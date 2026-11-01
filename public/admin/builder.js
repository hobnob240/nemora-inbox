// NEMORA site builder: GrapesJS (BSD-3, vendored) with NEMORA's sections, autosave and a live client link.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const id = (location.hash.slice(1) || '').replace(/[^a-z0-9_]/gi, '');
  const statusEl = $('#b-status'), banner = $('#b-banner');
  const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:wght@400;600;700&family=Playfair+Display:wght@500;700&family=Poppins:wght@400;600;700&family=Montserrat:wght@400;600;700&family=DM+Sans:wght@400;600;700&family=Merriweather:wght@400;700&family=Oswald:wght@500;700&display=swap';
  const FONT_IMPORT = '@import url("' + FONTS + '");';
  let build = null, editor = null, saving = false, queued = false, timer = null, approved = false;

  if (window.innerWidth < 900) { $('#b-small').hidden = false; }
  if (!id) { location.href = '/admin/app#builds'; return; }

  async function api(path, opts = {}) {
    const r = await fetch('/api/admin/' + path, { method: opts.method || 'GET', credentials: 'same-origin', headers: opts.raw ? { 'Content-Type': opts.type } : opts.body ? { 'Content-Type': 'application/json' } : {}, body: opts.raw || (opts.body ? JSON.stringify(opts.body) : undefined) });
    if (r.status === 401) { location.href = '/admin/'; throw new Error('logged out'); }
    let d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error(d.error || 'Something went wrong. Please try again.'); e.status = r.status; throw e; }
    return d;
  }
  const say = (t, bad) => { statusEl.textContent = t; statusEl.className = 'b-status' + (bad ? ' bad' : ''); };
  const show = (html, tone) => { banner.hidden = !html; banner.className = 'b-banner ' + (tone || ''); banner.replaceChildren(); if (html) html.forEach(n => banner.append(n)); };
  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); } kids.flat().forEach(k => k != null && e.append(k)); return e; };

  /* ---------- NEMORA sections ---------- */
  const PH = (w, h) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#e9e4d8"/><text x="50%" y="50%" fill="#6d6a62" font-family="Arial, sans-serif" font-size="${Math.round(w / 22)}" text-anchor="middle" dominant-baseline="middle">Double-click to add a photo</text></svg>`);
  const blocks = [
    ['nav', 'Top bar', 'Sections', `<header class="nm-nav"><div class="nm-wrap nm-nav-in"><a class="nm-logo" href="#">Business name</a><nav class="nm-links"><a href="#services">Services</a><a href="#about">About</a><a href="#contact">Contact</a></nav><a class="nm-btn" href="#contact">Get a quote</a></div></header>`],
    ['hero', 'Hero: words and photo', 'Sections', `<section class="nm-hero"><div class="nm-wrap nm-hero-in"><div><h1>Say what you do and where, in one line</h1><p class="nm-lead">Who you help and why people pick you.</p><div class="nm-actions"><a class="nm-btn" href="#contact">Get a quote</a><a class="nm-btn nm-ghost" href="tel:">Call us</a></div></div><img class="nm-photo" src="${PH(900, 700)}" alt=""></div></section>`],
    ['hero-c', 'Hero: centred', 'Sections', `<section class="nm-hero nm-center"><div class="nm-wrap nm-narrow"><h1>A big, clear headline</h1><p class="nm-lead">One sentence that says what happens next.</p><div class="nm-actions nm-actions-c"><a class="nm-btn" href="#contact">Book now</a></div></div></section>`],
    ['text', 'Text', 'Sections', `<section class="nm-section"><div class="nm-wrap nm-narrow"><h2>A section heading</h2><p>Write a few short paragraphs here. Keep sentences short and say things plainly.</p></div></section>`],
    ['split', 'Photo and text', 'Sections', `<section class="nm-section"><div class="nm-wrap nm-split"><img class="nm-photo" src="${PH(900, 700)}" alt=""><div><h2>About us</h2><p>The story of the business in a few honest sentences.</p><a class="nm-btn" href="#contact">Get in touch</a></div></div></section>`],
    ['cards', 'Three cards', 'Sections', `<section class="nm-section nm-alt"><div class="nm-wrap"><h2>What we do</h2><div class="nm-grid3"><div class="nm-card"><h3>First thing</h3><p>A line about it.</p></div><div class="nm-card"><h3>Second thing</h3><p>A line about it.</p></div><div class="nm-card"><h3>Third thing</h3><p>A line about it.</p></div></div></div></section>`],
    ['gallery', 'Photo gallery', 'Sections', `<section class="nm-section"><div class="nm-wrap"><h2>Our work</h2><div class="nm-grid3"><img class="nm-photo" src="${PH(800, 800)}" alt=""><img class="nm-photo" src="${PH(800, 800)}" alt=""><img class="nm-photo" src="${PH(800, 800)}" alt=""></div></div></section>`],
    ['prices', 'Price list', 'Sections', `<section class="nm-section"><div class="nm-wrap nm-narrow"><h2>Prices</h2><div class="nm-row"><span>Item or service</span><strong>£0</strong></div><div class="nm-row"><span>Item or service</span><strong>£0</strong></div><div class="nm-row"><span>Item or service</span><strong>£0</strong></div></div></section>`],
    ['reviews', 'Reviews', 'Sections', `<section class="nm-section nm-alt"><div class="nm-wrap"><h2>What customers say</h2><div class="nm-grid3"><blockquote class="nm-card nm-quote"><p>Paste a real review from Google or Facebook.</p><cite>Customer's first name</cite></blockquote><blockquote class="nm-card nm-quote"><p>Paste a real review.</p><cite>First name</cite></blockquote><blockquote class="nm-card nm-quote"><p>Paste a real review.</p><cite>First name</cite></blockquote></div></div></section>`],
    ['cta', 'Call to action band', 'Sections', `<section class="nm-band"><div class="nm-wrap nm-band-in"><h2>Ready when you are</h2><a class="nm-btn nm-light" href="#contact">Get a quote</a></div></section>`],
    ['contact', 'Contact details', 'Sections', `<section class="nm-section" id="contact"><div class="nm-wrap nm-split"><div><h2>Get in touch</h2><p>Phone, email, address and opening hours.</p></div><div class="nm-card"><p><strong>Phone</strong><br><a href="tel:">Add the number</a></p><p><strong>Email</strong><br><a href="mailto:">Add the email</a></p><p><strong>Opening hours</strong><br>Mon to Fri, 9am to 5pm</p></div></div></section>`],
    ['footer', 'Footer', 'Sections', `<footer class="nm-foot"><div class="nm-wrap">Business name. Website by NEMORA.</div></footer>`],
    ['h', 'Heading', 'Basics', `<h2>A heading</h2>`],
    ['p', 'Paragraph', 'Basics', `<p>Some text. Click to edit it.</p>`],
    ['btn', 'Button', 'Basics', `<a class="nm-btn" href="#">Button</a>`],
    ['img', 'Photo', 'Basics', { type: 'image', src: PH(900, 600), attributes: { class: 'nm-photo', alt: '' } }],
    ['cols2', 'Two columns', 'Basics', `<div class="nm-split"><div><p>Left column</p></div><div><p>Right column</p></div></div>`],
    ['cols3', 'Three columns', 'Basics', `<div class="nm-grid3"><div><p>One</p></div><div><p>Two</p></div><div><p>Three</p></div></div>`],
    ['hr', 'Divider', 'Basics', `<hr class="nm-hr">`],
    ['space', 'Space', 'Basics', `<div class="nm-space"></div>`]
  ];
  const EXTRA_CSS = `.nm-center{text-align:center}.nm-narrow{max-width:760px}.nm-actions-c{justify-content:center}.nm-row{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid #e8e3d8}.nm-quote{margin:0}.nm-quote cite{display:block;margin-top:10px;font-style:normal;font-weight:600}.nm-band{background:#1d1f26;color:#fff;padding:48px 0}.nm-band-in{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}.nm-band h2{margin:0}.nm-light{background:#fff;color:#1d1f26}.nm-hr{border:0;border-top:1px solid #e8e3d8;margin:32px 0}.nm-space{height:48px}`;

  const FAMILIES = [['', 'Default'], ['Inter, sans-serif', 'Inter'], ['"DM Sans", sans-serif', 'DM Sans'], ['Poppins, sans-serif', 'Poppins'], ['Montserrat, sans-serif', 'Montserrat'], ['Lora, serif', 'Lora'], ['"Playfair Display", serif', 'Playfair Display'], ['Merriweather, serif', 'Merriweather'], ['Oswald, sans-serif', 'Oswald'], ['system-ui, sans-serif', 'System']];

  function shrink(file) {
    // photos are resized in the browser (max 2000px, JPEG or WebP) before upload
    return new Promise((res, rej) => {
      if (file.type === 'image/gif' || file.size < 350 * 1024) return res(file);
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, 2000 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => b ? res(b) : rej(new Error('Could not read that photo.')), file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85); };
      img.onerror = () => rej(new Error('Could not read that photo.')); img.src = url;
    });
  }

  async function start() {
    try { build = (await api('builds/' + id)).build; } catch (e) { $('#b-title').textContent = 'Not found'; show([e.message], 'bad'); return; }
    $('#b-title').textContent = build.title; document.title = build.title + ' | Builder';
    approved = build.status === 'approved';
    const cfg = {
      container: '#gjs', height: '100%', width: 'auto', storageManager: false, fromElement: false, cssIcons: '',
      undoManager: { trackSelection: false },
      canvas: { styles: [FONTS] },
      deviceManager: { devices: [{ id: 'desktop', name: 'Desktop', width: '' }, { id: 'tablet', name: 'Tablet', width: '820px', widthMedia: '992px' }, { id: 'phone', name: 'Phone', width: '390px', widthMedia: '760px' }] },
      panels: { defaults: [] },
      blockManager: { appendTo: '#blocks', blocks: blocks.map(([bid, label, category, content]) => ({ id: bid, label, category, content, media: '' })) },
      layerManager: { appendTo: '#layers' },
      selectorManager: { appendTo: '#selectors', componentFirst: true },
      traitManager: { appendTo: '#traits' },
      styleManager: { appendTo: '#styles', sectors: [
        { name: 'Text', open: true, properties: [{ property: 'font-family', type: 'select', options: FAMILIES.map(([value, name]) => ({ id: value, label: name })) }, 'font-size', 'font-weight', 'color', 'line-height', 'letter-spacing', 'text-align'] },
        { name: 'Colour and background', open: false, properties: ['background-color', 'background', 'opacity'] },
        { name: 'Size', open: false, properties: ['width', 'max-width', 'height', 'min-height'] },
        { name: 'Spacing', open: false, properties: ['margin', 'padding'] },
        { name: 'Corners and borders', open: false, properties: ['border-radius', 'border', 'box-shadow'] },
        { name: 'Layout', open: false, properties: ['display', 'flex-direction', 'justify-content', 'align-items', 'gap', 'float', 'position'] }
      ] },
      assetManager: {
        upload: false, autoAdd: true, multiUpload: false,
        uploadFile: async e => {
          const files = (e.dataTransfer || e.target).files; if (!files || !files[0]) return;
          try { say('Uploading photo…'); const blob = await shrink(files[0]); const d = await api('builds/' + id + '/images', { method: 'POST', raw: blob, type: blob.type || files[0].type }); editor.AssetManager.add({ src: d.src }); const t = editor.AssetManager.getTarget && editor.AssetManager.getTarget(); if (t && t.set) t.set('src', d.src); say('Photo added'); }
          catch (err) { say(err.message, true); }
        }
      }
    };
    if (build.data && build.data.pages) cfg.projectData = build.data; else { cfg.components = stripBody(build.html); cfg.style = (build.css || '').replace(FONT_IMPORT, ''); }
    editor = grapesjs.init(cfg);
    editor.on('load', () => {
      const has = editor.Css.getRules('.nm-wrap').length;
      if (!has) editor.Css.addRules(build.base || '');
      if (!editor.Css.getRules('.nm-band').length) editor.Css.addRules(EXTRA_CSS);
      editor.UndoManager.clear();
      say(approved ? '' : 'Saved');
      if (approved) showApproved();
      editor.on('update', queueSave);
    });
    editor.on('component:selected', () => { $('#b-pick').hidden = true; });
    editor.on('component:deselected', () => { $('#b-pick').hidden = !!editor.getSelected(); });
    // keep the client's preview honest: images keep an alt field in Settings
    editor.DomComponents.getType('image') && editor.DomComponents.addType('image', { model: { defaults: { traits: [{ name: 'alt', label: 'Describe the photo' }] } } });
  }
  const stripBody = h => String(h || '').replace(/^\s*<body[^>]*>/i, '').replace(/<\/body>\s*$/i, '');

  function queueSave() { if (approved) return; say('Unsaved changes'); clearTimeout(timer); timer = setTimeout(save, 700); }
  async function save(note) {
    if (saving) { queued = true; return; }
    saving = true; say('Saving…');
    try {
      await api('builds/' + id, { method: 'PUT', body: { html: stripBody(editor.getHtml()), css: FONT_IMPORT + editor.getCss(), data: editor.getProjectData(), note: typeof note === 'string' ? note : '' } });
      say('Saved, client sees it now');
    } catch (e) { say(e.status === 409 ? 'Approved: not saving' : e.message, true); if (e.status === 409) { approved = true; showApproved(); } }
    saving = false; if (queued) { queued = false; save(); }
  }

  function showApproved() {
    show([el('strong', {}, 'The client approved this version. '), 'It is saved for going live. ', el('button', { type: 'button', class: 'b-btn', onclick: async () => { await api('builds/' + id + '/reopen', { method: 'POST' }); approved = false; show(null); say('Editing again'); } }, 'Edit again')], 'ok');
  }

  /* ---------- top bar ---------- */
  document.querySelectorAll('[data-device]').forEach(b => b.addEventListener('click', () => { editor.setDevice(b.dataset.device === 'desktop' ? 'Desktop' : b.dataset.device === 'tablet' ? 'Tablet' : 'Phone'); document.querySelectorAll('[data-device]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
  $('#b-undo').addEventListener('click', () => editor && editor.UndoManager.undo());
  $('#b-redo').addEventListener('click', () => editor && editor.UndoManager.redo());
  document.querySelectorAll('.b-tabs [data-tab]').forEach(t => t.addEventListener('click', () => {
    const group = t.parentElement; group.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === t)));
    const side = group.closest('aside'); side.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
    side.querySelectorAll('.b-hint[data-for]').forEach(p => { p.hidden = p.dataset.for !== t.dataset.tab; });
  }));
  const dlg = $('#b-dialog'), body = $('#b-dialog-body');
  const openDialog = (...kids) => { body.replaceChildren(...kids); dlg.showModal(); };
  $('#b-link').addEventListener('click', () => {
    const url = location.origin + build.link;
    const input = el('input', { type: 'text', readonly: true, value: url, class: 'b-input', 'aria-label': 'Client link' });
    openDialog(el('h2', {}, 'Client link'), el('p', {}, 'Send this to the client. Their screen updates by itself a second or two after each change you make. It is private: only people with the link can see it, and search engines are told to ignore it.'), input,
      el('div', { class: 'b-row' }, el('button', { type: 'button', class: 'b-btn b-gold', onclick: async e => { try { await navigator.clipboard.writeText(url); e.target.textContent = 'Copied'; } catch (err) { input.select(); } } }, 'Copy link'), el('a', { class: 'b-btn', href: build.link, target: '_blank', rel: 'noopener' }, 'Open it'),
        el('button', { type: 'button', class: 'b-btn', onclick: async () => { const d = await api('builds/' + id + '/relink', { method: 'POST' }); build.link = d.build.link; dlg.close(); $('#b-link').click(); } }, 'Make a new link (the old one stops working)')));
  });
  $('#b-versions').addEventListener('click', async () => {
    const { versions } = await api('builds/' + id + '/versions');
    openDialog(el('h2', {}, 'Versions'), el('p', {}, 'A copy is kept every few minutes. Going back keeps the current one in this list too.'),
      el('ol', { class: 'b-versions' }, versions.map(v => el('li', {}, el('span', {}, new Date(v.saved).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ', ' + v.note),
        el('button', { type: 'button', class: 'b-btn', onclick: async () => { const d = await api('builds/' + id + '/restore', { method: 'POST', body: { version: v.id } }); dlg.close(); build = d.build; approved = false; show(null); editor.off('update', queueSave); if (build.data && build.data.pages) editor.loadProjectData(build.data); else { editor.setComponents(stripBody(build.html)); editor.setStyle((build.css || '').replace(FONT_IMPORT, '')); } editor.on('update', queueSave); say('Went back to that version'); } }, 'Go back to this')))));
  });
  $('#b-approve').addEventListener('click', () => {
    openDialog(el('h2', {}, 'Client approves this version?'), el('p', {}, 'This saves exactly what is on screen now as the approved version. Claude puts it live on their domain once the deposit is paid. You can still edit again afterwards.'),
      el('div', { class: 'b-row' }, el('button', { type: 'button', class: 'b-btn b-gold', onclick: async () => { clearTimeout(timer); await save('Before approval'); await api('builds/' + id + '/approve', { method: 'POST' }); approved = true; dlg.close(); showApproved(); say('Approved'); } }, 'Yes, they approve it')));
  });
  window.addEventListener('beforeunload', e => { if (statusEl.textContent === 'Unsaved changes' || saving) { e.preventDefault(); e.returnValue = ''; } });

  if (window.grapesjs) start(); else window.addEventListener('load', start);
})();
