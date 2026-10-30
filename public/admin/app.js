// NEMORA admin: inbox, activity and account. Everything is rendered with textContent / DOM nodes (no innerHTML of user data).
const $ = s => document.querySelector(s);
const view = $('#view'), tabsEl = $('#tabs'), toastEl = $('#toast');
const PKG = { starter: 'Starter', business: 'Business', premium: 'Premium', bigger: 'Something bigger', '': 'Not sure yet' };
const STATUS = { new: 'New', read: 'Read', replied: 'Replied', archived: 'Archived' };
const TABS = [['inbox', 'Inbox'], ['traffic', 'Visitors'], ['activity', 'Activity'], ['account', 'Account']];
let filter = 'open', range = 30;

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
function toast(text, bad) { toastEl.textContent = text; toastEl.className = 'toast' + (bad ? ' bad' : ''); toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.hidden = true, 3200); }
async function api(path, opts = {}) {
  const r = await fetch('/api/' + path, { credentials: 'same-origin', headers: opts.body ? { 'Content-Type': 'application/json' } : {}, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (r.status === 401) { location.href = '/admin/'; throw new Error('logged out'); }
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
  return d;
}
const when = iso => { const d = new Date(iso); const today = new Date(); const same = d.toDateString() === today.toDateString(); return same ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' }); };
const full = iso => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function tabs(active, unread) {
  tabsEl.replaceChildren(...TABS.map(([id, label]) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(id === active), onclick: () => go(id) }, label, id === 'inbox' && unread ? h('span', { class: 'badge' }, String(unread)) : null)));
}
function go(id, arg) { location.hash = id + (arg ? '/' + arg : ''); }

async function route() {
  const [tab, arg] = (location.hash.slice(1) || 'inbox').split('/');
  let unread = 0;
  try { unread = (await api('admin/me')).unread; } catch (e) { return; }
  tabs(tab, unread);
  view.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
  try {
    if (tab === 'inbox' && arg) { await showMessage(arg); tabs(tab, (await api('admin/me')).unread); }
    else if (tab === 'inbox') await showInbox();
    else if (tab === 'traffic') await showTraffic();
    else if (tab === 'activity') await showActivity();
    else if (tab === 'account') showAccount();
    else go('inbox');
  } catch (e) { if (e.message !== 'logged out') view.replaceChildren(h('div', { class: 'msg err' }, e.message)); }
  view.focus({ preventScroll: true });
}

async function showInbox() {
  const { messages } = await api('admin/messages');
  const counts = { open: 0, new: 0, replied: 0, archived: 0 };
  for (const m of messages) { if (m.status !== 'archived') counts.open++; counts[m.status] = (counts[m.status] || 0) + 1; }
  const list = messages.filter(m => filter === 'open' ? m.status !== 'archived' : m.status === filter);
  const chips = [['open', 'Open'], ['new', 'New'], ['replied', 'Replied'], ['archived', 'Archived']].map(([k, l]) =>
    h('button', { class: 'chip' + (filter === k ? ' on' : ''), onclick: () => { filter = k; showInbox(); } }, `${l} (${counts[k] || 0})`));
  view.replaceChildren(
    h('div', { class: 'head' }, h('h1', {}, 'Inbox'), h('p', { class: 'muted' }, 'Messages from the contact form on nemora.uk. They delete themselves after 2 years.')),
    h('div', { class: 'chips' }, chips),
    list.length ? h('ul', { class: 'list' }, list.map(m => h('li', {},
      h('a', { class: 'item' + (m.status === 'new' ? ' unread' : ''), href: '#inbox/' + m.id },
        h('div', { class: 'item-top' }, h('strong', {}, m.name || 'No name'), m.business ? h('span', { class: 'muted' }, ' · ' + m.business) : null, h('span', { class: 'grow' }), h('span', { class: 'when' }, when(m.at))),
        h('div', { class: 'item-meta' }, h('span', { class: 'pill s-' + m.status }, STATUS[m.status] || m.status), m.package ? h('span', { class: 'pill' }, PKG[m.package] || m.package) : null),
        h('p', { class: 'excerpt' }, m.excerpt || ''))))) :
      h('div', { class: 'empty' }, filter === 'open' ? 'No messages yet. When someone uses the contact form on nemora.uk, it appears here.' : 'Nothing here.')
  );
}

async function showMessage(id) {
  const { message: m } = await api('admin/messages/' + id);
  const notes = h('textarea', { id: 'notes', rows: '4', maxlength: '2000', placeholder: 'Private notes (only you see these)' });
  notes.value = m.notes || '';
  const setStatus = async s => { try { await api('admin/messages/' + id, { method: 'PATCH', body: { status: s } }); toast(s === 'archived' ? 'Archived' : 'Marked as ' + STATUS[s].toLowerCase()); route(); } catch (e) { toast(e.message, true); } };
  const subject = 'Re: your website enquiry' + (m.business ? ' (' + m.business + ')' : '');
  const reply = 'mailto:' + encodeURIComponent(m.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(`Hi ${m.name.split(' ')[0]},\n\n\n\nThe NEMORA team\n07707 986154\n\n---\nYou wrote on ${full(m.at)}:\n${m.message}`);
  const confirmBox = h('div', { class: 'confirm', hidden: true },
    h('p', {}, 'Delete this message for good? This can\'t be undone.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn btn-danger', onclick: async () => { try { await api('admin/messages/' + id, { method: 'DELETE' }); toast('Deleted'); go('inbox'); } catch (e) { toast(e.message, true); } } }, 'Yes, delete'), h('button', { class: 'btn', onclick: () => confirmBox.hidden = true }, 'Cancel')));
  const copy = (text, label) => h('button', { class: 'btn btn-sm', onclick: async () => { try { await navigator.clipboard.writeText(text); toast(label + ' copied'); } catch (e) { toast('Copy failed: press and hold to copy instead', true); } } }, 'Copy');
  const row = (label, value, extra) => value ? h('div', { class: 'kv' }, h('span', { class: 'k' }, label), h('span', { class: 'v' }, value), extra || null) : null;
  view.replaceChildren(
    h('a', { class: 'back', href: '#inbox' }, '← Inbox'),
    h('div', { class: 'card' },
      h('div', { class: 'item-top' }, h('h1', {}, m.name), h('span', { class: 'grow' }), h('span', { class: 'pill s-' + m.status }, STATUS[m.status])),
      h('p', { class: 'muted' }, full(m.at)),
      h('div', { class: 'kvs' },
        row('Business', m.business),
        row('Email', m.email, copy(m.email, 'Email')),
        row('Phone', m.phone, h('a', { class: 'btn btn-sm', href: 'tel:' + m.phone.replace(/[^+0-9]/g, '') }, 'Call')),
        row('Package', PKG[m.package] || 'Not sure yet'),
        row('Looking for', m.need)),
      h('div', { class: 'message' }, m.message),
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn-gold', href: reply, onclick: () => m.status !== 'replied' && setTimeout(() => setStatus('replied'), 400) }, 'Reply by email'),
        m.status !== 'replied' ? h('button', { class: 'btn', onclick: () => setStatus('replied') }, 'Mark replied') : null,
        m.status !== 'archived' ? h('button', { class: 'btn', onclick: () => setStatus('archived') }, 'Archive') : h('button', { class: 'btn', onclick: () => setStatus('read') }, 'Move back to inbox'),
        h('button', { class: 'btn', onclick: () => setStatus('new') }, 'Mark unread'))),
    h('div', { class: 'card' },
      h('label', { for: 'notes' }, 'Notes'), notes,
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: async () => { try { await api('admin/messages/' + id, { method: 'PATCH', body: { notes: notes.value } }); toast('Notes saved'); } catch (e) { toast(e.message, true); } } }, 'Save notes'))),
    h('div', { class: 'card' },
      h('h2', {}, 'Privacy'), h('p', { class: 'muted' }, 'If this person asks us to delete their details, delete the message here and anything you copied elsewhere.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn btn-danger', onclick: () => confirmBox.hidden = false }, 'Delete message')), confirmBox)
  );
}

/* ---------------- visitors ---------------- */
const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); for (const c of kids) if (c) el.append(c.nodeType ? c : document.createTextNode(String(c))); return el; }
const num = n => Number(n || 0).toLocaleString('en-GB');
const PAGE_NAMES = { '/': 'Home', '/services.html': 'Services & prices', '/contact.html': 'Contact', '/work.html': 'Our work', '/about.html': 'About', '/privacy.html': 'Privacy', '/guides/': 'Guides', '/404.html': 'Page not found' };
const pageName = p => PAGE_NAMES[p] || p.replace(/^\//, '').replace(/\.html$/, '').replace(/[-_/]+/g, ' ').replace(/^./, c => c.toUpperCase()) || 'Home';
let regionNames; try { regionNames = new Intl.DisplayNames(['en-GB'], { type: 'region' }); } catch (e) {}
const countryName = c => { try { return (regionNames && regionNames.of(c)) || c; } catch (e) { return c; } };

function change(now, before) {
  now = Number(now || 0); before = Number(before || 0);
  if (!before) return now ? h('span', { class: 'delta up' }, 'New') : null;
  const pct = Math.round((now - before) / before * 100);
  return h('span', { class: 'delta ' + (pct > 0 ? 'up' : pct < 0 ? 'down' : '') }, (pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '') + Math.abs(pct) + '%');
}
function tile(label, value, delta, note) { return h('div', { class: 'tile' }, h('span', { class: 'tile-k' }, label), h('strong', { class: 'tile-v' }, value), h('span', { class: 'tile-n' }, delta, note ? h('span', { class: 'muted' }, ' ' + note) : null)); }

function chart(series, days, from) {
  const map = Object.fromEntries(series.map(r => [r.day, r]));
  const pts = []; const start = new Date(from + 'T00:00:00Z');
  for (let i = 0; i < days; i++) { const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10); pts.push({ day: d, v: Number((map[d] || {}).visitors || 0) }); }
  const W = view.clientWidth < 560 ? 340 : 600, H = W < 600 ? 170 : 180, pad = { l: 30, r: 8, t: 12, b: 24 };
  const max = Math.max(4, ...pts.map(p => p.v)); const top = Math.ceil(max / 4) * 4;
  const x = i => pad.l + (pts.length < 2 ? 0 : i * (W - pad.l - pad.r) / (pts.length - 1));
  const y = v => H - pad.b - v / top * (H - pad.t - pad.b);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `Visitors per day over the last ${days} days` });
  for (let g = 0; g <= 4; g++) { const v = top * g / 4; svg.append(s('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'grid' }), s('text', { x: pad.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' }, num(v))); }
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  svg.append(s('path', { d: `${line}L${x(pts.length - 1)},${y(0)}L${x(0)},${y(0)}Z`, class: 'area' }), s('path', { d: line, class: 'line' }));
  const fmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const ticks = days <= 7 ? pts.map((_, i) => i) : [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  for (const i of ticks) svg.append(s('text', { x: x(i), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle', class: 'axis' }, fmt(pts[i].day)));
  pts.forEach((p, i) => { const c = s('circle', { cx: x(i), cy: y(p.v), r: days <= 30 ? 3 : 0, class: 'dot' }); c.append(s('title', {}, `${fmt(p.day)}: ${num(p.v)} visitor${p.v === 1 ? '' : 's'}`)); svg.append(c); });
  return svg;
}
function bars(title, rows, label, valueKey = 'visitors', empty = 'Nothing yet.') {
  const total = rows.reduce((a, r) => a + Number(r[valueKey] || 0), 0);
  const max = Math.max(1, ...rows.map(r => Number(r[valueKey] || 0)));
  return h('div', { class: 'card' }, h('h2', {}, title),
    rows.length ? h('ul', { class: 'bars' }, rows.map(r => h('li', {},
      (el => (el.style.setProperty('--w', (Number(r[valueKey]) / max * 100).toFixed(1) + '%'), el))(h('span', { class: 'bar' })),
      h('span', { class: 'bar-l' }, label(r.label)),
      h('span', { class: 'bar-v' }, num(r[valueKey]), total ? h('span', { class: 'muted' }, ' · ' + Math.round(Number(r[valueKey]) / total * 100) + '%') : null)))) : h('p', { class: 'muted' }, empty));
}

async function showTraffic() {
  const t = await api('admin/traffic?days=' + range);
  const head = h('div', { class: 'head' }, h('h1', {}, 'Visitors'), h('p', { class: 'muted' }, 'Who is looking at nemora.uk. No cookies and no personal data: each visitor is counted with a code that changes every day.'));
  if (!t.enabled) { view.replaceChildren(head, h('div', { class: 'empty' }, 'Visitor stats are not switched on yet. The database link is missing from the server settings.')); return; }
  const chips = h('div', { class: 'chips' }, [[7, '7 days'], [30, '30 days'], [90, '90 days']].map(([d, l]) => h('button', { class: 'chip' + (range === d ? ' on' : ''), onclick: () => { range = d; showTraffic(); } }, l)));
  const T = t.totals, P = t.previous;
  const conv = T.visitors ? (Number(T.enquiries || 0) / Number(T.visitors) * 100) : 0;
  const prevNote = `vs previous ${t.days} days`;
  const live = h('div', { class: 'live' }, h('span', { class: 'pulse', 'aria-hidden': 'true' }), h('span', {}, h('strong', {}, num(t.live)), ` on the site in the last 30 minutes`));
  const nothing = !Number(T.views);
  view.replaceChildren(head, chips, live,
    h('div', { class: 'tiles' },
      tile('Visitors', num(T.visitors), change(T.visitors, P.visitors), prevNote),
      tile('Page views', num(T.views), change(T.views, P.views)),
      tile('Enquiries', num(T.enquiries), change(T.enquiries, P.enquiries)),
      tile('Enquiry rate', (conv ? conv.toFixed(1) : '0') + '%', null, 'of visitors sent a message')),
    nothing ? h('div', { class: 'empty' }, 'No visits recorded in this period yet. Stats start from the moment the counter went live, so give it a day.') : h('div', { class: 'card' }, h('h2', {}, 'Visitors per day'), chart(t.series, t.days, t.from)),
    h('div', { class: 'grid2' },
      bars('Top pages', t.pages, pageName, 'views'),
      bars('Where they came from', t.referrers, l => l, 'visitors', 'Everyone came direct or from a link without a source (WhatsApp, email, typed in).'),
      bars('Devices', t.devices, l => l),
      bars('Countries', t.countries, countryName)),
    h('div', { class: 'card' }, h('h2', {}, 'Leads and outreach'), h('p', { class: 'muted' }, 'Prospects, emails sent and client projects are tracked in your Nemora pipeline.'),
      h('div', { class: 'actions' }, h('a', { class: 'btn', href: 'https://claude.ai/artifact/29FFTNLVhyvBBhRRJvNAmq', target: '_blank', rel: 'noopener' }, 'Open pipeline'), h('button', { class: 'btn', onclick: () => go('inbox') }, 'Open inbox'))));
}

async function showActivity() {
  const { log } = await api('admin/activity');
  view.replaceChildren(
    h('div', { class: 'head' }, h('h1', {}, 'Activity'), h('p', { class: 'muted' }, 'Logins and changes to the admin. If you see something you don\'t recognise, change your password and log out all other devices.')),
    log.length ? h('ul', { class: 'list log' }, log.map(l => h('li', { class: 'item static' }, h('div', { class: 'item-top' }, h('strong', {}, l.action), h('span', { class: 'grow' }), h('span', { class: 'when' }, full(l.at))), h('p', { class: 'muted' }, [l.user, l.where].filter(Boolean).join(' · '))))) : h('div', { class: 'empty' }, 'No activity yet.'));
}

function showAccount() {
  const f = (id, label, type, ac, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), hint ? h('span', { class: 'hint' }, hint) : null, h('input', { id, type, autocomplete: ac, autocapitalize: 'none', spellcheck: 'false' }));
  const msg = h('div', { class: 'msg', role: 'status', hidden: true });
  const form = h('form', { class: 'card', novalidate: true, onsubmit: async e => {
    e.preventDefault(); msg.hidden = true;
    try {
      await api('admin/account', { method: 'POST', body: { current: $('#a-cur').value, username: $('#a-user').value.trim(), password: $('#a-pass').value } });
      form.reset(); msg.className = 'msg ok'; msg.textContent = 'Saved. Any other devices have been logged out.'; msg.hidden = false;
    } catch (x) { msg.className = 'msg err'; msg.textContent = x.message; msg.hidden = false; }
  } },
    h('h2', {}, 'Change login details'), msg,
    f('a-user', 'New username', 'text', 'username', 'Leave blank to keep your current username.'),
    f('a-pass', 'New password', 'password', 'new-password', 'At least 12 characters. Leave blank to keep your current password.'),
    f('a-cur', 'Current password', 'password', 'current-password', 'Needed to confirm it\'s you.'),
    h('button', { class: 'btn btn-gold', type: 'submit' }, 'Save'));
  view.replaceChildren(
    h('div', { class: 'head' }, h('h1', {}, 'Account')), form,
    h('div', { class: 'card' }, h('h2', {}, 'Devices'), h('p', { class: 'muted' }, 'Log out everywhere except this phone or computer.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: async () => { try { await api('admin/logout-others', { method: 'POST' }); toast('Other devices logged out'); } catch (e) { toast(e.message, true); } } }, 'Log out other devices'),
        h('button', { class: 'btn', onclick: async () => { try { await api('logout', { method: 'POST' }); } catch (e) {} location.href = '/admin/'; } }, 'Log out'))));
}

window.addEventListener('hashchange', route);
route();
