// Voting: polls and awards (for example the Spitfire Awards) built in the admin and voted on at /vote/<slug>/.
// Admin routes are only reachable with a valid admin session (checked in worker.js). The public page is a plain
// HTML form (no scripts), escaped output, bound SQL parameters, a hidden spam field, a signed time token,
// one vote per browser (an unguessable cookie stored only as a hash) and a per-network daily cap.
// No names, emails or IP addresses are stored unless the poll asks voters for their name.

export const VOTES_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS polls (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, client TEXT NOT NULL DEFAULT '', intro TEXT NOT NULL DEFAULT '', footer TEXT NOT NULL DEFAULT '', closes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', theme TEXT NOT NULL DEFAULT 'light', ask_name INTEGER NOT NULL DEFAULT 0, questions TEXT NOT NULL DEFAULT '[]', created TEXT NOT NULL, updated TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS poll_votes (id INTEGER PRIMARY KEY AUTOINCREMENT, poll_id TEXT NOT NULL, voter TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', answers TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_voter ON poll_votes(poll_id, voter)`
];
let ready = false;
async function ensure(env) { if (ready) return; await env.DB.batch(VOTES_SCHEMA.map(s => env.DB.prepare(s))); ready = true; }

export const THEMES = { spitfire: 'Spitfire (navy, red and white, with their logo)', nemora: 'NEMORA (dark and gold)', light: 'Plain light' };
const STATUSES = ['draft', 'open', 'closed'];
const now = () => new Date().toISOString();
const rid = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
const enc = new TextEncoder();
async function sha(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function hmac(key, msg) { const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function secret(env) { let s = await env.KV.get('votes:key'); if (!s) { s = rid(32); await env.KV.put('votes:key', s); } return s; }
const cl = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '').replace(/\r/g, '').trim().slice(0, max);
const one = (v, max) => cl(v, max * 2).replace(/\s+/g, ' ').slice(0, max);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parse = (s, d) => { try { const v = JSON.parse(s); return v == null ? d : v; } catch { return d; } };
const reply = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const isOpen = p => p.status === 'open' && (!p.closes || new Date(p.closes) > new Date());

// a vote's answer key for counting typed answers: "Dave  Smith!" and "dave smith" count together
export const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/^(the|a) /, '').trim();

function cleanQuestions(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40).map((q, i) => {
    const kind = q && q.kind === 'choice' ? 'choice' : 'text';
    const options = kind === 'choice' ? [...new Set((Array.isArray(q.options) ? q.options : String((q && q.options) || '').split('\n')).map(o => one(o, 80)).filter(Boolean))].slice(0, 60) : [];
    return { id: one(q && q.id, 20) && /^[a-z0-9]{4,20}$/.test(q.id) ? q.id : 'q' + rid(4), label: one(q && q.label, 100), kind, options, required: !!(q && q.required), note: one(q && q.note, 160), other: kind === 'choice' && !!(q && q.other) };
  }).filter(q => q.label);
}
const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'vote';

/* ---------- ready-made: the Spitfire Awards, from the categories on spitfirecomedy.co.uk ---------- */
const SPITFIRE = () => ({
  title: 'The Spitfire Awards 2026', client: 'Spitfire Comedy', theme: 'spitfire', closes: '2026-12-12T23:59:00.000Z',
  intro: 'Vote for your nominees in the annual Spitfire Awards. New categories have been added this year. Votes close on 12 December, and the nominees are announced at the Christmas Party on the 15th.',
  footer: 'Nicky’s Special Award isn’t voted on: that one is decided by Queen Nicky.',
  questions: [
    ['Best Comedian', 'text'], ['Best Character Act', 'text'], ['Best Guest MC', 'choice'], ['Best Dressed', 'text'],
    ['Most Likely to Have a Netflix Special', 'text'], ['Best Joke', 'text', 'Tell us the joke, or who told it.'], ['Best Audience Member', 'text'], ['Best One-Liner', 'text'],
    ['Best Musical Act', 'text'], ['Best Newcomer', 'text'], ['Best WIP', 'choice', 'New this year.'], ['Best Roast', 'choice', 'New this year.'], ['Best Pro Act', 'choice', 'New this year.']
  ].map(([label, kind, note]) => ({ label, kind, note: note || (kind === 'choice' ? 'Pick from the acts who performed at Spitfire in 2026.' : ''), options: [], required: false }))
});

/* ---------- admin ---------- */
export async function adminVotes(env, id, sub, m, body, log, url) {
  await ensure(env);
  if (!id && m === 'GET') {
    const polls = await env.DB.prepare('SELECT p.id, p.slug, p.title, p.client, p.status, p.closes, p.theme, p.updated, (SELECT COUNT(*) FROM poll_votes v WHERE v.poll_id = p.id) AS votes FROM polls p ORDER BY p.created DESC').all();
    return reply({ polls: polls.results.map(p => ({ ...p, live: isOpen(p) })), themes: THEMES, base: url.origin + '/vote/' });
  }
  if (!id && m === 'POST') {
    const tpl = body.template === 'spitfire' ? SPITFIRE() : { title: one(body.title, 100) || 'New vote', client: one(body.client, 80), theme: THEMES[body.theme] ? body.theme : 'light', closes: '', intro: '', footer: '', questions: [] };
    let slug = slugify(body.slug || tpl.title);
    if (await env.DB.prepare('SELECT 1 FROM polls WHERE slug = ?').bind(slug).first()) slug = slug.slice(0, 40) + '-' + rid(2);
    const pid = 'pl' + rid(6), t = now();
    await env.DB.prepare('INSERT INTO polls (id, slug, title, client, intro, footer, closes, status, theme, questions, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(pid, slug, tpl.title, tpl.client, tpl.intro, tpl.footer, tpl.closes, 'draft', tpl.theme, JSON.stringify(cleanQuestions(tpl.questions)), t, t).run();
    await log('Created a vote: ' + tpl.title);
    return reply({ ok: true, id: pid });
  }
  if (!/^pl[a-f0-9]{12}$/.test(id || '')) return reply({ error: 'That vote could not be found.' }, 404);
  const p = await env.DB.prepare('SELECT * FROM polls WHERE id = ?').bind(id).first();
  if (!p) return reply({ error: 'That vote could not be found. It may have been deleted.' }, 404);
  const qs = parse(p.questions, []);

  if (m === 'GET' && sub === 'csv') {
    const { results } = await env.DB.prepare('SELECT name, answers, created, updated FROM poll_votes WHERE poll_id = ? ORDER BY id').bind(id).all();
    const cell = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const head = ['Voted at', ...(p.ask_name ? ['Name'] : []), ...qs.map(q => q.label)];
    const rows = results.map(r => { const a = parse(r.answers, {}); return [r.updated, ...(p.ask_name ? [r.name] : []), ...qs.map(q => a[q.id] || '')]; });
    return new Response('﻿' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${p.slug}-votes.csv"`, 'Cache-Control': 'no-store' } });
  }
  if (m === 'GET') {
    const { results } = await env.DB.prepare('SELECT answers FROM poll_votes WHERE poll_id = ?').bind(id).all();
    const answers = results.map(r => parse(r.answers, {}));
    const tallies = qs.map(q => {
      const groups = new Map();
      for (const a of answers) {
        const v = a[q.id]; if (!v) continue;
        const k = q.kind === 'choice' && q.options.includes(v) ? 'opt:' + v : norm(v); if (!k) continue;
        const g = groups.get(k) || { n: 0, names: new Map() }; g.n++; g.names.set(v, (g.names.get(v) || 0) + 1); groups.set(k, g);
      }
      const rows = [...groups.values()].map(g => ({ answer: [...g.names.entries()].sort((x, y) => y[1] - x[1])[0][0], spellings: g.names.size, votes: g.n })).sort((x, y) => y.votes - x.votes || x.answer.localeCompare(y.answer));
      return { id: q.id, label: q.label, kind: q.kind, answered: rows.reduce((s, r) => s + r.votes, 0), rows: rows.slice(0, 25), more: Math.max(0, rows.length - 25) };
    });
    const last = await env.DB.prepare('SELECT MAX(updated) AS t FROM poll_votes WHERE poll_id = ?').bind(id).first();
    return reply({ poll: { ...p, questions: qs, ask_name: !!p.ask_name, live: isOpen(p) }, total: answers.length, last: last && last.t, tallies, themes: THEMES, link: url.origin + '/vote/' + p.slug + '/' });
  }
  if (m === 'PUT') {
    const questions = cleanQuestions(body.questions);
    const status = STATUSES.includes(body.status) ? body.status : p.status;
    const empty = questions.filter(q => q.kind === 'choice' && !q.options.length);
    if (status === 'open' && !questions.length) return reply({ error: 'Add at least one question before opening the vote.' }, 422);
    if (status === 'open' && empty.length) return reply({ error: `Add the choices for ${empty.map(q => '“' + q.label + '”').join(', ')} before opening the vote (one per line), or change ${empty.length > 1 ? 'them' : 'it'} to a typed answer.` }, 422);
    let closes = '';
    if (body.closes) { const d = new Date(body.closes); if (isNaN(d)) return reply({ error: 'That closing date doesn’t look right.' }, 422); closes = d.toISOString(); }
    let slug = p.slug;
    if (body.slug !== undefined && slugify(body.slug) !== p.slug) {
      slug = slugify(body.slug);
      if (await env.DB.prepare('SELECT 1 FROM polls WHERE slug = ? AND id != ?').bind(slug, id).first()) return reply({ error: 'Another vote already uses that link. Pick a different one.' }, 409);
    }
    const title = one(body.title, 100); if (!title) return reply({ error: 'Give the vote a title.' }, 422);
    await env.DB.prepare('UPDATE polls SET slug = ?, title = ?, client = ?, intro = ?, footer = ?, closes = ?, status = ?, theme = ?, ask_name = ?, questions = ?, updated = ? WHERE id = ?')
      .bind(slug, title, one(body.client, 80), cl(body.intro, 1200), cl(body.footer, 600), closes, status, THEMES[body.theme] ? body.theme : p.theme, body.ask_name ? 1 : 0, JSON.stringify(questions), now(), id).run();
    if (status !== p.status) await log(`Vote “${title}” is now ${status}`);
    return reply({ ok: true, slug });
  }
  if (m === 'DELETE' && sub === 'votes') { await env.DB.prepare('DELETE FROM poll_votes WHERE poll_id = ?').bind(id).run(); await log('Cleared all votes for ' + p.title); return reply({ ok: true }); }
  if (m === 'DELETE' && !sub) { await env.DB.batch([env.DB.prepare('DELETE FROM poll_votes WHERE poll_id = ?').bind(id), env.DB.prepare('DELETE FROM polls WHERE id = ?').bind(id)]); await log('Deleted the vote ' + p.title); return reply({ ok: true }); }
  return reply({ error: 'Not found.' }, 404);
}

/* ---------- public voting page ---------- */
const COOKIE = id => '__Host-v' + id.slice(2);
function readCookie(req, name) { for (const part of (req.headers.get('cookie') || '').split(';')) { const i = part.indexOf('='); if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim(); } return null; }
function sameOrigin(req, url) { const o = req.headers.get('origin'); if (o) return o === url.origin; const r = req.headers.get('referer'); return !!r && r.startsWith(url.origin + '/'); }
async function token(env) { const ts = String(Date.now()); return ts + '.' + (await hmac(await secret(env), 'vt' + ts)).slice(0, 32); }
async function tokenOk(env, t) { const [ts, sig] = String(t || '').split('.'); if (!/^\d{13}$/.test(ts || '')) return false; const age = Date.now() - Number(ts); if (age < 2500 || age > 6 * 3600e3) return false; return sig === (await hmac(await secret(env), 'vt' + ts)).slice(0, 32); }

function page(p, inner, { title } = {}) {
  const logo = p.theme === 'spitfire' ? '<img class="logo" src="/assets/vote/spitfire-logo.jpg" alt="Spitfire Comedy" width="120" height="120">' : '';
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${esc(title || p.title)}</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/assets/vote.css?v=1"></head>
<body class="t-${esc(p.theme)}"><main class="wrap">${logo}<h1>${esc(p.title)}</h1>${inner}</main><footer class="foot">${p.client ? esc(p.client) + ' · ' : ''}Voting by <a href="https://nemora.uk" rel="noopener">NEMORA</a></footer></body></html>`;
}
function form(p, qs, tk, prev = {}, errors = [], name = '', changing = false) {
  const closes = p.closes ? new Date(p.closes).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : '';
  return `${p.intro ? `<p class="intro">${esc(p.intro).replace(/\n/g, '<br>')}</p>` : ''}${closes ? `<p class="closes">Voting closes ${esc(closes)}</p>` : ''}
${changing ? '<p class="note ok">You’ve already voted. You can change your votes below until voting closes.</p>' : ''}
${errors.length ? `<div class="note bad" role="alert"><p>Please check:</p><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
<form method="post" novalidate>
<input type="hidden" name="t" value="${esc(tk)}"><div class="hp" aria-hidden="true"><label>Leave empty <input name="website" tabindex="-1" autocomplete="off"></label></div>
${p.ask_name ? `<div class="q"><label for="v-name">Your name</label><input id="v-name" name="name" maxlength="60" autocomplete="name" value="${esc(name)}" required></div>` : ''}
${qs.map((q, i) => `<div class="q"><label for="v-${q.id}"><span class="n">${i + 1}</span>${esc(q.label)}${q.required ? '' : ' <span class="opt">(optional)</span>'}</label>${q.note ? `<p class="hint">${esc(q.note)}</p>` : ''}
${q.kind === 'choice' ? `<select id="v-${q.id}" name="${q.id}"${q.required ? ' required' : ''}><option value="">Choose…</option>${q.options.map(o => `<option${prev[q.id] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input id="v-${q.id}" name="${q.id}" maxlength="140" autocomplete="off" value="${esc(prev[q.id] || '')}"${q.required ? ' required' : ''}>`}</div>`).join('')}
<button type="submit">${changing ? 'Update my votes' : 'Send my votes'}</button>
<p class="small">${p.ask_name ? 'Your name is only used to check votes are fair, and is deleted after the awards.' : 'We don’t collect your name, email or anything else about you.'} One vote per phone or browser: a small cookie remembers that you’ve voted so you can change your votes later.</p>
${p.footer ? `<p class="small">${esc(p.footer)}</p>` : ''}
</form>`;
}

export async function publicVote(req, env, url) {
  const mm = /^\/vote\/([a-z0-9-]{1,60})\/?$/.exec(url.pathname);
  if (!mm) return null;
  if (!url.pathname.endsWith('/')) return new Response(null, { status: 301, headers: { Location: url.pathname + '/' } });
  await ensure(env);
  const p = await env.DB.prepare('SELECT * FROM polls WHERE slug = ?').bind(mm[1]).first();
  const html = (b, status = 200, cookie) => { const r = new Response(b, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }); if (cookie) r.headers.append('Set-Cookie', cookie); return r; };
  if (!p || p.status === 'draft') return html(page({ title: 'Vote not found', theme: 'light', client: '' }, '<p class="intro">This vote doesn’t exist, or isn’t open yet.</p>'), 404);
  const qs = parse(p.questions, []);
  const ck = readCookie(req, COOKIE(p.id));
  const voter = ck && /^[a-f0-9]{48}$/.test(ck) ? await sha((await secret(env)) + ck) : null;
  const existing = voter ? await env.DB.prepare('SELECT name, answers FROM poll_votes WHERE poll_id = ? AND voter = ?').bind(p.id, voter).first() : null;
  if (!isOpen(p)) return html(page(p, `<p class="intro">Voting has closed. Thank you to everyone who voted!</p>${p.footer ? `<p class="small">${esc(p.footer)}</p>` : ''}`));

  if (req.method === 'GET') {
    if (url.searchParams.get('done') === '1' && existing) return html(page(p, `<p class="intro big">Thank you, your votes are in!</p><p class="intro">You can <a href="./">change your votes</a> until voting closes.</p>${p.footer ? `<p class="small">${esc(p.footer)}</p>` : ''}`, { title: 'Thanks for voting' }));
    return html(page(p, form(p, qs, await token(env), existing ? parse(existing.answers, {}) : {}, [], existing ? existing.name : '', !!existing)));
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!sameOrigin(req, url)) return new Response('Request blocked for security reasons.', { status: 403 });
  if (Number(req.headers.get('content-length') || 0) > 32 * 1024) return new Response('Too large', { status: 413 });
  let f; try { f = await req.formData(); } catch { return new Response('Bad request', { status: 400 }); }
  const g = k => { const v = f.get(k); return typeof v === 'string' ? v : ''; };
  if (g('website')) return new Response(null, { status: 303, headers: { Location: './?done=1' } });
  const answers = {}, errors = [];
  for (const q of qs) {
    const v = one(g(q.id), 140);
    if (!v) { if (q.required) errors.push(`Answer “${q.label}”.`); continue; }
    if (q.kind === 'choice' && !q.options.includes(v)) { errors.push(`Pick one of the options for “${q.label}”.`); continue; }
    answers[q.id] = v;
  }
  const name = p.ask_name ? one(g('name'), 60) : '';
  if (p.ask_name && name.length < 2) errors.push('Add your name.');
  if (!Object.keys(answers).length && !errors.length) errors.push('Vote in at least one category.');
  if (!(await tokenOk(env, g('t')))) errors.push('The page timed out, or that was very quick. Please check your answers and send them again.');
  // at most 40 votes a day from one network (a busy pub's wifi is fine, a ballot-stuffing script is not); only a hash is kept, for a day
  const netKey = 'vrl:' + p.id + ':' + (await sha((await secret(env)) + (req.headers.get('cf-connecting-ip') || ''))).slice(0, 24);
  const used = Number(await env.KV.get(netKey)) || 0;
  if (!existing && used >= 40) errors.push('Too many votes have come from this network today. Please try again tomorrow, or on mobile data.');
  if (errors.length) return html(page(p, form(p, qs, await token(env), answers, errors, name, !!existing)), 400);
  const t = now();
  let cookie = null;
  if (existing) await env.DB.prepare('UPDATE poll_votes SET answers = ?, name = ?, updated = ? WHERE poll_id = ? AND voter = ?').bind(JSON.stringify(answers), name, t, p.id, voter).run();
  else {
    const raw = rid(24), v = await sha((await secret(env)) + raw);
    await env.DB.prepare('INSERT INTO poll_votes (poll_id, voter, name, answers, created, updated) VALUES (?, ?, ?, ?, ?, ?)').bind(p.id, v, name, JSON.stringify(answers), t, t).run();
    await env.KV.put(netKey, String(used + 1), { expirationTtl: 86400 });
    const maxAge = Math.max(86400, Math.round(((p.closes ? new Date(p.closes).getTime() : Date.now() + 90 * 86400e3) - Date.now()) / 1000) + 30 * 86400);
    cookie = `${COOKIE(p.id)}=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  }
  return new Response(null, { status: 303, headers: { Location: './?done=1', 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
}
