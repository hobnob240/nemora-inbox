// NEMORA social: a queue of Facebook Page and Instagram posts, published straight to Meta's Graph API.
// The social media agent (a scheduled Claude task) writes posts into D1; photos and text are approved by the
// playbook, videos wait for Charlie's tap in the admin. This Worker publishes due posts every 15 minutes.
//
// Settings (Cloudflare > Workers > nemora-inbox > Settings > Variables and secrets):
//   META_APP_ID           text    the Meta app's App ID (Meta for Developers > your app > App settings > Basic)
//   META_APP_SECRET       secret  the same page's App secret (never put it anywhere else)
//   META_LOGIN_CONFIG_ID  text    the Facebook Login for Business configuration ID (Use cases > Customize > Settings)
//   With those three set, Charlie taps "Connect Facebook and Instagram" in the admin, logs in with Facebook and picks the Page.
//   The Worker swaps the login for a Page token that doesn't expire and keeps it encrypted in KV; it is never sent to the browser.
//   META_PAGE_TOKEN       secret  optional: a Page token pasted by hand instead of using the Connect button
//   MEDIA_ORIGIN      text    optional, where post media lives (default https://nemora.uk/social/)
//   META_API_VERSION  text    optional, Graph API version (default v23.0)
//   META_API_BASE     text    optional, only for testing (default https://graph.facebook.com)

export const SOCIAL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS social_posts (id TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'image', platforms TEXT NOT NULL DEFAULT 'fb,ig', caption TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '', media TEXT NOT NULL DEFAULT '[]', scheduled_at TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'needs_approval', needs_approval INTEGER NOT NULL DEFAULT 1, idea TEXT NOT NULL DEFAULT '', feedback TEXT NOT NULL DEFAULT '', fb_id TEXT NOT NULL DEFAULT '', fb_url TEXT NOT NULL DEFAULT '', ig_container TEXT NOT NULL DEFAULT '', ig_children TEXT NOT NULL DEFAULT '', ig_id TEXT NOT NULL DEFAULT '', ig_url TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', attempts INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'agent', approved_at TEXT NOT NULL DEFAULT '', posted_at TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS social_due ON social_posts(status, scheduled_at)`
];
export const KINDS = ['image', 'carousel', 'reel', 'text'];
const LIVE = ['approved', 'publishing'];
const now = () => new Date().toISOString();
const graphBase = env => (env.META_API_BASE || 'https://graph.facebook.com').replace(/\/$/, '') + '/' + (env.META_API_VERSION || 'v23.0');
export const mediaOrigin = env => String(env.MEDIA_ORIGIN || 'https://nemora.uk/social/');
const parse = (s, f) => { try { return JSON.parse(s); } catch (e) { return f; } };

async function graph(env, method, path, params = {}) {
  const url = new URL(graphBase(env) + path);
  const opts = { method, headers: {}, signal: AbortSignal.timeout(25000) };
  const tok = 'access_token' in params ? params.access_token : await pageToken(env);
  const p = new URLSearchParams(params); if (tok) p.set('access_token', tok); else p.delete('access_token');
  if (method === 'GET') url.search = p.toString(); else { opts.body = p; opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
  const r = await fetch(url, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    const e = d.error || {};
    // never echo the token back: Meta errors don't contain it, but strip anything token-like just in case
    throw new Error(String(e.error_user_msg || e.message || 'Meta returned HTTP ' + r.status).replace(/access_token=[^&\s]+/g, 'access_token=…').slice(0, 300));
  }
  return d;
}

/* ---------- the Page token: a Cloudflare secret, or the encrypted one saved by the Connect button ---------- */
const SCOPES = 'pages_show_list,pages_read_engagement,pages_manage_posts,business_management,instagram_basic,instagram_content_publish,instagram_manage_insights,read_insights';
let tokCache = { at: 0, val: '' };
const b64 = u8 => btoa(String.fromCharCode(...u8)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function tokenKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nemora-meta-token:' + String(env.META_APP_SECRET || '')));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await tokenKey(env), new TextEncoder().encode(text)));
  return b64(iv) + '.' + b64(ct);
}
async function unseal(env, box) {
  try { const [iv, ct] = String(box).split('.'); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await tokenKey(env), unb64(ct))); }
  catch (e) { return ''; }
}
export async function pageToken(env) {
  if (env.META_PAGE_TOKEN) return env.META_PAGE_TOKEN;
  if (!env.META_APP_SECRET) return '';
  if (Date.now() - tokCache.at < 60000) return tokCache.val;
  const box = await env.KV.get('meta:token');
  tokCache = { at: Date.now(), val: box ? await unseal(env, box) : '' };
  return tokCache.val;
}
const canConnect = env => !!(env.META_APP_ID && env.META_APP_SECRET && env.META_LOGIN_CONFIG_ID);
const redirectUri = url => url.origin + '/meta/callback';
const rid = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');

// step 1 (admin, logged in): a one-time state, then off to Facebook's login
async function connectStart(env, url) {
  const state = rid();
  await env.KV.put('meta:state:' + state, '1', { expirationTtl: 600 });
  const q = new URLSearchParams({ client_id: env.META_APP_ID, redirect_uri: redirectUri(url), state, response_type: 'code', config_id: env.META_LOGIN_CONFIG_ID });
  return 'https://www.facebook.com/' + (env.META_API_VERSION || 'v23.0') + '/dialog/oauth?' + q.toString();
}
// step 2 (Facebook sends the browser back here): check the state, swap the code for a long-lived login, list the Pages
export async function metaCallback(req, env, url) {
  // a same-site hop back into the admin, so the (SameSite=Strict) login cookie is sent again
  const back = () => new Response('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/admin/app#social"><title>Back to NEMORA</title><p><a href="/admin/app#social">Back to the NEMORA admin</a></p>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" } });
  const fail = async (msg) => { await env.KV.put('meta:connect-error', msg.slice(0, 300), { expirationTtl: 900 }); return back(); };
  const state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
  if (!/^[0-9a-f]{48}$/.test(state) || !(await env.KV.get('meta:state:' + state))) return fail('That Facebook login had expired or did not start here. Tap Connect again.');
  await env.KV.delete('meta:state:' + state);
  if (!code) return fail(url.searchParams.get('error_description') || 'Facebook login was cancelled.');
  if (!canConnect(env)) return fail('META_APP_ID, META_APP_SECRET and META_LOGIN_CONFIG_ID need adding in Cloudflare first.');
  try {
    const t1 = await graph(env, 'GET', '/oauth/access_token', { client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, redirect_uri: redirectUri(url), code, access_token: '' });
    const t2 = await graph(env, 'GET', '/oauth/access_token', { grant_type: 'fb_exchange_token', client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, fb_exchange_token: t1.access_token, access_token: '' });
    const pages = await graph(env, 'GET', '/me/accounts', { fields: 'id,name,access_token,tasks,instagram_business_account{id,username}', limit: '50', access_token: t2.access_token });
    const list = (pages.data || []).filter(pg => pg.access_token).map(pg => ({ id: pg.id, name: pg.name || pg.id, ig: (pg.instagram_business_account || {}).username || '', canPost: (pg.tasks || []).some(t => ['CREATE_CONTENT', 'MANAGE'].includes(t)), token: pg.access_token }));
    if (!list.length) return fail('Facebook logged you in but shared no Pages. Tap Connect again and tick NEMORA\'s Page (and its Instagram account) when Facebook asks.');
    const sealed = await Promise.all(list.map(async pg => ({ ...pg, token: await seal(env, pg.token) })));
    await env.KV.put('meta:pending', JSON.stringify(sealed), { expirationTtl: 900 });
    await env.KV.delete('meta:connect-error');
    return back();
  } catch (e) { return fail('Facebook said: ' + e.message); }
}
// step 3 (admin): Charlie picks the Page; its token is kept encrypted. The browser only ever sees names.
async function connectAdmin(env, url, sub, m, body, log) {
  if (sub === 'start' && m === 'POST') {
    if (!canConnect(env)) return reply({ error: 'Add META_APP_ID, META_APP_SECRET and META_LOGIN_CONFIG_ID in Cloudflare first (see the steps).' }, 409);
    return reply({ url: await connectStart(env, url) });
  }
  if (sub === 'pending' && m === 'GET') {
    const list = (await env.KV.get('meta:pending', 'json')) || [];
    return reply({ pages: list.map(({ token, ...pg }) => pg), error: (await env.KV.get('meta:connect-error')) || '' });
  }
  if (sub === 'choose' && m === 'POST') {
    const list = (await env.KV.get('meta:pending', 'json')) || [];
    const pg = list.find(x => x.id === String(body.id || ''));
    if (!pg) return reply({ error: 'That choice has expired. Tap Connect again.' }, 409);
    await env.KV.put('meta:token', pg.token);
    await Promise.all([env.KV.delete('meta:pending'), env.KV.delete('meta:ids'), env.KV.delete('meta:connect-error')]);
    tokCache = { at: 0, val: '' };
    await log('Connected Facebook and Instagram (' + pg.name + ')');
    return reply(await connection(env));
  }
  if (sub === 'disconnect' && m === 'POST') {
    await Promise.all([env.KV.delete('meta:token'), env.KV.delete('meta:ids'), env.KV.delete('meta:pending')]);
    tokCache = { at: 0, val: '' };
    await log('Disconnected Facebook and Instagram');
    return reply(await connection(env));
  }
  return reply({ error: 'Not found.' }, 404);
}

// the Page and its linked Instagram account, read from the token itself (cached for a day)
export async function metaIds(env, fresh) {
  if (!(await pageToken(env))) return null;
  if (!fresh) { const c = await env.KV.get('meta:ids', 'json'); if (c) return c; }
  const me = await graph(env, 'GET', '/me', { fields: 'id,name,instagram_business_account{id,username}' });
  const ids = { page: me.id, pageName: me.name || '', ig: (me.instagram_business_account || {}).id || '', igName: (me.instagram_business_account || {}).username || '' };
  await env.KV.put('meta:ids', JSON.stringify(ids), { expirationTtl: 86400 });
  return ids;
}
export async function connection(env) {
  if (!(await pageToken(env))) return { connected: false, reason: 'missing', canConnect: canConnect(env) };
  try { const ids = await metaIds(env, true); return { connected: true, ...ids, igConnected: !!ids.ig, via: env.META_PAGE_TOKEN ? 'secret' : 'button', canConnect: canConnect(env) }; }
  catch (e) { return { connected: false, reason: 'error', error: e.message, canConnect: canConnect(env) }; }
}

// validation used by the admin (the agent writes through D1 and follows the playbook; the publisher re-checks)
export function checkPost(env, p) {
  const media = Array.isArray(p.media) ? p.media : parse(p.media, []);
  const origin = mediaOrigin(env);
  if (!KINDS.includes(p.kind)) return 'Unknown post type.';
  if (media.some(u => typeof u !== 'string' || !u.startsWith(origin) || /[\s"'<>]/.test(u))) return 'Media must be hosted at ' + origin;
  if (p.kind === 'image' && media.length !== 1) return 'A photo post needs exactly one image.';
  if (p.kind === 'carousel' && (media.length < 2 || media.length > 10)) return 'A carousel needs 2 to 10 images.';
  if (p.kind === 'reel' && media.length !== 1) return 'A video post needs exactly one video.';
  if (p.kind === 'text' && media.length) return 'A text post has no media.';
  if (['image', 'carousel'].includes(p.kind) && media.some(u => !/\.jpe?g$/i.test(u))) return 'Instagram only takes JPEG photos (.jpg).';
  if (p.kind === 'reel' && !/\.mp4$/i.test(media[0])) return 'Videos must be MP4.';
  if (String(p.caption || '').length > 2200) return 'Captions can be at most 2,200 characters (Instagram limit).';
  if ((String(p.caption || '').match(/#[\p{L}\p{N}_]+/gu) || []).length > 30) return 'At most 30 hashtags.';
  return '';
}

// publish everything that's due. Returns a short summary for the log.
export async function publishDue(env) {
  if (!(await pageToken(env))) return [];
  for (const s of SOCIAL_SCHEMA) await env.DB.prepare(s).run();
  const due = (await env.DB.prepare(`SELECT * FROM social_posts WHERE status IN ('approved', 'publishing') AND scheduled_at != '' AND scheduled_at <= ? ORDER BY scheduled_at LIMIT 5`).bind(now()).all()).results || [];
  const out = [];
  for (const p of due) out.push(await publishOne(env, p).catch(e => ({ id: p.id, error: e.message })));
  return out;
}

export async function publishOne(env, p) {
  const err = checkPost(env, p);
  const set = async (f) => { const k = Object.keys(f); await env.DB.prepare(`UPDATE social_posts SET ${k.map(x => x + ' = ?').join(', ')}, updated = ? WHERE id = ?`).bind(...k.map(x => f[x]), now(), p.id).run(); Object.assign(p, f); };
  if (err) { await set({ status: 'failed', error: err }); return { id: p.id, error: err }; }
  const ids = await metaIds(env);
  const media = parse(p.media, []), plats = p.platforms.split(',');
  try {
    await set({ status: 'publishing' });
    // ---- Facebook Page ----
    if (plats.includes('fb') && !p.fb_id) {
      let r;
      if (p.kind === 'image') r = await graph(env, 'POST', `/${ids.page}/photos`, { url: media[0], caption: p.caption });
      else if (p.kind === 'carousel') {
        const att = [];
        for (const u of media) att.push((await graph(env, 'POST', `/${ids.page}/photos`, { url: u, published: 'false' })).id);
        const params = { message: p.caption }; att.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
        r = await graph(env, 'POST', `/${ids.page}/feed`, params);
      }
      else if (p.kind === 'reel') r = await graph(env, 'POST', `/${ids.page}/videos`, { file_url: media[0], description: p.caption });
      else r = await graph(env, 'POST', `/${ids.page}/feed`, p.link ? { message: p.caption, link: p.link } : { message: p.caption });
      const pid = r.post_id || r.id;
      await set({ fb_id: String(pid), fb_url: p.kind === 'reel' ? 'https://www.facebook.com/watch/?v=' + pid : 'https://www.facebook.com/' + pid });
    }
    // ---- Instagram (no text-only posts on Instagram) ----
    if (plats.includes('ig') && p.kind !== 'text' && !p.ig_id) {
      if (!ids.ig) throw new Error('No Instagram business account is linked to the Facebook Page.');
      if (!p.ig_container) {
        let c;
        if (p.kind === 'image') c = await graph(env, 'POST', `/${ids.ig}/media`, { image_url: media[0], caption: p.caption });
        else if (p.kind === 'carousel') {
          const kids = [];
          for (const u of media) kids.push((await graph(env, 'POST', `/${ids.ig}/media`, { image_url: u, is_carousel_item: 'true' })).id);
          await set({ ig_children: kids.join(',') });
          c = await graph(env, 'POST', `/${ids.ig}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption: p.caption });
        }
        else c = await graph(env, 'POST', `/${ids.ig}/media`, { media_type: 'REELS', video_url: media[0], caption: p.caption, share_to_feed: 'true' });
        await set({ ig_container: c.id });
      }
      const st = await graph(env, 'GET', `/${p.ig_container}`, { fields: 'status_code' });
      if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') { await set({ ig_container: '' }); throw new Error('Instagram could not process the media (' + st.status_code + '). Check the file format.'); }
      if (st.status_code !== 'FINISHED') return { id: p.id, waiting: true };   // videos take a minute; try again next run
      const pub = await graph(env, 'POST', `/${ids.ig}/media_publish`, { creation_id: p.ig_container });
      let link = '';
      try { link = (await graph(env, 'GET', `/${pub.id}`, { fields: 'permalink' })).permalink || ''; } catch (e) {}
      await set({ ig_id: String(pub.id), ig_url: link });
    }
    await set({ status: 'posted', posted_at: now(), error: '' });
    return { id: p.id, posted: true };
  } catch (e) {
    const attempts = (p.attempts || 0) + 1;
    await set({ status: attempts >= 3 ? 'failed' : 'approved', attempts, error: e.message });
    return { id: p.id, error: e.message };
  }
}

/* ---------- results: reach and engagement from Meta for 30 days after a post goes out ----------
   Stored as JSON in social_posts.insights ({ fb: {...}, ig: {...}, error }) so Charlie sees it in the admin and the
   social media agent can learn which posts work. Needs the read_insights and instagram_manage_insights permissions
   on the Page token. Never affects publishing: every call here is allowed to fail. */
const INSIGHT_COLS = [['insights', "TEXT NOT NULL DEFAULT '{}'"], ['insights_at', "TEXT NOT NULL DEFAULT ''"]];
export async function ensureInsightCols(env) {
  if (env.KV && await env.KV.get('social:cols:v1')) return;
  const cols = ((await env.DB.prepare('PRAGMA table_info(social_posts)').all()).results || []).map(c => c.name);
  for (const [c, t] of INSIGHT_COLS) if (!cols.includes(c)) await env.DB.prepare(`ALTER TABLE social_posts ADD COLUMN ${c} ${t}`).run();
  if (env.KV) await env.KV.put('social:cols:v1', '1');
}
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(+v)) ? undefined : +v;
const firstVal = d => { const x = (d && d.data && d.data[0]) || {}; return num(x.total_value ? x.total_value.value : x.values && x.values[0] ? x.values[0].value : undefined); };
// try a list of metric names in one call; if Meta rejects the list, try each on its own
async function metrics(env, path, names, extra = {}) {
  const out = {}; let lastErr = '';
  try {
    const d = await graph(env, 'GET', path, { metric: names.join(','), ...extra });
    for (const x of d.data || []) { const v = num(x.total_value ? x.total_value.value : x.values && x.values[0] ? x.values[0].value : undefined); if (v !== undefined) out[x.name] = v; }
    return { out, err: '' };
  } catch (e) { lastErr = e.message; }
  for (const m of names) { try { const v = firstVal(await graph(env, 'GET', path, { metric: m, ...extra })); if (v !== undefined) out[m] = v; } catch (e) { lastErr = e.message; } }
  return { out, err: Object.keys(out).length ? '' : lastErr };
}
export async function fetchInsights(env, p) {
  const res = {}; const errs = [];
  if (p.ig_id) {
    const ig = {};
    try { const d = await graph(env, 'GET', `/${p.ig_id}`, { fields: 'like_count,comments_count' }); ig.likes = num(d.like_count); ig.comments = num(d.comments_count); } catch (e) { errs.push('Instagram: ' + e.message); }
    const { out, err } = await metrics(env, `/${p.ig_id}/insights`, ['reach', 'views', 'saved', 'shares', 'total_interactions']);
    if (err) errs.push('Instagram insights: ' + err);
    Object.assign(ig, { reach: out.reach, views: out.views, saves: out.saved, shares: out.shares, interactions: out.total_interactions });
    res.ig = ig;
  }
  if (p.fb_id) {
    const fb = {};
    if (p.kind === 'reel') {
      try { const d = await graph(env, 'GET', `/${p.fb_id}`, { fields: 'likes.summary(true).limit(0),comments.summary(true).limit(0)' }); fb.likes = num(d.likes && d.likes.summary && d.likes.summary.total_count); fb.comments = num(d.comments && d.comments.summary && d.comments.summary.total_count); } catch (e) { errs.push('Facebook: ' + e.message); }
      const { out, err } = await metrics(env, `/${p.fb_id}/video_insights`, ['total_video_views_unique', 'total_video_views']);
      if (err) errs.push('Facebook insights: ' + err);
      fb.reach = out.total_video_views_unique; fb.views = out.total_video_views;
    } else {
      try { const d = await graph(env, 'GET', `/${p.fb_id}`, { fields: 'reactions.summary(true).limit(0),comments.summary(true).limit(0),shares' }); fb.reactions = num(d.reactions && d.reactions.summary && d.reactions.summary.total_count); fb.comments = num(d.comments && d.comments.summary && d.comments.summary.total_count); fb.shares = num((d.shares || {}).count) ?? 0; } catch (e) { errs.push('Facebook: ' + e.message); }
      const { out, err } = await metrics(env, `/${p.fb_id}/insights`, ['post_impressions_unique', 'post_clicks']);
      if (err) errs.push('Facebook insights: ' + err);
      fb.reach = out.post_impressions_unique; fb.clicks = out.post_clicks;
    }
    res.fb = fb;
  }
  const strip = o => o && Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const out = { fb: strip(res.fb), ig: strip(res.ig) };
  if (errs.length) out.error = errs.join(' | ').slice(0, 400);
  await env.DB.prepare('UPDATE social_posts SET insights = ?, insights_at = ? WHERE id = ?').bind(JSON.stringify(out), now(), p.id).run();
  return out;
}
// run hourly from the cron: refresh up to 2 posts that went out in the last 30 days and weren't checked in 6 hours
export async function refreshInsights(env, limit = 2) {
  if (!(await pageToken(env))) return [];
  for (const s of SOCIAL_SCHEMA) await env.DB.prepare(s).run();
  await ensureInsightCols(env);
  const since = new Date(Date.now() - 30 * 864e5).toISOString(), stale = new Date(Date.now() - 6 * 36e5).toISOString();
  const rows = (await env.DB.prepare(`SELECT * FROM social_posts WHERE status = 'posted' AND posted_at >= ? AND (insights_at = '' OR insights_at < ?) ORDER BY insights_at, posted_at DESC LIMIT ?`).bind(since, stale, limit).all()).results || [];
  const done = [];
  for (const p of rows) done.push(await fetchInsights(env, p).then(r => ({ id: p.id, ...r })).catch(e => ({ id: p.id, error: e.message })));
  return done;
}

/* ---------- admin API (session and same-origin already checked by worker.js) ---------- */
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
const clean = (v, max) => String(v == null ? '' : v).replace(CTRL, '').replace(/\r/g, '').slice(0, max);
const isoOk = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !isNaN(Date.parse(v));

export async function adminSocial(req, env, id, sub, m, body, log) {
  for (const s of SOCIAL_SCHEMA) await env.DB.prepare(s).run();
  const get = pid => env.DB.prepare('SELECT * FROM social_posts WHERE id = ?').bind(pid).first();
  await ensureInsightCols(env);
  const out = p => ({ ...p, media: parse(p.media, []), insights: parse(p.insights || '{}', {}) });
  if (!id) {
    if (m === 'GET') {
      const rows = (await env.DB.prepare(`SELECT * FROM social_posts ORDER BY CASE status WHEN 'needs_approval' THEN 0 WHEN 'failed' THEN 1 WHEN 'publishing' THEN 2 WHEN 'approved' THEN 3 ELSE 4 END, scheduled_at DESC LIMIT 200`).all()).results || [];
      return reply({ posts: rows.map(out), mediaOrigin: mediaOrigin(env), now: now() });
    }
    if (m === 'POST') {
      // a post Charlie writes himself in the admin
      const p = { kind: clean(body.kind, 20) || 'text', platforms: ['fb', 'ig', 'fb,ig'].includes(body.platforms) ? body.platforms : 'fb,ig', caption: clean(body.caption, 2200), link: '', media: JSON.stringify((Array.isArray(body.media) ? body.media : []).map(u => clean(u, 400)).slice(0, 10)), scheduled_at: isoOk(body.scheduled_at) ? new Date(body.scheduled_at).toISOString() : now() };
      const err = checkPost(env, p); if (err) return reply({ error: err }, 422);
      if (!p.caption.trim()) return reply({ error: 'Write a caption.' }, 422);
      const pid = 'sp_' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => b.toString(16).padStart(2, '0')).join('');
      await env.DB.prepare('INSERT INTO social_posts (id, kind, platforms, caption, link, media, scheduled_at, status, needs_approval, source, approved_at, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)').bind(pid, p.kind, p.platforms, p.caption, '', p.media, p.scheduled_at, 'approved', 'manual', now(), now(), now()).run();
      await log('Scheduled a social post'); return reply({ ok: true, id: pid });
    }
    return reply({ error: 'Not found.' }, 404);
  }
  if (id === 'connection' && m === 'GET') return reply(await connection(env));
  if (id === 'connect') return connectAdmin(env, new URL(req.url), sub, m, body, log);
  const p = await get(id);
  if (!p) return reply({ error: 'That post could not be found.' }, 404);
  const done = ['posted'].includes(p.status);
  if (m === 'GET') return reply({ post: out(p) });
  if (sub === 'insights' && m === 'POST') {
    if (!done) return reply({ error: 'Results appear once it has gone out.' }, 409);
    if (!(await pageToken(env))) return reply({ error: 'Facebook and Instagram aren\'t connected yet.' }, 409);
    await fetchInsights(env, p); return reply({ ok: true, post: out(await get(id)) });
  }
  if (sub === 'approve' && m === 'POST') {
    if (done) return reply({ error: 'Already posted.' }, 409);
    const err = checkPost(env, p); if (err) return reply({ error: err }, 422);
    const when = p.scheduled_at && p.scheduled_at > now() ? p.scheduled_at : now();
    await env.DB.prepare("UPDATE social_posts SET status = 'approved', approved_at = ?, scheduled_at = ?, error = '', attempts = 0, updated = ? WHERE id = ?").bind(now(), when, now(), id).run();
    await log('Approved a social post'); return reply({ ok: true });
  }
  if (sub === 'reject' && m === 'POST') {
    if (done) return reply({ error: 'Already posted. Delete it on Facebook or Instagram instead.' }, 409);
    await env.DB.prepare("UPDATE social_posts SET status = 'rejected', feedback = ?, updated = ? WHERE id = ?").bind(clean(body.feedback, 1000), now(), id).run();
    await log('Sent a social post back'); return reply({ ok: true });
  }
  if (sub === 'publish' && m === 'POST') {
    if (done) return reply({ error: 'Already posted.' }, 409);
    if (p.needs_approval && !p.approved_at) return reply({ error: 'Approve it first.' }, 409);
    if (!(await pageToken(env))) return reply({ error: 'Facebook and Instagram aren\'t connected yet. See the setup steps.' }, 409);
    await env.DB.prepare("UPDATE social_posts SET status = 'approved', scheduled_at = ?, attempts = 0, updated = ? WHERE id = ?").bind(now(), now(), id).run();
    const r = await publishOne(env, await get(id));
    return reply({ ok: !r.error, ...r, post: out(await get(id)) }, r.error ? 502 : 200);
  }
  if (m === 'PATCH') {
    if (done || p.status === 'publishing') return reply({ error: 'It\'s already going out, so it can\'t be changed here.' }, 409);
    const f = {};
    if (body.caption !== undefined) f.caption = clean(body.caption, 2200);
    if (body.scheduled_at !== undefined) { if (!isoOk(body.scheduled_at)) return reply({ error: 'Choose a valid date and time.' }, 422); f.scheduled_at = new Date(body.scheduled_at).toISOString(); }
    if (body.platforms !== undefined) { if (!['fb', 'ig', 'fb,ig'].includes(body.platforms)) return reply({ error: 'Choose where to post it.' }, 422); f.platforms = body.platforms; }
    const err = checkPost(env, { ...p, ...f }); if (err) return reply({ error: err }, 422);
    const k = Object.keys(f); if (k.length) await env.DB.prepare(`UPDATE social_posts SET ${k.map(x => x + ' = ?').join(', ')}, updated = ? WHERE id = ?`).bind(...k.map(x => f[x]), now(), id).run();
    return reply({ ok: true });
  }
  if (m === 'DELETE') {
    if (done) return reply({ error: 'Already posted. Delete it on Facebook or Instagram, then here.' }, 409);
    await env.DB.prepare('DELETE FROM social_posts WHERE id = ?').bind(id).run(); await log('Deleted a social post'); return reply({ ok: true });
  }
  return reply({ error: 'Not found.' }, 404);
}
