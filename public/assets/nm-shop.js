/* NEMORA shop: the basket and checkout for builds with product cards.
   Reads everything from the page itself (product cards, delivery charges), so whatever is edited in the
   builder is what the shop sells. The basket is kept in this browser only (localStorage, no cookies). */
(function () {
  'use strict';
  var token = document.body.getAttribute('data-nm-shop'); if (!token) return;
  var KEY = 'nm-basket:' + token;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var txt = function (el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  var keyOf = function (s) { return String(s).replace(/\s+/g, ' ').trim().toLowerCase(); };
  function pence(s) { var m = String(s || '').replace(/,/g, '').match(/(\d+)(?:\.(\d{1,2}))?/); if (!m) return null; return Number(m[1]) * 100 + (m[2] ? Number((m[2] + '0').slice(0, 2)) : 0); }
  function money(p) { var whole = p % 100 === 0; return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(p / 100); }
  function el(tag, attrs) {
    var e = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    for (var k in attrs || {}) { var v = attrs[k]; if (v == null || v === false) continue; if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v); }
    kids.forEach(function (c) { if (c == null) return; e.append(c.nodeType ? c : String(c)); }); return e;
  }

  /* ---------- what's for sale ---------- */
  var products = {};
  $$('[data-nm-product]').forEach(function (card) {
    var name = txt(card.querySelector('.nm-p-name')), price = pence(txt(card.querySelector('.nm-p-price')));
    if (!name || price == null) return;
    var so = card.getAttribute('data-nm-soldout'), img = card.querySelector('img');
    var p = { name: name, price: price, card: card, soldOut: so != null && so !== 'false', cat: txt(card.querySelector('.nm-p-cat')), desc: txt(card.querySelector('.nm-p-desc')), img: img ? img.currentSrc || img.src : '', alt: img ? img.alt : '' };
    if (!products[keyOf(name)]) products[keyOf(name)] = p;
    card.__nm = p;
  });
  var delivery = pence(txt(document.querySelector('[data-nm-delivery]'))) || 0;
  var freeEl = document.querySelector('[data-nm-free-over]'), freeOver = freeEl ? pence(txt(freeEl)) : null;

  /* ---------- the basket (this browser only) ---------- */
  var basket = [];
  try { basket = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { basket = []; }
  basket = (Array.isArray(basket) ? basket : []).filter(function (l) { var p = l && products[keyOf(l.name)]; return p && !p.soldOut && l.qty > 0; }).map(function (l) { return { name: products[keyOf(l.name)].name, qty: Math.min(20, Math.floor(l.qty)) }; });
  function store() { try { localStorage.setItem(KEY, JSON.stringify(basket)); } catch (e) {} }
  function count() { return basket.reduce(function (s, l) { return s + l.qty; }, 0); }
  function subtotal() { return basket.reduce(function (s, l) { return s + products[keyOf(l.name)].price * l.qty; }, 0); }
  function deliveryFor(sub) { return freeOver != null && sub >= freeOver ? 0 : delivery; }
  function add(name, qty) {
    var l = basket.filter(function (x) { return x.name === name; })[0];
    if (l) l.qty = Math.min(20, l.qty + qty); else basket.push({ name: name, qty: Math.min(20, qty) });
    store(); paint();
  }
  function setQty(name, qty) { basket = basket.map(function (l) { return l.name === name ? { name: name, qty: Math.max(0, Math.min(20, qty)) } : l; }).filter(function (l) { return l.qty > 0; }); store(); paint(); }

  /* ---------- the drawer ---------- */
  var lastFocus = null, view = 'basket', placed = null;
  var panel = el('div', { class: 'nmb-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'nmb-title', tabindex: '-1' });
  var shade = el('div', { class: 'nmb-shade', onclick: close });
  var root = el('div', { class: 'nmb', hidden: true }, shade, panel);
  document.body.append(root);
  var live = el('div', { class: 'nmb-sr', 'aria-live': 'polite' }); document.body.append(live);

  // the drawer takes its accent from the shop's own buttons, so it matches whatever the builder set
  var sample = document.querySelector('.nm-add, .nm-btn');
  if (sample) { var cs = getComputedStyle(sample); if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') { document.documentElement.style.setProperty('--nmb-accent', cs.backgroundColor); document.documentElement.style.setProperty('--nmb-on-accent', cs.color); } document.documentElement.style.setProperty('--nmb-radius', cs.borderRadius || '10px'); }

  function open(v) {
    if (root.hidden) lastFocus = document.activeElement;
    view = v || 'basket'; root.hidden = false; document.documentElement.classList.add('nmb-lock');
    requestAnimationFrame(function () { root.classList.add('is-open'); });
    paint(); panel.focus();
  }
  function close() {
    root.classList.remove('is-open'); document.documentElement.classList.remove('nmb-lock');
    setTimeout(function () { if (!root.classList.contains('is-open')) root.hidden = true; }, 260);
    if (view === 'done') { view = 'basket'; placed = null; }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !root.hidden) close();
    if (e.key === 'Tab' && !root.hidden) { var f = $$('button, a[href], input, textarea, select', panel).filter(function (x) { return !x.disabled; }); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  });

  function head(title, back) {
    return el('div', { class: 'nmb-head' },
      back ? el('button', { type: 'button', class: 'nmb-icon', 'aria-label': 'Back', onclick: back }, svg('M15 18l-6-6 6-6')) : null,
      el('h2', { id: 'nmb-title', text: title }),
      el('button', { type: 'button', class: 'nmb-icon', 'aria-label': 'Close', onclick: close }, svg('M6 6l12 12M18 6L6 18')));
  }
  function svg(d) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; }
  function sums(sub) {
    var del = deliveryFor(sub), rows = el('dl', { class: 'nmb-sums' },
      el('div', {}, el('dt', { text: 'Items' }), el('dd', { text: money(sub) })),
      el('div', {}, el('dt', { text: 'Delivery' }), el('dd', { text: del ? money(del) : 'Free' })),
      el('div', { class: 'nmb-total' }, el('dt', { text: 'Total' }), el('dd', { text: money(sub + del) })));
    var hint = freeOver != null && del > 0 && sub < freeOver ? el('p', { class: 'nmb-hint', text: 'Spend ' + money(freeOver - sub) + ' more for free delivery' }) : null;
    return [hint, rows];
  }

  function paint() {
    $$('[data-nm-count]').forEach(function (c) { c.textContent = String(count()); });
    $$('[data-nm-basket]').forEach(function (b) { b.setAttribute('aria-label', 'Basket, ' + count() + (count() === 1 ? ' item' : ' items')); });
    if (root.hidden) return;
    panel.replaceChildren();
    if (view === 'done' && placed) return paintDone();
    if (!basket.length) { view = 'basket'; panel.append(head('Your basket'), el('div', { class: 'nmb-empty' }, el('p', { text: 'Your basket is empty.' }), el('button', { type: 'button', class: 'nmb-btn nmb-ghost', onclick: close, text: 'Keep shopping' }))); return; }
    if (view === 'details') return paintDetails();
    var list = el('ul', { class: 'nmb-lines' });
    basket.forEach(function (l) {
      var p = products[keyOf(l.name)];
      list.append(el('li', { class: 'nmb-line' },
        p.img ? el('img', { src: p.img, alt: '', width: '64', height: '64' }) : el('span', { class: 'nmb-noimg' }),
        el('div', { class: 'nmb-line-main' }, el('p', { class: 'nmb-line-name', text: p.name }), el('p', { class: 'nmb-line-price', text: money(p.price) }),
          el('div', { class: 'nmb-qty' },
            el('button', { type: 'button', 'aria-label': 'One fewer ' + p.name, onclick: function () { setQty(l.name, l.qty - 1); live.textContent = l.qty > 1 ? p.name + ', ' + (l.qty - 1) + ' in basket' : p.name + ' removed'; }, text: '−' }),
            el('span', { 'aria-label': 'Quantity', text: String(l.qty) }),
            el('button', { type: 'button', 'aria-label': 'One more ' + p.name, disabled: l.qty >= 20, onclick: function () { setQty(l.name, l.qty + 1); live.textContent = p.name + ', ' + (l.qty + 1) + ' in basket'; }, text: '+' }))),
        el('div', { class: 'nmb-line-end' }, el('p', { class: 'nmb-line-total', text: money(p.price * l.qty) }),
          el('button', { type: 'button', class: 'nmb-remove', onclick: function () { setQty(l.name, 0); live.textContent = p.name + ' removed'; }, text: 'Remove' }))));
    });
    var sub = subtotal();
    panel.append(head('Your basket'), el('div', { class: 'nmb-body' }, list),
      el('div', { class: 'nmb-foot' }, sums(sub)[0], sums(sub)[1], el('button', { type: 'button', class: 'nmb-btn', onclick: function () { view = 'details'; paint(); var f = panel.querySelector('input'); if (f) f.focus(); }, text: 'Checkout' })));
  }

  var draft = {};
  function paintDetails() {
    var err = el('p', { class: 'nmb-err', role: 'alert' });
    function field(name, label, type, opts) {
      opts = opts || {};
      var id = 'nmb-' + name, input = type === 'textarea' ? el('textarea', { id: id, name: name, rows: opts.rows || '3', autocomplete: opts.ac || null, required: opts.req || null }) : el('input', { id: id, name: name, type: type, autocomplete: opts.ac || null, required: opts.req || null, inputmode: opts.im || null });
      input.value = draft[name] || ''; input.addEventListener('input', function () { draft[name] = input.value; input.removeAttribute('aria-invalid'); });
      return el('div', { class: 'nmb-field' }, el('label', { for: id, text: label + (opts.req ? '' : ' (optional)') }), input);
    }
    var sub = subtotal(), btn = el('button', { type: 'submit', class: 'nmb-btn', text: 'Place order, ' + money(sub + deliveryFor(sub)) });
    var form = el('form', { class: 'nmb-form', novalidate: true },
      field('name', 'Full name', 'text', { req: true, ac: 'name' }),
      field('email', 'Email', 'email', { req: true, ac: 'email', im: 'email' }),
      field('phone', 'Phone', 'tel', { ac: 'tel', im: 'tel' }),
      field('address', 'Delivery address and postcode', 'textarea', { req: true, ac: 'street-address', rows: '4' }),
      field('note', 'Note for the shop', 'textarea', { rows: '2' }));
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.textContent = '';
      btn.disabled = true; btn.textContent = 'Placing your order…';
      fetch('/s/' + token + '/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ items: basket, customer: draft }) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) { err.textContent = res.d.error || 'That did not go through. Please try again.'; if (res.d.field) { var f = form.querySelector('[name="' + res.d.field + '"]'); if (f) { f.setAttribute('aria-invalid', 'true'); f.focus(); } } btn.disabled = false; btn.textContent = 'Place order, ' + money(sub + deliveryFor(sub)); return; }
          placed = { order: res.d.order, name: draft.name, email: draft.email }; basket = []; store(); draft = {}; view = 'done'; paint();
        })
        .catch(function () { err.textContent = 'No connection. Check your internet and try again.'; btn.disabled = false; btn.textContent = 'Place order, ' + money(sub + deliveryFor(sub)); });
    });
    var summary = el('div', { class: 'nmb-mini' }, el('p', { text: count() + (count() === 1 ? ' item' : ' items') }), sums(sub)[1]);
    panel.append(head('Your details', function () { view = 'basket'; paint(); }), el('div', { class: 'nmb-body' }, summary, form, err),
      el('div', { class: 'nmb-foot' }, el('p', { class: 'nmb-preview', text: 'This shop is a preview, so no card is taken. On the live site, card payment happens at this step.' }), btn));
    btn.setAttribute('form', 'nmb-form'); form.id = 'nmb-form';
  }

  function paintDone() {
    var o = placed.order, first = String(placed.name || '').split(' ')[0];
    var list = el('ul', { class: 'nmb-done-lines' });
    o.lines.forEach(function (l) { list.append(el('li', {}, el('span', { text: l.qty + ' × ' + l.name }), el('span', { text: money(l.price * l.qty) }))); });
    panel.append(head('Order received'), el('div', { class: 'nmb-body nmb-done' },
      el('p', { class: 'nmb-done-big', text: 'Thank you' + (first ? ', ' + first : '') }),
      el('p', { text: 'Your order reference is ' }, el('strong', { text: o.ref })),
      list,
      el('dl', { class: 'nmb-sums' },
        el('div', {}, el('dt', { text: 'Delivery' }), el('dd', { text: o.delivery ? money(o.delivery) : 'Free' })),
        el('div', { class: 'nmb-total' }, el('dt', { text: 'Total' }), el('dd', { text: money(o.total) }))),
      el('p', { class: 'nmb-preview', text: 'The shop can see this order now. On the live site a receipt is emailed to ' + (placed.email || 'you') + '.' })),
      el('div', { class: 'nmb-foot' }, el('button', { type: 'button', class: 'nmb-btn', onclick: close, text: 'Back to the shop' })));
  }

  /* ---------- quick look at a product ---------- */
  var quick = el('dialog', { class: 'nmq', 'aria-labelledby': 'nmq-title' }); document.body.append(quick);
  quick.addEventListener('click', function (e) { if (e.target === quick) quick.close(); });
  function look(p) {
    var qty = 1, n = el('span', { text: '1' });
    var addBtn = el('button', { type: 'button', class: 'nmb-btn', disabled: p.soldOut, text: p.soldOut ? 'Sold out' : 'Add to basket' });
    addBtn.addEventListener('click', function () { add(p.name, qty); quick.close(); open(); });
    quick.replaceChildren(el('div', { class: 'nmq-in' },
      p.img ? el('img', { src: p.img, alt: p.alt || '' }) : null,
      el('div', { class: 'nmq-text' },
        el('button', { type: 'button', class: 'nmb-icon nmq-x', 'aria-label': 'Close', onclick: function () { quick.close(); } }, svg('M6 6l12 12M18 6L6 18')),
        p.cat ? el('p', { class: 'nmq-cat', text: p.cat }) : null,
        el('h2', { id: 'nmq-title', text: p.name }), el('p', { class: 'nmq-price', text: money(p.price) }),
        p.desc ? el('p', { class: 'nmq-desc', text: p.desc }) : null,
        p.soldOut ? null : el('div', { class: 'nmb-qty nmq-qty' },
          el('button', { type: 'button', 'aria-label': 'One fewer', onclick: function () { qty = Math.max(1, qty - 1); n.textContent = qty; }, text: '−' }), n,
          el('button', { type: 'button', 'aria-label': 'One more', onclick: function () { qty = Math.min(20, qty + 1); n.textContent = qty; }, text: '+' })),
        addBtn)));
    quick.showModal();
  }

  /* ---------- wire up the page ---------- */
  $$('[data-nm-product]').forEach(function (card) {
    var p = card.__nm; if (!p) return;
    var btn = card.querySelector('[data-nm-add]');
    if (btn) {
      if (p.soldOut) { btn.textContent = 'Sold out'; btn.setAttribute('aria-disabled', 'true'); btn.classList.add('is-soldout'); }
      btn.setAttribute('role', 'button');
      btn.addEventListener('click', function (e) { e.preventDefault(); if (p.soldOut) return; add(p.name, 1); live.textContent = p.name + ' added to your basket'; open(); });
    }
    var img = card.querySelector('img');
    if (img) { img.classList.add('nm-lookable'); img.setAttribute('tabindex', '0'); img.setAttribute('role', 'button'); img.setAttribute('aria-label', 'Look closer at ' + p.name);
      img.addEventListener('click', function () { look(p); }); img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); look(p); } }); }
  });
  $$('[data-nm-basket], a[href="#basket"]').forEach(function (a) { if (a.closest('[data-nm-product]')) return; a.addEventListener('click', function (e) { e.preventDefault(); open(); }); });

  // category buttons: a filter's own text is the category it shows ("All" shows everything)
  var filters = $$('[data-nm-filter]');
  function filter(f) {
    var want = keyOf(txt(f)), all = want === 'all' || want === 'everything';
    filters.forEach(function (x) { x.setAttribute('aria-pressed', String(x === f)); });
    Object.keys(products).forEach(function (k) { var p = products[k]; p.card.hidden = !(all || keyOf(p.cat) === want); });
    $$('[data-nm-product]').forEach(function (c) { if (!c.__nm) c.hidden = !all; });
  }
  filters.forEach(function (f, i) { f.setAttribute('role', 'button'); f.setAttribute('aria-pressed', String(i === 0)); f.addEventListener('click', function (e) { e.preventDefault(); filter(f); }); });

  paint();
})();
