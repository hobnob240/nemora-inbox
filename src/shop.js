// NEMORA shop builds: any build with product cards (data-nm-product) gets a working shop at /s/<token>.
// The page is the cleaned build HTML plus one trusted script (/assets/nm-shop.js) for the basket and checkout.
// Prices are never taken from the browser: the order endpoint reads them from the saved build.
// Preview orders are kept for 90 days so Charlie can show clients what an order looks like. No card is taken here;
// card payments are switched on when a client's shop goes live on their own site.

export const SHOP_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS shop_orders (id TEXT PRIMARY KEY, build_id TEXT NOT NULL, created TEXT NOT NULL, items TEXT NOT NULL DEFAULT '[]', subtotal INTEGER NOT NULL DEFAULT 0, delivery INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new')`,
  `CREATE INDEX IF NOT EXISTS shop_orders_by ON shop_orders(build_id, created)`
];
let ready = false;
async function ensure(env) { if (ready) return; for (const s of SHOP_SCHEMA) await env.DB.prepare(s).run(); ready = true; }

const text = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
export const key = s => text(s).toLowerCase();
// "£24", "£1,250.50", "24.00" -> pence. Anything without a number is not a price.
export function pence(s) { const m = text(s).replace(/,/g, '').match(/(\d+)(?:\.(\d{1,2}))?/); if (!m) return null; return Number(m[1]) * 100 + (m[2] ? Number(m[2].padEnd(2, '0')) : 0); }
function inner(html, cls) {
  const re = new RegExp('<([a-z0-9]+)\\b[^>]*class\\s*=\\s*"[^"]*\\b' + cls + '\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1\\s*>', 'i');
  const m = html.match(re); return m ? m[2] : null;
}
function attrText(html, attr) {
  const re = new RegExp('<([a-z0-9]+)\\b[^>]*\\b' + attr + '\\b[^>]*>([\\s\\S]*?)</\\1\\s*>', 'i');
  const m = html.match(re); return m ? m[2] : null;
}

// Reads the products and delivery charges out of the saved page.
export function readShop(html) {
  html = String(html || '');
  const tags = [...html.matchAll(/<[a-z0-9]+\b[^>]*\bdata-nm-product\b[^>]*>/gi)];
  const products = new Map();
  tags.forEach((t, i) => {
    const seg = html.slice(t.index + t[0].length, i + 1 < tags.length ? tags[i + 1].index : html.length);
    const name = text(inner(seg, 'nm-p-name')), price = pence(inner(seg, 'nm-p-price'));
    const soldOut = /\bdata-nm-soldout\b(?!\s*=\s*["']?false)/i.test(t[0]);
    if (name && price != null && !products.has(key(name))) products.set(key(name), { name: name.slice(0, 120), price, soldOut });
  });
  const delivery = pence(attrText(html, 'data-nm-delivery')) || 0;
  const freeOver = pence(attrText(html, 'data-nm-free-over'));
  return { products, delivery, freeOver };
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
const BASE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...BASE, 'Content-Type': 'application/json; charset=utf-8' } });
const SHOP_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

// Works out the order from what the shopper sent (names and quantities only) and the saved prices.
export function priceOrder(shop, items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Your basket is empty.');
  if (items.length > 30) throw new Error('That is a lot of different things. Please split it into two orders.');
  const lines = [];
  for (const it of items) {
    const p = shop.products.get(key(it && it.name));
    if (!p) throw new Error('Something in your basket is no longer in the shop. Please remove it and try again.');
    if (p.soldOut) throw new Error(p.name + ' has just sold out. Please remove it and try again.');
    const qty = Math.floor(Number(it.qty));
    if (!(qty >= 1 && qty <= 20)) throw new Error('Quantities go from 1 to 20.');
    const prev = lines.find(l => l.name === p.name);
    if (prev) prev.qty = Math.min(20, prev.qty + qty); else lines.push({ name: p.name, price: p.price, qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const delivery = shop.freeOver != null && subtotal >= shop.freeOver ? 0 : shop.delivery;
  return { lines, subtotal, delivery, total: subtotal + delivery };
}

export async function publicShop(req, env, url) {
  const mt = url.pathname.match(/^\/s\/([0-9a-f]{32})(\/order)?$/);
  if (!mt) return null;
  const b = await env.DB.prepare('SELECT id, title, html, css FROM builds WHERE token = ?').bind(mt[1]).first();
  if (!b) return new Response('This shop link has expired. Ask NEMORA for a new one.', { status: 404, headers: { ...BASE, 'Content-Type': 'text/plain; charset=utf-8' } });

  if (!mt[2]) {
    if (req.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
    const body = String(b.html || '').replace(/^\s*<body[^>]*>/i, '').replace(/<\/body>\s*$/i, '');
    const page = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(b.title)}</title><style>${String(b.css || '').replace(/<\/style/gi, '')}</style><link rel="stylesheet" href="/assets/nm-shop.css"><script src="/assets/nm-shop.js" defer></script></head><body data-nm-shop="${mt[1]}">${body}</body></html>`;
    return new Response(page, { headers: { ...BASE, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': SHOP_CSP, 'X-Frame-Options': 'DENY' } });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (req.headers.get('origin') && req.headers.get('origin') !== url.origin) return json({ error: 'Request blocked for security reasons.' }, 403);
  // a few orders an hour per visitor is plenty for a preview, and stops anyone filling the list
  const ip = req.headers.get('cf-connecting-ip') || 'x', rk = 'shoprl:' + ip + ':' + new Date().toISOString().slice(0, 13);
  const n = Number(await env.KV.get(rk)) || 0;
  if (n >= 12) return json({ error: 'Too many orders from here in the last hour. Please try again later.' }, 429);
  let body; try { const raw = await req.text(); if (raw.length > 20000) throw 0; body = JSON.parse(raw); } catch (e) { return json({ error: 'That order could not be read. Please try again.' }, 400); }
  const c = body.customer || {};
  const name = clean(c.name, 120), email = clean(c.email, 200), phone = clean(c.phone, 40), address = clean(c.address, 400), note = clean(c.note, 600);
  if (!name) return json({ error: 'Please add your name.', field: 'name' }, 422);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Please check your email address.', field: 'email' }, 422);
  if (address.length < 6) return json({ error: 'Please add the delivery address and postcode.', field: 'address' }, 422);
  let order; try { order = priceOrder(readShop(b.html), body.items); } catch (e) { return json({ error: e.message }, 422); }
  await ensure(env);
  const id = 'o_' + hex(5), t = new Date().toISOString();
  await env.DB.prepare('INSERT INTO shop_orders (id, build_id, created, items, subtotal, delivery, total, name, email, phone, address, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, b.id, t, JSON.stringify(order.lines), order.subtotal, order.delivery, order.total, name, email, phone, address, note).run();
  await env.DB.prepare('DELETE FROM shop_orders WHERE created < ?').bind(new Date(Date.now() - 90 * 864e5).toISOString()).run();
  await env.KV.put(rk, String(n + 1), { expirationTtl: 3900 });
  return json({ ok: true, order: { ref: id.slice(2).toUpperCase(), ...order } });
}

// Admin: the orders placed on one build's shop link.
export async function adminShopOrders(env, buildId, m) {
  await ensure(env);
  if (m === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM shop_orders WHERE build_id = ? ORDER BY created DESC LIMIT 100').bind(buildId).all()).results || [];
    return json({ orders: rows.map(r => ({ ...r, ref: r.id.slice(2).toUpperCase(), items: JSON.parse(r.items || '[]') })) });
  }
  if (m === 'DELETE') { await env.DB.prepare('DELETE FROM shop_orders WHERE build_id = ?').bind(buildId).run(); return json({ ok: true }); }
  return json({ error: 'Not found.' }, 404);
}
