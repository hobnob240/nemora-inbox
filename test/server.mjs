// Local stand-in for Cloudflare: runs src/worker.js with an in-memory KV and serves public/ as ASSETS.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { default: worker } = await import(path.join(ROOT, 'src/worker.js'));
const store = new Map();
const KV = {
  async get(k, t) { const e = store.get(k); if (!e || (e.exp && e.exp < Date.now())) return null; return t === 'json' ? JSON.parse(e.v) : e.v; },
  async getWithMetadata(k) { const e = store.get(k); if (!e || (e.exp && e.exp < Date.now())) return { value: null, metadata: null }; return { value: e.v, metadata: e.m || null }; },
  async put(k, v, o = {}) { store.set(k, { v: typeof v === 'string' ? v : String(v), m: o.metadata, exp: o.expirationTtl ? Date.now() + o.expirationTtl * 1000 : 0 }); },
  async delete(k) { store.delete(k); },
  async list({ prefix = '' } = {}) { return { keys: [...store.entries()].filter(([k, e]) => k.startsWith(prefix) && !(e.exp && e.exp < Date.now())).sort().map(([k, e]) => ({ name: k, metadata: e.m })), list_complete: true }; }
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const ASSETS = { async fetch(req) {
  let p = new URL(req.url).pathname; if (p.endsWith('/')) p += 'index.html'; else if (!path.extname(p)) p += '.html';
  const f = path.join(ROOT, 'public', p); if (!f.startsWith(path.join(ROOT, 'public')) || !fs.existsSync(f)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(f), { headers: { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' } });
} };
import { DatabaseSync } from 'node:sqlite';
const sql = new DatabaseSync(':memory:');
sql.exec("CREATE TABLE hits (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL, path TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '', visitor TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'view')");
const stmt = (q, a = []) => ({ q, bind: (...b) => stmt(q, b), async first() { return sql.prepare(q).get(...a) || null; }, async all() { return { results: sql.prepare(q).all(...a) }; }, async run() { sql.prepare(q).run(...a); return { success: true }; } });
const DB = { prepare: q => stmt(q), async batch(list) { const out = []; for (const x of list) out.push(/^\s*(SELECT|WITH)/i.test(x.q) ? await x.all() : (await x.run(), { results: [] })); return out; } };
globalThis.__testDB = sql;
const env = { KV, ASSETS, DB, META_PAGE_TOKEN: process.env.META_PAGE_TOKEN ?? 'test-token', META_API_BASE: 'http://localhost:8802', META_APP_ID: process.env.META_APP_ID ?? '', META_APP_SECRET: process.env.META_APP_SECRET ?? '', META_LOGIN_CONFIG_ID: process.env.META_LOGIN_CONFIG_ID ?? '', MEDIA_ORIGIN: 'https://nemora.uk/social/', SETUP_CODE: process.env.SETUP_CODE ?? 'test setup phrase', SITE_ORIGINS: process.env.SITE_ORIGINS || 'https://nemora.uk,http://localhost:8795' };
const PORT = +process.env.PORT || 8801;
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  headers.set('cf-connecting-ip', req.headers['x-test-ip'] || '127.0.0.1');
  const r = new Request('http://localhost:' + PORT + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  Object.defineProperty(r, 'cf', { value: { country: req.headers['x-test-country'] || 'GB' } });
  if (req.url === '/__insights') { const { refreshInsights } = await import(path.join(ROOT, 'src/social.js')); res.end(JSON.stringify(await refreshInsights(env))); return; }
  if (req.url === '/__cron') { const { publishDue } = await import(path.join(ROOT, 'src/social.js')); res.end(JSON.stringify(await publishDue(env))); return; }
  if (req.url === '/__sql') { try { sql.exec(Buffer.concat(chunks).toString()); res.end('ok'); } catch (e) { res.statusCode = 500; res.end(String(e)); } return; }
  if (req.url === '/__seed' ) { const now = Date.now(); for (let i = 0; i < 400; i++) { const t = now - Math.floor(Math.random() * 40) * 86400000; sql.prepare("INSERT INTO hits (ts, day, path, ref, device, country, visitor, kind) VALUES (?,?,?,?,?,?,?,?)").run(t, new Date(t).toISOString().slice(0, 10), ['/', '/services.html', '/contact.html', '/work.html', '/guides/how-much-does-a-website-cost.html'][i % 5], ['', 'google.com', 'facebook.com', '', 'bing.com'][i % 5 === 1 ? 1 : i % 7 === 0 ? 2 : i % 11 === 0 ? 4 : 0], ['Phone', 'Phone', 'Desktop', 'Tablet'][i % 4], ['GB', 'GB', 'GB', 'US', 'IE'][i % 5], 'v' + (i % 90), i % 37 === 0 ? 'enquiry' : 'view'); } res.end('seeded'); return; }
  const out = await worker.fetch(r, env, { waitUntil() {} });
  const h = {}; out.headers.forEach((v, k) => { if (k === 'set-cookie') return; h[k] = v; });
  const sc = out.headers.getSetCookie ? out.headers.getSetCookie() : []; if (sc.length) h['set-cookie'] = sc;
  res.writeHead(out.status, h); res.end(Buffer.from(await out.arrayBuffer()));
}).listen(PORT, () => console.log('inbox test server on', PORT));
