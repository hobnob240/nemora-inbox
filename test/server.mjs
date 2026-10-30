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
const env = { KV, ASSETS, SETUP_CODE: process.env.SETUP_CODE ?? 'test setup phrase', SITE_ORIGINS: process.env.SITE_ORIGINS || 'https://nemora.uk,http://localhost:8795' };
const PORT = +process.env.PORT || 8801;
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  headers.set('cf-connecting-ip', req.headers['x-test-ip'] || '127.0.0.1');
  const r = new Request('http://localhost:' + PORT + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const out = await worker.fetch(r, env, { waitUntil() {} });
  const h = {}; out.headers.forEach((v, k) => { if (k === 'set-cookie') return; h[k] = v; });
  const sc = out.headers.getSetCookie ? out.headers.getSetCookie() : []; if (sc.length) h['set-cookie'] = sc;
  res.writeHead(out.status, h); res.end(Buffer.from(await out.arrayBuffer()));
}).listen(PORT, () => console.log('inbox test server on', PORT));
