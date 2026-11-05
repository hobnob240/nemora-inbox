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
  const pth = u.pathname.replace(/^\/v[\d.]+/, '');
  if (!['/oauth/access_token', '/me/accounts', '/debug_token', '/me/businesses'].includes(pth) && !(pth === '/PAGE1' && tok === 'LONG-USER') && tok !== 'test-token' && tok !== 'PAGE-TOKEN-FROM-OAUTH') return send({ error: { message: 'Invalid OAuth access token.' } }, 400);
  const p = u.pathname.replace(/^\/v[\d.]+/, '');
  if (p === '/oauth/access_token') { const q = u.searchParams; if (q.get('client_secret') !== 'app-secret') return send({ error: { message: 'Error validating client secret.' } }, 400); return send({ access_token: q.get('grant_type') === 'fb_exchange_token' ? 'LONG-USER' : 'SHORT-USER' }); }
  if (p === '/debug_token') return send({ data: { scopes: ['pages_show_list', 'pages_manage_posts'], granular_scopes: [{ scope: 'pages_show_list', target_ids: ['PAGE1'] }] } });
  if (p === '/me/businesses') return send({ data: [] });
  if (p === '/PAGE1' && tok === 'LONG-USER') return send({ id: 'PAGE1', name: 'NEMORA', access_token: 'PAGE-TOKEN-FROM-OAUTH', tasks: ['MANAGE'], instagram_business_account: { id: 'IG1', username: 'nemora.uk' } });
  if (p === '/me/accounts' && process.env.EMPTY_ACCOUNTS) return send({ data: [] });
  if (p === '/me/accounts') { if (u.searchParams.get('access_token') !== 'LONG-USER') return send({ error: { message: 'bad user token' } }, 400); return send({ data: [{ id: 'PAGE1', name: 'NEMORA', access_token: 'PAGE-TOKEN-FROM-OAUTH', tasks: ['MANAGE', 'CREATE_CONTENT'], instagram_business_account: { id: 'IG1', username: 'nemora.uk' } }, { id: 'PAGE9', name: 'Random page', access_token: 'OTHER', tasks: ['ANALYZE'] }] }); }
  if (p === '/me') { const t = u.searchParams.get('access_token'); if (t !== 'test-token' && t !== 'PAGE-TOKEN-FROM-OAUTH') return send({ error: { message: 'Invalid OAuth access token.' } }, 400); }
  if (p === '/me') return send({ id: 'PAGE1', name: 'NEMORA', instagram_business_account: { id: 'IG1', username: 'nemora.uk' } });
  if (p === '/PAGE1/photos') return send({ id: 'PH' + n++, post_id: 'PAGE1_' + n++ });
  if (p === '/PAGE1/feed') return send({ id: 'PAGE1_' + n++ });
  if (p === '/PAGE1/videos') return send({ id: 'V' + n++ });
  if (p === '/IG1/media') { if ((body.get('image_url') || body.get('video_url') || '').includes('broken')) return send({ error: { message: 'Only photo or video can be accepted as media type.' } }, 400); const id = 'C' + n++; seen[id] = body.get('media_type') === 'REELS' ? 0 : 2; return send({ id }); }
  if (p === '/IG1/media_publish') return send({ id: 'M' + n++ });
  // results (insights) for posted media: Instagram and Facebook
  if (/^\/M\d+\/insights$/.test(p)) { const ms = (u.searchParams.get('metric') || '').split(','); if (ms.includes('views') && process.env.MOCK_NO_VIEWS) return send({ error: { message: '(#100) metric[1] must be one of the following values: reach, saved' } }, 400); return send({ data: ms.map((name, i) => ({ name, period: 'lifetime', values: [{ value: 10 * (i + 1) }] })) }); }
  if (/^\/[^/]+\/(insights|video_insights)$/.test(p)) return send({ data: (u.searchParams.get('metric') || '').split(',').map(name => ({ name, values: [{ value: 42 }] })) });
  if (/^\/M\d+$/.test(p) && (u.searchParams.get('fields') || '').includes('like_count')) return send({ like_count: 7, comments_count: 2 });
  if ((u.searchParams.get('fields') || '').includes('summary(true)')) return send({ reactions: { summary: { total_count: 5 } }, likes: { summary: { total_count: 4 } }, comments: { summary: { total_count: 1 } }, shares: { count: 3 } });
  // comments and messages
  const ago = mins => new Date(Date.now() - mins * 60000).toISOString().replace('Z', '+0000');
  if (p === '/__sent') return send(globalThis.__sent || []);
  if (p === '/FBPOST/comments' && req.method === 'GET') return send({ data: [
    { id: 'FC1', from: { id: 'U1', name: 'Jane Smith' }, message: 'How much would a website for my salon be?', created_time: ago(50), comments: { data: [] } },
    { id: 'FC2', from: { id: 'U2', name: 'Tom Hughes' }, message: 'Looks great!', created_time: ago(300), comments: { data: [{ id: 'FC2R', from: { id: 'PAGE1', name: 'NEMORA' }, message: 'Thanks Tom!', created_time: ago(200) }] } }] });
  if (p === '/IGM1/comments' && req.method === 'GET') return send({ data: [{ id: 'IC1', text: 'love this 🔥', username: 'sam.builds', timestamp: ago(30), replies: { data: [] } }] });
  if (p === '/PAGE1/conversations' && req.method === 'GET') {
    if (process.env.MOCK_NO_MSG_PERM) return send({ error: { message: '(#200) Requires pages_messaging permission to manage the object' } }, 400);
    if (u.searchParams.get('platform') === 'instagram') return send({ data: [{ id: 'T2', updated_time: ago(60 * 30), messages: { data: [{ id: 'IM1', message: 'Do you build shops?', from: { id: 'IGS9', username: 'kerry.cakes' }, created_time: ago(60 * 30) }] } }] });
    return send({ data: [{ id: 'T1', updated_time: ago(5), messages: { data: [{ id: 'MM2', message: 'Do you do websites for barbers?', from: { id: 'PSID3', name: 'Ali Khan' }, created_time: ago(5) }, { id: 'MM1', message: 'Hi', from: { id: 'PSID3', name: 'Ali Khan' }, created_time: ago(6) }] } }] });
  }
  if (/^\/(FC\d+)\/comments$/.test(p) || /^\/IC\d+\/replies$/.test(p) || p === '/PAGE1/messages') { (globalThis.__sent = globalThis.__sent || []).push({ path: p, body: Object.fromEntries(body) }); return send(p === '/PAGE1/messages' ? { recipient_id: 'x', message_id: 'mid.' + n++ } : { id: 'R' + n++ }); }
  const id = p.slice(1);
  if (u.searchParams.get('fields') === 'status_code') { seen[id] = (seen[id] || 0) + 1; return send({ status_code: seen[id] >= 2 ? 'FINISHED' : 'IN_PROGRESS' }); }
  if (u.searchParams.get('fields') === 'permalink') return send({ permalink: 'https://www.instagram.com/p/' + id + '/' });
  send({ error: { message: 'Unknown path ' + p } }, 404);
}).listen(8802, () => console.log('meta mock on 8802'));
