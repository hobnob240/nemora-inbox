// Fake Graph API for local tests of the social publisher. Never used in production.
import http from 'node:http';
const seen = {}; let n = 1000; const calls = [];
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const u = new URL(req.url, 'http://x'); const body = new URLSearchParams(Buffer.concat(chunks).toString());
  const tok = u.searchParams.get('access_token') || body.get('access_token');
  calls.push({ m: req.method, p: u.pathname, body: Object.fromEntries([...body].filter(([k]) => k !== 'access_token')) });
  const send = (d, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); };
  if (u.pathname === '/__calls') return send(calls);
  if (tok !== 'test-token') return send({ error: { message: 'Invalid OAuth access token.' } }, 400);
  const p = u.pathname.replace(/^\/v[\d.]+/, '');
  if (p === '/me') return send({ id: 'PAGE1', name: 'NEMORA', instagram_business_account: { id: 'IG1', username: 'nemora.uk' } });
  if (p === '/PAGE1/photos') return send({ id: 'PH' + n++, post_id: 'PAGE1_' + n++ });
  if (p === '/PAGE1/feed') return send({ id: 'PAGE1_' + n++ });
  if (p === '/PAGE1/videos') return send({ id: 'V' + n++ });
  if (p === '/IG1/media') { if ((body.get('image_url') || body.get('video_url') || '').includes('broken')) return send({ error: { message: 'Only photo or video can be accepted as media type.' } }, 400); const id = 'C' + n++; seen[id] = body.get('media_type') === 'REELS' ? 0 : 2; return send({ id }); }
  if (p === '/IG1/media_publish') return send({ id: 'M' + n++ });
  const id = p.slice(1);
  if (u.searchParams.get('fields') === 'status_code') { seen[id] = (seen[id] || 0) + 1; return send({ status_code: seen[id] >= 2 ? 'FINISHED' : 'IN_PROGRESS' }); }
  if (u.searchParams.get('fields') === 'permalink') return send({ permalink: 'https://www.instagram.com/p/' + id + '/' });
  send({ error: { message: 'Unknown path ' + p } }, 404);
}).listen(8802, () => console.log('meta mock on 8802'));
