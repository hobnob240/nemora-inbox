// NEMORA site builder: drag-and-drop editing of a client's nearly finished site, with a private live link.
// Charlie edits in /admin/builder (GrapesJS); every save is stored here and the client's link (/v/<token>)
// picks it up within a couple of seconds. The client's page shows the site in a sandboxed frame: no scripts run.
// Approving freezes a version for Claude to put live on the client's domain.

export const BUILDS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS builds (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', project_id TEXT NOT NULL DEFAULT '', token TEXT NOT NULL DEFAULT '', rev INTEGER NOT NULL DEFAULT 0, html TEXT NOT NULL DEFAULT '', css TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', approved_rev INTEGER NOT NULL DEFAULT 0, approved_at TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE UNIQUE INDEX IF NOT EXISTS builds_token ON builds(token)`,
  `CREATE TABLE IF NOT EXISTS build_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, build_id TEXT NOT NULL, rev INTEGER NOT NULL, html TEXT NOT NULL DEFAULT '', css TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', saved TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS build_versions_by ON build_versions(build_id, rev)`
];
const MAX_DOC = 900 * 1024, MAX_IMG = 4 * 1024 * 1024;
const now = () => new Date().toISOString();
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
const reply = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

let ready = false;
async function ensure(env) { if (ready) return; for (const s of BUILDS_SCHEMA) await env.DB.prepare(s).run(); ready = true; }

// Nothing that runs: no scripts, no inline handlers, no javascript: links, no embedded frames or objects.
export function cleanHtml(html) {
  return String(html || '')
    .replace(/<\s*(script|iframe|object|embed|frameset|applet|noscript|template|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|frame|frameset|applet|base|meta|link|noscript|template)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|action|formaction|xlink:href|srcset|poster)\s*=\s*("|')\s*(javascript|vbscript|data:text\/html)[^"']*\2/gi, ' $1="#"')
    .replace(/\s(href|src|action|formaction|xlink:href)\s*=\s*(javascript|vbscript):[^\s>]*/gi, ' $1="#"')
    .replace(/\ssrcdoc\s*=\s*("[^"]*"|'[^']*')/gi, '');
}
export function cleanCss(css) {
  return String(css || '')
    .replace(/@import\s+(?!url\(\s*["']?https:\/\/fonts\.googleapis\.com\/)[^;]+;?/gi, '')
    .replace(/expression\s*\(/gi, '(').replace(/javascript:/gi, '').replace(/-moz-binding/gi, '').replace(/<\/style/gi, '');
}
const cleanData = d => { try { const s = JSON.stringify(typeof d === 'string' ? JSON.parse(d) : d || {}); return s.length > MAX_DOC ? '' : s; } catch (e) { return ''; } };

// the starting point for a new build: a calm, editable one-page site in NEMORA's sections
export const STARTER = {
  html: `<header class="nm-nav"><div class="nm-wrap nm-nav-in"><a class="nm-logo" href="#">Business name</a><nav class="nm-links"><a href="#services">Services</a><a href="#about">About</a><a href="#contact">Contact</a></nav><a class="nm-btn" href="#contact">Get a quote</a></div></header>
<section class="nm-hero"><div class="nm-wrap nm-hero-in"><div><h1>Say what you do and where, in one line</h1><p class="nm-lead">One or two sentences about who you help and why people pick you.</p><div class="nm-actions"><a class="nm-btn" href="#contact">Get a quote</a><a class="nm-btn nm-ghost" href="tel:">Call us</a></div></div><img class="nm-photo" src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22900%22%20height%3D%22700%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e9e4d8%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20fill%3D%22%236d6a62%22%20font-family%3D%22Arial%22%20font-size%3D%2240%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3EDouble-click%20to%20add%20a%20photo%3C%2Ftext%3E%3C%2Fsvg%3E" alt="Replace with a photo of the business"></div></section>
<section class="nm-section" id="services"><div class="nm-wrap"><h2>Services</h2><div class="nm-grid3"><div class="nm-card"><h3>Service one</h3><p>What it is and who it's for.</p></div><div class="nm-card"><h3>Service two</h3><p>What it is and who it's for.</p></div><div class="nm-card"><h3>Service three</h3><p>What it is and who it's for.</p></div></div></div></section>
<section class="nm-section nm-alt" id="about"><div class="nm-wrap nm-split"><img class="nm-photo" src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22900%22%20height%3D%22700%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e9e4d8%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20fill%3D%22%236d6a62%22%20font-family%3D%22Arial%22%20font-size%3D%2240%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3EDouble-click%20to%20add%20a%20photo%3C%2Ftext%3E%3C%2Fsvg%3E" alt="Replace with a photo"><div><h2>About us</h2><p>The story of the business in a few honest sentences.</p></div></div></section>
<section class="nm-section" id="contact"><div class="nm-wrap nm-split"><div><h2>Get in touch</h2><p>Phone, email, address and opening hours.</p></div><div class="nm-card"><p><strong>Phone</strong><br>Add the number</p><p><strong>Email</strong><br>Add the email</p></div></div></div></section>
<footer class="nm-foot"><div class="nm-wrap">Business name. Website by NEMORA.</div></footer>`,
  css: `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1d1f26;background:#fbf9f4;line-height:1.6}
img{max-width:100%;display:block}a{color:inherit}
.nm-wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.nm-nav{background:#fff;border-bottom:1px solid #e8e3d8}.nm-nav-in{display:flex;align-items:center;gap:20px;min-height:68px}
.nm-logo{font-weight:700;font-size:20px;text-decoration:none;margin-right:auto}.nm-links{display:flex;gap:18px}.nm-links a{text-decoration:none;color:#4a4c55}
.nm-btn{display:inline-block;background:#1d1f26;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600}
.nm-ghost{background:transparent;color:#1d1f26;border:1px solid #c9c3b6}
.nm-hero{padding:64px 0}.nm-hero-in{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
.nm-hero h1{font-size:46px;line-height:1.08;margin:0 0 16px}.nm-lead{font-size:19px;color:#4a4c55;margin:0 0 24px}.nm-actions{display:flex;gap:12px;flex-wrap:wrap}
.nm-photo{width:100%;border-radius:16px;aspect-ratio:9/7;object-fit:cover}
.nm-section{padding:64px 0}.nm-alt{background:#f2eee5}.nm-section h2{font-size:34px;margin:0 0 20px}
.nm-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.nm-card{background:#fff;border:1px solid #e8e3d8;border-radius:14px;padding:22px}.nm-card h3{margin:0 0 8px}
.nm-split{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
.nm-foot{padding:28px 0;border-top:1px solid #e8e3d8;color:#6d6a62;font-size:14px}
@media (max-width:760px){.nm-links{display:none}.nm-hero-in,.nm-split,.nm-grid3{grid-template-columns:1fr}.nm-hero h1{font-size:34px}.nm-hero{padding:40px 0}.nm-section{padding:44px 0}}`
};

function out(b, full) {
  const o = { id: b.id, title: b.title, project_id: b.project_id, rev: b.rev, status: b.status, approved_rev: b.approved_rev, approved_at: b.approved_at, notes: b.notes, created: b.created, updated: b.updated, link: '/v/' + b.token };
  if (full) Object.assign(o, { html: b.html, css: b.css, data: b.data ? JSON.parse(b.data) : null, base: STARTER.css });
  return o;
}

export async function adminBuilds(req, env, id, sub, m, body, log, readRaw) {
  await ensure(env);
  const get = bid => env.DB.prepare('SELECT * FROM builds WHERE id = ?').bind(bid).first();
  if (!id) {
    if (m === 'GET') return reply({ builds: ((await env.DB.prepare('SELECT * FROM builds ORDER BY updated DESC LIMIT 200').all()).results || []).map(b => out(b)) });
    if (m === 'POST') {
      const title = clean(body.title, 120); if (!title) return reply({ error: 'Give it a name, like the business name.' }, 422);
      const project = clean(body.project_id, 80);
      let html = STARTER.html, css = STARTER.css;
      if (body.html) { html = cleanHtml(clean(body.html, MAX_DOC)); css = cleanCss(clean(body.css, MAX_DOC)); }
      const bid = 'b_' + hex(6), t = now();
      await env.DB.prepare('INSERT INTO builds (id, title, project_id, token, rev, html, css, data, created, updated) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)').bind(bid, title, project, hex(16), html, css, '', t, t).run();
      await env.DB.prepare('INSERT INTO build_versions (build_id, rev, html, css, data, note, saved) VALUES (?, 1, ?, ?, ?, ?, ?)').bind(bid, html, css, '', 'Started', t).run();
      await log('Started a site build: ' + title);
      return reply({ ok: true, build: out(await get(bid)) });
    }
    return reply({ error: 'Not found.' }, 404);
  }
  const b = await get(String(id));
  if (!b) return reply({ error: 'That build could not be found.' }, 404);
  if (!sub && m === 'GET') return reply({ build: out(b, true) });
  if (!sub && m === 'PUT') {
    // a save from the editor (autosave). Keeps a version every 5 minutes, and whenever Charlie names one.
    if (b.status === 'approved' && !body.reopen) return reply({ error: 'This version is approved. Tap Edit again to make more changes.' }, 409);
    const html = cleanHtml(clean(body.html, MAX_DOC)), css = cleanCss(clean(body.css, MAX_DOC)), data = cleanData(body.data);
    if (!html) return reply({ error: 'Nothing to save.' }, 422);
    const rev = b.rev + 1, t = now();
    await env.DB.prepare("UPDATE builds SET html = ?, css = ?, data = ?, rev = ?, status = 'draft', updated = ? WHERE id = ?").bind(html, css, data, rev, t, b.id).run();
    const last = await env.DB.prepare('SELECT saved FROM build_versions WHERE build_id = ? ORDER BY rev DESC LIMIT 1').bind(b.id).first();
    const note = clean(body.note, 120);
    if (note || !last || Date.now() - Date.parse(last.saved) > 5 * 60000) {
      await env.DB.prepare('INSERT INTO build_versions (build_id, rev, html, css, data, note, saved) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(b.id, rev, html, css, data, note || 'Autosave', t).run();
      await env.DB.prepare('DELETE FROM build_versions WHERE build_id = ? AND id NOT IN (SELECT id FROM build_versions WHERE build_id = ? ORDER BY rev DESC LIMIT 60)').bind(b.id, b.id).run();
    }
    return reply({ ok: true, rev });
  }
  if (sub === 'versions' && m === 'GET') return reply({ versions: (await env.DB.prepare('SELECT id, rev, note, saved FROM build_versions WHERE build_id = ? ORDER BY rev DESC').bind(b.id).all()).results || [] });
  if (sub === 'restore' && m === 'POST') {
    const v = await env.DB.prepare('SELECT * FROM build_versions WHERE build_id = ? AND id = ?').bind(b.id, Number(body.version) || 0).first();
    if (!v) return reply({ error: 'That version could not be found.' }, 404);
    const rev = b.rev + 1, t = now();
    await env.DB.prepare("UPDATE builds SET html = ?, css = ?, data = ?, rev = ?, status = 'draft', updated = ? WHERE id = ?").bind(v.html, v.css, v.data, rev, t, b.id).run();
    await env.DB.prepare('INSERT INTO build_versions (build_id, rev, html, css, data, note, saved) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(b.id, rev, v.html, v.css, v.data, 'Went back to ' + (v.note || 'a version') + ' from ' + v.saved.slice(0, 16).replace('T', ' '), t).run();
    await log('Restored an earlier version of ' + b.title);
    return reply({ ok: true, build: out(await get(b.id), true) });
  }
  if (sub === 'approve' && m === 'POST') {
    const t = now();
    await env.DB.prepare("UPDATE builds SET status = 'approved', approved_rev = rev, approved_at = ?, updated = ? WHERE id = ?").bind(t, t, b.id).run();
    await env.DB.prepare('INSERT INTO build_versions (build_id, rev, html, css, data, note, saved) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(b.id, b.rev, b.html, b.css, b.data, 'Approved by the client', t).run();
    await log('Client approved the site: ' + b.title);
    return reply({ ok: true, build: out(await get(b.id)) });
  }
  if (sub === 'reopen' && m === 'POST') { await env.DB.prepare("UPDATE builds SET status = 'draft', updated = ? WHERE id = ?").bind(now(), b.id).run(); return reply({ ok: true }); }
  if (sub === 'relink' && m === 'POST') { await env.DB.prepare('UPDATE builds SET token = ?, updated = ? WHERE id = ?').bind(hex(16), now(), b.id).run(); await log('Made a new client link for ' + b.title); return reply({ ok: true, build: out(await get(b.id)) }); }
  if (sub === 'rename' && m === 'POST') { const title = clean(body.title, 120); if (!title) return reply({ error: 'Give it a name.' }, 422); await env.DB.prepare('UPDATE builds SET title = ?, project_id = ?, notes = ?, updated = ? WHERE id = ?').bind(title, clean(body.project_id ?? b.project_id, 80), clean(body.notes ?? b.notes, 2000), now(), b.id).run(); return reply({ ok: true }); }
  if (sub === 'images' && m === 'POST') {
    // a photo for this build: the editor shrinks it first; stored in KV and served at /b/img/<key>
    const type = (req.headers.get('content-type') || '').split(';')[0].trim();
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) return reply({ error: 'Use a JPG, PNG, WebP or GIF photo.' }, 415);
    const buf = await readRaw(req, MAX_IMG); if (!buf) return reply({ error: 'That photo is too big. Try one under 4 MB.' }, 413);
    const key = b.id + '-' + hex(8);
    await env.KV.put('bimg:' + key, buf, { metadata: { type } });
    return reply({ ok: true, src: '/b/img/' + key });
  }
  if (!sub && m === 'DELETE') {
    await env.DB.batch([env.DB.prepare('DELETE FROM build_versions WHERE build_id = ?').bind(b.id), env.DB.prepare('DELETE FROM builds WHERE id = ?').bind(b.id)]);
    await log('Deleted the site build ' + b.title); return reply({ ok: true });
  }
  return reply({ error: 'Not found.' }, 404);
}

/* ---------- public: the client's live link and the photos ---------- */
const VIEW_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data: https:; frame-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export async function publicBuild(req, env, url) {
  await ensure(env);
  const p = url.pathname;
  const img = p.match(/^\/b\/img\/(b_[0-9a-f]{12}-[0-9a-f]{16})$/);
  if (img) {
    const { value, metadata } = await env.KV.getWithMetadata('bimg:' + img[1], 'arrayBuffer');
    if (!value) return new Response('Not found', { status: 404 });
    return new Response(value, { headers: { 'Content-Type': (metadata && metadata.type) || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  }
  const mt = p.match(/^\/v\/([0-9a-f]{32})(\/data)?$/);
  if (!mt) return null;
  const b = await env.DB.prepare('SELECT id, title, rev, html, css, status FROM builds WHERE token = ?').bind(mt[1]).first();
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': VIEW_CSP };
  if (!b) return new Response('This preview link has expired. Ask NEMORA for a new one.', { status: 404, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
  if (mt[2]) {
    const since = Number(url.searchParams.get('rev')) || 0;
    if (since === b.rev) return reply({ rev: b.rev, status: b.status }, 200, headers);
    return reply({ rev: b.rev, status: b.status, title: b.title, html: b.html, css: b.css }, 200, headers);
  }
  const page = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(b.title)}: preview by NEMORA</title><link rel="stylesheet" href="/assets/viewer.css"><script src="/assets/viewer.js" defer></script></head>
<body><div class="vbar"><span class="vdot" aria-hidden="true"></span><span class="vtitle">${esc(b.title)}</span><span class="vnote" id="vnote">Live preview: changes appear here as we make them</span></div>
<iframe id="site" title="${esc(b.title)} website preview" sandbox="allow-same-origin allow-popups" data-rev="0"></iframe></body></html>`;
  return new Response(page, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY' } });
}
