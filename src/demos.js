// Demo sites sent to prospects, and the replies people send back (to demos and to cold emails).
// Rows are added from the admin, or straight into D1 by Claude each time a demo email goes out.

export const DEMO_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS demos (id TEXT PRIMARY KEY, business TEXT NOT NULL, trade TEXT NOT NULL DEFAULT '', area TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', facebook TEXT NOT NULL DEFAULT '', idea TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'sent', sent_at TEXT NOT NULL DEFAULT '', lead_id TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS demos_sent ON demos(sent_at)`,
  `CREATE TABLE IF NOT EXISTS replies (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL DEFAULT '', demo_id TEXT NOT NULL DEFAULT '', business TEXT NOT NULL DEFAULT '', from_name TEXT NOT NULL DEFAULT '', from_email TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', received_at TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', created TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS replies_lead ON replies(lead_id)`,
  `CREATE INDEX IF NOT EXISTS replies_demo ON replies(demo_id)`
];

export const DEMO_STATUSES = ['building', 'scheduled', 'sent', 'replied', 'interested', 'won', 'declined', 'quiet'];
const REPLY_STATUSES = ['new', 'seen', 'done'];

const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
class Bad extends Error {}
const text = max => v => { const s = String(v == null ? '' : v).replace(CTRL, '').replace(/\r/g, '').trim(); if (s.length > max) throw new Bad(`That's too long (max ${max} characters).`); return s; };
const line = max => v => text(max)(v).replace(/\s+/g, ' ');
const oneOf = list => v => { const s = String(v == null ? '' : v); if (!list.includes(s)) throw new Bad('That option isn\'t allowed.'); return s; };
const when = v => { const s = String(v == null ? '' : v).trim(); if (!s) return ''; if (isNaN(Date.parse(s))) throw new Bad('Please choose a valid date and time.'); return new Date(s).toISOString(); };
const email = v => { const s = line(160)(v).toLowerCase(); if (s && !/^[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}$/i.test(s)) throw new Bad("That email address doesn't look right."); return s; };
const url = v => { const s = line(400)(v); if (!s) return ''; let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { throw new Bad("That web address doesn't look right."); } if (!/^https?:$/.test(u.protocol)) throw new Bad("That web address doesn't look right."); return u.href; };
const ref = v => { const s = String(v == null ? '' : v).trim(); if (s && !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(s)) throw new Bad('Unknown link.'); return s; };

const FIELDS = {
  demos: { business: line(120), trade: line(80), area: line(120), url, contact: line(120), email, phone: line(40), facebook: url, idea: text(400), subject: line(200), status: oneOf(DEMO_STATUSES), sent_at: when, lead_id: ref, notes: text(4000) },
  replies: { lead_id: ref, demo_id: ref, business: line(120), from_name: line(120), from_email: email, subject: line(200), body: text(8000), received_at: when, status: oneOf(REPLY_STATUSES) }
};
function clean(kind, body, partial) {
  const out = {};
  for (const [k, fn] of Object.entries(FIELDS[kind])) if (body[k] !== undefined) out[k] = fn(body[k]);
  if (!partial && kind === 'demos' && !out.business) throw new Bad('Please fill in the business name.');
  if (!partial && kind === 'replies' && !out.body) throw new Bad('Paste in what they said.');
  if (partial && 'business' in out && !out.business && kind === 'demos') throw new Bad("The business name can't be empty.");
  return out;
}

const now = () => new Date().toISOString();
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const run = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).run();
const newId = p => p + '_' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => b.toString(16).padStart(2, '0')).join('');
async function insert(env, table, row) { const k = Object.keys(row); await run(env, `INSERT INTO ${table} (${k.join(', ')}) VALUES (${k.map(() => '?').join(', ')})`, ...k.map(x => row[x])); }
async function update(env, table, id, row) { const k = Object.keys(row); if (!k.length) return; await run(env, `UPDATE ${table} SET ${k.map(x => x + ' = ?').join(', ')} WHERE id = ?`, ...k.map(x => row[x]), id); }

// a reply moves its demo or lead forward (never backwards, and never out of won/interested)
async function bumpForReply(env, r) {
  if (r.demo_id) await run(env, "UPDATE demos SET status = 'replied', updated = ? WHERE id = ? AND status IN ('building', 'scheduled', 'sent', 'quiet')", now(), r.demo_id);
  if (r.lead_id) await run(env, "UPDATE leads SET status = 'replied', updated = ? WHERE id = ? AND status IN ('check', 'ready', 'contacted', 'followup', 'hold')", now().slice(0, 10), r.lead_id);
}

export async function adminDemos(env, res, id, sub, m, body, log) {
  try {
    if (res === 'demos') {
      if (!id) {
        if (m === 'GET') {
          const [demos, reps] = await Promise.all([
            all(env, 'SELECT * FROM demos ORDER BY CASE WHEN sent_at = \'\' THEN 1 ELSE 0 END, sent_at DESC, created DESC'),
            all(env, "SELECT demo_id, COUNT(*) AS n, SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS unread, MAX(received_at) AS last FROM replies WHERE demo_id != '' GROUP BY demo_id")
          ]);
          const r = Object.fromEntries(reps.map(x => [x.demo_id, x]));
          return reply({ demos: demos.map(d => ({ ...d, replies: (r[d.id] || {}).n || 0, unread: (r[d.id] || {}).unread || 0, lastReply: (r[d.id] || {}).last || '' })) });
        }
        if (m === 'POST') {
          const v = clean('demos', body);
          const base = 'd_' + (v.business.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'demo');
          let did = base, n = 2; while (await first(env, 'SELECT 1 FROM demos WHERE id = ?', did)) did = base + '-' + n++;
          await insert(env, 'demos', { status: 'sent', ...v, id: did, created: now(), updated: now() });
          await log('Added demo for ' + v.business.slice(0, 40)); return reply({ ok: true, id: did });
        }
        return reply({ error: 'Not found.' }, 404);
      }
      const d = await first(env, 'SELECT * FROM demos WHERE id = ?', id);
      if (!d) return reply({ error: 'That demo could not be found.' }, 404);
      if (m === 'GET') {
        const [replies, lead] = await Promise.all([
          all(env, 'SELECT * FROM replies WHERE demo_id = ? ORDER BY received_at DESC, created DESC', id),
          d.lead_id ? first(env, 'SELECT id, name, status FROM leads WHERE id = ?', d.lead_id) : null
        ]);
        // opening the demo counts as reading its replies (the page still shows them as new this once)
        if (replies.some(r => r.status === 'new')) await run(env, "UPDATE replies SET status = 'seen' WHERE demo_id = ? AND status = 'new'", id);
        return reply({ demo: d, replies, lead });
      }
      if (m === 'PATCH') { const v = clean('demos', body, true); await update(env, 'demos', id, { ...v, updated: now() }); if (v.status && v.status !== d.status) await log(`Moved demo ${d.business.slice(0, 40)} to ${v.status}`); return reply({ ok: true }); }
      if (m === 'DELETE') { await env.DB.batch([env.DB.prepare('DELETE FROM replies WHERE demo_id = ?').bind(id), env.DB.prepare('DELETE FROM demos WHERE id = ?').bind(id)]); await log('Deleted demo ' + d.business.slice(0, 40)); return reply({ ok: true }); }
      return reply({ error: 'Not found.' }, 404);
    }
    if (res === 'replies') {
      if (!id) {
        if (m === 'GET') return reply({ replies: await all(env, `SELECT r.*, COALESCE(NULLIF(r.business, ''), d.business, l.name, '') AS who FROM replies r LEFT JOIN demos d ON d.id = r.demo_id LEFT JOIN leads l ON l.id = r.lead_id ORDER BY r.received_at DESC, r.created DESC LIMIT 300`) });
        if (m === 'POST') {
          const v = clean('replies', body);
          if (!v.received_at) v.received_at = now();
          if (v.demo_id && !(await first(env, 'SELECT 1 FROM demos WHERE id = ?', v.demo_id))) throw new Bad('That demo could not be found.');
          if (v.lead_id && !(await first(env, 'SELECT 1 FROM leads WHERE id = ?', v.lead_id))) throw new Bad('That lead could not be found.');
          const rid = newId('r');
          await insert(env, 'replies', { status: 'new', ...v, id: rid, created: now() });
          await bumpForReply(env, v);
          await log('Logged a reply from ' + (v.business || v.from_name || v.from_email || 'a prospect').slice(0, 40)); return reply({ ok: true, id: rid });
        }
        return reply({ error: 'Not found.' }, 404);
      }
      const r = await first(env, 'SELECT * FROM replies WHERE id = ?', id);
      if (!r) return reply({ error: 'That reply could not be found.' }, 404);
      if (m === 'PATCH') { const v = clean('replies', body, true); await update(env, 'replies', id, v); return reply({ ok: true }); }
      if (m === 'DELETE') { await run(env, 'DELETE FROM replies WHERE id = ?', id); await log('Deleted a reply'); return reply({ ok: true }); }
      return reply({ error: 'Not found.' }, 404);
    }
    return null;
  } catch (e) {
    if (e instanceof Bad) return reply({ error: e.message }, 422);
    throw e;
  }
}
