// "Your list": leads the outreach agent can't email (sole traders, or no published email) that Charlie
// contacts himself by Instagram/Facebook DM or phone. The agent adds ~25 a day straight into D1.

export const MYLIST_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS mylist (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL DEFAULT '', business TEXT NOT NULL, trade TEXT NOT NULL DEFAULT '', area TEXT NOT NULL DEFAULT '', legal TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', instagram TEXT NOT NULL DEFAULT '', facebook TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '', demo_url TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '', detail_source TEXT NOT NULL DEFAULT '', dm TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'todo', dm_at TEXT NOT NULL DEFAULT '', called_at TEXT NOT NULL DEFAULT '', replied_at TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', added TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE UNIQUE INDEX IF NOT EXISTS mylist_biz ON mylist(business COLLATE NOCASE, area COLLATE NOCASE)`,
  `CREATE INDEX IF NOT EXISTS mylist_status ON mylist(status, added)`
];

export const MYLIST_STATUSES = ['todo', 'dm_sent', 'called', 'replied', 'not_interested'];

const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
class Bad extends Error {}
const text = max => v => { const s = String(v == null ? '' : v).replace(CTRL, '').replace(/\r/g, '').trim(); if (s.length > max) throw new Bad(`That's too long (max ${max} characters).`); return s; };
const line = max => v => text(max)(v).replace(/\s+/g, ' ');
const oneOf = list => v => { const s = String(v == null ? '' : v); if (!list.includes(s)) throw new Bad('That option isn\'t allowed.'); return s; };
const phone = v => { const s = line(30)(v); if (s && !/^[+0-9 ()-]{6,30}$/.test(s)) throw new Bad("That phone number doesn't look right."); return s; };
const url = v => { const s = line(400)(v); if (!s) return ''; let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { throw new Bad("That web address doesn't look right."); } if (!/^https?:$/.test(u.protocol)) throw new Bad("That web address doesn't look right."); return u.href; };
const ref = v => { const s = String(v == null ? '' : v).trim(); if (s && !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(s)) throw new Bad('Unknown link.'); return s; };

const FIELDS = { lead_id: ref, business: line(120), trade: line(80), area: line(120), legal: line(120), phone, instagram: url, facebook: url, website: url, demo_url: url, detail: text(400), detail_source: url, dm: text(1200), status: oneOf(MYLIST_STATUSES), notes: text(2000) };
function clean(body, partial) {
  const out = {};
  for (const [k, fn] of Object.entries(FIELDS)) if (body[k] !== undefined) out[k] = fn(body[k]);
  if ((!partial || 'business' in out) && !out.business) throw new Bad('Please fill in the business name.');
  return out;
}

const now = () => new Date().toISOString();
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const run = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).run();

// what each button records, and what it means for the matching lead (if this came from leads)
const STAMP = { dm_sent: 'dm_at', called: 'called_at', replied: 'replied_at' };
async function syncLead(env, item, status) {
  if (!item.lead_id) return;
  const day = now().slice(0, 10);
  if (status === 'replied') await run(env, "UPDATE leads SET status = 'replied', updated = ? WHERE id = ? AND status IN ('check', 'ready', 'contacted', 'followup', 'hold')", day, item.lead_id);
  if (status === 'not_interested') await run(env, "UPDATE leads SET status = 'dnc', next = 'Said not interested (Your list)', updated = ? WHERE id = ? AND status NOT IN ('won', 'interested')", day, item.lead_id);
}

export async function adminMyList(env, id, m, body, log) {
  try {
    if (!id) {
      if (m === 'GET') {
        const { results } = await env.DB.prepare("SELECT * FROM mylist ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'dm_sent' THEN 1 WHEN 'called' THEN 1 WHEN 'replied' THEN 2 ELSE 3 END, added DESC, business LIMIT 500").all();
        return reply({ items: results || [] });
      }
      if (m === 'POST') {
        const v = clean(body);
        if (await first(env, 'SELECT 1 FROM mylist WHERE business = ? COLLATE NOCASE AND area = ? COLLATE NOCASE', v.business, v.area || '')) throw new Bad('That business is already on your list.');
        const base = 'm_' + (v.business.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'lead');
        let mid = base, n = 2; while (await first(env, 'SELECT 1 FROM mylist WHERE id = ?', mid)) mid = base + '-' + n++;
        const row = { status: 'todo', ...v, id: mid, added: now().slice(0, 10), updated: now() };
        const k = Object.keys(row);
        await run(env, `INSERT INTO mylist (${k.join(', ')}) VALUES (${k.map(() => '?').join(', ')})`, ...k.map(x => row[x]));
        await log('Added ' + v.business.slice(0, 40) + ' to Your list'); return reply({ ok: true, id: mid });
      }
      return reply({ error: 'Not found.' }, 404);
    }
    const item = await first(env, 'SELECT * FROM mylist WHERE id = ?', id);
    if (!item) return reply({ error: 'That lead could not be found.' }, 404);
    if (m === 'PATCH') {
      const v = clean(body, true), row = { ...v, updated: now() };
      if (v.status && STAMP[v.status] && !item[STAMP[v.status]]) row[STAMP[v.status]] = now();
      const k = Object.keys(row);
      await run(env, `UPDATE mylist SET ${k.map(x => x + ' = ?').join(', ')} WHERE id = ?`, ...k.map(x => row[x]), id);
      if (v.status && v.status !== item.status) { await syncLead(env, item, v.status); await log(`Your list: ${item.business.slice(0, 40)} → ${v.status.replace('_', ' ')}`); }
      return reply({ ok: true });
    }
    if (m === 'DELETE') { await run(env, 'DELETE FROM mylist WHERE id = ?', id); await log('Removed ' + item.business.slice(0, 40) + ' from Your list'); return reply({ ok: true }); }
    return reply({ error: 'Not found.' }, 404);
  } catch (e) {
    if (e instanceof Bad) return reply({ error: e.message }, 422);
    throw e;
  }
}
