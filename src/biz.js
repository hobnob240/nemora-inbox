// NEMORA business back office: leads (outreach), clients, projects, invoices, reports and settings, stored in D1.
// Every route here is only reachable with a valid admin session (checked in worker.js before adminBiz is called),
// and every change must come from the admin's own origin. All input is validated against the field lists below;
// SQL always uses bound parameters.

import { adminSocial, SOCIAL_SCHEMA } from './social.js';

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT '', area TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT 'UK', status TEXT NOT NULL DEFAULT 'check', channel TEXT NOT NULL DEFAULT '', legal TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', socials TEXT NOT NULL DEFAULT '', reviews INTEGER NOT NULL DEFAULT 0, fit INTEGER NOT NULL DEFAULT 0, package TEXT NOT NULL DEFAULT '', pitch TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', next TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', found TEXT NOT NULL DEFAULT '', vetted TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL DEFAULT '', business TEXT NOT NULL DEFAULT '', to_email TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT '', slot TEXT NOT NULL DEFAULT '', not_before TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', checks TEXT NOT NULL DEFAULT '', fit INTEGER NOT NULL DEFAULT 0, queued_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS sendlog (id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id TEXT NOT NULL DEFAULT '', business TEXT NOT NULL DEFAULT '', to_email TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT '', sent_at TEXT NOT NULL DEFAULT '', checks TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, business TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', lead_id TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, client_id TEXT NOT NULL DEFAULT '', lead_id TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, package TEXT NOT NULL DEFAULT '', price_pence INTEGER NOT NULL DEFAULT 0, monthly_pence INTEGER NOT NULL DEFAULT 0, stage TEXT NOT NULL DEFAULT 'preview', due TEXT NOT NULL DEFAULT '', preview_url TEXT NOT NULL DEFAULT '', live_url TEXT NOT NULL DEFAULT '', brief TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, client_id TEXT NOT NULL, project_id TEXT NOT NULL DEFAULT '', issued TEXT NOT NULL, due TEXT NOT NULL, items TEXT NOT NULL DEFAULT '[]', total_pence INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', paid_on TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, type TEXT NOT NULL, date TEXT NOT NULL, period TEXT NOT NULL DEFAULT '', found INTEGER NOT NULL DEFAULT 0, contacted INTEGER NOT NULL DEFAULT 0, replies INTEGER NOT NULL DEFAULT 0, interested INTEGER NOT NULL DEFAULT 0, won INTEGER NOT NULL DEFAULT 0, headline TEXT NOT NULL DEFAULT '', needs_you TEXT NOT NULL DEFAULT '[]', highlights TEXT NOT NULL DEFAULT '[]')`,
  `CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS leads_status ON leads(status)`,
  `CREATE INDEX IF NOT EXISTS sendlog_sent ON sendlog(sent_at)`,
  `CREATE INDEX IF NOT EXISTS sendlog_lead ON sendlog(lead_id)`,
  `CREATE INDEX IF NOT EXISTS projects_client ON projects(client_id)`,
  `CREATE INDEX IF NOT EXISTS invoices_client ON invoices(client_id)`,
  `CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', admin_url TEXT NOT NULL DEFAULT '', client_id TEXT NOT NULL DEFAULT '', project_id TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'client', status TEXT NOT NULL DEFAULT 'live', hosting TEXT NOT NULL DEFAULT '', worker TEXT NOT NULL DEFAULT '', repo TEXT NOT NULL DEFAULT '', domain TEXT NOT NULL DEFAULT '', renews TEXT NOT NULL DEFAULT '', plan TEXT NOT NULL DEFAULT '', allowance_min INTEGER NOT NULL DEFAULT 0, monitor INTEGER NOT NULL DEFAULT 1, state TEXT NOT NULL DEFAULT '', fails INTEGER NOT NULL DEFAULT 0, last_code INTEGER NOT NULL DEFAULT 0, last_ms INTEGER NOT NULL DEFAULT 0, last_check TEXT NOT NULL DEFAULT '', down_since TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS checks (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL, ts INTEGER NOT NULL, ok INTEGER NOT NULL, code INTEGER NOT NULL DEFAULT 0, ms INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS checks_site ON checks(site_id, ts)`,
  `CREATE TABLE IF NOT EXISTS worklog (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL, day TEXT NOT NULL, minutes INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL DEFAULT 'change', what TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS worklog_site ON worklog(site_id, day)`,
  ...SOCIAL_SCHEMA
];
let ready = false;
export async function ensureBizSchema(env) {
  if (ready) return;
  await env.DB.batch(SCHEMA.map(s => env.DB.prepare(s)));
  ready = true;
}

export const LEAD_STATUSES = ['check', 'ready', 'contacted', 'followup', 'replied', 'interested', 'won', 'lost', 'hold', 'dnc'];
export const STAGES = ['preview', 'quoted', 'deposit', 'building', 'review', 'live', 'care', 'paused', 'lost'];
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'];
const PACKAGES = ['', 'Starter', 'Business', 'Premium', 'Custom'];

/* ---------- validation ---------- */
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
const text = max => v => { const s = String(v == null ? '' : v).replace(CTRL, '').replace(/\r/g, '').trim(); if (s.length > max) throw new Bad(`That's too long (max ${max} characters).`); return s; };
const line = max => v => text(max)(v).replace(/\s+/g, ' ');
const int = (min, max) => v => { if (v === '' || v == null) return 0; const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw new Bad('Please enter a whole number.'); return n; };
const pence = v => { if (v === '' || v == null) return 0; const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > 100000000) throw new Bad('That amount doesn\'t look right.'); return n; };
const date = v => { const s = String(v == null ? '' : v).trim(); if (!s) return ''; if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s))) throw new Bad('Please choose a valid date.'); return s; };
const oneOf = list => v => { const s = String(v == null ? '' : v); if (!list.includes(s)) throw new Bad('That option isn\'t allowed.'); return s; };
const email = v => { const s = line(120)(v).toLowerCase(); if (s && !/^[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}$/i.test(s)) throw new Bad("That email address doesn't look right."); return s; };
const phone = v => { const s = line(30)(v); if (s && !/^[+0-9 ()-]{6,30}$/.test(s)) throw new Bad("That phone number doesn't look right."); return s; };
const url = v => { const s = line(300)(v); if (!s) return ''; let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { throw new Bad("That web address doesn't look right."); } if (!/^https?:$/.test(u.protocol)) throw new Bad("That web address doesn't look right."); return u.href; };
const ref = v => { const s = String(v == null ? '' : v).trim(); if (s && !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(s)) throw new Bad('Unknown link.'); return s; };
class Bad extends Error {}

const FIELDS = {
  leads: { name: line(120), type: line(120), area: line(120), country: line(40), status: oneOf(LEAD_STATUSES), channel: line(120), legal: line(300), email: line(300), phone: line(60), website: line(400), address: line(300), socials: line(300), reviews: int(0, 1000000), fit: int(0, 5), package: line(40), pitch: text(600), notes: text(4000), next: text(600), source: line(300), found: date, vetted: date },
  clients: { name: line(120), business: line(120), email, phone, website: url, address: text(400), notes: text(4000), lead_id: ref },
  projects: { title: line(160), client_id: ref, lead_id: ref, package: oneOf(PACKAGES), price_pence: pence, monthly_pence: pence, stage: oneOf(STAGES), due: date, preview_url: url, live_url: url, brief: text(20000), notes: text(4000) },
  sites: { name: line(120), url: url, admin_url: url, client_id: ref, project_id: ref, kind: oneOf(['client', 'own', 'demo']), status: oneOf(['live', 'building', 'demo', 'paused', 'retired']), hosting: oneOf(['', 'Cloudflare Worker', 'Cloudflare Pages', 'GitHub Pages', 'Other']), worker: v => { const s = line(80)(v); if (s && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(s)) throw new Bad('Worker names use lowercase letters, numbers and dashes.'); return s; }, repo: v => { const s = line(120)(v).replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, ''); if (s && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s)) throw new Bad('Repos look like owner/name.'); return s; }, domain: v => line(120)(v).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), renews: date, plan: oneOf(['', 'Starter', 'Business', 'Premium', 'Custom', 'None']), allowance_min: int(0, 6000), monitor: int(0, 1), notes: text(4000) },
  invoices: { client_id: ref, project_id: ref, issued: date, due: date, notes: text(1000), status: oneOf(INVOICE_STATUSES), paid_on: date }
};
const REQUIRED = { sites: ['name'], leads: ['name'], clients: ['name'], projects: ['title'], invoices: ['client_id', 'issued', 'due'] };
function clean(kind, body, partial) {
  const out = {};
  for (const [k, fn] of Object.entries(FIELDS[kind])) if (body[k] !== undefined) out[k] = fn(body[k]);
  if (!partial) for (const k of REQUIRED[kind]) if (!out[k]) throw new Bad(`Please fill in ${k.replace(/_id$/, '').replace(/_/g, ' ')}.`);
  if (partial) for (const k of REQUIRED[kind]) if (k in out && !out[k]) throw new Bad(`${k.replace(/_id$/, '').replace(/_/g, ' ')} can't be empty.`);
  return out;
}
function items(v) {
  if (!Array.isArray(v) || !v.length) throw new Bad('Add at least one line to the invoice.');
  if (v.length > 30) throw new Bad('Too many lines (max 30).');
  return v.map(it => {
    const desc = line(200)(it && it.desc); if (!desc) throw new Bad('Every invoice line needs a description.');
    const qty = Number(it.qty); if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new Bad('Quantities must be whole numbers.');
    return { desc, qty, unit_pence: pence(it.unit_pence) };
  });
}
const total = list => list.reduce((a, i) => a + i.qty * i.unit_pence, 0);

const BUSINESS_FIELDS = { first_name: line(40), trading_name: line(120), owners: line(200), address: text(400), email, phone, website: url, bank_name: line(80), account_name: line(120), sort_code: v => { const s = line(10)(v); if (s && !/^\d{2}-?\d{2}-?\d{2}$/.test(s)) throw new Bad("Sort codes look like 12-34-56."); return s; }, account_number: v => { const s = line(12)(v); if (s && !/^\d{8}$/.test(s)) throw new Bad('Account numbers are 8 digits.'); return s; }, payment_days: int(0, 120), invoice_prefix: v => { const s = line(12)(v).toUpperCase(); if (s && !/^[A-Z0-9-]{1,12}$/.test(s)) throw new Bad('Use letters, numbers and dashes only.'); return s; }, invoice_note: text(600), stripe_link: url };

/* ---------- helpers ---------- */
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const newId = p => p + '_' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => b.toString(16).padStart(2, '0')).join('');
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const run = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).run();
async function insert(env, table, row) {
  const keys = Object.keys(row);
  await run(env, `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, ...keys.map(k => row[k]));
}
async function update(env, table, id, row) {
  const keys = Object.keys(row); if (!keys.length) return;
  await run(env, `UPDATE ${table} SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`, ...keys.map(k => row[k]), id);
}
async function getConfig(env, key, fallback) {
  const r = await first(env, 'SELECT value FROM config WHERE key = ?', key);
  try { return r ? JSON.parse(r.value) : fallback; } catch (e) { return fallback; }
}
const parseJSON = (s, f) => { try { return JSON.parse(s); } catch (e) { return f; } };
const monthStart = () => today().slice(0, 8) + '01';
const weekStart = () => { const d = new Date(); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };
const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* ---------- router ---------- */
// returns a Response, or null if the path isn't a business route
export async function adminBiz(req, env, path, m, readJson, log, user, extra) {
  const parts = path.split('/'), [res, id, sub] = parts;
  if (!['dashboard', 'leads', 'outbox', 'clients', 'projects', 'invoices', 'reports', 'settings', 'rulebook', 'sites', 'worklog', 'cf', 'social'].includes(res)) return null;
  if (!env.DB) return reply({ error: 'The database is not connected. Add the D1 binding called DB in Cloudflare.' }, 503);
  await ensureBizSchema(env);
  try {
    const body = ['POST', 'PATCH', 'PUT'].includes(m) ? ((await readJson(req, 128 * 1024)) || {}) : {};
    if (res === 'dashboard' && m === 'GET') return reply(await dashboard(env, extra));
    if (res === 'leads') return await leads(env, id, sub, m, body, log, user);
    if (res === 'outbox' && id && m === 'DELETE') {
      const o = await first(env, 'SELECT business FROM outbox WHERE id = ?', id); if (!o) return reply({ error: 'That queued email has already gone or been removed.' }, 404);
      await run(env, 'DELETE FROM outbox WHERE id = ?', id); await log('Cancelled a queued email to ' + o.business.slice(0, 40)); return reply({ ok: true });
    }
    if (res === 'clients') return await clients(env, id, m, body, log);
    if (res === 'projects') return await projects(env, id, m, body, log);
    if (res === 'invoices') return await invoices(env, id, m, body, log);
    if (res === 'reports' && m === 'GET') return reply({ reports: (await all(env, 'SELECT * FROM reports ORDER BY date DESC, type LIMIT 60')).map(r => ({ ...r, needs_you: parseJSON(r.needs_you, []), highlights: parseJSON(r.highlights, []) })) });
    if (res === 'social') return await adminSocial(req, env, id, sub, m, body, log);
    if (res === 'sites') return await sites(env, id, sub, m, body, log);
    if (res === 'worklog' && id && m === 'DELETE') { await run(env, 'DELETE FROM worklog WHERE id = ?', Number(id) || 0); return reply({ ok: true }); }
    if (res === 'cf' && id === 'workers' && m === 'GET') return reply(await cfWorkers(env));
    if (res === 'rulebook' && m === 'GET') return reply({ rulebook: await getConfig(env, 'rulebook', null), prospecting: await getConfig(env, 'prospecting', null), social: await getConfig(env, 'social_playbook', null) });
    if (res === 'settings') {
      if (m === 'GET') return reply({ business: await getConfig(env, 'business', {}) });
      if (m === 'PUT') {
        const cur = await getConfig(env, 'business', {}), next = { ...cur };
        for (const [k, fn] of Object.entries(BUSINESS_FIELDS)) if (body[k] !== undefined) next[k] = fn(body[k]);
        await run(env, 'INSERT INTO config (key, value, updated) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated', 'business', JSON.stringify(next), now());
        await log('Updated business details'); return reply({ ok: true, business: next });
      }
    }
    return reply({ error: 'Not found.' }, 404);
  } catch (e) {
    if (e instanceof Bad) return reply({ error: e.message }, 422);
    throw e;
  }
}

/* ---------- dashboard ---------- */
async function dashboard(env, { unread, visitors, latestMessages }) {
  const t = today(), ms = monthStart(), ws = weekStart(), soon = plusDays(t, 7), ys = t.slice(0, 4) + '-01-01';
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a);
  const [leadCounts, sentWeek, sentToday, moneyMonth, moneyYear, outstanding, overdue, recurring, stages, dueSoon, report, hotLeads, queued, recentSent, siteRows, socialRows] = await env.DB.batch([
    q('SELECT status, COUNT(*) AS n FROM leads GROUP BY status'),
    q('SELECT COUNT(*) AS n FROM sendlog WHERE sent_at >= ?', ws),
    q('SELECT COUNT(*) AS n FROM sendlog WHERE sent_at >= ?', t),
    q("SELECT COALESCE(SUM(total_pence), 0) AS p FROM invoices WHERE status = 'paid' AND paid_on >= ?", ms),
    q("SELECT COALESCE(SUM(total_pence), 0) AS p FROM invoices WHERE status = 'paid' AND paid_on >= ?", ys),
    q("SELECT COALESCE(SUM(total_pence), 0) AS p, COUNT(*) AS n FROM invoices WHERE status = 'sent'"),
    q("SELECT i.id, i.number, i.total_pence, i.due, c.name, c.business FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.status = 'sent' AND i.due < ? ORDER BY i.due", t),
    q("SELECT COALESCE(SUM(monthly_pence), 0) AS p, COUNT(*) AS n FROM projects WHERE stage IN ('live', 'care')"),
    q('SELECT stage, COUNT(*) AS n FROM projects GROUP BY stage'),
    q("SELECT p.id, p.title, p.due, p.stage, c.business, c.name FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.due != '' AND p.due <= ? AND p.stage NOT IN ('live', 'care', 'lost', 'paused') ORDER BY p.due LIMIT 6", soon),
    q('SELECT * FROM reports ORDER BY date DESC, CASE type WHEN \'monthly\' THEN 0 WHEN \'weekly\' THEN 1 ELSE 2 END LIMIT 1'),
    q("SELECT id, name, type, area, status, package, next, updated FROM leads WHERE status IN ('replied', 'interested') ORDER BY updated DESC LIMIT 6"),
    q('SELECT COUNT(*) AS n FROM outbox'),
    q('SELECT business, kind, sent_at, lead_id FROM sendlog ORDER BY sent_at DESC LIMIT 5'),
    q("SELECT id, name, status, state, monitor, renews, down_since FROM sites WHERE status != 'retired'"),
    q("SELECT status, COUNT(*) AS n FROM social_posts GROUP BY status")
  ]);
  const sl = siteRows.results || [], soon30 = plusDays(t, 30);
  const one = r => (r.results && r.results[0]) || {};
  const by = r => Object.fromEntries((r.results || []).map(x => [x.status || x.stage, x.n]));
  const rep = one(report);
  return {
    today: t, unread, visitors, latestMessages,
    leads: by(leadCounts), sentWeek: one(sentWeek).n || 0, sentToday: one(sentToday).n || 0, queued: one(queued).n || 0,
    money: { month: one(moneyMonth).p, year: one(moneyYear).p, outstanding: one(outstanding).p, outstandingCount: one(outstanding).n, recurring: one(recurring).p, recurringCount: one(recurring).n },
    overdue: overdue.results || [], stages: by(stages), dueSoon: dueSoon.results || [], hotLeads: hotLeads.results || [], recentSent: recentSent.results || [],
    report: rep.id ? { ...rep, needs_you: parseJSON(rep.needs_you, []), highlights: parseJSON(rep.highlights, []) } : null,
    social: Object.fromEntries((socialRows.results || []).map(x => [x.status, x.n])),
    sites: { total: sl.length, live: sl.filter(x => x.status === 'live').length, down: sl.filter(x => x.monitor && x.state === 'down').map(x => ({ id: x.id, name: x.name, since: x.down_since })), renewing: sl.filter(x => x.renews && x.renews <= soon30).map(x => ({ id: x.id, name: x.name, renews: x.renews })) }
  };
}

/* ---------- leads ---------- */
async function leads(env, id, sub, m, body, log) {
  if (!id) {
    if (m === 'GET') {
      const [rows, sent] = await Promise.all([
        all(env, 'SELECT id, name, type, area, country, status, channel, email, fit, package, next, reviews, found, updated FROM leads ORDER BY updated DESC, found DESC, name'),
        all(env, 'SELECT lead_id, COUNT(*) AS n, MAX(sent_at) AS last FROM sendlog GROUP BY lead_id')
      ]);
      const s = Object.fromEntries(sent.map(r => [r.lead_id, r]));
      return reply({ leads: rows.map(r => ({ ...r, sent: (s[r.id] || {}).n || 0, lastSent: (s[r.id] || {}).last || '' })) });
    }
    if (m === 'POST') {
      const v = clean('leads', body);
      const base = v.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'lead';
      let lid = base, n = 2; while (await first(env, 'SELECT 1 FROM leads WHERE id = ?', lid)) lid = base + '-' + n++;
      await insert(env, 'leads', { status: 'check', country: 'UK', ...v, id: lid, found: v.found || today(), updated: today() });
      await log('Added lead ' + v.name.slice(0, 40)); return reply({ ok: true, id: lid });
    }
    return reply({ error: 'Not found.' }, 404);
  }
  const lead = await first(env, 'SELECT * FROM leads WHERE id = ?', id);
  if (!lead) return reply({ error: 'That lead could not be found.' }, 404);
  if (sub === 'convert' && m === 'POST') {
    // turn an interested lead into a client: create the client, attach (or create) the project, mark the lead won
    const exist = await first(env, 'SELECT id FROM clients WHERE lead_id = ?', id);
    let cid = exist && exist.id;
    if (!cid) {
      cid = newId('c');
      const em = (lead.email.match(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/i) || [''])[0].toLowerCase();
      const ph = (lead.phone.match(/[+0-9][0-9 ()-]{5,28}[0-9]/) || [''])[0];
      const site = (lead.website.match(/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?/i) || [''])[0];
      await insert(env, 'clients', { id: cid, name: String(body.contact || '').trim().slice(0, 120) || lead.name, business: lead.name, email: em, phone: ph, website: site ? url(site) : '', address: lead.address, notes: '', lead_id: id, created: now(), updated: now() });
    }
    const proj = await first(env, 'SELECT id FROM projects WHERE lead_id = ?', id);
    if (proj) await update(env, 'projects', proj.id, { client_id: cid, updated: now() });
    else {
      const pk = PACKAGES.includes(lead.package) ? lead.package : '';
      const price = { Starter: 40000, Business: 79500, Premium: 160000 }[pk] || 0, monthly = { Starter: 2500, Business: 5000, Premium: 7000 }[pk] || 0;
      await insert(env, 'projects', { id: newId('p'), client_id: cid, lead_id: id, title: lead.name + ' website', package: pk, price_pence: price, monthly_pence: monthly, stage: 'quoted', created: now(), updated: now() });
    }
    await run(env, 'DELETE FROM outbox WHERE lead_id = ?', id);  // a client never gets a cold email
    await update(env, 'leads', id, { status: 'won', next: 'Now a client', updated: today() });
    await log('Turned lead ' + lead.name.slice(0, 40) + ' into a client');
    return reply({ ok: true, client: cid });
  }
  if (m === 'GET') {
    const [sent, queued, project, client] = await Promise.all([
      all(env, 'SELECT id, subject, kind, sent_at, to_email FROM sendlog WHERE lead_id = ? ORDER BY sent_at DESC', id),
      all(env, 'SELECT id, subject, body, kind, slot, not_before, to_email FROM outbox WHERE lead_id = ? ORDER BY not_before', id),
      first(env, 'SELECT id, title, stage, preview_url FROM projects WHERE lead_id = ?', id),
      first(env, 'SELECT id, name FROM clients WHERE lead_id = ?', id)
    ]);
    return reply({ lead, sent, queued, project, client });
  }
  if (m === 'PATCH') {
    const v = clean('leads', body, true);
    if (v.status === 'dnc') await run(env, 'DELETE FROM outbox WHERE lead_id = ?', id);  // never email someone who said no
    await update(env, 'leads', id, { ...v, updated: today() });
    if (v.status && v.status !== lead.status) await log(`Moved lead ${lead.name.slice(0, 40)} to ${v.status}`);
    return reply({ ok: true });
  }
  if (m === 'DELETE') {
    // erase a lead completely (e.g. a data-deletion request)
    await env.DB.batch([env.DB.prepare('DELETE FROM outbox WHERE lead_id = ?').bind(id), env.DB.prepare('DELETE FROM sendlog WHERE lead_id = ?').bind(id), env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id), env.DB.prepare("UPDATE projects SET lead_id = '' WHERE lead_id = ?").bind(id), env.DB.prepare("UPDATE clients SET lead_id = '' WHERE lead_id = ?").bind(id)]);
    await log('Deleted lead ' + lead.name.slice(0, 40)); return reply({ ok: true });
  }
  return reply({ error: 'Not found.' }, 404);
}

/* ---------- clients ---------- */
async function clients(env, id, m, body, log) {
  if (!id) {
    if (m === 'GET') return reply({ clients: await all(env, `SELECT c.*, (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) AS projects,
      (SELECT COALESCE(SUM(total_pence), 0) FROM invoices i WHERE i.client_id = c.id AND i.status = 'paid') AS paid_pence,
      (SELECT COALESCE(SUM(total_pence), 0) FROM invoices i WHERE i.client_id = c.id AND i.status = 'sent') AS owed_pence
      FROM clients c ORDER BY c.updated DESC`) });
    if (m === 'POST') {
      const v = clean('clients', body); const cid = newId('c');
      await insert(env, 'clients', { ...v, id: cid, created: now(), updated: now() });
      await log('Added client ' + (v.business || v.name).slice(0, 40)); return reply({ ok: true, id: cid });
    }
    return reply({ error: 'Not found.' }, 404);
  }
  const c = await first(env, 'SELECT * FROM clients WHERE id = ?', id);
  if (!c) return reply({ error: 'That client could not be found.' }, 404);
  if (m === 'GET') {
    const [projs, invs] = await Promise.all([
      all(env, 'SELECT id, title, package, stage, price_pence, monthly_pence, due FROM projects WHERE client_id = ? ORDER BY created DESC', id),
      all(env, 'SELECT id, number, issued, due, total_pence, status, paid_on FROM invoices WHERE client_id = ? ORDER BY issued DESC, number DESC', id)
    ]);
    return reply({ client: c, projects: projs, invoices: invs });
  }
  if (m === 'PATCH') { await update(env, 'clients', id, { ...clean('clients', body, true), updated: now() }); return reply({ ok: true }); }
  if (m === 'DELETE') {
    const inv = await first(env, "SELECT COUNT(*) AS n FROM invoices WHERE client_id = ? AND status != 'draft'", id);
    if (inv && inv.n) return reply({ error: "This client has invoices, which have to be kept for HMRC (6 years). Archive their projects instead." }, 409);
    await env.DB.batch([env.DB.prepare('DELETE FROM invoices WHERE client_id = ?').bind(id), env.DB.prepare("UPDATE projects SET client_id = '' WHERE client_id = ?").bind(id), env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(id)]);
    await log('Deleted client ' + (c.business || c.name).slice(0, 40)); return reply({ ok: true });
  }
  return reply({ error: 'Not found.' }, 404);
}

/* ---------- projects ---------- */
async function projects(env, id, m, body, log) {
  if (!id) {
    if (m === 'GET') return reply({ projects: await all(env, `SELECT p.id, p.title, p.package, p.stage, p.price_pence, p.monthly_pence, p.due, p.preview_url, p.updated, p.client_id, p.lead_id,
      c.name AS client_name, c.business AS client_business, l.name AS lead_name FROM projects p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN leads l ON l.id = p.lead_id ORDER BY p.updated DESC`) });
    if (m === 'POST') {
      const v = clean('projects', body); const pid = newId('p');
      if (v.client_id && !(await first(env, 'SELECT 1 FROM clients WHERE id = ?', v.client_id))) throw new Bad('Choose a client from the list.');
      await insert(env, 'projects', { stage: 'quoted', ...v, id: pid, created: now(), updated: now() });
      await log('Added project ' + v.title.slice(0, 40)); return reply({ ok: true, id: pid });
    }
    return reply({ error: 'Not found.' }, 404);
  }
  const p = await first(env, 'SELECT * FROM projects WHERE id = ?', id);
  if (!p) return reply({ error: 'That project could not be found.' }, 404);
  if (m === 'GET') {
    const [client, lead, invs] = await Promise.all([
      p.client_id ? first(env, 'SELECT id, name, business, email, phone FROM clients WHERE id = ?', p.client_id) : null,
      p.lead_id ? first(env, 'SELECT id, name, status FROM leads WHERE id = ?', p.lead_id) : null,
      all(env, 'SELECT id, number, issued, total_pence, status FROM invoices WHERE project_id = ? ORDER BY issued DESC', id)
    ]);
    return reply({ project: p, client, lead, invoices: invs });
  }
  if (m === 'PATCH') {
    const v = clean('projects', body, true);
    if (v.client_id && !(await first(env, 'SELECT 1 FROM clients WHERE id = ?', v.client_id))) throw new Bad('Choose a client from the list.');
    await update(env, 'projects', id, { ...v, updated: now() });
    if (v.stage && v.stage !== p.stage) await log(`Moved ${p.title.slice(0, 40)} to ${v.stage}`);
    return reply({ ok: true });
  }
  if (m === 'DELETE') {
    await env.DB.batch([env.DB.prepare("UPDATE invoices SET project_id = '' WHERE project_id = ?").bind(id), env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id)]);
    await log('Deleted project ' + p.title.slice(0, 40)); return reply({ ok: true });
  }
  return reply({ error: 'Not found.' }, 404);
}

/* ---------- invoices ---------- */
async function nextNumber(env) {
  const biz = await getConfig(env, 'business', {});
  const prefix = (biz.invoice_prefix || 'NEM') + '-' + today().slice(0, 4) + '-';
  const r = await first(env, 'SELECT number FROM invoices WHERE number LIKE ? ORDER BY number DESC LIMIT 1', prefix + '%');
  const n = r ? (parseInt(r.number.slice(prefix.length), 10) || 0) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}
async function invoices(env, id, m, body, log) {
  if (!id) {
    if (m === 'GET') return reply({ next: await nextNumber(env), today: today(), invoices: await all(env, `SELECT i.id, i.number, i.issued, i.due, i.total_pence, i.status, i.paid_on, i.client_id, i.project_id, c.name AS client_name, c.business AS client_business
      FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ORDER BY i.issued DESC, i.number DESC`) });
    if (m === 'POST') {
      const v = clean('invoices', body); const list = items(body.items);
      if (!(await first(env, 'SELECT 1 FROM clients WHERE id = ?', v.client_id))) throw new Bad('Choose a client from the list.');
      if (v.project_id && !(await first(env, 'SELECT 1 FROM projects WHERE id = ? AND client_id = ?', v.project_id, v.client_id))) throw new Bad("That project doesn't belong to this client.");
      if (v.due < v.issued) throw new Bad('The due date is before the invoice date.');
      const iid = newId('i'); let number = await nextNumber(env);
      for (let tries = 0; ; tries++) {
        try { await insert(env, 'invoices', { status: 'draft', ...v, paid_on: '', id: iid, number, items: JSON.stringify(list), total_pence: total(list), created: now(), updated: now() }); break; }
        catch (e) { if (tries > 3 || !/UNIQUE/i.test(String(e))) throw e; number = await nextNumber(env); }
      }
      await log('Created invoice ' + number); return reply({ ok: true, id: iid, number });
    }
    return reply({ error: 'Not found.' }, 404);
  }
  const inv = await first(env, 'SELECT * FROM invoices WHERE id = ?', id);
  if (!inv) return reply({ error: 'That invoice could not be found.' }, 404);
  if (m === 'GET') {
    const [client, project, business] = await Promise.all([
      first(env, 'SELECT id, name, business, email, phone, address FROM clients WHERE id = ?', inv.client_id),
      inv.project_id ? first(env, 'SELECT id, title FROM projects WHERE id = ?', inv.project_id) : null,
      getConfig(env, 'business', {})
    ]);
    return reply({ invoice: { ...inv, items: parseJSON(inv.items, []) }, client, project, business, today: today() });
  }
  if (m === 'PATCH') {
    const v = clean('invoices', body, true), row = { ...v };
    if (body.items !== undefined) { if (inv.status !== 'draft') throw new Bad('Only draft invoices can be edited. Void it and make a new one.'); const list = items(body.items); row.items = JSON.stringify(list); row.total_pence = total(list); }
    if (inv.status !== 'draft' && ['client_id', 'project_id', 'issued'].some(k => k in v && v[k] !== inv[k])) throw new Bad('Only draft invoices can be edited. Void it and make a new one.');
    if (v.status === 'paid' && !v.paid_on) row.paid_on = inv.paid_on || today();
    if (v.status && v.status !== 'paid') row.paid_on = '';
    if (inv.status === 'void' && v.status && v.status !== 'void') throw new Bad('A void invoice can\'t be reopened. Make a new one.');
    await update(env, 'invoices', id, { ...row, updated: now() });
    if (v.status && v.status !== inv.status) await log(`Marked invoice ${inv.number} as ${v.status}`);
    return reply({ ok: true });
  }
  if (m === 'DELETE') {
    if (inv.status !== 'draft') return reply({ error: 'Sent and paid invoices have to be kept for your records. Mark it void instead.' }, 409);
    await run(env, 'DELETE FROM invoices WHERE id = ?', id); await log('Deleted draft invoice ' + inv.number); return reply({ ok: true });
  }
  return reply({ error: 'Not found.' }, 404);
}


/* ---------- sites hub ---------- */
async function sites(env, id, sub, m, body, log) {
  if (!id) {
    if (m === 'GET') {
      const since = Date.now() - 30 * 86400000, ms = monthStart();
      const [rows, up, used] = await Promise.all([
        all(env, `SELECT s.*, c.name AS client_name, c.business AS client_business FROM sites s LEFT JOIN clients c ON c.id = s.client_id ORDER BY CASE s.status WHEN 'live' THEN 0 WHEN 'building' THEN 1 WHEN 'demo' THEN 2 WHEN 'paused' THEN 3 ELSE 4 END, s.name`),
        all(env, 'SELECT site_id, COUNT(*) AS n, SUM(ok) AS good FROM checks WHERE ts > ? GROUP BY site_id', since),
        all(env, 'SELECT site_id, SUM(minutes) AS m FROM worklog WHERE day >= ? GROUP BY site_id', ms)
      ]);
      const U = Object.fromEntries(up.map(r => [r.site_id, r])), M = Object.fromEntries(used.map(r => [r.site_id, r.m]));
      return reply({ sites: rows.map(r => ({ ...r, uptime: U[r.id] && U[r.id].n ? Math.round(U[r.id].good / U[r.id].n * 1000) / 10 : null, used_min: M[r.id] || 0 })), today: today() });
    }
    if (m === 'POST') {
      const v = clean('sites', body); const sid = newId('s');
      await insert(env, 'sites', { ...v, id: sid, created: now(), updated: now() });
      await log('Added site ' + v.name.slice(0, 40)); return reply({ ok: true, id: sid });
    }
    return reply({ error: 'Not found.' }, 404);
  }
  const site = await first(env, 'SELECT * FROM sites WHERE id = ?', id);
  if (!site) return reply({ error: 'That site could not be found.' }, 404);
  if (sub === 'check' && m === 'POST') { await checkSite(env, site); return reply({ ok: true, site: await first(env, 'SELECT * FROM sites WHERE id = ?', id) }); }
  if (sub === 'log' && m === 'POST') {
    const minutes = int(1, 600)(body.minutes); if (!minutes) throw new Bad('How many minutes did it take?');
    const what = line(300)(body.what); if (!what) throw new Bad('Say what was done.');
    await insert(env, 'worklog', { site_id: id, day: date(body.day) || today(), minutes, kind: oneOf(['change', 'fix', 'update', 'other'])(body.kind || 'change'), what, created: now() });
    return reply({ ok: true });
  }
  if (m === 'GET') {
    const since = Date.now() - 30 * 86400000;
    const [checks, days, work, client, project] = await Promise.all([
      all(env, 'SELECT ts, ok, code, ms, error FROM checks WHERE site_id = ? ORDER BY ts DESC LIMIT 20', id),
      all(env, "SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, COUNT(*) AS n, SUM(ok) AS good, CAST(AVG(ms) AS INTEGER) AS ms FROM checks WHERE site_id = ? AND ts > ? GROUP BY day ORDER BY day", id, since),
      all(env, 'SELECT id, day, minutes, kind, what FROM worklog WHERE site_id = ? ORDER BY day DESC, id DESC LIMIT 60', id),
      site.client_id ? first(env, 'SELECT id, name, business FROM clients WHERE id = ?', site.client_id) : null,
      site.project_id ? first(env, 'SELECT id, title, stage FROM projects WHERE id = ?', site.project_id) : null
    ]);
    return reply({ site, checks, days, work, client, project, today: today() });
  }
  if (m === 'PATCH') { await update(env, 'sites', id, { ...clean('sites', body, true), updated: now() }); return reply({ ok: true }); }
  if (m === 'DELETE') {
    await env.DB.batch([env.DB.prepare('DELETE FROM checks WHERE site_id = ?').bind(id), env.DB.prepare('DELETE FROM worklog WHERE site_id = ?').bind(id), env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(id)]);
    await log('Removed site ' + site.name.slice(0, 40)); return reply({ ok: true });
  }
  return reply({ error: 'Not found.' }, 404);
}

// fetch a site's homepage and record whether it answered. Two failures in a row = down.
export async function checkSite(env, site) {
  if (!site.url) return;
  const t0 = Date.now(); let ok = 0, code = 0, error = '';
  try {
    const r = await fetch(site.url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'NEMORA uptime check (+https://nemora.uk)' }, signal: AbortSignal.timeout(12000), cf: { cacheTtl: 0 } });
    code = r.status; ok = r.status < 400 ? 1 : 0; if (!ok) error = 'HTTP ' + r.status;
    try { await r.body?.cancel(); } catch (e) {}
  } catch (e) { error = String(e && e.name === 'TimeoutError' ? 'No answer within 12 seconds' : (e && e.message) || e).slice(0, 160); }
  const ms = Date.now() - t0, fails = ok ? 0 : site.fails + 1;
  const state = ok ? 'up' : fails >= 2 ? 'down' : (site.state || 'up');
  const downSince = state === 'down' ? (site.state === 'down' ? site.down_since : new Date().toISOString()) : '';
  await env.DB.batch([
    env.DB.prepare('INSERT INTO checks (site_id, ts, ok, code, ms, error) VALUES (?, ?, ?, ?, ?, ?)').bind(site.id, Date.now(), ok, code, ms, error),
    env.DB.prepare('UPDATE sites SET state = ?, fails = ?, last_code = ?, last_ms = ?, last_check = ?, down_since = ? WHERE id = ?').bind(state, fails, code, ms, new Date().toISOString(), downSince, site.id)
  ]);
  return { changed: state !== site.state && site.state !== '' ? state : null, site, error };
}
export async function checkAllSites(env) {
  await ensureBizSchema(env);
  const list = await all(env, "SELECT * FROM sites WHERE monitor = 1 AND url != '' AND status != 'retired'");
  const results = await Promise.all(list.map(s => checkSite(env, s).catch(e => ({ error: String(e) }))));
  await run(env, 'DELETE FROM checks WHERE ts < ?', Date.now() - 35 * 86400000);
  return results.filter(r => r && r.changed);
}

// optional: list every Worker in the Cloudflare account (needs a read-only API token set as a secret)
async function cfWorkers(env) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return { enabled: false };
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/workers/scripts`, { headers: { Authorization: 'Bearer ' + env.CF_API_TOKEN } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) return { enabled: true, error: 'Cloudflare refused the request. Check the API token has "Workers Scripts: Read".' };
  const linked = new Set((await all(env, "SELECT worker FROM sites WHERE worker != ''")).map(x => x.worker));
  return { enabled: true, workers: (d.result || []).map(w => ({ name: w.id, modified: w.modified_on, created: w.created_on, linked: linked.has(w.id) })).sort((a, b) => (b.modified || '').localeCompare(a.modified || '')) };
}
