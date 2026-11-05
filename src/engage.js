// NEMORA social replies: comments and messages on the Facebook Page and Instagram, collected every 15 minutes.
// The social media agent (a scheduled Claude task) reads new ones from D1 and writes a reply in NEMORA's voice,
// passes anything sensitive to Charlie, or skips spam. This Worker sends approved replies on its next run.
// Personal data: commenters' names and words are kept only as long as needed (90 days) and never leave Meta/D1.
import { graph, metaIds, pageToken } from './social.js';

export const INBOX_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS social_inbox (id TEXT PRIMARY KEY, channel TEXT NOT NULL, post_id TEXT NOT NULL DEFAULT '', target TEXT NOT NULL DEFAULT '', thread TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '', author_id TEXT NOT NULL DEFAULT '', text TEXT NOT NULL DEFAULT '', context TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', reply TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', reply_id TEXT NOT NULL DEFAULT '', replied_at TEXT NOT NULL DEFAULT '', replied_by TEXT NOT NULL DEFAULT '', fetched TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS social_inbox_status ON social_inbox(status, created)`
];
export const CHANNELS = { fb_comment: 'Facebook comment', ig_comment: 'Instagram comment', fb_dm: 'Facebook message', ig_dm: 'Instagram message' };
const now = () => new Date().toISOString();
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
const clean = (v, max) => String(v == null ? '' : v).replace(CTRL, '').replace(/\r/g, '').trim().slice(0, max);
const iso = t => { const d = Date.parse(String(t || '').replace(/\+0000$/, 'Z')); return isNaN(d) ? now() : new Date(d).toISOString(); };
let ready = false;
export async function ensureInbox(env) { if (ready) return; for (const s of INBOX_SCHEMA) await env.DB.prepare(s).run(); ready = true; }

async function add(env, it) {
  const r = await env.DB.prepare('INSERT OR IGNORE INTO social_inbox (id, channel, post_id, target, thread, author, author_id, text, context, created, status, fetched, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(it.id, it.channel, it.post_id || '', it.target, it.thread || '', clean(it.author, 120), String(it.author_id || ''), clean(it.text, 4000), clean(it.context, 1500), it.created, it.status || 'new', now(), now()).run();
  return !!(r && r.meta ? r.meta.changes : 1);
}
// if NEMORA (or Charlie by hand) already answered after this message, it's handled: don't reply twice
async function answered(env, id, by) {
  await env.DB.prepare("UPDATE social_inbox SET status = 'sent', replied_by = ?, updated = ? WHERE id = ? AND status IN ('new', 'needs_charlie')").bind(by, now(), id).run();
}

/* ---------- collect: comments on recent posts, and recent conversations ---------- */
export async function pollEngagement(env) {
  if (!(await pageToken(env))) return { skipped: 'not connected' };
  await ensureInbox(env);
  const ids = await metaIds(env); if (!ids || !ids.page) return { skipped: 'no page' };
  const errs = [], found = { comments: 0, messages: 0 };
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const posts = (await env.DB.prepare("SELECT id, kind, caption, fb_id, ig_id FROM social_posts WHERE status = 'posted' AND posted_at >= ? ORDER BY posted_at DESC LIMIT 10").bind(since).all()).results || [];
  for (const p of posts) {
    const ctx = 'Our post: ' + String(p.caption || '').slice(0, 600);
    if (p.fb_id) try {
      const d = await graph(env, 'GET', '/' + p.fb_id + '/comments', { fields: 'id,from{id,name},message,created_time,comments.limit(25){id,from{id,name},message,created_time}', filter: 'toplevel', order: 'chronological', limit: '50' });
      for (const c of d.data || []) {
        const kids = (c.comments && c.comments.data) || [];
        const ours = kids.filter(k => k.from && k.from.id === ids.page).map(k => iso(k.created_time));
        const lastOurs = ours.length ? ours.sort().pop() : '';
        const items = [c, ...kids].filter(x => x.from && x.from.id !== ids.page && x.message);
        for (const x of items) {
          const it = { id: 'fbc_' + x.id, channel: 'fb_comment', post_id: p.id, target: c.id, thread: c.id, author: x.from.name, author_id: x.from.id, text: x.message, context: ctx + (x !== c ? '\nIn reply to: ' + String(c.message || '').slice(0, 300) : ''), created: iso(x.created_time) };
          if (await add(env, it)) found.comments++;
          if (lastOurs && lastOurs > it.created) await answered(env, it.id, 'page');
        }
      }
    } catch (e) { errs.push('Facebook comments: ' + e.message); }
    if (p.ig_id) try {
      const d = await graph(env, 'GET', '/' + p.ig_id + '/comments', { fields: 'id,text,username,timestamp,from{id,username},replies{id,text,username,timestamp,from{id,username}}', limit: '50' });
      for (const c of d.data || []) {
        const kids = (c.replies && c.replies.data) || [];
        const mine = u => ids.igName && String(u || '').toLowerCase() === ids.igName.toLowerCase();
        const lastOurs = kids.filter(k => mine(k.username)).map(k => iso(k.timestamp)).sort().pop() || '';
        for (const x of [c, ...kids].filter(x => !mine(x.username) && x.text)) {
          const it = { id: 'igc_' + x.id, channel: 'ig_comment', post_id: p.id, target: c.id, thread: c.id, author: '@' + (x.username || (x.from || {}).username || 'someone'), author_id: (x.from || {}).id || '', text: x.text, context: ctx + (x !== c ? '\nIn reply to: ' + String(c.text || '').slice(0, 300) : ''), created: iso(x.timestamp) };
          if (await add(env, it)) found.comments++;
          if (lastOurs && lastOurs > it.created) await answered(env, it.id, 'page');
        }
      }
    } catch (e) { errs.push('Instagram comments: ' + e.message); }
  }
  // messages: the last week's conversations on Messenger and Instagram Direct
  for (const [platform, channel] of [['messenger', 'fb_dm'], ['instagram', 'ig_dm']]) {
    if (platform === 'instagram' && !ids.ig) continue;
    try {
      const d = await graph(env, 'GET', '/' + ids.page + '/conversations', { platform, fields: 'id,updated_time,messages.limit(6){id,message,from,created_time}', limit: '15' });
      for (const conv of d.data || []) {
        if (Date.parse(String(conv.updated_time || '').replace(/\+0000$/, 'Z')) < Date.now() - 7 * 864e5) continue;
        const msgs = ((conv.messages && conv.messages.data) || []).slice().reverse();   // oldest first
        const isUs = f => f && (f.id === ids.page || f.id === ids.ig || (ids.igName && String(f.username || '').toLowerCase() === ids.igName.toLowerCase()));
        const lastOurs = msgs.filter(mm => isUs(mm.from)).map(mm => iso(mm.created_time)).sort().pop() || '';
        const earlier = [];
        for (const mm of msgs) {
          if (isUs(mm.from)) { earlier.push('NEMORA: ' + String(mm.message || '').slice(0, 300)); continue; }
          if (!mm.message) { earlier.push('Them: (a photo, sticker or attachment)'); continue; }
          const it = { id: (channel === 'fb_dm' ? 'fbm_' : 'igm_') + mm.id, channel, target: (mm.from || {}).id || '', thread: conv.id, author: (mm.from || {}).name || ((mm.from || {}).username ? '@' + mm.from.username : 'someone'), author_id: (mm.from || {}).id || '', text: mm.message, context: earlier.slice(-4).join('\n'), created: iso(mm.created_time) };
          if (await add(env, it)) found.messages++;
          if (lastOurs && lastOurs > it.created) await answered(env, it.id, 'page');
          earlier.push('Them: ' + String(mm.message).slice(0, 300));
        }
      }
    } catch (e) { errs.push((platform === 'messenger' ? 'Facebook' : 'Instagram') + ' messages: ' + e.message); }
  }
  const status = { at: now(), ...found, errors: errs.slice(0, 6) };
  await env.KV.put('engage:status', JSON.stringify(status));
  return status;
}

/* ---------- send: replies the agent (or Charlie) approved ---------- */
const DM_WINDOW = 24 * 3600e3;   // Meta only allows standard replies within 24 hours of their last message
export async function sendReplies(env) {
  if (!(await pageToken(env))) return [];
  await ensureInbox(env);
  const ids = await metaIds(env); if (!ids || !ids.page) return [];
  const rows = (await env.DB.prepare("SELECT * FROM social_inbox WHERE status = 'approved' ORDER BY created LIMIT 10").all()).results || [];
  const out = [];
  for (const r of rows) {
    // claim it first so a reply can never go out twice
    const claim = await env.DB.prepare("UPDATE social_inbox SET status = 'sending', updated = ? WHERE id = ? AND status = 'approved'").bind(now(), r.id).run();
    if (claim && claim.meta && claim.meta.changes === 0) continue;
    const text = clean(r.reply, 2000);
    try {
      if (!text) throw new Error('The reply is empty.');
      let res;
      if (r.channel === 'fb_comment') res = await graph(env, 'POST', '/' + r.target + '/comments', { message: text });
      else if (r.channel === 'ig_comment') res = await graph(env, 'POST', '/' + r.target + '/replies', { message: text });
      else {
        const last = await env.DB.prepare("SELECT MAX(created) m FROM social_inbox WHERE thread = ? AND channel = ?").bind(r.thread, r.channel).first();
        if (Date.now() - Date.parse((last && last.m) || r.created) > DM_WINDOW) throw new Error('More than 24 hours since their last message, so Meta won\'t let the Page reply automatically. Reply from the Facebook or Instagram app instead.');
        res = await graph(env, 'POST', '/' + ids.page + '/messages', { recipient: JSON.stringify({ id: r.target }), messaging_type: 'RESPONSE', message: JSON.stringify({ text }) });
      }
      const rid = String((res && (res.id || res.message_id)) || '');
      await env.DB.prepare("UPDATE social_inbox SET status = 'sent', reply_id = ?, replied_at = ?, error = '', updated = ? WHERE id = ?").bind(rid, now(), now(), r.id).run();
      // the same person's other unanswered messages in this conversation are answered by this reply
      if (r.channel.endsWith('_dm')) await env.DB.prepare("UPDATE social_inbox SET status = 'sent', replied_by = 'grouped', updated = ? WHERE thread = ? AND status = 'new' AND created <= ?").bind(now(), r.thread, r.created).run();
      out.push({ id: r.id, ok: true });
    } catch (e) {
      await env.DB.prepare("UPDATE social_inbox SET status = 'failed', error = ?, updated = ? WHERE id = ?").bind(String(e.message).slice(0, 300), now(), r.id).run();
      out.push({ id: r.id, error: e.message });
    }
  }
  return out;
}

export async function tidyInbox(env) {
  await ensureInbox(env);
  await env.DB.prepare('DELETE FROM social_inbox WHERE created < ?').bind(new Date(Date.now() - 90 * 864e5).toISOString()).run();
}

/* ---------- admin: see everything, reply yourself, approve or skip ---------- */
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export async function adminInbox(env, m, body, log) {
  await ensureInbox(env);
  if (m === 'GET') {
    const rows = (await env.DB.prepare("SELECT i.*, p.caption AS post_caption FROM social_inbox i LEFT JOIN social_posts p ON p.id = i.post_id ORDER BY CASE i.status WHEN 'needs_charlie' THEN 0 WHEN 'failed' THEN 1 WHEN 'new' THEN 2 WHEN 'approved' THEN 3 WHEN 'sending' THEN 3 ELSE 4 END, i.created DESC LIMIT 150").all()).results || [];
    return reply({ items: rows.map(r => ({ ...r, post_caption: String(r.post_caption || '').slice(0, 140) })), status: await env.KV.get('engage:status', 'json'), channels: CHANNELS });
  }
  if (m === 'POST') {
    const it = await env.DB.prepare('SELECT * FROM social_inbox WHERE id = ?').bind(String(body.id || '')).first();
    if (!it) return reply({ error: 'That message could not be found.' }, 404);
    if (['sent', 'sending'].includes(it.status)) return reply({ error: 'That has already been answered.' }, 409);
    if (body.action === 'skip') {
      await env.DB.prepare("UPDATE social_inbox SET status = 'skipped', reason = ?, replied_by = 'charlie', updated = ? WHERE id = ?").bind('Charlie: no reply needed', now(), it.id).run();
      await log('Skipped a ' + (CHANNELS[it.channel] || 'message').toLowerCase()); return reply({ ok: true });
    }
    if (body.action === 'reply') {
      const text = clean(body.text, 2000); if (!text) return reply({ error: 'Write a reply first.' }, 422);
      await env.DB.prepare("UPDATE social_inbox SET status = 'approved', reply = ?, replied_by = 'charlie', error = '', updated = ? WHERE id = ?").bind(text, now(), it.id).run();
      await log('Replied to a ' + (CHANNELS[it.channel] || 'message').toLowerCase()); return reply({ ok: true });
    }
    return reply({ error: 'Unknown action.' }, 422);
  }
  return reply({ error: 'Not found.' }, 404);
}
