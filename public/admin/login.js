(function () {
  var $ = function (id) { return document.getElementById(id); };
  function show(id) { ['login', 'setup', 'nocode', 'loading'].forEach(function (x) { $(x).hidden = x !== id; }); var f = $(id).querySelector('input'); if (f) f.focus(); }
  function err(box, text) { box.textContent = text; box.hidden = !text; }
  document.querySelectorAll('[data-show]').forEach(function (b) {
    b.addEventListener('click', function () { var i = $(b.getAttribute('data-show')); var on = i.type === 'password'; i.type = on ? 'text' : 'password'; b.textContent = on ? 'Hide' : 'Show'; });
  });
  async function post(url, body) {
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
    var d = {}; try { d = await r.json(); } catch (e) {}
    return { ok: r.ok, data: d };
  }
  fetch('/api/setup-state', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (s) {
    show(s.needsSetup ? (s.hasCode ? 'setup' : 'nocode') : 'login');
  }).catch(function () { show('login'); });

  $('login').addEventListener('submit', async function (e) {
    e.preventDefault();
    var box = $('login-msg'), btn = this.querySelector('button[type=submit]');
    err(box, '');
    if (!$('l-user').value.trim() || !$('l-pass').value) return err(box, 'Enter your username and password.');
    btn.disabled = true; btn.textContent = 'Checking…';
    try {
      var r = await post('/api/login', { username: $('l-user').value, password: $('l-pass').value });
      if (r.ok) { location.href = '/admin/app'; return; }
      if (r.data.setup) return show('setup');
      err(box, r.data.error || 'Could not log in. Please try again.');
    } catch (x) { err(box, 'No connection. Check your signal and try again.'); }
    btn.disabled = false; btn.textContent = 'Log in';
  });

  $('setup').addEventListener('submit', async function (e) {
    e.preventDefault();
    var box = $('setup-msg'), btn = this.querySelector('button[type=submit]');
    err(box, '');
    if ($('s-pass').value.length < 12) return err(box, 'The password must be at least 12 characters.');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      var r = await post('/api/setup', { code: $('s-code').value.trim(), username: $('s-user').value.trim(), password: $('s-pass').value });
      if (r.ok) { location.href = '/admin/app'; return; }
      err(box, r.data.error || 'Could not create the login. Please try again.');
    } catch (x) { err(box, 'No connection. Check your signal and try again.'); }
    btn.disabled = false; btn.textContent = 'Create login';
  });
})();
