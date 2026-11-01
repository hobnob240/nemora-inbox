// NEMORA agents: the scheduled Claude tasks that run the business, shown in the admin as a team.
// Each agent reads its own switch at the start of a run (agents.enabled) and writes a line to agent_runs at the end,
// so this page shows who is on, when they run next, what they last did and anything that has gone wrong.
// The Boss agent checks the others every morning. The Autopilot is this Worker's own 15-minute cron.

export const AGENTS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', job TEXT NOT NULL DEFAULT '', duties TEXT NOT NULL DEFAULT '[]', kind TEXT NOT NULL DEFAULT 'claude', cron TEXT NOT NULL DEFAULT '', tz TEXT NOT NULL DEFAULT 'Europe/London', schedule_text TEXT NOT NULL DEFAULT '', trigger_id TEXT NOT NULL DEFAULT '', reports_to TEXT NOT NULL DEFAULT 'boss', enabled INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, last_run TEXT NOT NULL DEFAULT '', last_status TEXT NOT NULL DEFAULT '', last_summary TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS agent_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT NOT NULL, started TEXT NOT NULL DEFAULT '', finished TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'ok', summary TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS agent_runs_by ON agent_runs(agent, finished)`
];

// the team (seeded once; Charlie's switches and the agents' own reports are never overwritten)
const TEAM = [
  { id: 'boss', name: 'Boss', role: 'Master agent', kind: 'claude', cron: '52 7 * * *', schedule_text: 'Every morning at 7:52', trigger_id: 'trig_01XDT7ahnravrYYcpRi7QLfv', reports_to: '', sort: 0,
    job: 'Checks every other agent each morning, flags anything stuck, missed or failing, and sends you one short summary.',
    duties: ['Checks each agent ran when it should have', 'Spots failed posts, bounced emails and sites that are down', 'Re-runs an agent once if it missed its slot', 'Sends you one morning summary'] },
  { id: 'outreach', name: 'Outreach', role: 'Finds and emails new clients', kind: 'claude', cron: '37 8,14 * * 1-5', schedule_text: 'Weekdays at 8:37am and 2:37pm', trigger_id: 'trig_016x5BGKCc2RmtyLqHavqNDv', sort: 1,
    job: 'Finds independent UK businesses with weak websites, writes and sends emails that pass the rulebook, and starts a private preview when someone is interested.',
    duties: ['Prospects a new area every morning', 'Sends emails that pass every rulebook check', 'Writes polite follow-ups', 'Builds a private preview for interested prospects'] },
  { id: 'replies', name: 'Replies', role: 'Answers prospects and writes reports', kind: 'claude', cron: '11 10,12,16,18 * * 1-5', schedule_text: 'Weekdays at 10:11, 12:11, 4:11 and 6:11', trigger_id: 'trig_01E53iUrKNT2PYTK752pNEK2', sort: 2,
    job: 'Checks the inbox for replies from prospects, answers them within the rulebook, and writes your daily, weekly and monthly reports.',
    duties: ['Answers interested prospects', 'Stops emailing anyone who says no', 'Tells you straight away when something needs you', 'Daily report at about 6pm'] },
  { id: 'social', name: 'Social media', role: 'Facebook and Instagram', kind: 'claude', cron: '40 17 * * 0,3', schedule_text: 'Sundays and Wednesdays at 5:40pm', trigger_id: 'trig_018RXHtphFpChMCcnb3LAwYz', sort: 3,
    job: 'Plans and makes three honest posts a week from real work. Videos wait for your OK; photos and text go out on their own.',
    duties: ['Plans the week on Sundays', 'Makes photos, carousels and videos', 'Fixes failed posts on Wednesdays', 'Learns from what gets saved and shared'] },
  { id: 'care', name: 'Client care', role: 'Looks after care-plan clients', kind: 'claude', cron: '13 9 * * 1-5', schedule_text: 'Weekdays at 9:13am', trigger_id: 'trig_01WxjBT2H1fyBMsGEevrd2Zd', sort: 4,
    job: "Answers clients' change requests within a working day, makes small changes within their plan's hours, and writes their monthly reports as Outlook drafts for you to send.",
    duties: ['Replies to care clients within a working day', "Makes small changes live within their plan's hours", 'Monthly client reports as drafts for you', 'Flags renewals and overdue invoices'] },
  { id: 'guides', name: 'Guides writer', role: 'Writes guides for nemora.uk', kind: 'claude', cron: '13 10 1,15 * *', schedule_text: 'The 1st and 15th of each month at 10:13am', trigger_id: 'trig_0142NdQ8BK8APcu6By9sXhKn', sort: 5,
    job: 'Researches and publishes one honest, useful guide for small business owners on nemora.uk/guides, twice a month, with every fact sourced.',
    duties: ['Picks a useful topic nobody has covered on the site', 'Researches it from official and reliable sources', 'Writes and publishes it on nemora.uk/guides', 'Never touches any other page'] },
  { id: 'autopilot', name: 'Autopilot', role: 'Always on', kind: 'system', cron: '*/15 * * * *', schedule_text: 'Every 15 minutes', trigger_id: '', sort: 6,
    job: 'Built into the admin itself: publishes approved social posts on time and checks every website is up.',
    duties: ['Publishes approved posts at their time', 'Checks all your websites are online', 'Alerts you if a site goes down'] }
];

const now = () => new Date().toISOString();
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
// what Charlie can hire from the village. The Boss turns the brief into a scheduled task with the standard rules.
export const TEMPLATES = [
  { id: 'social', label: 'Social media manager', role: 'Facebook and Instagram', job: 'Plans and makes honest posts from real material for the business, three a week, with videos waiting for approval.', duties: ['Plans the week', 'Makes photos, carousels and videos', 'Posts only from real material', 'Needs the business\'s Facebook and Instagram connected'] },
  { id: 'writer', label: 'Blog and guides writer', role: 'Writes for the website', job: 'Researches and writes useful, sourced articles for the business\'s website.', duties: ['Picks useful topics', 'Researches from reliable sources', 'Writes in the business\'s voice', 'Needs access to the website\'s code'] },
  { id: 'reviews', label: 'Reviews helper', role: 'Reviews and reputation', job: 'Watches for new reviews and drafts friendly replies for approval.', duties: ['Spots new reviews', 'Drafts replies for approval', 'Flags unhappy customers', 'Needs the business\'s review accounts'] },
  { id: 'research', label: 'Researcher', role: 'Finds things out', job: 'Researches a question on a schedule and writes a short, sourced report.', duties: ['Searches the web', 'Checks sources', 'Writes a short report', 'Sends you the highlights'] },
  { id: 'custom', label: 'Something else', role: 'Custom agent', job: '', duties: ['Does what you describe', 'Follows the standard rules', 'Logs every run', 'Checked by the Boss'] }
];
export const SCHEDULES = [
  ['daily', 'Every day at 9:41am', '41 9 * * *'], ['weekdays', 'Weekdays at 9:41am', '41 9 * * 1-5'], ['twice-week', 'Mondays and Thursdays at 11:23am', '23 11 * * 1,4'],
  ['weekly', 'Mondays at 10:17am', '17 10 * * 1'], ['fortnight', 'The 1st and 15th at 10:29am', '29 10 1,15 * *'], ['monthly', 'The 1st of each month at 10:47am', '47 10 1 * *']
];
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

let ready = false;
export async function ensureAgents(env) {
  if (ready) return;
  for (const s of AGENTS_SCHEMA) await env.DB.prepare(s).run();
  const cols = ((await env.DB.prepare('PRAGMA table_info(agents)').all()).results || []).map(c => c.name);
  for (const [c, def] of [['business', "TEXT NOT NULL DEFAULT 'NEMORA'"], ['status', "TEXT NOT NULL DEFAULT 'active'"], ['brief', "TEXT NOT NULL DEFAULT ''"], ['look', "TEXT NOT NULL DEFAULT ''"], ['seeded', 'INTEGER NOT NULL DEFAULT 0']])
    if (!cols.includes(c)) await env.DB.prepare(`ALTER TABLE agents ADD COLUMN ${c} ${def}`).run();
  const st = env.DB.prepare('INSERT OR IGNORE INTO agents (id, name, role, job, duties, kind, cron, schedule_text, trigger_id, reports_to, sort, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  await env.DB.batch(TEAM.map(a => st.bind(a.id, a.name, a.role, a.job, JSON.stringify(a.duties), a.kind, a.cron, a.schedule_text, a.trigger_id, a.reports_to ?? 'boss', a.sort, now())));
  await env.DB.prepare("UPDATE agents SET seeded = 1 WHERE id IN ('boss','outreach','replies','social','care','guides','autopilot')").run();
  ready = true;
}

/* ---------- cron maths (5-field, in a time zone) ---------- */
function field(spec, min, max) {
  const out = new Set();
  for (const part of String(spec).split(',')) {
    const [range, stepS] = part.split('/'); const step = Number(stepS) || 1;
    let [a, b] = range === '*' ? [min, max] : range.split('-').map(Number); if (b === undefined) b = stepS ? max : a;
    for (let i = a; i <= b; i += step) out.add(i);
  }
  return out;
}
const parts = (d, tz) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', minute: 'numeric', hour: 'numeric', day: 'numeric', month: 'numeric', weekday: 'short' }).formatToParts(d).map(x => [x.type, x.value])); return { mi: +p.minute, h: +p.hour, d: +p.day, mo: +p.month, w: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) }; };
function matcher(cron) {
  const [mi, h, d, mo, w] = String(cron).trim().split(/\s+/);
  const F = { mi: field(mi, 0, 59), h: field(h, 0, 23), d: field(d, 1, 31), mo: field(mo, 1, 12), w: field(w, 0, 6) };
  return x => F.mi.has(x.mi) && F.h.has(x.h) && F.d.has(x.d) && F.mo.has(x.mo) && F.w.has(x.w);
}
// next or previous run, searching minute by minute (skipping hours that can't match) up to 8 days
export function cronStep(cron, tz, from, dir = 1) {
  if (!cron) return '';
  const ok = matcher(cron), hours = field(String(cron).trim().split(/\s+/)[1], 0, 23);
  let t = Math.floor(from.getTime() / 60000) * 60000 + (dir > 0 ? 60000 : 0);
  for (let i = 0; i < 8 * 24 * 60; i++, t += dir * 60000) {
    const x = parts(new Date(t), tz);
    if (!hours.has(x.h)) { const skip = dir > 0 ? 60 - x.mi - 1 : x.mi; t += dir * skip * 60000; i += skip; continue; }
    if (ok(x)) return new Date(t).toISOString();
  }
  return '';
}

/* ---------- the view ---------- */
async function team(env) {
  const rows = (await env.DB.prepare("SELECT * FROM agents WHERE status != 'retired' ORDER BY sort, name").all()).results || [];
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const runs = (await env.DB.prepare('SELECT agent, status, COUNT(*) n FROM agent_runs WHERE finished >= ? GROUP BY agent, status').bind(since).all()).results || [];
  const t = new Date();
  return rows.map(a => {
    const next = a.enabled ? cronStep(a.cron, a.tz, t, 1) : '';
    const prev = cronStep(a.cron, a.tz, t, -1);
    // missed: it should have run more than 40 minutes ago (2 hours for the autopilot's 15-minute beat is plenty) and hasn't since
    const grace = a.kind === 'system' ? 45 : 40;
    const missed = !!(a.status === 'active' && a.enabled && prev && Date.now() - Date.parse(prev) > grace * 60000 && (!a.last_run || Date.parse(a.last_run) < Date.parse(prev) - 5 * 60000) && Date.parse(a.updated || 0) < Date.parse(prev));
    const health = a.status === 'hiring' ? 'hiring' : a.status === 'retiring' ? 'retiring' : !a.enabled ? 'paused' : missed ? 'missed' : ['failed', 'attention'].includes(a.last_status) ? a.last_status : a.last_run ? 'ok' : 'waiting';
    const stats = Object.fromEntries(runs.filter(r => r.agent === a.id).map(r => [r.status, r.n]));
    let brief = {}; try { brief = JSON.parse(a.brief || '{}'); } catch (e) {}
    return { ...a, brief, duties: JSON.parse(a.duties || '[]'), enabled: !!a.enabled, seeded: !!a.seeded, next: a.status === 'active' ? next : '', prev, health, stats };
  });
}

export async function adminAgents(env, id, sub, m, body, log) {
  await ensureAgents(env);
  if (!id && m === 'GET') return reply({ agents: await team(env), now: now(), templates: TEMPLATES, schedules: SCHEDULES.map(([k, l]) => ({ id: k, label: l })) });
  if (!id && m === 'POST') {
    // Charlie designs a new agent in the village; the Boss sets it up as a scheduled task next morning
    const name = clean(body.name, 40), business = clean(body.business, 80) || 'NEMORA', tpl = TEMPLATES.find(t => t.id === body.template) || TEMPLATES[TEMPLATES.length - 1];
    const sch = SCHEDULES.find(([k]) => k === body.schedule); const job = clean(body.job, 400) || tpl.job, instructions = clean(body.instructions, 3000);
    if (!name) return reply({ error: 'Give your new agent a name.' }, 422);
    if (!sch) return reply({ error: 'Choose when it should work.' }, 422);
    if (tpl.id === 'custom' && !instructions) return reply({ error: 'Tell it what to do: a few lines in your own words.' }, 422);
    const aid = 'h_' + [...crypto.getRandomValues(new Uint8Array(5))].map(b => b.toString(16).padStart(2, '0')).join('');
    const look = clean(body.look, 20) || String(Math.floor(Math.random() * 6));
    const brief = { template: tpl.id, job, instructions, business, requested: now() };
    const sort = ((await env.DB.prepare('SELECT MAX(sort) m FROM agents').first()) || {}).m || 10;
    await env.DB.prepare("INSERT INTO agents (id, name, role, job, duties, kind, cron, schedule_text, trigger_id, reports_to, enabled, sort, business, status, brief, look, updated) VALUES (?, ?, ?, ?, ?, 'claude', ?, ?, '', 'boss', 0, ?, ?, 'hiring', ?, ?, ?)")
      .bind(aid, name, tpl.role, job, JSON.stringify(tpl.duties), sch[2], sch[1], sort + 1, business, JSON.stringify(brief), look, now()).run();
    await log('Designed a new agent: ' + name + ' (' + business + ')');
    return reply({ agent: (await team(env)).find(x => x.id === aid) });
  }
  const a = await env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(String(id)).first();
  if (!a) return reply({ error: 'That agent could not be found.' }, 404);
  if (m === 'GET') {
    const runs = (await env.DB.prepare('SELECT * FROM agent_runs WHERE agent = ? ORDER BY finished DESC LIMIT 40').bind(a.id).all()).results || [];
    return reply({ agent: (await team(env)).find(x => x.id === a.id), runs });
  }
  if (sub === 'retire' && m === 'POST') {
    if (a.seeded) return reply({ error: 'The core team can be paused but not retired here. Ask Claude if you really want to remove one.' }, 409);
    const st = a.status === 'hiring' || !a.trigger_id ? 'retired' : 'retiring';
    await env.DB.prepare('UPDATE agents SET status = ?, enabled = 0, updated = ? WHERE id = ?').bind(st, now(), a.id).run();
    await log((st === 'retired' ? 'Cancelled the new agent ' : 'Retired the agent ') + a.name);
    return reply({ ok: true, status: st });
  }
  if (m === 'PATCH' && body.look !== undefined) {
    // Charlie dresses the agent: numbers only, each within its list
    const L = { skin: 5, hair: 8, style: 6, shirt: 8, legs: 4, acc: 6 }, look = {};
    for (const [k, n] of Object.entries(L)) { const v = Math.floor(Number((body.look || {})[k])); look[k] = Number.isFinite(v) && v >= 0 && v < n ? v : 0; }
    await env.DB.prepare('UPDATE agents SET look = ? WHERE id = ?').bind(JSON.stringify(look), a.id).run();
    return reply({ ok: true, look });
  }
  if (m === 'PATCH' && body.enabled !== undefined) {
    if (a.status === 'hiring') return reply({ error: 'The Boss sets this one up tomorrow morning. You can switch it on and off after that.' }, 409);
    if (a.kind === 'system') return reply({ error: 'The Autopilot is part of the admin and stays on. Pause the Social media agent to stop posts going out.' }, 409);
    const on = body.enabled ? 1 : 0;
    await env.DB.prepare('UPDATE agents SET enabled = ?, updated = ? WHERE id = ?').bind(on, now(), a.id).run();
    await log((on ? 'Switched on' : 'Paused') + ' the ' + a.name + ' agent');
    return reply({ agent: (await team(env)).find(x => x.id === a.id) });
  }
  return reply({ error: 'Not found.' }, 404);
}

// for the dashboard: agents that need a look
export async function agentAlerts(env) {
  await ensureAgents(env);
  return (await team(env)).filter(a => ['missed', 'failed', 'attention'].includes(a.health)).map(a => ({ id: a.id, name: a.name, health: a.health, summary: a.last_summary }));
}

// is an agent switched on? (the publisher checks the Social media agent's switch)
export async function agentOn(env, id) {
  await ensureAgents(env);
  const a = await env.DB.prepare('SELECT enabled FROM agents WHERE id = ?').bind(id).first();
  return !a || !!a.enabled;
}

// the Autopilot's heartbeat, written by the Worker's own cron (one row a day plus problems, so the log stays short)
export async function autopilotBeat(env, status, summary) {
  await ensureAgents(env);
  const t = now();
  await env.DB.prepare('UPDATE agents SET last_run = ?, last_status = ?, last_summary = ? WHERE id = ?').bind(t, status, summary.slice(0, 300), 'autopilot').run();
  const lastLogged = await env.DB.prepare("SELECT finished, status FROM agent_runs WHERE agent = 'autopilot' ORDER BY finished DESC LIMIT 1").first();
  if (status !== 'ok' || !lastLogged || lastLogged.status !== 'ok' || lastLogged.finished.slice(0, 10) !== t.slice(0, 10)) {
    await env.DB.prepare('INSERT INTO agent_runs (agent, started, finished, status, summary) VALUES (?, ?, ?, ?, ?)').bind('autopilot', t, t, status, summary.slice(0, 300)).run();
    await env.DB.prepare("DELETE FROM agent_runs WHERE finished < ?").bind(new Date(Date.now() - 120 * 864e5).toISOString()).run();
  }
}

/* ---------- the village's decorations (one set per business) ---------- */
const TOWN_KEYS = ['tree', 'pine', 'bush', 'flowers', 'bench', 'lamp', 'pond', 'rock', 'stall', 'statue', 'mailbox', 'sign', 'flag', 'table', 'cat', 'car'];
const ROOM_KEYS = ['plant', 'rug', 'shelf', 'lampf', 'sofa', 'picture', 'trophy', 'coffee', 'cat', 'board', 'clock', 'bin'];
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
const items = (list, keys, w, h, max) => (Array.isArray(list) ? list : []).filter(i => i && keys.includes(i.k)).slice(0, max).map(i => ({ k: i.k, x: int(i.x, 0, w), y: int(i.y, 0, h) }));
export async function adminVillage(env, url, m, body, log) {
  await ensureAgents(env);
  const biz = clean(url.searchParams.get('b') || body.business || 'NEMORA', 80) || 'NEMORA', key = 'village:' + biz.toLowerCase();
  if (m === 'GET') { const row = await env.DB.prepare('SELECT value FROM config WHERE key = ?').bind(key).first(); let v = {}; try { v = JSON.parse((row || {}).value || '{}'); } catch (e) {} return reply({ business: biz, decor: v }); }
  if (m === 'PUT') {
    const d = body.decor || {}, out = {};
    if (Array.isArray(d.items)) out.items = items(d.items, TOWN_KEYS, 480, 272, 250);
    out.houses = {}; for (const [id, hs] of Object.entries(d.houses || {}).slice(0, 60)) if (/^[a-z0-9_]{1,40}$/.test(id)) out.houses[id] = { wall: hs.wall == null ? null : int(hs.wall, 0, 9), roof: hs.roof == null ? null : int(hs.roof, 0, 9), door: /^#[0-9a-f]{6}$/i.test(hs.door || '') ? hs.door : undefined };
    out.rooms = {}; for (const [id, r] of Object.entries(d.rooms || {}).slice(0, 60)) if (/^[a-z0-9_]{1,40}$/.test(id)) out.rooms[id] = { floor: int(r.floor, 0, 5), paper: int(r.paper, 0, 5), items: items(r.items, ROOM_KEYS, 240, 144, 40) };
    await env.DB.prepare('INSERT INTO config (key, value, updated) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated').bind(key, JSON.stringify(out), now()).run();
    return reply({ ok: true, decor: out });
  }
  return reply({ error: 'Not found.' }, 404);
}
