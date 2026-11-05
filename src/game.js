// NEMORA village game: per-login saves, and coins earned from real work (worked out here, never trusted from the page).
const now = () => new Date().toISOString();
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const parse = (s, f) => { try { const v = JSON.parse(s); return v == null ? f : v; } catch (e) { return f; } };
const MAX_SAVE = 100 * 1024;
let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS game_saves (user TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}', rev INTEGER NOT NULL DEFAULT 0, claimed TEXT NOT NULL DEFAULT '{}', updated TEXT NOT NULL DEFAULT '')").run();
  ready = true;
}
const safe = async (f, d) => { try { return await f(); } catch (e) { return d; } };
const count = (env, sql, ...b) => safe(async () => ((await env.DB.prepare(sql).bind(...b).first()) || {}).n || 0, 0);
const ids = (env, sql, ...b) => safe(async () => ((await env.DB.prepare(sql).bind(...b).all()).results || []), []);

// what the team has done since the last claim, priced in coins
export const RATES = { sent: 20, reply: 40, post: 50, social: 15, guide: 100, found: 5, interested: 150, won: 1000 };
async function earnings(env, claimed) {
  const since = claimed.since || '1970-01-01T00:00:00Z', sinceDay = since.slice(0, 10);
  const got = {
    sent: await count(env, "SELECT COUNT(*) n FROM sendlog WHERE sent_at > ? AND lower(kind) != 'reply'", since),
    reply: await count(env, "SELECT COUNT(*) n FROM sendlog WHERE sent_at > ? AND lower(kind) = 'reply'", since),
    post: await count(env, "SELECT COUNT(*) n FROM social_posts WHERE status = 'posted' AND posted_at > ?", since),
    social: await count(env, "SELECT COUNT(*) n FROM social_inbox WHERE status = 'sent' AND replied_by != 'page' AND replied_at > ?", since),
    guide: await count(env, "SELECT COUNT(*) n FROM agent_runs WHERE agent = 'guides' AND status = 'ok' AND finished > ?", since),
    found: await count(env, 'SELECT COUNT(*) n FROM leads WHERE found > ?', claimed.since ? sinceDay : '0000')
  };
  const had = claimed.ids || {};
  const newIds = (rows, key) => rows.map(r => r.id).filter(id => !(had[key] || []).includes(id));
  const interested = newIds(await ids(env, "SELECT id FROM leads WHERE status IN ('interested', 'won')"), 'interested');
  const won = newIds(await ids(env, "SELECT id FROM leads WHERE status = 'won'"), 'won');
  const paidRows = await ids(env, "SELECT id, total_pence FROM invoices WHERE status = 'paid'");
  const paid = paidRows.filter(r => !(had.paid || []).includes(r.id));
  const lines = [
    ['sent', 'Outreach emails sent', got.sent, RATES.sent], ['reply', 'Replies to prospects', got.reply, RATES.reply], ['found', 'New prospects found', got.found, RATES.found],
    ['interested', 'Prospects who said they\'re interested', interested.length, RATES.interested], ['won', 'New clients won', won.length, RATES.won],
    ['post', 'Social posts published', got.post, RATES.post], ['social', 'Comments and messages answered', got.social, RATES.social], ['guide', 'Guides published', got.guide, RATES.guide]
  ].filter(l => l[2] > 0).map(([k, label, n, each]) => ({ k, label, n, each, coins: n * each }));
  const paidCoins = paid.reduce((s, r) => s + Math.round((r.total_pence || 0) / 100), 0);
  if (paid.length) lines.push({ k: 'paid', label: 'Invoices paid (1 coin per £1)', n: paid.length, each: 0, coins: paidCoins });
  return { lines, total: lines.reduce((s, l) => s + l.coins, 0), marks: { interested, won, paid: paid.map(r => r.id) } };
}

export async function adminGame(env, user, sub, m, body, log) {
  await ensure(env);
  user = String(user || 'owner').slice(0, 80);
  const row = await env.DB.prepare('SELECT data, rev, claimed, updated FROM game_saves WHERE user = ?').bind(user).first();
  const claimed = parse(row && row.claimed, {});
  if (!sub && m === 'GET') {
    const e = await earnings(env, claimed);
    return reply({ save: row ? parse(row.data, null) : null, rev: row ? row.rev : 0, updated: row ? row.updated : '', earnings: { total: e.total, lines: e.lines, first: !claimed.since } });
  }
  if (!sub && m === 'PUT') {
    const data = body.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return reply({ error: 'Nothing to save.' }, 422);
    const text = JSON.stringify(data); if (text.length > MAX_SAVE) return reply({ error: 'That save is too big.' }, 413);
    const rev = Number(body.rev) || 0;
    // another device saved since this one loaded: hand back the newer save instead of overwriting it
    if (row && row.rev !== rev) return reply({ conflict: true, save: parse(row.data, null), rev: row.rev }, 409);
    await env.DB.prepare("INSERT INTO game_saves (user, data, rev, claimed, updated) VALUES (?, ?, 1, '{}', ?) ON CONFLICT(user) DO UPDATE SET data = excluded.data, rev = game_saves.rev + 1, updated = excluded.updated").bind(user, text, now()).run();
    return reply({ ok: true, rev: rev + 1 });
  }
  if (sub === 'claim' && m === 'POST') {
    if (!row) return reply({ error: 'Save your game once before collecting.' }, 409);
    const e = await earnings(env, claimed);
    const data = parse(row.data, {}); data.coins = Math.max(0, Math.floor(Number(data.coins) || 0)) + e.total; data.earnedTotal = (Number(data.earnedTotal) || 0) + e.total;
    const had = claimed.ids || {};
    const next = { since: now(), ids: { interested: [...(had.interested || []), ...e.marks.interested].slice(-2000), won: [...(had.won || []), ...e.marks.won].slice(-2000), paid: [...(had.paid || []), ...e.marks.paid].slice(-2000) } };
    await env.DB.prepare('UPDATE game_saves SET data = ?, rev = rev + 1, claimed = ?, updated = ? WHERE user = ? AND rev = ?').bind(JSON.stringify(data), JSON.stringify(next), now(), user, row.rev).run();
    const after = await env.DB.prepare('SELECT rev FROM game_saves WHERE user = ?').bind(user).first();
    if (e.total) await log('Collected ' + e.total + ' coins in the village game');
    return reply({ ok: true, total: e.total, lines: e.lines, coins: data.coins, rev: after.rev, save: data });
  }
  if (sub === 'reset' && m === 'POST') {
    // a fresh farm, but coins already collected for past work stay collected (no double-claiming)
    await env.DB.prepare("UPDATE game_saves SET data = '{}', rev = rev + 1, updated = ? WHERE user = ?").bind(now(), user).run();
    await log('Started the village game again'); return reply({ ok: true });
  }
  return reply({ error: 'Not found.' }, 404);
}
