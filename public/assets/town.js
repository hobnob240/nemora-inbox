// The view-only village: names, looks and who's working. No messages, logs or numbers ever reach this page.
import { mountVillage, lookOf, personIcon } from '/admin/village.js?v=4';
const tok = (location.pathname.match(/^\/town\/([a-f0-9]{32})/) || [])[1];
const $ = id => document.getElementById(id);
const stage = $('town-stage'), card = $('town-card');
let app = null, sel = '';
const when = iso => new Date(iso).toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Europe/London' });
function status(a) {
  if (a.health === 'hiring') return 'Just hired: starts soon.';
  if (!a.enabled) return 'Having a rest (paused).';
  if (a.last_run) return 'Working at their desk right now.';
  return a.next ? 'Back at their desk ' + when(a.next) + '.' : 'Around town.';
}
function show(a) {
  sel = a.id; card.hidden = false;
  const txt = document.createElement('div');
  const h2 = document.createElement('h2'); h2.textContent = a.name;
  const role = document.createElement('p'); role.className = 'small muted'; role.textContent = a.role || '';
  const st = document.createElement('p'); st.textContent = status(a) + (a.personality.catchphrase ? ' “' + a.personality.catchphrase + '”' : '');
  txt.append(h2, role, st); card.replaceChildren(personIcon(lookOf(a), 3), txt);
}
async function load() {
  if (!tok) { $('town-sub').textContent = 'This link isn’t right.'; return; }
  let d;
  try { const r = await fetch('/town/' + tok + '/data', { cache: 'no-store', credentials: 'omit' }); if (!r.ok) throw new Error(r.status); d = await r.json(); }
  catch (e) { $('town-sub').textContent = 'This village link has been turned off, or the village couldn’t load. Try again later.'; return; }
  const name = (d.decor.settings && d.decor.settings.name) || d.business + ' village';
  $('town-name').textContent = name; document.title = name;
  const working = d.agents.filter(a => a.last_run && a.enabled).length;
  $('town-sub').textContent = d.agents.length + ' AI ' + (d.agents.length === 1 ? 'agent lives' : 'agents live') + ' here' + (working ? ', ' + working + ' working right now' : '') + '. Tap someone to say hello.';
  if (app) app.destroy();
  app = mountVillage(stage, d.agents, { onSelect: show, selected: sel, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, decor: d.decor, readOnly: true });
  const s = d.agents.find(a => a.id === sel); if (s) show(s);
}
load(); setInterval(() => { if (document.visibilityState === 'visible') load(); }, 120000);
