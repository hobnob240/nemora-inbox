// NEMORA back office. Everything is drawn with DOM nodes and textContent: no innerHTML, so nothing a visitor or a lead
// typed can ever run as code here. The page holds no passwords, keys or tokens; the login lives in an HttpOnly cookie.
const $ = s => document.querySelector(s);
const view = $('#view');
const render = (...kids) => { view.replaceChildren(); add(view, kids); };

/* ================= helpers ================= */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  return add(el, kids);
}
function add(el, kids) { for (const c of [kids].flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); return el; }
const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); for (const c of kids) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c))); return el; }
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2|M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  leads: 'M22 12h-4l-3 9L9 3l-3 9H2',
  work: 'M3 7h18v13H3z|M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2|M3 12h18',
  money: 'M12 2v20|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  visitors: 'M3 3v18h18|M7 15l4-4 3 3 5-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z|M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z|M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9',
  back: 'M15 18l-6-6 6-6', chev: 'M9 18l6-6-6-6', plus: 'M12 5v14|M5 12h14', x: 'M18 6 6 18|M6 6l12 12',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M21 21l-4.35-4.35',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z|M22 6l-10 7L2 6',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
  copy: 'M9 9h11v11H9z|M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  link: 'M15 3h6v6|M10 14 21 3|M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  alert: 'M12 9v4|M12 17h.01|M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  check: 'M20 6 9 17l-5-5', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 6v6l4 2',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  print: 'M6 9V2h12v7|M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2|M6 14h12v8H6z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  trash: 'M3 6h18|M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
};
function icon(name, cls) { return s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: cls || '' }, ...ICONS[name].split('|').map(d => s('path', { d }))); }
let toastT;
function toast(text, bad) { document.querySelectorAll('.toast').forEach(t => t.remove()); const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, text); document.body.append(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3200); }
async function api(path, opts = {}) {
  const r = await fetch('/api/' + path, { credentials: 'same-origin', method: opts.method || 'GET', headers: opts.body ? { 'Content-Type': 'application/json' } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (r.status === 401) { location.href = '/admin/'; throw new Error('logged out'); }
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
  return d;
}
async function act(fn, ok) { try { const r = await fn(); if (ok) toast(ok); return r || true; } catch (e) { if (e.message !== 'logged out') toast(e.message, true); return null; } }
const go = hash => { if (location.hash === '#' + hash) route(); else location.hash = hash; };
const style = (el, prop, val) => { el.style.setProperty(prop, val); return el; };

// formatting
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 });
const money = (p, exact) => { p = Number(p || 0); return exact || p % 100 ? gbp2.format(p / 100) : gbp0.format(p / 100); };
const toPence = v => { const t = String(v == null ? '' : v).replace(/[£,\s]/g, ''); if (t === '') return 0; if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN; return Math.round(Number(t) * 100); };
const num = n => Number(n || 0).toLocaleString('en-GB');
const D = iso => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso);
const day = iso => iso ? D(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: D(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : '';
const longDay = iso => iso ? D(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const when = iso => { if (!iso) return ''; const d = new Date(iso), t = new Date(); return d.toDateString() === t.toDateString() ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : day(iso); };
const full = iso => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const localISO = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayISO = () => localISO(new Date());
const addDays = (iso, n) => { const d = D(iso); d.setDate(d.getDate() + n); return localISO(d); };
const plural = (n, one, many) => `${num(n)} ${Number(n) === 1 ? one : many || one + 's'}`;
const initials = t => { const w = String(t || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean); if (!w.length) return '?'; const f = [...w[0]][0], l = w.length > 1 ? [...w[w.length - 1]][0] : ''; return (f + l).toUpperCase(); };
const safeHref = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };
const tel = p => 'tel:' + String(p).replace(/[^+0-9]/g, '');
async function copy(text, label) { try { await navigator.clipboard.writeText(text); toast((label || 'Text') + ' copied'); } catch (e) { toast('Couldn\'t copy. Press and hold to select it instead.', true); } }

// shared UI pieces
const pill = (text, tone) => h('span', { class: 'pill ' + (tone || '') }, text);
const fitDots = n => h('span', { class: 'fit', title: `Fit ${n} of 5`, role: 'img', 'aria-label': `Fit ${n} of 5` }, [1, 2, 3, 4, 5].map(i => h('i', { class: i <= n ? 'on' : '' })));
function pageHead(eyebrow, title, sub, actions, backTo) {
  return h('div', { class: 'page-head' },
    h('div', { class: 'titles' }, backTo ? h('a', { class: 'back', href: '#' + backTo[0] }, icon('back'), backTo[1]) : null, eyebrow ? h('span', { class: 'eyebrow' }, eyebrow) : null, h('h1', {}, title), sub ? h('p', { class: 'muted' }, sub) : null),
    actions && actions.filter(Boolean).length ? h('div', { class: 'actions' }, actions) : null);
}
const card = (title, kids, link) => h('section', { class: 'card' }, title ? h('div', { class: 'card-head' }, h('h2', {}, title), link || null) : null, kids);
const empty = (title, text, btn) => h('div', { class: 'empty' }, h('strong', {}, title), text ? h('span', {}, text) : null, btn || null);
const kv = (k, v, extra) => h('div', { class: 'kv' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v || h('span', { class: 'muted' }, '—')), extra || h('span'));
const tile = (k, v, n, cls, href) => h(href ? 'a' : 'div', { class: 'tile ' + (cls || ''), href }, h('span', { class: 'tile-k' }, k), h('strong', { class: 'tile-v' }, v), h('span', { class: 'tile-n' }, n || ''));
function chipsRow(opts, current, onPick) { return h('div', { class: 'chips', role: 'tablist' }, opts.map(([k, l, n]) => h('button', { class: 'chip' + (current === k ? ' on' : ''), role: 'tab', 'aria-selected': String(current === k), onclick: () => onPick(k) }, l, n != null ? h('span', { class: 'n' }, num(n)) : null))); }
function confirmBox(text, yesLabel, onYes) {
  const box = h('div', { class: 'confirm', hidden: true }, text, h('div', { class: 'actions' }, h('button', { class: 'btn btn-danger', onclick: onYes }, yesLabel), h('button', { class: 'btn', onclick: () => box.hidden = true }, 'Keep it')));
  return box;
}
// form builder: fields [{k, label, type, options, hint, full, value, placeholder}]
function form(fields, data = {}, opts = {}) {
  const els = {};
  const err = h('div', { class: 'msg err', role: 'alert', hidden: true });
  const grid = h('div', { class: 'fields two' });
  for (const f of fields) {
    const id = 'f-' + f.k, v = data[f.k] != null && data[f.k] !== '' ? data[f.k] : (f.value != null ? f.value : '');
    let input;
    if (f.type === 'textarea') input = h('textarea', { id, rows: f.rows || 4, placeholder: f.placeholder }, String(v));
    else if (f.type === 'select') input = h('select', { id }, f.options.map(([val, l]) => h('option', { value: val, selected: String(val) === String(v) }, l)));
    else if (f.type === 'money') input = h('input', { id, inputmode: 'decimal', placeholder: '0.00', value: v === '' || v == null ? '' : (Number(v) / 100).toFixed(2).replace(/\.00$/, '') });
    else input = h('input', { id, type: f.type === 'number' ? 'text' : f.type || 'text', value: String(v), placeholder: f.placeholder, inputmode: f.inputmode || (f.type === 'number' ? 'numeric' : null), autocomplete: 'off', autocapitalize: ['email', 'url'].includes(f.type) ? 'none' : null, spellcheck: ['email', 'url'].includes(f.type) ? 'false' : null });
    els[f.k] = input;
    const wrap = h('div', { class: 'field' }, h('label', { for: id }, f.label), f.hint ? h('span', { class: 'hint' }, f.hint) : null, input);
    if (f.full || f.type === 'textarea') style(wrap, 'grid-column', '1 / -1');
    grid.append(wrap);
  }
  const values = () => {
    const o = {};
    for (const f of fields) {
      const raw = els[f.k].value;
      if (f.type === 'money') { const p = toPence(raw); if (isNaN(p)) throw new Error(f.label.replace(/ \(£\)/, '') + ': use a number like 795 or 397.50'); o[f.k] = p; }
      else if (f.type === 'number') { if (raw.trim() !== '' && !/^\d+$/.test(raw.trim())) throw new Error(f.label + ': use a whole number.'); o[f.k] = raw.trim() === '' ? 0 : Number(raw); }
      else o[f.k] = raw;
    }
    return o;
  };
  const submit = h('button', { class: 'btn btn-gold', type: 'submit' }, opts.submit || 'Save');
  const el = h('form', { class: 'card', novalidate: true, onsubmit: async e => {
    e.preventDefault(); err.hidden = true; submit.disabled = true;
    try { await opts.onSave(values()); } catch (x) { if (x.message !== 'logged out') { err.textContent = x.message; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); } }
    finally { submit.disabled = false; }
  } }, opts.title ? h('h2', {}, opts.title) : null, err, grid, opts.after || null,
    h('div', { class: 'actions' }, submit, opts.onCancel ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: opts.onCancel }, 'Cancel') : null));
  return { el, els, values };
}

/* ================= labels ================= */
const LEAD = { check: ['To check', ''], ready: ['Ready', 'info'], contacted: ['Contacted', 'gold'], followup: ['Followed up', 'gold'], replied: ['Replied', 'warn'], interested: ['Interested', 'ok'], won: ['Client', 'ok'], lost: ['Lost', ''], hold: ['On hold', ''], dnc: ['Do not contact', 'bad'] };
const STAGE = { preview: ['Preview', 'info'], quoted: ['Quoted', 'gold'], deposit: ['Deposit paid', 'ok'], building: ['Building', 'warn'], review: ['Client review', 'warn'], live: ['Live', 'ok'], care: ['Care plan', 'ok'], paused: ['Paused', ''], lost: ['Lost', ''] };
const STAGE_FLOW = ['preview', 'quoted', 'deposit', 'building', 'review', 'live', 'care'];
const INV = { draft: ['Draft', 'warn'], sent: ['Awaiting payment', 'info'], paid: ['Paid', 'ok'], void: ['Void', ''] };
const MSG = { new: ['New', 'warn'], read: ['Read', 'info'], replied: ['Replied', 'ok'], archived: ['Archived', ''] };
const PKG = { starter: 'Starter', business: 'Business', premium: 'Premium', bigger: 'Something bigger', '': 'Not sure yet' };
const PRICES = { Starter: [40000, 2500], Business: [79500, 5000], Premium: [160000, 7000] };
const tag = (map, k) => pill((map[k] || [k])[0], (map[k] || [])[1]);

/* ================= shell ================= */
const NAV = [['home', 'Home'], ['inbox', 'Inbox'], ['leads', 'Leads'], ['work', 'Work'], ['money', 'Money']];
const NAV_MORE = [['visitors', 'Visitors'], ['settings', 'Settings']];
const SECTION = { inbox: 'inbox', leads: 'leads', lead: 'leads', work: 'work', project: 'work', client: 'work', clients: 'work', money: 'money', invoice: 'money', visitors: 'visitors', settings: 'settings', activity: 'settings', home: 'home' };
const TITLES = { home: 'Home', inbox: 'Inbox', leads: 'Leads', work: 'Work', money: 'Money', visitors: 'Visitors', settings: 'Settings' };
let me = { username: '', unread: 0 };
function shell() {
  $('#side-nav').replaceChildren(...NAV.map(([k, l]) => h('a', { href: '#' + k, 'data-k': k }, icon(k), l, k === 'inbox' ? h('span', { class: 'count', hidden: true }) : null)), h('div', { class: 'sep' }), ...NAV_MORE.map(([k, l]) => h('a', { href: '#' + k, 'data-k': k }, icon(k), l)));
  $('#tabbar').replaceChildren(...NAV.map(([k, l]) => h('a', { href: '#' + k, 'data-k': k }, icon(k), l, k === 'inbox' ? h('span', { class: 'dot', hidden: true }) : null)));
  $('#me-name').textContent = me.username; $('#me-avatar').textContent = initials(me.username);
  const menu = $('#menu'), btn = $('#menu-btn');
  menu.replaceChildren(...NAV_MORE.map(([k, l]) => h('a', { href: '#' + k }, icon(k), l)), h('a', { href: 'https://nemora.uk/', target: '_blank', rel: 'noopener' }, icon('link'), 'View website'), h('button', { type: 'button', onclick: logout }, icon('logout'), 'Log out'));
  btn.replaceChildren(icon('more')); $('#logout-side').replaceChildren(icon('logout'));
  btn.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); };
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { menu.hidden = true; btn.focus(); } });
  $('#logout-side').onclick = logout;
}
function markNav(section) {
  document.querySelectorAll('[data-k]').forEach(a => { if (a.dataset.k === section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.querySelectorAll('#side-nav .count, #tabbar .dot').forEach(b => { b.hidden = !me.unread; b.textContent = me.unread > 99 ? '99+' : String(me.unread); });
  $('#menu').hidden = true;
  document.title = (TITLES[section] || 'Admin') + ' | NEMORA';
}
async function logout() { try { await api('logout', { method: 'POST' }); } catch (e) {} location.href = '/admin/'; }
async function refreshMe() { try { me = await api('admin/me'); } catch (e) { return false; } return true; }

let routeSeq = 0;
async function route() {
  const seq = ++routeSeq;
  const [page, id, extra] = (location.hash.slice(1) || 'home').split('/');
  if (!(await refreshMe()) || seq !== routeSeq) return;
  markNav(SECTION[page] || 'home');
  render(h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }));
  const pages = {
    home: showHome, inbox: id ? () => showMessage(id) : showInbox, leads: showLeads, lead: () => showLead(id),
    work: () => showWork('projects'), clients: () => showWork('clients'),
    project: () => id === 'new' ? editProject(null, extra) : showProject(id), client: () => id === 'new' ? editClient(null) : showClient(id),
    money: showMoney, invoice: () => id === 'new' ? editInvoice(null, extra) : showInvoice(id),
    visitors: showTraffic, settings: showSettings, activity: showActivity
  };
  try { await (pages[page] || showHome)(); }
  catch (e) { if (e.message !== 'logged out' && seq === routeSeq) render(h('div', { class: 'msg err' }, e.message)); }
  if (seq === routeSeq) { view.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}

/* ================= home ================= */
async function showHome() {
  const [d, st] = await Promise.all([api('admin/dashboard'), api('admin/settings').catch(() => ({ business: {} }))]);
  const hr = new Date().getHours();
  const hello = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const name = (st.business && st.business.first_name) || '';
  const L = d.leads || {}, sum = ks => ks.reduce((a, k) => a + (L[k] || 0), 0);

  const todo = [];
  if (d.unread) todo.push(['#inbox', 'inbox', '', plural(d.unread, 'new message'), 'From the contact form on nemora.uk']);
  for (const i of d.overdue) todo.push(['#invoice/' + i.id, 'alert', 'bad', `${i.business || i.name || 'A client'} owes ${money(i.total_pence)}`, `Invoice ${i.number} was due ${day(i.due)}`]);
  for (const l of d.hotLeads) todo.push(['#lead/' + l.id, 'star', 'ok', `${l.name} ${l.status === 'interested' ? 'is interested' : 'replied'}`, l.next || [l.type, l.area].filter(Boolean).join(' · ')]);
  for (const p of d.dueSoon) todo.push(['#project/' + p.id, 'clock', p.due < d.today ? 'bad' : '', `${p.title} ${p.due < d.today ? 'was due' : 'is due'} ${day(p.due)}`, (STAGE[p.stage] || [p.stage])[0]]);
  if (d.report && d.report.date === d.today) for (const n of d.report.needs_you || []) todo.push([null, 'check', '', n, 'From today\'s outreach report']);

  const v = d.visitors;
  const vDelta = v && v.prev ? Math.round((v.week - v.prev) / v.prev * 100) : null;
  const funnel = [['Found', sum(Object.keys(L))], ['Contacted', sum(['contacted', 'followup', 'replied', 'interested', 'won'])], ['Replied', sum(['replied', 'interested', 'won'])], ['Interested', sum(['interested', 'won'])], ['Clients', L.won || 0]];
  const fmax = Math.max(1, funnel[0][1]);
  const stagesActive = STAGE_FLOW.filter(k => d.stages[k]);
  const r = d.report;

  render(
    h('div', { class: 'hello' }, h('span', { class: 'eyebrow' }, new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })), h('h1', {}, hello + (name ? ', ' : ''), name ? h('em', {}, name) : null)),
    h('div', { class: 'tiles' },
      tile('Paid this month', money(d.money.month), `${money(d.money.year)} this year`, 'hero', '#money'),
      tile('Owed to you', money(d.money.outstanding), d.overdue.length ? h('span', { class: 'delta down' }, plural(d.overdue.length, 'overdue invoice')) : plural(d.money.outstandingCount, 'invoice') + ' out', '', '#money'),
      tile('Monthly plans', money(d.money.recurring), plural(d.money.recurringCount, 'client') + ' paying monthly', '', '#work'),
      tile('Visitors this week', v ? num(v.week) : '—', v ? [vDelta != null ? h('span', { class: 'delta ' + (vDelta >= 0 ? 'up' : 'down') }, (vDelta >= 0 ? '▲ ' : '▼ ') + Math.abs(vDelta) + '% ') : null, `${num(v.live)} on the site now`] : '', '', '#visitors')),
    h('div', { class: 'grid side-r' },
      card('Needs you', h('div', { class: 'todo' }, todo.length ? todo.slice(0, 8).map(([href, ic, tone, t, sub]) => h(href ? 'a' : 'div', { href }, h('span', { class: 'ic ' + tone }, icon(ic)), h('span', { class: 'tx' }, h('strong', {}, t), sub ? h('span', {}, sub) : null), href ? icon('chev', 'chev') : null))
        : h('div', {}, h('span', { class: 'ic ok' }, icon('check')), h('span', { class: 'tx' }, h('strong', {}, 'Nothing needs you right now'), h('span', {}, 'New messages, replies and overdue invoices show up here.'))))),
      card('Latest report', r ? [
        h('div', { class: 'fields' }, h('span', { class: 'eyebrow' }, ({ daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[r.type] || 'Report') + ' · ' + r.period), h('p', {}, r.headline)),
        h('div', { class: 'minis' }, [['Found', r.found], ['Emailed', r.contacted], ['Replies', r.replies], ['Interested', r.interested]].map(([k, n]) => h('div', { class: 'mini' }, h('span', {}, k), h('strong', {}, num(n))))),
        (r.highlights || []).length ? h('ul', { class: 'small' }, r.highlights.map(x => h('li', {}, x))) : null]
        : empty('No report yet', 'Your outreach assistant writes one every weekday at about 6pm.'))),
    h('div', { class: 'grid g2' },
      card('Outreach', [h('div', { class: 'pipe' }, funnel.map(([k, n]) => h('div', { class: 'pipe-row' }, h('span', {}, k), h('span', { class: 'pipe-bar' }, style(h('span'), 'transform', `scaleX(${n ? Math.max(.03, n / fmax) : 0})`)), h('span', { class: 'n' }, num(n))))),
        h('p', { class: 'small muted' }, `${plural(d.sentToday, 'email')} sent today · ${num(d.sentWeek)} this week · ${num(d.queued)} queued`)], h('a', { href: '#leads' }, 'All leads')),
      card('Projects', stagesActive.length || d.dueSoon.length ? [h('div', { class: 'actions' }, stagesActive.map(k => h('a', { href: '#work', class: 'pill ' + STAGE[k][1] }, STAGE[k][0] + ' · ' + d.stages[k]))),
        d.dueSoon.length ? h('div', { class: 'list' }, d.dueSoon.map(p => h('a', { class: 'row', href: '#project/' + p.id }, h('span', { class: 'body' }, h('span', { class: 't' }, p.title), h('span', { class: 's' }, p.business || p.name || '')), h('span', { class: 'end' }, h('span', { class: 'when' }, 'Due ' + day(p.due)))))) : null]
        : empty('No projects yet', 'When a lead says yes, turn them into a client and their project shows up here.'), h('a', { href: '#work' }, 'All work'))),
    h('div', { class: 'grid g2' },
      card('Latest messages', d.latestMessages && d.latestMessages.length ? h('div', { class: 'list' }, d.latestMessages.map(msgRow)) : empty('No messages yet', 'Messages from the contact form on nemora.uk land here.'), h('a', { href: '#inbox' }, 'Inbox')),
      card('Visitors', v ? [h('div', { class: 'live' }, h('span', { class: 'pulse', 'aria-hidden': 'true' }), h('span', {}, h('strong', {}, num(v.live)), ' on nemora.uk in the last 30 minutes')), chart(v.series, 7, v.from, true)] : empty('Visitor stats are off'), h('a', { href: '#visitors' }, 'Details'))));
}

/* ================= inbox ================= */
let inboxFilter = 'open';
const msgRow = m => h('a', { class: 'row' + (m.status === 'new' ? ' unread' : ''), href: '#inbox/' + m.id },
  h('span', { class: 'avatar-sm', 'aria-hidden': 'true' }, initials(m.name)),
  h('span', { class: 'body' }, h('span', { class: 't' }, m.name, m.business ? h('span', { class: 'muted' }, '· ' + m.business) : null), h('span', { class: 'x' }, m.excerpt)),
  h('span', { class: 'end' }, h('span', { class: 'when' }, when(m.at)), m.status !== 'new' ? tag(MSG, m.status) : null));
async function showInbox() {
  const { messages } = await api('admin/messages');
  const counts = { open: 0, new: 0, replied: 0, archived: 0 };
  for (const m of messages) { if (m.status !== 'archived') counts.open++; counts[m.status] = (counts[m.status] || 0) + 1; }
  const list = messages.filter(m => inboxFilter === 'open' ? m.status !== 'archived' : m.status === inboxFilter);
  render(
    pageHead('Inbox', 'Messages', 'Enquiries from the contact form on nemora.uk. They delete themselves after 2 years.'),
    chipsRow([['open', 'Open', counts.open], ['new', 'New', counts.new], ['replied', 'Replied', counts.replied], ['archived', 'Archived', counts.archived]], inboxFilter, k => { inboxFilter = k; showInbox(); }),
    list.length ? card(null, h('div', { class: 'list' }, list.map(msgRow))) : empty(inboxFilter === 'open' ? 'All clear' : 'Nothing here', inboxFilter === 'open' ? 'New messages from your website appear here.' : null));
}
async function showMessage(id) {
  const { message: m } = await api('admin/messages/' + id);
  const setStatus = async st => { if (await act(() => api('admin/messages/' + id, { method: 'PATCH', body: { status: st } }), st === 'archived' ? 'Archived' : 'Marked as ' + MSG[st][0].toLowerCase())) route(); };
  const notes = h('textarea', { rows: 3, placeholder: 'Private notes (only you see these)', 'aria-label': 'Notes' }, m.notes || '');
  const del = confirmBox('Delete this message for good? This can\'t be undone.', 'Delete', async () => { if (await act(() => api('admin/messages/' + id, { method: 'DELETE' }), 'Message deleted')) go('inbox'); });
  render(
    pageHead(full(m.at), m.name, m.business || null, [tag(MSG, m.status)], ['inbox', 'Inbox']),
    h('div', { class: 'grid side-r' },
      card('Message', [h('div', { class: 'quote' }, m.message),
        h('div', { class: 'actions' },
          h('a', { class: 'btn btn-gold', href: `mailto:${m.email}?subject=${encodeURIComponent('Re: your enquiry to NEMORA')}`, onclick: () => { if (m.status !== 'replied') api('admin/messages/' + id, { method: 'PATCH', body: { status: 'replied' } }).catch(() => {}); } }, icon('mail'), 'Reply by email'),
          m.phone ? h('a', { class: 'btn', href: tel(m.phone) }, icon('phone'), 'Call') : null,
          h('button', { class: 'btn', onclick: async () => { const r = await act(() => api('admin/clients', { method: 'POST', body: { name: m.name, business: m.business, email: m.email, phone: m.phone, notes: `From a website enquiry on ${day(m.at)}:\n${m.message}`.slice(0, 4000) } }), 'Client added'); if (r) go('client/' + r.id); } }, icon('user'), 'Add as client'))]),
      h('div', { class: 'grid' },
        card('Details', h('div', { class: 'kvs' },
          kv('Email', m.email, h('button', { class: 'btn btn-sm', onclick: () => copy(m.email, 'Email') }, 'Copy')),
          kv('Phone', m.phone, m.phone ? h('button', { class: 'btn btn-sm', onclick: () => copy(m.phone, 'Number') }, 'Copy') : null),
          kv('Business', m.business), kv('Package', PKG[m.package] || 'Not sure yet'), kv('Needs', m.need))),
        card('Notes', [notes, h('div', { class: 'actions' }, h('button', { class: 'btn btn-sm', onclick: () => act(() => api('admin/messages/' + id, { method: 'PATCH', body: { notes: notes.value } }), 'Notes saved') }, 'Save notes'))]),
        card(null, [h('div', { class: 'actions' },
          m.status !== 'replied' ? h('button', { class: 'btn btn-sm', onclick: () => setStatus('replied') }, 'Mark replied') : null,
          m.status !== 'archived' ? h('button', { class: 'btn btn-sm', onclick: () => setStatus('archived') }, 'Archive') : h('button', { class: 'btn btn-sm', onclick: () => setStatus('read') }, 'Move to inbox'),
          m.status !== 'new' ? h('button', { class: 'btn btn-sm', onclick: () => setStatus('new') }, 'Mark unread') : null,
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => del.hidden = false }, 'Delete')), del]))));
}

/* ================= leads ================= */
let leadFilter = 'active', leadSearch = '';
const LEAD_GROUPS = [['active', 'Active', l => !['dnc', 'lost', 'won', 'hold'].includes(l.status)], ['hot', 'Replied', l => ['replied', 'interested'].includes(l.status)], ['ready', 'Ready to email', l => l.status === 'ready'], ['contacted', 'Contacted', l => ['contacted', 'followup'].includes(l.status)], ['check', 'To check', l => l.status === 'check'], ['hold', 'On hold', l => l.status === 'hold'], ['won', 'Clients', l => l.status === 'won'], ['closed', 'Closed', l => ['lost', 'dnc'].includes(l.status)], ['all', 'All', () => true]];
async function showLeads() {
  const { leads } = await api('admin/leads');
  const listEl = h('div', { class: 'list' });
  const draw = () => {
    const g = LEAD_GROUPS.find(x => x[0] === leadFilter) || LEAD_GROUPS[0];
    const q = leadSearch.trim().toLowerCase();
    const rows = leads.filter(g[2]).filter(l => !q || [l.name, l.type, l.area, l.email].join(' ').toLowerCase().includes(q));
    listEl.replaceChildren(...(rows.length ? rows.map(l => h('a', { class: 'row', href: '#lead/' + l.id },
      h('span', { class: 'avatar-sm', 'aria-hidden': 'true' }, initials(l.name)),
      h('span', { class: 'body' }, h('span', { class: 't' }, l.name, l.fit ? fitDots(l.fit) : null), h('span', { class: 's' }, [l.type, l.area, l.package].filter(Boolean).join(' · ')), l.next ? h('span', { class: 'x' }, l.next) : null),
      h('span', { class: 'end' }, tag(LEAD, l.status), l.sent ? h('span', { class: 'when' }, plural(l.sent, 'email')) : null))) : [empty('No leads here', q ? 'Try a different search.' : null)]));
  };
  const counts = Object.fromEntries(LEAD_GROUPS.map(([k, , f]) => [k, leads.filter(f).length]));
  const search = h('input', { type: 'search', placeholder: 'Search leads', value: leadSearch, 'aria-label': 'Search leads', oninput: e => { leadSearch = e.target.value; draw(); } });
  let chipsEl;
  const chips = () => chipsRow(LEAD_GROUPS.filter(([k]) => counts[k] || k === 'active' || k === leadFilter).map(([k, l]) => [k, l, counts[k]]), leadFilter, k => { leadFilter = k; const n = chips(); chipsEl.replaceWith(n); chipsEl = n; draw(); });
  chipsEl = chips();
  const sum = ks => leads.filter(l => ks.includes(l.status)).length;
  render(
    pageHead('Outreach', 'Leads', 'Businesses your outreach assistant has found and contacted. It keeps these up to date; you can change anything.', [h('a', { class: 'btn', href: '#lead/new' }, icon('plus'), 'Add lead')]),
    h('div', { class: 'tiles' },
      tile('Leads', num(leads.length), `${num(sum(['ready']))} ready to email`),
      tile('Contacted', num(sum(['contacted', 'followup', 'replied', 'interested', 'won'])), `${num(sum(['check']))} to check`),
      tile('Replied', num(sum(['replied', 'interested', 'won']))),
      tile('Interested', num(sum(['interested', 'won'])), `${num(sum(['won']))} became clients`, 'hero')),
    h('div', { class: 'search' }, icon('search'), search), chipsEl,
    card(null, listEl));
  draw();
}
const LEAD_FIELDS = [
  { k: 'name', label: 'Business name' }, { k: 'type', label: 'What they do', placeholder: 'e.g. Dog groomer' }, { k: 'area', label: 'Area', placeholder: 'e.g. Hanley' },
  { k: 'status', label: 'Status', type: 'select', options: Object.entries(LEAD).map(([k, v]) => [k, v[0]]), value: 'check' },
  { k: 'email', label: 'Email', hint: 'Only a published business email.' }, { k: 'phone', label: 'Phone' }, { k: 'website', label: 'Website' },
  { k: 'legal', label: 'Company', hint: 'Ltd name and Companies House number, if any.' }, { k: 'address', label: 'Address', full: true },
  { k: 'package', label: 'Best package', type: 'select', options: [['', 'Not decided'], ['Starter', 'Starter'], ['Business', 'Business'], ['Premium', 'Premium']] },
  { k: 'fit', label: 'Fit', type: 'select', options: [[0, 'Not scored'], [1, '1 of 5'], [2, '2 of 5'], [3, '3 of 5'], [4, '4 of 5'], [5, '5 of 5']] },
  { k: 'pitch', label: 'Pitch', type: 'textarea', rows: 2 }, { k: 'notes', label: 'Notes', type: 'textarea' }, { k: 'next', label: 'Next step', full: true }];
async function showLead(id) {
  if (id === 'new') {
    const f = form(LEAD_FIELDS, {}, { title: 'New lead', submit: 'Add lead', onCancel: () => go('leads'), onSave: async v => { v.fit = Number(v.fit); const r = await api('admin/leads', { method: 'POST', body: v }); toast('Lead added'); go('lead/' + r.id); } });
    render(pageHead('Outreach', 'Add a lead', 'Your outreach assistant only emails limited companies with a published email, and checks every rule first.', null, ['leads', 'Leads']), f.el);
    return;
  }
  const { lead: l, sent, queued, project, client } = await api('admin/leads/' + id);
  const statusSel = h('select', { 'aria-label': 'Status', onchange: async e => { if (await act(() => api('admin/leads/' + id, { method: 'PATCH', body: { status: e.target.value } }), e.target.value === 'dnc' ? 'Marked do not contact. Queued emails cancelled.' : 'Status updated')) route(); } }, Object.entries(LEAD).map(([k, v]) => h('option', { value: k, selected: k === l.status }, v[0])));
  const notes = h('textarea', { rows: 4, 'aria-label': 'Notes' }, l.notes); const next = h('input', { value: l.next, 'aria-label': 'Next step' });
  const del = confirmBox('Delete this lead and its email history for good? Do this if they ask you to erase their data.', 'Delete lead', async () => { if (await act(() => api('admin/leads/' + id, { method: 'DELETE' }), 'Lead deleted')) go('leads'); });
  const site = safeHref(/^https?:\/\//i.test(l.website) ? l.website.split(/\s/)[0] : /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?(\s|$)/i.test(l.website) ? 'https://' + l.website.split(/\s/)[0] : '');
  const mail = (l.email.match(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/i) || [''])[0];
  const canConvert = !client && ['replied', 'interested', 'won', 'contacted', 'followup', 'ready'].includes(l.status);
  render(
    pageHead([l.type, l.area].filter(Boolean).join(' · ') || 'Lead', l.name, null, [tag(LEAD, l.status), l.fit ? fitDots(l.fit) : null], ['leads', 'Leads']),
    h('div', { class: 'grid side-r' },
      h('div', { class: 'grid' },
        l.pitch ? card('Pitch', h('p', { class: 'prose' }, l.pitch)) : null,
        card('Notes and next step', [h('div', { class: 'field' }, h('label', {}, 'Next step'), next), h('div', { class: 'field' }, h('label', {}, 'Notes'), notes), h('div', { class: 'actions' }, h('button', { class: 'btn btn-sm', onclick: () => act(() => api('admin/leads/' + id, { method: 'PATCH', body: { notes: notes.value, next: next.value } }), 'Saved') }, 'Save'))]),
        card('Emails', [
          queued.length ? h('div', { class: 'list' }, queued.map(o => h('div', { class: 'row' }, h('span', { class: 'body' }, h('span', { class: 't' }, o.subject, pill('Queued', 'gold')), h('span', { class: 's' }, `${o.kind}${o.not_before ? ' · from ' + day(o.not_before) : ''}${o.slot ? ', ' + o.slot : ''}`), h('details', {}, h('summary', { class: 'small' }, 'Read it'), h('div', { class: 'quote' }, o.body))),
            h('span', { class: 'end' }, h('button', { class: 'btn btn-sm btn-danger', onclick: async () => { if (await act(() => api('admin/outbox/' + o.id, { method: 'DELETE' }), 'Email cancelled')) route(); } }, 'Cancel'))))) : null,
          sent.length ? h('div', { class: 'list' }, sent.map(x => h('div', { class: 'row' }, h('span', { class: 'body' }, h('span', { class: 't' }, x.subject), h('span', { class: 's' }, x.kind + ' to ' + x.to_email)), h('span', { class: 'end' }, h('span', { class: 'when' }, when(x.sent_at)))))) : null,
          !queued.length && !sent.length ? h('p', { class: 'muted small' }, 'No emails yet.') : null])),
      h('div', { class: 'grid' },
        card('Status', [statusSel, h('div', { class: 'actions' },
          client ? h('a', { class: 'btn btn-gold', href: '#client/' + client.id }, icon('user'), 'Open client') : canConvert ? h('button', { class: 'btn btn-gold', onclick: async () => { const r = await act(() => api('admin/leads/' + id + '/convert', { method: 'POST', body: {} }), 'Now a client'); if (r) go('client/' + r.client); } }, icon('user'), 'Turn into client') : null,
          project ? h('a', { class: 'btn', href: '#project/' + project.id }, icon('work'), 'Project') : null)]),
        card('Details', h('div', { class: 'kvs' },
          kv('Email', l.email, mail ? h('button', { class: 'btn btn-sm', onclick: () => copy(mail, 'Email') }, 'Copy') : null),
          kv('Phone', l.phone, /[0-9]{6}/.test(l.phone.replace(/\s/g, '')) ? h('a', { class: 'btn btn-sm', href: tel(l.phone) }, 'Call') : null),
          kv('Website', l.website, site ? h('a', { class: 'btn btn-sm', href: site, target: '_blank', rel: 'noopener noreferrer' }, 'Open') : null),
          kv('Company', l.legal), kv('Address', l.address), kv('Socials', l.socials), kv('Reviews', l.reviews ? num(l.reviews) : ''), kv('Package', l.package), kv('Channel', l.channel), kv('Source', l.source), kv('Found', day(l.found)))),
        card(null, [h('div', { class: 'actions' }, h('button', { class: 'btn btn-sm btn-danger', onclick: () => del.hidden = false }, icon('trash'), 'Delete lead')), del]))));
}

/* ================= work: projects & clients ================= */
async function showWork(tab) {
  const isClients = tab === 'clients';
  const head = pageHead('Work', isClients ? 'Clients' : 'Projects', null, [h('a', { class: 'btn btn-gold', href: isClients ? '#client/new' : '#project/new' }, icon('plus'), isClients ? 'New client' : 'New project')]);
  const seg = chipsRow([['projects', 'Projects'], ['clients', 'Clients']], isClients ? 'clients' : 'projects', k => go(k === 'clients' ? 'clients' : 'work'));
  if (isClients) {
    const { clients } = await api('admin/clients');
    render(head, seg, clients.length ? card(null, h('div', { class: 'list' }, clients.map(c => h('a', { class: 'row', href: '#client/' + c.id },
      h('span', { class: 'avatar-sm', 'aria-hidden': 'true' }, initials(c.business || c.name)),
      h('span', { class: 'body' }, h('span', { class: 't' }, c.business || c.name), h('span', { class: 's' }, [c.business ? c.name : '', plural(c.projects, 'project')].filter(Boolean).join(' · '))),
      h('span', { class: 'end' }, h('span', { class: 'amt' }, money(c.paid_pence)), h('span', { class: 'when' }, c.owed_pence ? money(c.owed_pence) + ' owed' : 'paid to date')))))) : empty('No clients yet', 'Add one here, from an enquiry in your inbox, or by turning a lead into a client.', h('a', { class: 'btn btn-gold', href: '#client/new' }, 'Add a client')));
    return;
  }
  const { projects } = await api('admin/projects');
  const groups = [...STAGE_FLOW, 'paused', 'lost'].map(k => [k, projects.filter(p => p.stage === k)]).filter(([, l]) => l.length);
  const inHand = projects.filter(p => !['lost', 'paused', 'preview'].includes(p.stage)).reduce((a, p) => a + p.price_pence, 0);
  render(head, seg,
    projects.length ? h('div', { class: 'tiles' },
      tile('Work won', money(inHand), 'setup fees, not counting previews', 'hero'),
      tile('Previews', num(projects.filter(p => p.stage === 'preview').length), 'built for interested leads'),
      tile('In progress', num(projects.filter(p => ['deposit', 'building', 'review'].includes(p.stage)).length)),
      tile('Live', num(projects.filter(p => ['live', 'care'].includes(p.stage)).length))) : null,
    groups.length ? groups.map(([k, list]) => card(STAGE[k][0], h('div', { class: 'list' }, list.map(p => h('a', { class: 'row', href: '#project/' + p.id },
      h('span', { class: 'body' }, h('span', { class: 't' }, p.title), h('span', { class: 's' }, [p.client_business || p.client_name || (p.lead_name ? 'Lead: ' + p.lead_name : ''), p.package].filter(Boolean).join(' · '))),
      h('span', { class: 'end' }, p.price_pence ? h('span', { class: 'amt' }, money(p.price_pence)) : null, p.due ? h('span', { class: 'when' }, 'Due ' + day(p.due)) : null))))))
      : empty('No projects yet', 'Projects appear when your assistant builds a preview for an interested lead, or when you add one.', h('a', { class: 'btn btn-gold', href: '#project/new' }, 'Add a project')));
}

async function showProject(id) {
  const { project: p, client, lead, invoices } = await api('admin/projects/' + id);
  const setStage = async st => { if (st !== p.stage && await act(() => api('admin/projects/' + id, { method: 'PATCH', body: { stage: st } }), 'Moved to ' + STAGE[st][0].toLowerCase())) route(); };
  const idx = STAGE_FLOW.indexOf(p.stage);
  const notes = h('textarea', { rows: 4, 'aria-label': 'Notes' }, p.notes);
  const del = confirmBox('Delete this project? Its invoices are kept.', 'Delete project', async () => { if (await act(() => api('admin/projects/' + id, { method: 'DELETE' }), 'Project deleted')) go('work'); });
  const open = u => safeHref(u) ? h('a', { class: 'btn btn-sm', href: safeHref(u), target: '_blank', rel: 'noopener noreferrer' }, 'Open') : null;
  const paid = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.total_pence, 0), owed = invoices.filter(i => i.status === 'sent').reduce((a, i) => a + i.total_pence, 0);
  render(
    pageHead(client ? client.business || client.name : lead ? 'Lead: ' + lead.name : 'Project', p.title, null, [tag(STAGE, p.stage), h('button', { class: 'btn btn-sm', onclick: () => editProject(p) }, 'Edit')], ['work', 'Projects']),
    card('Stage', [h('div', { class: 'steps', role: 'group', 'aria-label': 'Project stage' }, STAGE_FLOW.map((k, i) => h('button', { class: 'step' + (k === p.stage ? ' on' : i < idx ? ' done' : ''), 'aria-pressed': String(k === p.stage), onclick: () => setStage(k) }, STAGE[k][0]))),
      h('div', { class: 'actions' }, p.stage !== 'paused' ? h('button', { class: 'btn btn-sm', onclick: () => setStage('paused') }, 'Pause') : null, p.stage !== 'lost' ? h('button', { class: 'btn btn-sm', onclick: () => setStage('lost') }, 'Mark lost') : null)]),
    h('div', { class: 'grid side-r' },
      h('div', { class: 'grid' },
        card('Money', [h('div', { class: 'tiles' }, tile('Setup fee', money(p.price_pence)), tile('Monthly', money(p.monthly_pence)), tile('Paid', money(paid)), tile('Owed', money(owed))),
          invoices.length ? h('div', { class: 'list' }, invoices.map(invRow)) : null,
          client ? h('div', { class: 'actions' }, h('a', { class: 'btn btn-gold', href: '#invoice/new/' + id }, icon('plus'), 'Create invoice')) : h('p', { class: 'small muted' }, 'Link this project to a client (Edit) to invoice it.')]),
        p.brief ? card('Brief', h('details', {}, h('summary', {}, 'Research, client direction and open questions'), h('div', { class: 'prose small' }, p.brief))) : null,
        card('Notes', [notes, h('div', { class: 'actions' }, h('button', { class: 'btn btn-sm', onclick: () => act(() => api('admin/projects/' + id, { method: 'PATCH', body: { notes: notes.value } }), 'Notes saved') }, 'Save notes'))])),
      h('div', { class: 'grid' },
        card('Details', h('div', { class: 'kvs' },
          kv('Client', client ? h('a', { href: '#client/' + client.id }, client.business || client.name) : null),
          kv('Lead', lead ? h('a', { href: '#lead/' + lead.id }, lead.name) : null),
          kv('Package', p.package), kv('Due', longDay(p.due)), kv('Preview', p.preview_url ? 'Private preview' : null, open(p.preview_url)), kv('Live site', p.live_url ? p.live_url.replace(/^https?:\/\//, '').replace(/\/$/, '') : null, open(p.live_url)), kv('Started', day(p.created)))),
        card(null, [h('div', { class: 'actions' }, h('button', { class: 'btn btn-sm btn-danger', onclick: () => del.hidden = false }, icon('trash'), 'Delete project')), del]))));
}
async function editProject(p, clientId) {
  const { clients } = await api('admin/clients');
  const f = form([
    { k: 'title', label: 'Project name', full: true, placeholder: 'e.g. Long Rest website' },
    { k: 'client_id', label: 'Client', type: 'select', options: [['', 'No client yet']].concat(clients.map(c => [c.id, c.business ? `${c.business} (${c.name})` : c.name])) },
    { k: 'package', label: 'Package', type: 'select', options: [['', 'Not decided'], ['Starter', 'Starter'], ['Business', 'Business'], ['Premium', 'Premium'], ['Custom', 'Custom']] },
    { k: 'price_pence', label: 'Setup fee (£)', type: 'money' }, { k: 'monthly_pence', label: 'Monthly (£)', type: 'money' },
    { k: 'stage', label: 'Stage', type: 'select', options: Object.entries(STAGE).map(([k, v]) => [k, v[0]]), value: 'quoted' }, { k: 'due', label: 'Due date', type: 'date' },
    { k: 'preview_url', label: 'Preview link', type: 'url' }, { k: 'live_url', label: 'Live website', type: 'url' },
    { k: 'brief', label: 'Brief', type: 'textarea', rows: 6 }, { k: 'notes', label: 'Notes', type: 'textarea' }
  ], p || (clientId ? { client_id: clientId } : {}), { title: p ? 'Edit project' : 'New project', submit: p ? 'Save' : 'Create project', onCancel: () => p ? route() : history.back(),
    onSave: async v => { if (p) { await api('admin/projects/' + p.id, { method: 'PATCH', body: v }); toast('Saved'); route(); } else { const r = await api('admin/projects', { method: 'POST', body: v }); toast('Project created'); go('project/' + r.id); } } });
  f.els.package.addEventListener('change', () => { const pr = PRICES[f.els.package.value]; if (pr && !f.els.price_pence.value) { f.els.price_pence.value = pr[0] / 100; f.els.monthly_pence.value = pr[1] / 100; } });
  render(pageHead('Work', p ? p.title : 'New project', p ? null : 'Pick a package to fill in the standard prices.', null, p ? ['project/' + p.id, 'Back'] : ['work', 'Projects']), f.el);
}

async function showClient(id) {
  const { client: c, projects, invoices } = await api('admin/clients/' + id);
  const notes = h('textarea', { rows: 4, 'aria-label': 'Notes' }, c.notes);
  const del = confirmBox('Delete this client? Only possible if they have no sent or paid invoices.', 'Delete client', async () => { if (await act(() => api('admin/clients/' + id, { method: 'DELETE' }), 'Client deleted')) go('clients'); });
  const paid = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.total_pence, 0), owed = invoices.filter(i => i.status === 'sent').reduce((a, i) => a + i.total_pence, 0);
  render(
    pageHead('Client', c.business || c.name, c.business ? c.name : null, [h('button', { class: 'btn btn-sm', onclick: () => editClient(c) }, 'Edit')], ['clients', 'Clients']),
    h('div', { class: 'tiles' }, tile('Paid to date', money(paid), null, 'hero'), tile('Owed', money(owed)), tile('Monthly', money(projects.filter(p => ['live', 'care'].includes(p.stage)).reduce((a, p) => a + p.monthly_pence, 0))), tile('Client since', day(c.created))),
    h('div', { class: 'grid side-r' },
      h('div', { class: 'grid' },
        card('Projects', projects.length ? h('div', { class: 'list' }, projects.map(p => h('a', { class: 'row', href: '#project/' + p.id }, h('span', { class: 'body' }, h('span', { class: 't' }, p.title), h('span', { class: 's' }, [p.package, p.due ? 'due ' + day(p.due) : ''].filter(Boolean).join(' · '))), h('span', { class: 'end' }, tag(STAGE, p.stage))))) : h('p', { class: 'muted small' }, 'No projects yet.'), h('a', { href: '#project/new/' + id }, 'New project')),
        card('Invoices', invoices.length ? h('div', { class: 'list' }, invoices.map(invRow)) : h('p', { class: 'muted small' }, 'No invoices yet.'), h('a', { href: '#invoice/new/c:' + id }, 'New invoice')),
        card('Notes', [notes, h('div', { class: 'actions' }, h('button', { class: 'btn btn-sm', onclick: () => act(() => api('admin/clients/' + id, { method: 'PATCH', body: { notes: notes.value } }), 'Notes saved') }, 'Save notes'))])),
      h('div', { class: 'grid' },
        card('Contact', [h('div', { class: 'kvs' },
          kv('Email', c.email, c.email ? h('button', { class: 'btn btn-sm', onclick: () => copy(c.email, 'Email') }, 'Copy') : null),
          kv('Phone', c.phone, c.phone ? h('button', { class: 'btn btn-sm', onclick: () => copy(c.phone, 'Number') }, 'Copy') : null),
          kv('Website', c.website ? c.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '', safeHref(c.website) ? h('a', { class: 'btn btn-sm', href: safeHref(c.website), target: '_blank', rel: 'noopener noreferrer' }, 'Open') : null),
          kv('Address', c.address ? h('span', { class: 'prose' }, c.address) : '')),
          h('div', { class: 'actions' }, c.email ? h('a', { class: 'btn btn-gold', href: 'mailto:' + c.email }, icon('mail'), 'Email') : null, c.phone ? h('a', { class: 'btn', href: tel(c.phone) }, icon('phone'), 'Call') : null, c.lead_id ? h('a', { class: 'btn', href: '#lead/' + c.lead_id }, 'Outreach history') : null)]),
        card(null, [h('div', { class: 'actions' }, h('button', { class: 'btn btn-sm btn-danger', onclick: () => del.hidden = false }, icon('trash'), 'Delete client')), del]))));
}
async function editClient(c) {
  const f = form([
    { k: 'name', label: 'Contact name' }, { k: 'business', label: 'Business' },
    { k: 'email', label: 'Email', type: 'email' }, { k: 'phone', label: 'Phone', type: 'tel' },
    { k: 'website', label: 'Website', type: 'url' }, { k: 'address', label: 'Billing address', type: 'textarea', rows: 3, hint: 'Shown on invoices.' },
    { k: 'notes', label: 'Notes', type: 'textarea' }
  ], c || {}, { title: c ? 'Edit client' : 'New client', submit: c ? 'Save' : 'Add client', onCancel: () => c ? route() : go('clients'),
    onSave: async v => { if (c) { await api('admin/clients/' + c.id, { method: 'PATCH', body: v }); toast('Saved'); route(); } else { const r = await api('admin/clients', { method: 'POST', body: v }); toast('Client added'); go('client/' + r.id); } } });
  render(pageHead('Work', c ? c.business || c.name : 'New client', null, null, c ? ['client/' + c.id, 'Back'] : ['clients', 'Clients']), f.el);
}

/* ================= money ================= */
let invFilter = 'all';
const invRow = i => h('a', { class: 'row', href: '#invoice/' + i.id },
  h('span', { class: 'body' }, h('span', { class: 't' }, i.number, i.client_business || i.client_name ? h('span', { class: 'muted' }, '· ' + (i.client_business || i.client_name)) : null), h('span', { class: 's' }, i.status === 'paid' ? 'Paid ' + day(i.paid_on) : i.status === 'sent' ? (i.due < todayISO() ? 'Overdue since ' : 'Due ') + day(i.due) : 'Dated ' + day(i.issued))),
  h('span', { class: 'end' }, h('span', { class: 'amt' }, money(i.total_pence)), i.status === 'sent' && i.due < todayISO() ? pill('Overdue', 'bad') : tag(INV, i.status)));
async function showMoney() {
  const { invoices, today } = await api('admin/invoices');
  const ms = today.slice(0, 8) + '01', ys = today.slice(0, 4) + '-01-01';
  const sumP = l => l.reduce((a, i) => a + i.total_pence, 0);
  const overdue = invoices.filter(i => i.status === 'sent' && i.due < today);
  const groups = { all: () => true, unpaid: i => i.status === 'sent', overdue: i => i.status === 'sent' && i.due < today, paid: i => i.status === 'paid', draft: i => i.status === 'draft', void: i => i.status === 'void' };
  const list = invoices.filter(groups[invFilter] || groups.all);
  const months = []; for (let k = 5; k >= 0; k--) { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - k); months.push(d.toISOString().slice(0, 7)); }
  const byM = months.map(mo => invoices.filter(i => i.status === 'paid' && (i.paid_on || '').startsWith(mo)).reduce((a, i) => a + i.total_pence, 0));
  const mMax = Math.max(1, ...byM);
  const income = card('Income, last 6 months', h('div', { class: 'pipe' }, months.map((mo, i) => style(h('div', { class: 'pipe-row' }, h('span', {}, new Date(mo + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })), h('span', { class: 'pipe-bar' }, style(h('span'), 'transform', `scaleX(${byM[i] / mMax})`)), h('span', { class: 'n' }, money(byM[i]))), 'grid-template-columns', '64px minmax(0,1fr) 84px'))));
  render(
    pageHead('Money', 'Invoices', null, [h('a', { class: 'btn btn-gold', href: '#invoice/new' }, icon('plus'), 'New invoice')]),
    h('div', { class: 'tiles' },
      tile('Paid this month', money(sumP(invoices.filter(i => i.status === 'paid' && i.paid_on >= ms))), null, 'hero'),
      tile('Paid this year', money(sumP(invoices.filter(i => i.status === 'paid' && i.paid_on >= ys)))),
      tile('Owed to you', money(sumP(invoices.filter(i => i.status === 'sent'))), plural(invoices.filter(i => i.status === 'sent').length, 'invoice')),
      tile('Overdue', money(sumP(overdue)), overdue.length ? h('span', { class: 'delta down' }, plural(overdue.length, 'invoice')) : 'none')),
    invoices.some(i => i.status === 'paid') ? income : null,
    chipsRow([['all', 'All', invoices.length], ['unpaid', 'Awaiting payment', invoices.filter(groups.unpaid).length], ['overdue', 'Overdue', overdue.length], ['paid', 'Paid', invoices.filter(groups.paid).length], ['draft', 'Drafts', invoices.filter(groups.draft).length], ['void', 'Void', invoices.filter(groups.void).length]].filter(([k, , n]) => n || k === 'all' || k === invFilter), invFilter, k => { invFilter = k; showMoney(); }),
    list.length ? card(null, h('div', { class: 'list' }, list.map(invRow))) : empty(invoices.length ? 'Nothing here' : 'No invoices yet', invoices.length ? null : 'Add your business and bank details in Settings first, so they appear on your invoices.', invoices.length ? null : h('a', { class: 'btn btn-gold', href: '#invoice/new' }, 'New invoice')));
}

async function editInvoice(existing, arg) {
  const [{ clients }, { projects }, { business }, idx] = await Promise.all([api('admin/clients'), api('admin/projects'), api('admin/settings'), api('admin/invoices')]);
  if (!clients.length) { render(pageHead('Money', 'New invoice', null, null, ['money', 'Invoices']), empty('Add a client first', 'Invoices are made out to a client.', h('a', { class: 'btn btn-gold', href: '#client/new' }, 'Add a client'))); return; }
  const inv = existing || {};
  let pre = {};
  if (!existing && arg) { if (arg.startsWith('c:')) pre.client_id = arg.slice(2); else { const pr = projects.find(p => p.id === arg); if (pr) pre = { client_id: pr.client_id, project_id: pr.id }; } }
  const t = todayISO();
  const clientSel = h('select', { id: 'i-client' }, clients.map(c => h('option', { value: c.id, selected: c.id === (inv.client_id || pre.client_id) }, c.business ? `${c.business} (${c.name})` : c.name)));
  const projSel = h('select', { id: 'i-project' });
  const fillProjects = () => { const cid = clientSel.value; projSel.replaceChildren(h('option', { value: '' }, 'No project'), ...projects.filter(p => p.client_id === cid).map(p => h('option', { value: p.id, selected: p.id === (inv.project_id || pre.project_id) }, p.title))); };
  fillProjects();
  const issued = h('input', { id: 'i-issued', type: 'date', value: inv.issued || t });
  const due = h('input', { id: 'i-due', type: 'date', value: inv.due || addDays(t, Number(business.payment_days) || 14) });
  const notes = h('textarea', { id: 'i-notes', rows: 2, placeholder: 'Optional, e.g. "Thank you for your business."' }, inv.notes || '');
  const linesEl = h('div', { class: 'lines' }); const totalEl = h('strong', {}, '£0.00');
  const lines = (inv.items && inv.items.length ? inv.items : [{ desc: '', qty: 1, unit_pence: null }]).map(x => ({ desc: x.desc, qty: String(x.qty), price: x.unit_pence == null ? '' : (x.unit_pence / 100).toFixed(2) }));
  const recalc = () => { let tot = 0; for (const l of lines) { const p = toPence(l.price); tot += (Number(l.qty) || 0) * (isNaN(p) ? 0 : p); } totalEl.textContent = money(tot, true); };
  const drawLines = () => {
    linesEl.replaceChildren(...lines.map((l, i) => h('div', { class: 'line' },
      h('div', { class: 'field f-desc' }, h('label', { for: 'ld' + i }, 'Description'), h('input', { id: 'ld' + i, value: l.desc, oninput: e => { l.desc = e.target.value; } })),
      h('div', { class: 'field' }, h('label', { for: 'lq' + i }, 'Qty'), h('input', { id: 'lq' + i, inputmode: 'numeric', value: l.qty, oninput: e => { l.qty = e.target.value; recalc(); } })),
      h('div', { class: 'field' }, h('label', { for: 'lp' + i }, 'Price (£)'), h('input', { id: 'lp' + i, inputmode: 'decimal', value: l.price, placeholder: '0.00', oninput: e => { l.price = e.target.value; recalc(); } })),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove line', disabled: lines.length < 2, onclick: () => { lines.splice(i, 1); drawLines(); } }, icon('x')))));
    recalc();
  };
  drawLines();
  const quickWrap = h('div');
  const drawQuick = () => {
    const pr = projects.find(p => p.id === projSel.value);
    if (!pr || !(pr.price_pence || pr.monthly_pence)) { quickWrap.replaceChildren(); return; }
    const half = Math.round(pr.price_pence / 2);
    const set = (desc, p) => { lines.splice(0, lines.length, { desc, qty: '1', price: (p / 100).toFixed(2) }); drawLines(); };
    quickWrap.replaceChildren(h('div', { class: 'actions' }, h('span', { class: 'small muted' }, 'Fill in:'),
      pr.price_pence ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => set(`${pr.title}: 50% deposit${pr.package ? ' (' + pr.package + ' package)' : ''}`, half) }, 'Deposit 50%') : null,
      pr.price_pence ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => set(`${pr.title}: remaining 50% at launch`, pr.price_pence - half) }, 'Final 50%') : null,
      pr.monthly_pence ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => set(`${pr.title}: monthly plan, ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`, pr.monthly_pence) }, 'Monthly plan') : null));
  };
  drawQuick(); projSel.addEventListener('change', drawQuick); clientSel.addEventListener('change', () => { fillProjects(); drawQuick(); });
  const err = h('div', { class: 'msg err', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-gold', type: 'submit' }, existing ? 'Save draft' : 'Create invoice');
  const f = h('form', { class: 'card', novalidate: true, onsubmit: async e => {
    e.preventDefault(); err.hidden = true; save.disabled = true;
    try {
      const items = lines.map(l => { const p = toPence(l.price); if (isNaN(p)) throw new Error('Check the prices: use numbers like 397.50'); const q = Number(l.qty); if (!Number.isInteger(q) || q < 1) throw new Error('Quantities must be whole numbers, 1 or more.'); return { desc: l.desc, qty: q, unit_pence: p }; });
      const body = { client_id: clientSel.value, project_id: projSel.value, issued: issued.value, due: due.value, notes: notes.value, items };
      if (existing) { await api('admin/invoices/' + existing.id, { method: 'PATCH', body }); toast('Saved'); go('invoice/' + existing.id); }
      else { const r = await api('admin/invoices', { method: 'POST', body }); toast('Invoice ' + r.number + ' created'); go('invoice/' + r.id); }
    } catch (x) { if (x.message !== 'logged out') { err.textContent = x.message; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); } } finally { save.disabled = false; }
  } },
    err,
    h('div', { class: 'fields two' }, h('div', { class: 'field' }, h('label', { for: 'i-client' }, 'Client'), clientSel), h('div', { class: 'field' }, h('label', { for: 'i-project' }, 'Project'), projSel),
      h('div', { class: 'field' }, h('label', { for: 'i-issued' }, 'Invoice date'), issued), h('div', { class: 'field' }, h('label', { for: 'i-due' }, 'Due date'), due)),
    quickWrap, h('h2', {}, 'Lines'), linesEl,
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { lines.push({ desc: '', qty: '1', price: '' }); drawLines(); } }, icon('plus'), 'Add line')),
    h('div', { class: 'totals' }, h('span', { class: 'muted' }, 'Total'), totalEl),
    h('div', { class: 'field' }, h('label', { for: 'i-notes' }, 'Note on the invoice'), notes),
    h('div', { class: 'actions' }, save, h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => existing ? route() : history.back() }, 'Cancel')));
  render(pageHead('Money', existing ? 'Edit ' + existing.number : 'New invoice', existing ? null : 'It will be number ' + idx.next + ' and stays a draft until you mark it as sent.', null, existing ? ['invoice/' + existing.id, 'Back'] : ['money', 'Invoices']), f);
}

async function showInvoice(id) {
  const { invoice: i, client: c, project, business: b } = await api('admin/invoices/' + id);
  const setStatus = async (st, extra = {}) => { if (await act(() => api('admin/invoices/' + id, { method: 'PATCH', body: { status: st, ...extra } }), { paid: 'Marked as paid', sent: 'Marked as sent', void: 'Invoice voided' }[st])) route(); };
  const overdue = i.status === 'sent' && i.due < todayISO();
  const paidOn = h('input', { type: 'date', value: todayISO(), 'aria-label': 'Date paid' });
  const paidBox = style(style(h('div', { class: 'confirm', hidden: true }, 'When was it paid?', paidOn, h('div', { class: 'actions' }, h('button', { class: 'btn btn-gold', onclick: () => setStatus('paid', { paid_on: paidOn.value }) }, 'Mark as paid'), h('button', { class: 'btn', onclick: () => paidBox.hidden = true }, 'Cancel'))), 'background', 'var(--ok-bg)'), 'color', 'var(--ok)');
  const voidBox = confirmBox('Void this invoice? It stays in your records but no longer counts as owed.', 'Void invoice', () => setStatus('void'));
  const delBox = confirmBox('Delete this draft?', 'Delete draft', async () => { if (await act(() => api('admin/invoices/' + id, { method: 'DELETE' }), 'Draft deleted')) go('money'); });
  const missing = !b.trading_name || !(b.account_number || b.stripe_link);
  const payText = [b.bank_name && 'Bank: ' + b.bank_name, b.account_name && 'Account name: ' + b.account_name, b.sort_code && 'Sort code: ' + b.sort_code, b.account_number && 'Account number: ' + b.account_number, 'Reference: ' + i.number].filter(Boolean).join('\n');
  const from = [b.owners, b.address, b.email, b.phone, b.website && b.website.replace(/^https?:\/\//, '').replace(/\/$/, '')].filter(Boolean).join('\n');
  const to = [c && c.business ? c.name : '', c && c.address, c && c.email].filter(Boolean).join('\n');
  const stripe = safeHref(b.stripe_link);
  const sheet = h('article', { class: 'sheet', 'aria-label': 'Invoice ' + i.number },
    h('div', { class: 'top' }, h('div', { class: 'brand' }, (b.trading_name || 'NEMORA').toUpperCase(), h('span', {}, 'WEB DESIGN STUDIO')),
      h('div', {}, h('h2', {}, 'Invoice'), i.status !== 'sent' ? h('span', { class: 'stamp ' + i.status }, i.status.toUpperCase()) : null)),
    h('div', { class: 'parties' },
      h('div', {}, h('div', { class: 'lbl' }, 'Billed to'), h('div', { class: 'addr' }, h('strong', {}, c ? c.business || c.name : 'Unknown client'), to ? '\n' + to : '')),
      h('div', {}, h('div', { class: 'lbl' }, 'From'), h('div', { class: 'addr' }, h('strong', {}, b.trading_name || 'NEMORA'), from ? '\n' + from : '')),
      h('div', { class: 'meta' }, h('span', {}, 'Invoice no.'), h('span', {}, i.number), h('span', {}, 'Date'), h('span', {}, longDay(i.issued)), h('span', {}, 'Due'), h('span', {}, longDay(i.due)), i.status === 'paid' ? [h('span', {}, 'Paid'), h('span', {}, longDay(i.paid_on))] : null)),
    h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Description'), h('th', { class: 'r' }, 'Qty'), h('th', { class: 'r' }, 'Price'), h('th', { class: 'r' }, 'Amount'))),
      h('tbody', {}, i.items.map(it => h('tr', {}, h('td', {}, it.desc), h('td', { class: 'r' }, num(it.qty)), h('td', { class: 'r' }, money(it.unit_pence, true)), h('td', { class: 'r' }, money(it.qty * it.unit_pence, true))))))),
    h('div', { class: 'sum' }, h('div', { class: 'grand' }, h('span', {}, i.status === 'paid' ? 'Total paid' : 'Total due'), h('span', {}, money(i.total_pence, true)))),
    i.status === 'sent' || i.status === 'draft' ? h('div', { class: 'pay' }, h('div', { class: 'lbl' }, 'How to pay'), b.account_number ? h('div', { class: 'addr' }, payText) : null, stripe ? h('div', {}, 'Pay by card: ', h('a', { href: stripe, target: '_blank', rel: 'noopener noreferrer' }, stripe.replace(/^https?:\/\//, ''))) : null, !b.account_number && !stripe ? h('div', {}, 'Add your bank details in Settings.') : null) : null,
    i.notes || b.invoice_note ? h('div', { class: 'foot' }, [i.notes, b.invoice_note].filter(Boolean).join('\n\n')) : null);
  const greet = (c && c.name || '').split(' ')[0];
  const mailBody = `Hi ${greet},\n\nPlease find attached invoice ${i.number} for ${money(i.total_pence, true)}, due by ${longDay(i.due)}.\n\n${payText}\n\nThank you,\nThe NEMORA team`;
  render(
    h('div', { class: 'no-print' }, pageHead(c ? c.business || c.name : 'Invoice', i.number, project ? 'For ' + project.title : null, [overdue ? pill('Overdue', 'bad') : tag(INV, i.status)], ['money', 'Invoices'])),
    missing ? h('div', { class: 'msg err no-print' }, 'Your business name or payment details are missing from this invoice. ', h('a', { href: '#settings' }, 'Add them in Settings')) : null,
    h('div', { class: 'card no-print' }, h('div', { class: 'actions' },
      i.status === 'draft' ? h('button', { class: 'btn btn-gold', onclick: () => setStatus('sent') }, icon('check'), 'Mark as sent') : null,
      i.status === 'sent' ? h('button', { class: 'btn btn-gold', onclick: () => { paidBox.hidden = false; } }, icon('check'), 'Mark as paid') : null,
      h('button', { class: 'btn', onclick: () => window.print() }, icon('print'), 'Print or save PDF'),
      c && c.email && ['draft', 'sent'].includes(i.status) ? h('a', { class: 'btn', href: `mailto:${c.email}?subject=${encodeURIComponent('Invoice ' + i.number + ' from ' + (b.trading_name || 'NEMORA'))}&body=${encodeURIComponent(mailBody)}` }, icon('mail'), 'Email client') : null,
      b.account_number && i.status !== 'paid' ? h('button', { class: 'btn', onclick: () => copy(payText, 'Payment details') }, icon('copy'), 'Copy bank details') : null,
      i.status === 'draft' ? h('button', { class: 'btn', onclick: () => editInvoice(i) }, 'Edit') : null,
      i.status === 'draft' ? h('button', { class: 'btn btn-danger', onclick: () => delBox.hidden = false }, 'Delete') : null,
      ['sent', 'paid'].includes(i.status) ? h('button', { class: 'btn btn-ghost', onclick: () => voidBox.hidden = false }, 'Void') : null,
      i.status === 'paid' ? h('button', { class: 'btn btn-ghost', onclick: () => setStatus('sent') }, 'Mark as unpaid') : null),
      paidBox, voidBox, delBox,
      ['draft', 'sent'].includes(i.status) ? h('p', { class: 'small muted' }, 'To send it: Print or save PDF, choose "Save as PDF", then attach it to the email.') : null),
    sheet);
}

/* ================= visitors ================= */
let range = 30;
let regionNames; try { regionNames = new Intl.DisplayNames(['en-GB'], { type: 'region' }); } catch (e) {}
const countryName = c => { try { return (regionNames && regionNames.of(c)) || c; } catch (e) { return c; } };
const PAGE_NAMES = { '/': 'Home', '/services.html': 'Services & prices', '/contact.html': 'Contact', '/work.html': 'Our work', '/about.html': 'About', '/privacy.html': 'Privacy', '/guides/': 'Guides', '/404.html': 'Page not found' };
const pageName = p => PAGE_NAMES[p] || p.replace(/^\//, '').replace(/\.html$/, '').replace(/[-_/]+/g, ' ').replace(/^./, c => c.toUpperCase()) || 'Home';
function chart(series, days, from, compact) {
  const map = Object.fromEntries((series || []).map(r => [r.day, r]));
  const pts = []; const start = new Date(from + 'T00:00:00Z');
  for (let i = 0; i < days; i++) { const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10); pts.push({ day: d, v: Number((map[d] || {}).visitors || 0) }); }
  const narrow = view.clientWidth < 560 || compact;
  const W = narrow ? 340 : 600, H = compact ? 130 : narrow ? 170 : 190, pad = { l: 28, r: 8, t: 10, b: 22 };
  const top = Math.ceil(Math.max(4, ...pts.map(p => p.v)) / 4) * 4;
  const x = i => pad.l + (pts.length < 2 ? 0 : i * (W - pad.l - pad.r) / (pts.length - 1));
  const y = v => H - pad.b - v / top * (H - pad.t - pad.b);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `Visitors per day over the last ${days} days` });
  for (let g = 0; g <= 4; g += compact ? 2 : 1) { const v = top * g / 4; svg.append(s('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'grid' }), s('text', { x: pad.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' }, num(v))); }
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  svg.append(s('path', { d: `${line}L${x(pts.length - 1)},${y(0)}L${x(0)},${y(0)}Z`, class: 'area' }), s('path', { d: line, class: 'line' }));
  const fmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', days <= 7 ? { weekday: 'short', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const ticks = days <= 7 ? pts.map((_, i) => i) : [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  for (const i of ticks) svg.append(s('text', { x: x(i), y: H - 5, 'text-anchor': i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle', class: 'axis' }, fmt(pts[i].day)));
  pts.forEach((p, i) => { const c = s('circle', { cx: x(i), cy: y(p.v), r: days <= 30 ? 3 : 0, class: 'dot' }); c.append(s('title', {}, `${fmt(p.day)}: ${plural(p.v, 'visitor')}`)); svg.append(c); });
  return svg;
}
function bars(title, rows, label, key = 'visitors', none = 'Nothing yet.') {
  const total = rows.reduce((a, r) => a + Number(r[key] || 0), 0), max = Math.max(1, ...rows.map(r => Number(r[key] || 0)));
  return card(title, rows.length ? h('ul', { class: 'bars' }, rows.map(r => h('li', {},
    style(h('span', { class: 'bar' }), '--w', (Number(r[key]) / max * 100).toFixed(1) + '%'),
    h('span', { class: 'bar-l' }, label(r.label)), h('span', { class: 'bar-v' }, num(r[key]), total ? h('span', { class: 'muted' }, ' · ' + Math.round(Number(r[key]) / total * 100) + '%') : null)))) : h('p', { class: 'muted small' }, none));
}
async function showTraffic() {
  const t = await api('admin/traffic?days=' + range);
  const head = pageHead('Website', 'Visitors', 'Who is looking at nemora.uk. No cookies and no personal data: each visitor is counted with a code that changes every day.');
  if (!t.enabled) { render(head, empty('Visitor stats are off', 'The database link is missing from the server settings.')); return; }
  const T = t.totals, P = t.previous;
  const delta = (a, b) => { a = Number(a || 0); b = Number(b || 0); if (!b) return a ? h('span', { class: 'delta up' }, 'New') : null; const p = Math.round((a - b) / b * 100); return h('span', { class: 'delta ' + (p > 0 ? 'up' : p < 0 ? 'down' : '') }, (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + Math.abs(p) + '%'); };
  const conv = T.visitors ? Number(T.enquiries || 0) / Number(T.visitors) * 100 : 0;
  render(head,
    chipsRow([[7, '7 days'], [30, '30 days'], [90, '90 days']], range, d => { range = d; showTraffic(); }),
    h('div', { class: 'card' }, h('div', { class: 'live' }, h('span', { class: 'pulse', 'aria-hidden': 'true' }), h('span', {}, h('strong', {}, num(t.live)), ' on the site in the last 30 minutes'))),
    h('div', { class: 'tiles' },
      tile('Visitors', num(T.visitors), [delta(T.visitors, P.visitors), ` vs previous ${t.days} days`], 'hero'),
      tile('Page views', num(T.views), delta(T.views, P.views)),
      tile('Enquiries', num(T.enquiries), delta(T.enquiries, P.enquiries)),
      tile('Enquiry rate', (conv ? conv.toFixed(1) : '0') + '%', 'of visitors sent a message')),
    Number(T.views) ? card('Visitors per day', chart(t.series, t.days, t.from)) : empty('No visits yet in this period', 'Counting started when the counter went live.'),
    h('div', { class: 'grid g2' }, bars('Top pages', t.pages, pageName, 'views'), bars('Where they came from', t.referrers, l => l, 'visitors', 'Everyone came direct or from a link without a source (WhatsApp, email, typed in).'), bars('Devices', t.devices, l => l), bars('Countries', t.countries, countryName)));
}

/* ================= settings ================= */
async function showSettings() {
  const [{ business: b }, rb] = await Promise.all([api('admin/settings'), api('admin/rulebook').catch(() => ({}))]);
  const biz = form([
    { k: 'first_name', label: 'Your first name', hint: 'Used to greet you on the home page.' },     { k: 'trading_name', label: 'Trading name', placeholder: 'NEMORA' }, { k: 'owners', label: 'Owners', hint: 'Shown under "From" on invoices.' },
    { k: 'email', label: 'Email', type: 'email' }, { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'website', label: 'Website', type: 'url' },
    { k: 'address', label: 'Business address', type: 'textarea', rows: 3 },
    { k: 'bank_name', label: 'Bank' }, { k: 'account_name', label: 'Account name' }, { k: 'sort_code', label: 'Sort code', inputmode: 'numeric', placeholder: '12-34-56' }, { k: 'account_number', label: 'Account number', inputmode: 'numeric' },
    { k: 'stripe_link', label: 'Card payment link', type: 'url', hint: 'Optional Stripe payment link shown on invoices.' },
    { k: 'payment_days', label: 'Payment terms (days)', type: 'number', value: 14 }, { k: 'invoice_prefix', label: 'Invoice number prefix', placeholder: 'NEM' },
    { k: 'invoice_note', label: 'Invoice footer', type: 'textarea', rows: 2, hint: 'For example "Not VAT registered." Only add what is true for your business.' }
  ], b, { title: 'Business details', submit: 'Save details', after: h('p', { class: 'small muted' }, 'These appear on your invoices. They are kept privately in your Cloudflare account and only shown after you log in.'),
    onSave: async v => { await api('admin/settings', { method: 'PUT', body: v }); toast('Details saved'); } });
  const f = (id, label, type, ac, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), hint ? h('span', { class: 'hint' }, hint) : null, h('input', { id, type, autocomplete: ac, autocapitalize: 'none', spellcheck: 'false' }));
  const msg = h('div', { class: 'msg', role: 'status', hidden: true });
  const acc = h('form', { class: 'card', novalidate: true, onsubmit: async e => {
    e.preventDefault(); msg.hidden = true;
    try { await api('admin/account', { method: 'POST', body: { current: $('#a-cur').value, username: $('#a-user').value.trim(), password: $('#a-pass').value } }); acc.reset(); msg.className = 'msg ok'; msg.textContent = 'Saved. Any other devices have been logged out.'; msg.hidden = false; }
    catch (x) { if (x.message !== 'logged out') { msg.className = 'msg err'; msg.textContent = x.message; msg.hidden = false; } }
  } }, h('h2', {}, 'Login'), msg, h('div', { class: 'fields two' },
    f('a-user', 'New username', 'text', 'username', 'Leave blank to keep it.'), f('a-pass', 'New password', 'password', 'new-password', 'At least 12 characters. Blank keeps it.')),
    f('a-cur', 'Current password', 'password', 'current-password', 'Needed to confirm it\'s you.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn btn-gold', type: 'submit' }, 'Save login'),
      h('button', { class: 'btn', type: 'button', onclick: () => act(() => api('admin/logout-others', { method: 'POST' }), 'Other devices logged out') }, 'Log out other devices'),
      h('a', { class: 'btn btn-ghost', href: '#activity' }, icon('shield'), 'Login activity')));
  const rules = rb.rulebook;
  render(
    pageHead('Settings', 'Settings'),
    biz.el, acc,
    card('Outreach rulebook', rules ? [h('p', { class: 'small muted' }, `Version ${rules.version}, updated ${day(rules.updated)}. Your outreach assistant reads this before every run and never changes it itself. Ask Claude to change a rule.`),
      ...(rules.sections || []).map(sec => h('details', {}, h('summary', {}, sec.title), h('ul', { class: 'small' }, (sec.rules || []).map(r => h('li', {}, r)))))] : h('p', { class: 'muted small' }, 'Not loaded yet.')),
    card('Privacy and security', h('ul', { class: 'small' },
      h('li', {}, 'Your password is stored only as a one-way hash. There are no passwords, keys or tokens in this page.'),
      h('li', {}, 'You stay logged in for 8 hours. Five wrong passwords lock logins for 15 minutes.'),
      h('li', {}, 'Website messages delete themselves after 2 years, and visitor stats after 13 months.'),
      h('li', {}, 'Invoices marked as sent or paid can\'t be deleted, because HMRC expects you to keep records for 6 years.'))));
}
async function showActivity() {
  const { log } = await api('admin/activity');
  render(pageHead('Settings', 'Login activity', 'Logins and changes. If you see something you don\'t recognise, change your password and log out other devices.', null, ['settings', 'Settings']),
    log.length ? card(null, h('div', { class: 'list' }, log.map(l => h('div', { class: 'row' }, h('span', { class: 'body' }, h('span', { class: 't' }, l.action), h('span', { class: 's' }, [l.user, l.where].filter(Boolean).join(' · '))), h('span', { class: 'end' }, h('span', { class: 'when' }, full(l.at))))))) : empty('No activity yet'));
}

/* ================= start ================= */
window.addEventListener('hashchange', route);
(async () => { if (await refreshMe()) { shell(); route(); } })();
