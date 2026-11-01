// NEMORA live preview: shows the site being built and updates it as NEMORA edits, without the page jumping.
(function () {
  'use strict';
  var frame = document.getElementById('site'), note = document.getElementById('vnote');
  var base = location.pathname.replace(/\/$/, ''), rev = 0, fails = 0, delay = 1500, flashT;
  function doc(css, html) {
    return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><style id="nm-css">' + css.replace(/<\/style/gi, '') + '</style></head><body>' + html + '</body></html>';
  }
  function apply(d) {
    var html = String(d.html || '').replace(/^\s*<body[^>]*>/i, '').replace(/<\/body>\s*$/i, ''), css = String(d.css || '');
    var inner = null; try { inner = frame.contentDocument; } catch (e) {}
    if (rev && inner && inner.body && inner.getElementById('nm-css')) {
      var y = inner.scrollingElement ? inner.scrollingElement.scrollTop : 0;
      inner.getElementById('nm-css').textContent = css; inner.body.innerHTML = html;
      if (inner.scrollingElement) inner.scrollingElement.scrollTop = y;
    } else frame.srcdoc = doc(css, html);
    if (rev) { note.textContent = 'Updated just now'; document.body.classList.add('flash'); clearTimeout(flashT); flashT = setTimeout(function () { document.body.classList.remove('flash'); note.textContent = 'Live preview: changes appear here as we make them'; }, 2200); }
    if (d.status === 'approved') note.textContent = 'This is the approved version';
    rev = d.rev;
  }
  function tick() {
    fetch(base + '/data?rev=' + rev, { cache: 'no-store', credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { fails = 0; if (d.html !== undefined) apply(d); })
      .catch(function () { fails++; if (fails === 3) note.textContent = 'Reconnecting…'; })
      .then(function () { setTimeout(tick, document.hidden ? 6000 : Math.min(delay * (1 + fails), 15000)); });
  }
  tick();
})();
