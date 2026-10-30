// NEMORA inbox: receives contact-form messages from nemora.uk and serves a private admin to read them.
// No passwords, keys or tokens live in this code. The admin login is created once at /admin using
// the SETUP_CODE secret (set in Cloudflare), and only a PBKDF2 hash of the password is stored.
//
// Settings (Cloudflare > Workers > nemora-inbox > Settings > Variables and secrets):
//   SETUP_CODE      secret  a phrase of 8+ characters, used once to create the admin login
//   SITE_ORIGINS    text    optional, comma-separated sites allowed to send messages (default https://nemora.uk)
//   RESEND_API_KEY  secret  optional, turns on an email alert for each new message
//   ALERT_TO        text    optional, where alerts go (default daniel@nemora.uk)
//   ALERT_FROM      text    optional, a sender on a domain verified in Resend
//
// Visit statistics (D1 binding DB): cookieless. Each page view stores the page, referring site, device type and
// country. Unique visitors are counted with a hash of IP + browser + a random salt that changes every day; the IP
// itself is never stored and the hash can't be linked across days or back to a person. Rows are kept 13 months.

import { adminBiz } from './biz.js';

const SESSION_TTL = 8 * 60 * 60;
const COOKIE = '__Host-nemora_admin';
const MAX_FAILS = 5, LOCK_SECONDS = 15 * 60;
const KEEP_LOG = 200;
const KEEP_MESSAGES = 2 * 365 * 86400;          // messages delete themselves after 2 years (privacy notice)
const PER_IP_HOUR = 5, PER_DAY = 200;           // spam limits
const MSG_ID = /^\d{13}-[a-f0-9]{8}$/;
const PACKAGES = ['starter', 'business', 'premium', 'bigger', ''];
const NEEDS = ['A new website', 'A redesign of my current website', 'A booking, membership or payment system', 'Not sure yet'];
const ADMIN_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";

export default {
  async fetch(request, env, ctx) {
    try { return await route(request, env, ctx); }
    catch (err) { console.error(err && err.stack || err); return json({ error: 'Something went wrong on our side. Please try again.' }, 500); }
  },
  // daily: delete visit statistics older than 13 months
  async scheduled(event, env, ctx) {
    if (env.DB) ctx.waitUntil(env.DB.prepare('DELETE FROM hits WHERE ts < ?').bind(Date.now() - 400 * 86400000).run());
  }
};

async function route(req, env, ctx) {
  const url = new URL(req.url), p = url.pathname, m = req.method;

  // ---- public: the contact form on nemora.uk ----
  if (p === '/api/form-token' || p === '/api/enquiry' || p === '/api/hit') {
    const cors = corsHeaders(req, env);
    if (m === 'OPTIONS') return cors ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status: 403 });
    if (!cors) return json({ error: 'Request blocked for security reasons.' }, 403);
    if (p === '/api/form-token' && m === 'GET') return json({ token: await formToken(env) }, 200, cors);
    if (p === '/api/enquiry' && m === 'POST') return enquiry(req, env, ctx, cors);
    if (p === '/api/hit' && m === 'POST') return hit(req, env, ctx, cors);
    return json({ error: 'Method not allowed.' }, 405, cors);
  }

  // ---- admin ----
  if (p === '/' ) return redirect(url.origin + '/admin/');
  if (p === '/api/setup-state' && m === 'GET') { const cr = await credentials(env); return json({ needsSetup: !cr.hash, hasCode: !!env.SETUP_CODE }); }
  if (p === '/api/setup') return m === 'POST' ? setup(req, env, url) : notAllowed();
  if (p === '/api/login') return m === 'POST' ? login(req, env, url) : notAllowed();
  if (p === '/api/logout') return m === 'POST' ? logout(req, env, url) : notAllowed();
  if (p.startsWith('/api/admin/')) {
    const s = await getSession(req, env);
    if (!s) return json({ error: 'Your session has ended. Please log in again.' }, 401);
    if (m !== 'GET' && !sameOrigin(req, url)) return json({ error: 'Request blocked for security reasons.' }, 403);
    return adminApi(req, env, p.slice(11), m, s);
  }
  if (p.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
  if (p === '/admin') return redirect(url.origin + '/admin/');
  if (p === '/admin/app' || p === '/admin/app.html') {
    if (!(await getSession(req, env))) return redirect(url.origin + '/admin/');
    return adminHeaders(await env.ASSETS.fetch(new Request(url.origin + '/admin/app', { headers: req.headers })));
  }
  if (p.startsWith('/admin/') || p.startsWith('/assets/') || p === '/favicon.ico' || p === '/robots.txt') return adminHeaders(await env.ASSETS.fetch(req), p.startsWith('/assets/') || p === '/favicon.ico');
  return adminHeaders(new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
}

/* ---------------- public form ---------------- */
function allowedOrigins(env) {
  return String(env.SITE_ORIGINS || 'https://nemora.uk,https://www.nemora.uk').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
}
function corsHeaders(req, env) {
  const o = req.headers.get('origin');
  if (!o || !allowedOrigins(env).includes(o)) return null;
  return { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' };
}

async function enquiry(req, env, ctx, cors) {
  if (!/^application\/json/i.test(req.headers.get('content-type') || '')) return json({ error: "Your message didn't come through. Please try again." }, 415, cors);
  const b = await readJson(req, 16 * 1024);
  if (!b) return json({ error: "Your message didn't come through. Please try again." }, 400, cors);
  // bots: hidden box filled in, sent too fast, or no valid form token. Pretend it worked so they learn nothing.
  if (String(b.website || '').trim() || !(await checkToken(env, b.t))) return json({ ok: true }, 200, cors);

  const cl = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '').replace(/\r/g, '').trim().slice(0, max);
  const one = s => s.replace(/\s+/g, ' ');
  const v = {
    name: one(cl(b.name, 80)), email: cl(b.email, 120).toLowerCase(), phone: one(cl(b.phone, 30)), business: one(cl(b.business, 100)),
    package: PACKAGES.includes(cl(b.package, 20)) ? cl(b.package, 20) : '', need: NEEDS.includes(cl(b.need, 80)) ? cl(b.need, 80) : 'Not sure yet',
    message: cl(b.message, 4000)
  };
  if (!v.name) return json({ error: 'Please add your name.', field: 'name' }, 422, cors);
  if (!/^[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}$/i.test(v.email)) return json({ error: "That email address doesn't look right.", field: 'email' }, 422, cors);
  if (v.phone && !/^[+0-9 ()-]{6,30}$/.test(v.phone)) return json({ error: "That phone number doesn't look right.", field: 'phone' }, 422, cors);
  if (v.message.length < 2) return json({ error: 'Please tell us a little about your business.', field: 'message' }, 422, cors);

  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  const ipKey = 'erl:' + await sha256hex(ip), dayKey = 'eday:' + new Date().toISOString().slice(0, 10);
  const [n, d] = await Promise.all([env.KV.get(ipKey), env.KV.get(dayKey)]).then(a => a.map(x => parseInt(x, 10) || 0));
  if (n >= PER_IP_HOUR) return json({ error: "You've sent a few messages already. Please wait an hour, or email us at daniel@nemora.uk." }, 429, cors);
  if (d >= PER_DAY) return json({ error: 'We are getting a lot of messages right now. Please email us at daniel@nemora.uk.' }, 429, cors);
  await Promise.all([env.KV.put(ipKey, String(n + 1), { expirationTtl: 3600 }), env.KV.put(dayKey, String(d + 1), { expirationTtl: 2 * 86400 })]);

  const now = Date.now(), id = String(9999999999999 - now).padStart(13, '0') + '-' + randomHex(4);
  const rec = { id, at: new Date(now).toISOString(), status: 'new', notes: '', ...v };
  await env.KV.put('msg:' + id, JSON.stringify(rec), { expirationTtl: KEEP_MESSAGES, metadata: meta(rec) });
  ctx.waitUntil(record(req, env, { kind: 'enquiry', path: '/contact.html', ref: '', w: 0 }).catch(e => console.error('stat failed', e)));
  if (env.RESEND_API_KEY && env.ALERT_FROM) ctx.waitUntil(alert(env, rec, new URL(req.url).origin).catch(e => console.error('alert failed', e)));
  return json({ ok: true }, 200, cors);
}
const meta = r => ({ s: r.status, n: r.name.slice(0, 60), b: (r.business || '').slice(0, 60), at: r.at, p: r.package || '', ex: r.message.slice(0, 100) });

// optional email alert (only the sender's name and business, no message contents, so nothing sensitive sits in email)
async function alert(env, rec, origin) {
  const to = String(env.ALERT_TO || 'daniel@nemora.uk').trim();
  const text = `New message from ${rec.name}${rec.business ? ' (' + rec.business + ')' : ''}.\n\nRead and reply in the admin: ${origin}/admin/\n`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.ALERT_FROM, to: [to], subject: 'New website enquiry: ' + rec.name.slice(0, 60), text })
  });
}

/* ---------------- visit statistics (cookieless) ---------------- */
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python|java\/|go-http|facebookexternalhit|whatsapp|telegram|discord|embedly|bing|yandex|semrush|ahrefs/i;
async function hit(req, env, ctx, cors) {
  const done = new Response(null, { status: 204, headers: cors });
  if (!env.DB || BOT.test(req.headers.get('user-agent') || '')) return done;
  const b = await readJson(req, 2048);
  if (!b) return done;
  let path = String(b.p || '/').split(/[?#]/)[0].slice(0, 120);
  if (!/^\/[A-Za-z0-9._\-\/%]*$/.test(path)) return done;
  path = path.replace(/\/index\.html$/, '/');
  let ref = '';
  try { const r = new URL(String(b.r || '')); const host = r.hostname.replace(/^www\./, ''); if (!allowedOrigins(env).some(o => new URL(o).hostname.replace(/^www\./, '') === host)) ref = host.slice(0, 80); } catch (e) {}
  ctx.waitUntil(record(req, env, { kind: 'view', path, ref, w: Number(b.w) || 0 }).catch(e => console.error('stat failed', e)));
  return done;
}
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS hits (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL, path TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '', visitor TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'view')"),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS hits_day ON hits(day)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS hits_ts ON hits(ts)')
  ]);
  schemaReady = true;
}
async function record(req, env, { kind, path, ref, w }) {
  if (!env.DB) return;
  await ensureSchema(env);
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  const visitor = (await sha256hex((await dailySalt(env, day)) + '|' + (req.headers.get('cf-connecting-ip') || '') + '|' + (req.headers.get('user-agent') || ''))).slice(0, 16);
  // flood guard: at most 60 page views a minute from one visitor
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM hits WHERE visitor = ? AND ts > ?').bind(visitor, now - 60000).first();
  if (recent && recent.n >= 60) return;
  const device = !w ? '' : w < 768 ? 'Phone' : w < 1100 ? 'Tablet' : 'Desktop';
  const country = String((req.cf && req.cf.country) || '').slice(0, 2);
  await env.DB.prepare('INSERT INTO hits (ts, day, path, ref, device, country, visitor, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(now, day, path, ref, device, country, visitor, kind).run();
}
async function dailySalt(env, day) {
  let s = await env.KV.get('salt:' + day);
  if (!s) { s = randomHex(32); await env.KV.put('salt:' + day, s, { expirationTtl: 2 * 86400 }); }
  return s;
}
async function traffic(env, days) {
  if (!env.DB) return { enabled: false };
  await ensureSchema(env);
  const d = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const from = d(days - 1), prevFrom = d(2 * days - 1), prevTo = d(days);
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a);
  const [cur, prev, series, pages, refs, devices, countries, live] = await env.DB.batch([
    q("SELECT COUNT(DISTINCT day || visitor) AS visitors, SUM(kind = 'view') AS views, SUM(kind = 'enquiry') AS enquiries FROM hits WHERE day >= ?", from),
    q("SELECT COUNT(DISTINCT day || visitor) AS visitors, SUM(kind = 'view') AS views, SUM(kind = 'enquiry') AS enquiries FROM hits WHERE day >= ? AND day <= ?", prevFrom, prevTo),
    q("SELECT day, COUNT(DISTINCT visitor) AS visitors, SUM(kind = 'view') AS views FROM hits WHERE day >= ? GROUP BY day ORDER BY day", from),
    q("SELECT path AS label, COUNT(*) AS views, COUNT(DISTINCT day || visitor) AS visitors FROM hits WHERE day >= ? AND kind = 'view' GROUP BY path ORDER BY views DESC LIMIT 10", from),
    q("SELECT ref AS label, COUNT(DISTINCT day || visitor) AS visitors FROM hits WHERE day >= ? AND kind = 'view' AND ref != '' GROUP BY ref ORDER BY visitors DESC LIMIT 10", from),
    q("SELECT device AS label, COUNT(DISTINCT day || visitor) AS visitors FROM hits WHERE day >= ? AND kind = 'view' AND device != '' GROUP BY device ORDER BY visitors DESC", from),
    q("SELECT country AS label, COUNT(DISTINCT day || visitor) AS visitors FROM hits WHERE day >= ? AND kind = 'view' AND country != '' GROUP BY country ORDER BY visitors DESC LIMIT 8", from),
    q('SELECT COUNT(DISTINCT visitor) AS n FROM hits WHERE ts > ?', Date.now() - 30 * 60000)
  ]);
  const one = r => (r.results && r.results[0]) || {};
  return { enabled: true, days, from, totals: one(cur), previous: one(prev), series: series.results, pages: pages.results, referrers: refs.results, devices: devices.results, countries: countries.results, live: one(live).n || 0 };
}

async function formKey(env) {
  let k = await env.KV.get('formkey');
  if (!k) { k = randomHex(32); await env.KV.put('formkey', k); }
  return k;
}
async function formToken(env) { const ts = String(Date.now()); return ts + '.' + (await hmac(await formKey(env), ts)).slice(0, 32); }
async function checkToken(env, tok) {
  const [ts, sig] = String(tok || '').split('.');
  if (!/^\d{13}$/.test(ts || '') || !sig) return false;
  const age = Date.now() - Number(ts);
  if (age < 3000 || age > 86400000) return false;
  return bytesEqual(new TextEncoder().encode(sig), new TextEncoder().encode((await hmac(await formKey(env), ts)).slice(0, 32)));
}
async function hmac(keyHex, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(keyHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))));
}

/* ---------------- admin API ---------------- */
async function adminApi(req, env, path, m, s) {
  if (path === 'me' && m === 'GET') return json({ username: s.u, expires: s.exp, unread: (await listMessages(env)).filter(e => e.status === 'new').length });
  if (path === 'messages' && m === 'GET') return json({ messages: await listMessages(env) });
  if (path.startsWith('traffic') && m === 'GET') { const days = [7, 30, 90].includes(Number(new URL(req.url).searchParams.get('days'))) ? Number(new URL(req.url).searchParams.get('days')) : 30; return json(await traffic(env, days)); }
  if (path.startsWith('messages/')) {
    const id = path.slice(9);
    if (!MSG_ID.test(id)) return json({ error: 'That message could not be found.' }, 404);
    const r = await env.KV.getWithMetadata('msg:' + id);
    const rec = r && r.value ? JSON.parse(r.value) : null;
    if (!rec) return json({ error: 'That message could not be found. It may have been deleted.' }, 404);
    if (m === 'GET') {
      if (rec.status === 'new') { rec.status = 'read'; await putMsg(env, rec); }
      return json({ message: rec });
    }
    if (m === 'PATCH') {
      const b = (await readJson(req)) || {};
      if (b.status !== undefined) { if (!['new', 'read', 'replied', 'archived'].includes(b.status)) return json({ error: 'Unknown status.' }, 422); rec.status = b.status; }
      if (b.notes !== undefined) rec.notes = String(b.notes).replace(/\r/g, '').slice(0, 2000);
      await putMsg(env, rec);
      return json({ ok: true, message: rec });
    }
    if (m === 'DELETE') { await env.KV.delete('msg:' + id); await log(env, req, s.u, 'Deleted a message from ' + rec.name.slice(0, 40)); return json({ ok: true }); }
    return notAllowed();
  }
  if (path === 'activity' && m === 'GET') return json({ log: (await env.KV.get('log', 'json')) || [] });
  if (path === 'account' && m === 'POST') {
    const b = (await readJson(req)) || {};
    const creds = await credentials(env);
    const rl = await rateLimited(env, req);
    if (rl.blocked) return json({ error: 'Too many attempts. Please wait 15 minutes and try again.' }, 429);
    if (!(await verifyPassword(String(b.current || '').slice(0, 200), creds.hash))) { await fail(env, rl); await log(env, req, s.u, 'Failed attempt to change login details'); return json({ error: 'Your current password is wrong.' }, 403); }
    const newUser = String(b.username || '').trim(), newPass = String(b.password || '');
    if (!newUser && !newPass) return json({ error: 'Enter a new username, a new password, or both.' }, 422);
    if (newUser && !/^[A-Za-z0-9._@-]{3,60}$/.test(newUser)) return json({ error: 'Usernames can use letters, numbers, dots, dashes and @, from 3 to 60 characters.' }, 422);
    if (newPass) { const err = checkNewLogin(newUser || creds.user, newPass); if (err) return json({ error: err }, 422); }
    if (newPass) await env.KV.put('auth:hash', await hashPassword(newPass));
    if (newUser) await env.KV.put('auth:user', newUser);
    const cookie = await bumpGeneration(env, newUser || s.u);
    await log(env, req, newUser || s.u, newPass && newUser ? 'Changed username and password' : newPass ? 'Changed password' : 'Changed username');
    return json({ ok: true }, 200, { 'Set-Cookie': cookie });
  }
  if (path === 'logout-others' && m === 'POST') {
    const cookie = await bumpGeneration(env, s.u);
    await log(env, req, s.u, 'Logged out all other devices');
    return json({ ok: true }, 200, { 'Set-Cookie': cookie });
  }
  let extra = {};
  if (path === 'dashboard' && m === 'GET') {
    const [msgs, t] = await Promise.all([listMessages(env), traffic(env, 7)]);
    extra = { unread: msgs.filter(e => e.status === 'new').length, latestMessages: msgs.filter(e => e.status !== 'archived').slice(0, 4),
      visitors: t.enabled ? { week: t.totals.visitors || 0, prev: t.previous.visitors || 0, views: t.totals.views || 0, live: t.live, series: t.series, from: t.from } : null };
  }
  const biz = await adminBiz(req, env, path, m, readJson, action => log(env, req, s.u, action), s.u, extra);
  if (biz) return biz;
  return json({ error: 'Not found.' }, 404);
}
async function putMsg(env, rec) {
  const left = Math.max(60, Math.floor((Date.parse(rec.at) + KEEP_MESSAGES * 1000 - Date.now()) / 1000));
  await env.KV.put('msg:' + rec.id, JSON.stringify(rec), { expirationTtl: left, metadata: meta(rec) });
}
async function listMessages(env) {
  const out = [];
  let cursor;
  do {
    const r = await env.KV.list({ prefix: 'msg:', cursor });
    for (const k of r.keys) { const md = k.metadata || {}; out.push({ id: k.name.slice(4), status: md.s, name: md.n, business: md.b, at: md.at, package: md.p, excerpt: md.ex }); }
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return out;
}
async function log(env, req, user, action) {
  try {
    const cf = req.cf || {};
    const cur = (await env.KV.get('log', 'json')) || [];
    cur.unshift({ at: new Date().toISOString(), user: String(user || '').slice(0, 60), action, where: [cf.city, cf.country].filter(Boolean).join(', ') });
    await env.KV.put('log', JSON.stringify(cur.slice(0, KEEP_LOG)));
  } catch (e) { console.error('log failed', e); }
}

/* ---------------- setup, login and sessions ---------------- */
async function credentials(env) {
  const [u, h] = await Promise.all([env.KV.get('auth:user'), env.KV.get('auth:hash')]);
  return { user: String(u || '').trim(), hash: String(h || '').trim() };
}
function checkNewLogin(user, pass) {
  if (pass.length < 12) return 'The password must be at least 12 characters.';
  if (pass.length > 200) return 'The password is too long.';
  if (user && pass.toLowerCase().includes(user.toLowerCase())) return "The password can't contain your username.";
  if (/^(.)\1+$/.test(pass) || /^(password|nemora|qwerty|123456)/i.test(pass)) return 'Please choose a less guessable password.';
  return '';
}
async function rateLimited(env, req) {
  const key = 'rl:' + await sha256hex(req.headers.get('cf-connecting-ip') || 'unknown');
  const rl = (await env.KV.get(key, 'json')) || { n: 0 };
  return { key, n: rl.n, blocked: rl.n >= MAX_FAILS };
}
async function fail(env, rl) { await env.KV.put(rl.key, JSON.stringify({ n: rl.n + 1 }), { expirationTtl: LOCK_SECONDS }); return MAX_FAILS - rl.n - 1; }

async function setup(req, env, url) {
  if (!sameOrigin(req, url)) return json({ error: 'Request blocked for security reasons.' }, 403);
  if ((await credentials(env)).hash) return json({ error: 'The admin login is already set up. Log in instead.' }, 409);
  if (!env.SETUP_CODE || String(env.SETUP_CODE).length < 8) return json({ error: 'Add a secret called SETUP_CODE (at least 8 characters) in Cloudflare first.' }, 503);
  const rl = await rateLimited(env, req);
  if (rl.blocked) return json({ error: 'Too many attempts. Please wait 15 minutes and try again.' }, 429);
  const b = (await readJson(req)) || {};
  if (!(await safeEqual(String(b.code || '').slice(0, 200), String(env.SETUP_CODE)))) { const left = await fail(env, rl); return json({ error: left > 0 ? `That setup code is wrong. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many attempts. Please wait 15 minutes and try again.' }, left > 0 ? 403 : 429); }
  const user = String(b.username || '').trim(), pass = String(b.password || '');
  if (!/^[A-Za-z0-9._@-]{3,60}$/.test(user)) return json({ error: 'Usernames can use letters, numbers, dots, dashes and @, from 3 to 60 characters.' }, 422);
  const err = checkNewLogin(user, pass);
  if (err) return json({ error: err }, 422);
  await env.KV.put('auth:user', user);
  await env.KV.put('auth:hash', await hashPassword(pass));
  await env.KV.delete(rl.key);
  await log(env, req, user, 'Set up the admin login');
  return json({ ok: true }, 200, { 'Set-Cookie': await newSession(env, user) });
}

const generation = async env => parseInt(await env.KV.get('auth:gen'), 10) || 0;
async function newSession(env, user) {
  const id = randomHex(32), exp = Date.now() + SESSION_TTL * 1000, gen = await generation(env);
  await env.KV.put('sess:' + await sha256hex(id), JSON.stringify({ u: user, exp, gen }), { expirationTtl: SESSION_TTL });
  return `${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`;
}
async function bumpGeneration(env, user) { await env.KV.put('auth:gen', String((await generation(env)) + 1)); return newSession(env, user); }

async function login(req, env, url) {
  if (!sameOrigin(req, url)) return json({ error: 'Request blocked for security reasons.' }, 403);
  const creds = await credentials(env);
  if (!creds.user || !creds.hash) return json({ error: "The admin login hasn't been set up yet.", setup: true }, 503);
  const rl = await rateLimited(env, req);
  if (rl.blocked) return json({ error: 'Too many attempts. Please wait 15 minutes and try again.' }, 429);
  const body = (await readJson(req)) || {};
  const u = String(body.username || '').slice(0, 100), pw = String(body.password || '').slice(0, 200);
  const okUser = await safeEqual(u.trim().toLowerCase(), creds.user.toLowerCase());
  const okPass = await verifyPassword(pw, creds.hash);
  if (!(okUser && okPass)) {
    const left = await fail(env, rl);
    await log(env, req, '', 'Failed login');
    return left > 0 ? json({ error: `Wrong username or password. ${left} attempt${left === 1 ? '' : 's'} left.` }, 401) : json({ error: 'Too many attempts. Please wait 15 minutes and try again.' }, 429);
  }
  await env.KV.delete(rl.key);
  await log(env, req, creds.user, 'Logged in');
  return json({ ok: true }, 200, { 'Set-Cookie': await newSession(env, creds.user) });
}
async function logout(req, env, url) {
  if (!sameOrigin(req, url)) return json({ error: 'Request blocked for security reasons.' }, 403);
  const id = readCookie(req);
  if (id) await env.KV.delete('sess:' + await sha256hex(id));
  return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
}
async function getSession(req, env) {
  const id = readCookie(req);
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  const s = await env.KV.get('sess:' + await sha256hex(id), 'json');
  if (!s || s.exp < Date.now()) return null;
  if ((s.gen || 0) !== (await generation(env))) return null;
  return s;
}
function readCookie(req) {
  for (const part of (req.headers.get('cookie') || '').split(';')) { const i = part.indexOf('='); if (i > -1 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim(); }
  return null;
}
function sameOrigin(req, url) {
  const o = req.headers.get('origin');
  if (o) return o === url.origin;
  const r = req.headers.get('referer');
  return !!r && r.startsWith(url.origin + '/');
}

/* password hash format: pbkdf2$<iterations>$<salt b64>$<hash b64> */
async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), it = 100000;
  return `pbkdf2$${it}$${b64e(salt)}$${b64e(await pbkdf2(pw, salt, it))}`;
}
async function verifyPassword(pw, stored) {
  const parts = String(stored || '').trim().split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') { await pbkdf2(pw, new Uint8Array(16), 100000); return false; }
  const it = Math.min(parseInt(parts[1], 10) || 1, 100000);
  return bytesEqual(await pbkdf2(pw, b64d(parts[2]), it), b64d(parts[3]));
}
async function pbkdf2(pw, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}
async function safeEqual(a, b) {
  const ha = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(a)));
  const hb = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(b)));
  return bytesEqual(ha, hb) && a.length > 0;
}
function bytesEqual(a, b) { if (a.length !== b.length || !a.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
async function sha256hex(s) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))); }
function randomHex(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return hex(b); }
const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
const b64e = b => btoa(String.fromCharCode(...b));
function b64d(s) { try { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); } catch { return new Uint8Array(0); } }

/* ---------------- helpers ---------------- */
async function readJson(req, max = 64 * 1024) {
  try { const t = await req.text(); if (t.length > max) return null; const v = JSON.parse(t); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Strict-Transport-Security': 'max-age=31536000', ...extra } });
}
const redirect = to => new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } });
const notAllowed = () => json({ error: 'Method not allowed.' }, 405);
function adminHeaders(res, cacheable = false) {
  const r = new Response(res.body, res);
  r.headers.set('Content-Security-Policy', ADMIN_CSP);
  r.headers.set('X-Frame-Options', 'DENY');
  r.headers.set('X-Robots-Tag', 'noindex, nofollow');
  r.headers.set('Referrer-Policy', 'same-origin');  // not no-referrer: that makes browsers send Origin: null and blocks logins
  r.headers.set('Cache-Control', cacheable ? 'public, max-age=86400' : 'no-store');
  r.headers.set('X-Content-Type-Options', 'nosniff');
  r.headers.set('Strict-Transport-Security', 'max-age=31536000');
  r.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  r.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return r;
}
