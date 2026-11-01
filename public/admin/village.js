// NEMORA village: a little pixel-art town where each AI agent lives, works and wanders.
// Drawn on a 480 x 272 canvas, scaled up crisp. Everything is generated in code (no image files),
// and it shows real state: who is working, who is paused, who needs you, and who is waiting to be hired.
const W = 480, H = 272, T = 16;
const PAL = {
  grass: ['#5b8f3a', '#64983f', '#548536'], path: '#c9b38a', pathEdge: '#b39b70', stone: '#9aa0a6', stoneD: '#6f757c', water: ['#4aa3df', '#62b6ea'],
  tree: '#2f6b2a', treeL: '#3f8a36', trunk: '#6b4a2b', fence: '#8a6a43', flower: ['#f2d36b', '#f08aa0', '#ffffff', '#b98cf2'],
  skin: ['#f1c7a3', '#d9a27c', '#a86f4c', '#7a4b31'], hair: ['#2b2118', '#6b3f22', '#d8b25a', '#1a1a1a', '#a33b2b', '#dcdcdc'],
  shirt: ['#3f6fd8', '#d84f4f', '#3fae6a', '#e0a33a', '#8a58d6', '#2fb3b3'], legs: '#2d3140', night: 'rgba(16,22,58,0.38)', lit: '#ffd86b', dark: '#2a2f3d'
};
// where each core agent's building stands (tile coords of the building's top-left) and its colours
const SPOTS = {
  boss: { x: 12.5, y: 1, w: 5, h: 4, wall: '#e9dcc0', roof: '#b0453a', label: 'Town hall' },
  outreach: { x: 2, y: 2, w: 4, h: 3, wall: '#d9e4ef', roof: '#3d6db5', label: 'Post office' },
  replies: { x: 7, y: 2, w: 3, h: 3, wall: '#efe0d0', roof: '#7a5236', label: 'Mail room' },
  social: { x: 20, y: 2, w: 4, h: 3, wall: '#f3d9e3', roof: '#a8487a', label: 'Studio' },
  guides: { x: 3, y: 10, w: 4, h: 3, wall: '#e6e0cf', roof: '#5a6b3a', label: 'Library' },
  care: { x: 22, y: 10, w: 4, h: 3, wall: '#e0efe6', roof: '#3a8a6a', label: 'Care cottage' },
  autopilot: { x: 25.5, y: 3, w: 2, h: 3, wall: '#c8ccd2', roof: '#5b6270', label: 'Clock tower', tower: true }
};
const PLOTS = [{ x: 8.5, y: 10 }, { x: 17, y: 10.5 }, { x: 1.5, y: 6.5 }, { x: 26, y: 7.5 }, { x: 12, y: 12.5 }, { x: 19.5, y: 6.5 }];
const GATE = { x: 14.5 * T, y: 16.2 * T };
const SQUARE = { x: 15 * T, y: 8.5 * T };

function rng(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function drawWorld(g, night) {
  const r = rng('nemora');
  for (let y = 0; y < H / T + 1; y++) for (let x = 0; x < W / T; x++) { g.fillStyle = PAL.grass[Math.floor(r() * 3)]; g.fillRect(x * T, y * T, T, T); if (r() < 0.25) { g.fillStyle = PAL.grass[1]; g.fillRect(x * T + Math.floor(r() * 14), y * T + Math.floor(r() * 14), 2, 1); } }
  // paths: a main street, a cross street and lanes to each building
  const path = (x, y, w, h) => { g.fillStyle = PAL.pathEdge; g.fillRect(x - 1, y - 1, w + 2, h + 2); g.fillStyle = PAL.path; g.fillRect(x, y, w, h); };
  path(0, 7.5 * T, W, 2 * T); path(14 * T, 5 * T, 2 * T, H - 5 * T);
  for (const s of Object.values(SPOTS)) path((s.x + s.w / 2 - 0.5) * T, (s.y + s.h) * T, T, Math.max(0, 7.5 * T - (s.y + s.h) * T) || T);
  for (const s of [SPOTS.guides, SPOTS.care]) path((s.x + s.w / 2 - 0.5) * T, 9.5 * T, T, s.y * T - 9.5 * T);
  // the square and fountain
  g.fillStyle = PAL.pathEdge; g.beginPath(); g.arc(SQUARE.x, SQUARE.y, 44, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.path; g.beginPath(); g.arc(SQUARE.x, SQUARE.y, 42, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.stoneD; g.beginPath(); g.arc(SQUARE.x, SQUARE.y, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.stone; g.beginPath(); g.arc(SQUARE.x, SQUARE.y, 14, 0, Math.PI * 2); g.fill();
  // fence along the bottom with the gate
  g.fillStyle = PAL.fence; for (let x = 0; x < W; x += 6) { if (Math.abs(x - GATE.x) < 18) continue; g.fillRect(x, H - 14, 2, 10); } g.fillRect(0, H - 11, GATE.x - 18, 2); g.fillRect(GATE.x + 18, H - 11, W, 2);
  g.fillStyle = '#7a5a36'; g.fillRect(GATE.x - 20, H - 22, 3, 18); g.fillRect(GATE.x + 17, H - 22, 3, 18); g.fillStyle = '#e9dcc0'; g.fillRect(GATE.x - 14, H - 30, 28, 8); g.fillStyle = PAL.dark; g.fillRect(GATE.x - 11, H - 27, 22, 1); g.fillRect(GATE.x - 11, H - 25, 16, 1);
  // trees and flowers, kept off the paths and buildings
  const busy = (x, y) => (y > 7 * T && y < 10 * T) || (x > 13.5 * T && x < 16.5 * T && y > 4.5 * T) || Object.values(SPOTS).some(s => x > (s.x - 0.5) * T && x < (s.x + s.w + 0.5) * T && y > (s.y - 0.5) * T && y < (s.y + s.h + 1.5) * T) || PLOTS.some(p => x > (p.x - 0.5) * T && x < (p.x + 3.5) * T && y > (p.y - 0.5) * T && y < (p.y + 3.5) * T) || Math.hypot(x - SQUARE.x, y - SQUARE.y) < 52 || y > H - 26;
  for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * (H - 30); if (busy(x, y)) continue; if (r() < 0.45) { g.fillStyle = PAL.trunk; g.fillRect(x - 1, y + 4, 3, 5); g.fillStyle = PAL.tree; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = PAL.treeL; g.beginPath(); g.arc(x - 2, y - 2, 4, 0, Math.PI * 2); g.fill(); } else { g.fillStyle = PAL.flower[Math.floor(r() * 4)]; g.fillRect(x, y, 2, 2); g.fillRect(x + 4, y + 2, 2, 2); } }
}

function drawBuilding(g, s, lit, t) {
  const x = Math.round(s.x * T), y = Math.round(s.y * T), w = s.w * T, h = s.h * T;
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 3, y + 6, w, h);
  const roofH = s.tower ? 18 : Math.round(h * 0.42);
  g.fillStyle = s.wall; g.fillRect(x, y + roofH, w, h - roofH);
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, y + h - 4, w, 4);
  // stepped pixel roof
  g.fillStyle = s.roof; for (let i = 0; i < roofH; i += 2) { const inset = Math.round((roofH - i) * (s.tower ? 0.5 : 0.55)); g.fillRect(x - 3 + inset, y + i, w + 6 - inset * 2, 2); }
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x - 3 + Math.round(roofH * 0.55), y + roofH - 2, w + 6 - Math.round(roofH * 1.1), 1);
  // door and windows
  const dx = x + Math.round(w / 2) - 4; g.fillStyle = '#5a3b22'; g.fillRect(dx, y + h - 12, 8, 12); g.fillStyle = '#e0b04a'; g.fillRect(dx + 6, y + h - 7, 1, 1);
  const flick = lit === 'busy' ? (Math.sin(t / 180) > -0.3 ? PAL.lit : '#ffc94a') : lit ? PAL.lit : '#5d7a99';
  const wins = s.tower ? [[x + w / 2 - 3, y + roofH + 4]] : [[x + 5, y + roofH + 5], [x + w - 13, y + roofH + 5]];
  for (const [wx, wy] of wins) { g.fillStyle = '#3b3f4a'; g.fillRect(wx - 1, wy - 1, 10, 9); g.fillStyle = flick; g.fillRect(wx, wy, 8, 7); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(wx, wy, 3, 2); }
  if (s.tower) { const cx = x + w / 2, cy = y + 9; g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill(); g.strokeStyle = PAL.dark; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 3 * Math.cos(t / 1000), cy + 3 * Math.sin(t / 1000)); g.stroke(); }
  if (s.flag) { g.fillStyle = '#6b4a2b'; g.fillRect(x + w - 6, y - 14, 1, 16); g.fillStyle = '#d4b06a'; g.fillRect(x + w - 5, y - 14 + Math.round(Math.sin(t / 300)), 7, 4); }
}

function drawPerson(g, a, t) {
  const x = Math.round(a.x), y = Math.round(a.y), look = a.look, step = a.moving ? (Math.floor(t / 140) % 2) : 0;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 4, y + 7, 9, 2);
  if (a.robot) {
    g.fillStyle = '#9aa3ad'; g.fillRect(x - 4, y - 6, 9, 8); g.fillStyle = '#c8ced5'; g.fillRect(x - 3, y - 5, 7, 6); g.fillStyle = '#58c4f0'; g.fillRect(x - 2, y - 3, 2, 2); g.fillRect(x + 1, y - 3, 2, 2);
    g.fillStyle = '#6f777f'; g.fillRect(x, y - 9, 1, 3); g.fillStyle = t % 1000 < 500 ? '#f05a5a' : '#ffd86b'; g.fillRect(x, y - 10, 1, 1);
    g.fillStyle = '#7b848e'; g.fillRect(x - 3, y + 2, 7, 4); g.fillStyle = PAL.dark; g.fillRect(x - 3 + step, y + 6, 2, 2); g.fillRect(x + 2 - step, y + 6, 2, 2); return;
  }
  const skin = PAL.skin[look.skin], hair = PAL.hair[look.hair], shirt = PAL.shirt[look.shirt];
  g.fillStyle = PAL.legs; g.fillRect(x - 2, y + 3, 2, 4 - step); g.fillRect(x + 1, y + 3, 2, 3 + step);
  g.fillStyle = shirt; g.fillRect(x - 3, y - 2, 7, 6); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x - 3, y + 3, 7, 1);
  if (a.tie) { g.fillStyle = '#d4b06a'; g.fillRect(x, y - 2, 1, 4); }
  g.fillStyle = skin; g.fillRect(x - 2, y - 7, 5, 5); g.fillRect(x - 4, y - 1 + step, 1, 3); g.fillRect(x + 4, y - 1 - step + 1, 1, 3);
  g.fillStyle = hair; g.fillRect(x - 2, y - 8, 5, 2); g.fillRect(x - 3, y - 7, 1, 2);
  g.fillStyle = PAL.dark; if (a.dir >= 0) g.fillRect(x + 1, y - 5, 1, 1); if (a.dir <= 0) g.fillRect(x - 1, y - 5, 1, 1);
  if (a.crown) { g.fillStyle = '#e8c35a'; g.fillRect(x - 2, y - 10, 5, 2); g.fillRect(x - 2, y - 11, 1, 1); g.fillRect(x, y - 11, 1, 1); g.fillRect(x + 2, y - 11, 1, 1); }
}

// the state each agent shows in town
function mood(a) {
  if (a.health === 'hiring') return 'hiring';
  if (a.health === 'retiring') return 'leaving';
  if (!a.enabled) return 'asleep';
  if (['missed', 'failed', 'attention'].includes(a.health)) return 'trouble';
  if (a.last_run && Date.now() - Date.parse(a.last_run) < 20 * 60000 && a.kind !== 'system') return 'busy';
  return 'idle';
}
const BUBBLE = { hiring: 'Starts tomorrow', leaving: 'Leaving', asleep: 'Zz', trouble: '!', busy: 'Working…' };

export function mountVillage(host, agents, { onSelect, selected, reduced } = {}) {
  const wrap = document.createElement('div'); wrap.className = 'village';
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Village map: ' + agents.map(a => `${a.name}, ${(BUBBLE[mood(a)] || 'around town').replace('…', '')}`).join('; '));
  const layer = document.createElement('div'); layer.className = 'village-layer';
  wrap.append(canvas, layer); host.append(wrap);
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const night = hour >= 19 || hour < 7;
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H; drawWorld(bg.getContext('2d'), night);

  // give every agent a building: core ones have their own, hired ones take the next free plot
  let plot = 0;
  const people = agents.map((a, i) => {
    const r = rng(a.id + a.look);
    const n = Number(a.look) || Math.floor(r() * 6);
    const spot = SPOTS[a.id] ? { ...SPOTS[a.id], flag: a.id === 'boss' } : (() => { const p = PLOTS[plot++ % PLOTS.length]; return { x: p.x, y: p.y, w: 3, h: 3, wall: ['#efe6d2', '#dfe9f2', '#f2e1dc', '#e3f0e0', '#ece2f3', '#f3ecd0'][n % 6], roof: ['#8a5a3a', '#4a6fa8', '#a85a4a', '#4a8a5a', '#7a5aa8', '#a8883a'][n % 6], label: a.name + "'s house" }; })();
    const door = { x: (spot.x + spot.w / 2) * T, y: (spot.y + spot.h) * T + 9 };
    const m = mood(a);
    const start = m === 'hiring' ? { x: GATE.x + (i % 3 - 1) * 12, y: GATE.y - 4 } : { ...door };
    return { a, spot, door, m, x: start.x, y: start.y, tx: start.x, ty: start.y, wait: r() * 3000, moving: false, dir: 1, robot: a.kind === 'system', crown: a.id === 'boss', tie: a.id === 'boss',
      look: { skin: n % 4, hair: (n * 7 + 2) % 6, shirt: n % 6 }, r };
  });

  // labels and bubbles are HTML, so they stay sharp and readable
  const tags = people.map(p => {
    const sign = document.createElement('span'); sign.className = 'v-sign'; sign.textContent = p.a.name;
    const bub = document.createElement('span'); bub.className = 'v-bubble v-' + p.m; bub.textContent = BUBBLE[p.m] || ''; bub.hidden = !BUBBLE[p.m];
    const hit = document.createElement('button'); hit.type = 'button'; hit.className = 'v-hit'; hit.setAttribute('aria-label', p.a.name + ': ' + (p.a.role || '') + '. Show details');
    hit.addEventListener('click', () => select(p));
    layer.append(sign, bub, hit); return { sign, bub, hit };
  });
  let sel = people.find(p => p.a.id === selected) || null;
  function select(p) { sel = p; onSelect && onSelect(p.a); }

  const place = (el, x, y) => { el.style.setProperty('left', (x / W * 100) + '%'); el.style.setProperty('top', (y / H * 100) + '%'); };
  function pickTarget(p) {
    const r = p.r();
    if (p.robot) { const ang = (performance.now() / 4000) % (Math.PI * 2); return { x: SQUARE.x + Math.cos(ang + 1) * 34, y: SQUARE.y + Math.sin(ang + 1) * 30 }; }
    if (r < 0.35) return { x: p.door.x + (p.r() - 0.5) * 30, y: p.door.y + p.r() * 10 };
    if (r < 0.75) { const ang = p.r() * Math.PI * 2; return { x: SQUARE.x + Math.cos(ang) * 32, y: SQUARE.y + Math.sin(ang) * 28 }; }
    if (r < 0.85 && SPOTS.boss) return { x: (SPOTS.boss.x + SPOTS.boss.w / 2) * T + (p.r() - 0.5) * 24, y: (SPOTS.boss.y + SPOTS.boss.h) * T + 14 };
    return { x: p.r() * (W - 40) + 20, y: 8.5 * T + (p.r() - 0.5) * 18 };
  }
  let last = performance.now(), raf = 0, alive = true;
  function frame(t) {
    if (!alive) return;
    if (!document.body.contains(canvas)) { alive = false; return; }
    const dt = Math.min(64, t - last); last = t;
    g.drawImage(bg, 0, 0);
    // water shimmer
    g.fillStyle = PAL.water[Math.floor(t / 400) % 2]; g.beginPath(); g.arc(SQUARE.x, SQUARE.y, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(SQUARE.x - 1, SQUARE.y - 6 - (Math.floor(t / 200) % 3), 2, 4);
    const spots = new Map(); people.forEach(p => spots.set(p.spot, p));
    for (const [s, p] of spots) drawBuilding(g, s, p.m === 'busy' ? 'busy' : night && p.m !== 'asleep', t);
    for (const p of people) {
      const still = reduced || ['asleep', 'trouble', 'hiring', 'leaving', 'busy'].includes(p.m);
      if (!still) {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        if (d < 1) { p.moving = false; p.wait -= dt; if (p.wait <= 0) { const nt = pickTarget(p); p.tx = nt.x; p.ty = nt.y; p.wait = p.robot ? 300 : 1500 + p.r() * 4500; } }
        else { const v = (p.robot ? 0.03 : 0.022) * dt; p.x += dx / d * Math.min(v, d); p.y += dy / d * Math.min(v, d); p.moving = true; p.dir = dx > 0.2 ? 1 : dx < -0.2 ? -1 : p.dir; }
      } else p.moving = false;
    }
    people.filter(p => p.m !== 'busy').sort((a, b) => a.y - b.y).forEach(p => drawPerson(g, p, t));
    if (sel) { g.strokeStyle = '#ffe08a'; g.lineWidth = 1; const sx = sel.m === 'busy' ? sel.door.x : sel.x, sy = sel.m === 'busy' ? sel.door.y : sel.y; g.strokeRect(Math.round(sx) - 7.5, Math.round(sy) - 13.5, 15, 23); }
    if (night) { g.fillStyle = PAL.night; g.fillRect(0, 0, W, H); for (const [s, p] of spots) if (p.m !== 'asleep') { g.fillStyle = 'rgba(255,216,107,0.18)'; g.beginPath(); g.arc((s.x + s.w / 2) * T, (s.y + s.h) * T, 18, 0, Math.PI * 2); g.fill(); } }
    people.forEach((p, i) => {
      const bx = p.m === 'busy' ? p.door.x : p.x, by = p.m === 'busy' ? (p.spot.y * T) : p.y - 12;
      place(tags[i].bub, bx, by); place(tags[i].sign, (p.spot.x + p.spot.w / 2) * T, (p.spot.y + p.spot.h) * T + 2);
      const hx = p.m === 'busy' ? (p.spot.x + p.spot.w / 2) * T : p.x, hy = p.m === 'busy' ? (p.spot.y + p.spot.h / 2) * T : p.y - 3;
      place(tags[i].hit, hx, hy); tags[i].hit.classList.toggle('v-big', p.m === 'busy');
      tags[i].sign.classList.toggle('on', sel === p);
    });
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && alive) { last = performance.now(); } });
  return { destroy() { alive = false; cancelAnimationFrame(raf); wrap.remove(); }, night };
}
