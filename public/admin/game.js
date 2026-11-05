// NEMORA village: the playable version. Walk round your real AI village as yourself, talk to your agents and give them jobs,
// farm, fish, mine, and spend coins your real business earns. Everything is drawn in code, like the village itself.
// The village page keeps working exactly as before; this opens over it from the Play button.
import {
  T, PAL, SPOTS, PLOTS, GATE, SQUARE, rng, drawGround, drawBuilding, drawCloud, drawItem, drawPerson, drawPet, drawRoom, RW, RH,
  LOOK, WALLS, ROOFS, FLOORS, PAPERS, TOWN_ITEMS, STARTER_DECOR, lookOf, mood, bubbleText, personIcon, GROUNDS
} from './village.js?v=5';

/* ======================= the world ======================= */
const WT = 72, HT = 44, WW = WT * T, WH = HT * T;           // world in tiles and pixels
const OX = 21 * T, OY = 10 * T;                              // where the real town sits in the world
const TOWN_W = 480, TOWN_H = 272;
const FARM = { x: 2 * T, y: 20 * T, w: 16 * T, h: 14 * T };  // tillable land, fenced, opening at the top
const FARM_GAP = { x: 8 * T, w: 2 * T };                     // the way into the field
const HOME = { x: 4, y: 9, w: 5, h: 4, wall: 7, roof: 2 };     // your farmhouse (tiles)
const SHOP = { x: 27, y: 29, w: 6, h: 4, wall: 0, roof: 4 };   // the general store (tiles)
const BIN = { x: 10 * T + 4, y: 12 * T + 6 };                 // shipping bin
const MAILBOX = { x: 9 * T + 4, y: 13 * T + 4 };
const POND = { x: 1000, y: 340, rx: 92, ry: 62 };
const MOUNT = { x: 44 * T, y: 0, w: WW - 44 * T, h: 7 * T }; // rocky hills
const CAVE = { x: 888, y: 112 };                              // the mine's mouth
const PATHS = [
  [8 * T, 280, OX - 8 * T, 32],             // farm to town (meets the town's own path)
  [5.5 * T + 8, 13 * T, 16, 280 - 13 * T],  // farmhouse door down to it
  [OX + TOWN_W, 280, 930 - OX - TOWN_W, 32],// town to the pond
  [872, 6 * T + 12, 32, 280 - 6 * T - 12],  // up to the mine
  [OX + GATE.x - 16, OY + TOWN_H, 32, 544 - OY - TOWN_H + 8], // out of the gate, south
  [29.5 * T, 536, OX + GATE.x + 16 - 29.5 * T, 24], // along to the shop door
  [29.5 * T, 528, 16, 10],                  // shop doorstep
  [FARM_GAP_X(), 312, 32, 10]               // into the field
];
function FARM_GAP_X() { return 8 * T; }
const SEASONS = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
const london = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { h: +p.hour, m: +p.minute, month: +p.month, day: +p.day, wd: p.weekday };
};
const season = () => SEASONS[london().month - 1];

/* ======================= things you can have ======================= */
const CROPS = {
  parsnip: { name: 'Parsnip', s: ['spring'], h: 2, sell: 35, seed: 20, col: '#efe2b0' },
  potato: { name: 'Potato', s: ['spring'], h: 4, sell: 80, seed: 50, col: '#c9a26a' },
  cauliflower: { name: 'Cauliflower', s: ['spring'], h: 8, sell: 175, seed: 80, col: '#f4f1e3' },
  strawberry: { name: 'Strawberry', s: ['spring'], h: 6, re: 3, sell: 120, seed: 100, col: '#e0453a' },
  tomato: { name: 'Tomato', s: ['summer'], h: 6, re: 2, sell: 60, seed: 50, col: '#e0503a' },
  blueberry: { name: 'Blueberries', s: ['summer'], h: 8, re: 3, yield: 3, sell: 50, seed: 80, col: '#4a5fd0' },
  melon: { name: 'Melon', s: ['summer'], h: 10, sell: 250, seed: 80, col: '#7fc06a' },
  corn: { name: 'Corn', s: ['summer', 'autumn'], h: 10, re: 3, sell: 50, seed: 150, col: '#f2d36b', tall: true },
  pumpkin: { name: 'Pumpkin', s: ['autumn'], h: 12, sell: 320, seed: 100, col: '#e0802a' },
  cranberry: { name: 'Cranberries', s: ['autumn'], h: 6, re: 3, yield: 2, sell: 75, seed: 240, col: '#c0304a' },
  aubergine: { name: 'Aubergine', s: ['autumn'], h: 4, re: 2, sell: 60, seed: 20, col: '#6a3a8a' },
  beetroot: { name: 'Beetroot', s: ['autumn'], h: 5, sell: 100, seed: 30, col: '#9a2a4a' },
  snowpea: { name: 'Snow pea', s: ['winter'], h: 3, re: 2, sell: 45, seed: 30, col: '#9fd88a' },
  kale: { name: 'Winter kale', s: ['winter'], h: 5, sell: 110, seed: 60, col: '#3f7a4a' },
  sprouts: { name: 'Sprouts', s: ['winter'], h: 8, sell: 190, seed: 90, col: '#6aa84a' }
};
const FISH = [
  { k: 'carp', name: 'Carp', sell: 30, diff: 18, w: 40, col: '#9a8a4a' },
  { k: 'perch', name: 'Perch', sell: 55, diff: 32, w: 30, col: '#6a9a4a' },
  { k: 'sunfish', name: 'Sunfish', sell: 30, diff: 28, w: 25, day: true, col: '#e0a33a' },
  { k: 'bream', name: 'Bream', sell: 45, diff: 36, w: 20, night: true, col: '#8a8f96' },
  { k: 'trout', name: 'Rainbow trout', sell: 65, diff: 46, w: 12, seasons: ['spring', 'summer'], col: '#d07a9a' },
  { k: 'pike', name: 'Pike', sell: 100, diff: 60, w: 10, col: '#4a7a5a' },
  { k: 'eel', name: 'Eel', sell: 85, diff: 70, w: 8, night: true, seasons: ['spring', 'autumn'], col: '#3a4a5a' },
  { k: 'koi', name: 'Golden koi', sell: 600, diff: 86, w: 1.5, col: '#f2b33a' },
  { k: 'boot', name: 'Old boot', sell: 1, diff: 0, w: 6, junk: true, col: '#6b4a2b' }
];
const MINERALS = {
  stone: { name: 'Stone', sell: 2, col: '#9aa0a6' }, coal: { name: 'Coal', sell: 15, col: '#2d2f38' },
  copper: { name: 'Copper ore', sell: 5, col: '#d0803a' }, iron: { name: 'Iron ore', sell: 10, col: '#c8ccd2' }, gold: { name: 'Gold ore', sell: 25, col: '#f2d36b' },
  quartz: { name: 'Quartz', sell: 25, col: '#f2f2f2', gem: true }, amethyst: { name: 'Amethyst', sell: 100, col: '#a86ae0', gem: true }, topaz: { name: 'Topaz', sell: 80, col: '#f2b33a', gem: true },
  emerald: { name: 'Emerald', sell: 250, col: '#3fae6a', gem: true }, ruby: { name: 'Ruby', sell: 250, col: '#e0453a', gem: true }, diamond: { name: 'Diamond', sell: 750, col: '#bff0ff', gem: true }
};
const FOOD = { bread: { name: 'Bread', price: 40, energy: 40 }, coffee: { name: 'Coffee', price: 60, energy: 30 }, pie: { name: 'Apple pie', price: 120, energy: 80 } };
const TOOL_LV = ['Basic', 'Copper', 'Steel', 'Gold'], TOOL_COST = [0, 2000, 5000, 10000];
const CAN_SIZE = [40, 60, 90, 130], PICK_POW = [1, 2, 3, 4], ROD_BAR = [34, 42, 50, 60];
const DECO_PRICE = { tree: 150, pine: 150, bush: 60, flowers: 40, bench: 120, lamp: 180, pond: 600, rock: 30, stall: 400, statue: 900, mailbox: 80, sign: 60, flag: 120, table: 200, cat: 300, car: 1500, well: 700, campfire: 150, tent: 350, windmill: 1200, hedge: 90, mushrooms: 40, autumn: 180, blossom: 220, lights: 260, banner: 200, snowman: 80, fountain: 1000 };
const TOOLS = { hoe: 'Hoe', can: 'Watering can', pick: 'Pickaxe', rod: 'Fishing rod' };

function itemInfo(id) {
  const [kind, k] = id.includes(':') ? id.split(':') : [id, ''];
  if (TOOLS[id]) return { name: TOOLS[id], type: 'tool' };
  if (kind === 'seed' && CROPS[k]) return { name: CROPS[k].name.replace(/ies$/, 'y').replace(/s$/, '') + ' seeds', type: 'seed', sell: Math.floor(CROPS[k].seed / 2), crop: k };
  if (kind === 'crop' && CROPS[k]) return { name: CROPS[k].name, type: 'crop', sell: CROPS[k].sell, energy: Math.round(CROPS[k].sell / 3) + 5 };
  if (kind === 'fish') { const f = FISH.find(x => x.k === k); if (f) return { name: f.name, type: 'fish', sell: f.sell, energy: f.junk ? 0 : Math.round(f.sell / 2) + 8 }; }
  if (MINERALS[id]) return { name: MINERALS[id].name, type: 'mineral', sell: MINERALS[id].sell };
  if (FOOD[id]) return { name: FOOD[id].name, type: 'food', sell: Math.floor(FOOD[id].price / 4), energy: FOOD[id].energy };
  if (kind === 'deco') { const d = TOWN_ITEMS.find(x => x[0] === k); if (d) return { name: d[1], type: 'deco', deco: k }; }
  return { name: id, type: 'junk' };
}

/* ======================= drawing helpers ======================= */
function drawIcon(g, id, x, y) {
  // a 16 x 16 icon centred on (x, y)
  const R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  const C = (c, a, b, r) => { g.fillStyle = c; g.beginPath(); g.arc(x + a, y + b, r, 0, Math.PI * 2); g.fill(); };
  const [kind, k] = id.includes(':') ? id.split(':') : [id, ''];
  if (id === 'hoe') { for (let i = 0; i < 9; i++) R('#8a5a3a', -4 + i, 5 - i, 2, 2); R('#9aa0a6', 3, -6, 4, 3); R('#c8ccd2', 3, -6, 4, 1); return; }
  if (id === 'can') { R('#5b8fd0', -5, -2, 9, 7); R('#3d6db5', -5, 3, 9, 2); R('#5b8fd0', 4, -1, 4, 2); R('#5b8fd0', 7, -3, 2, 2); R('#3d6db5', -4, -5, 6, 2); R('#cfe6ff', -3, -1, 2, 1); return; }
  if (id === 'pick') { for (let i = 0; i < 9; i++) R('#8a5a3a', -4 + i, 5 - i, 2, 2); R('#9aa0a6', -1, -6, 10, 2); R('#9aa0a6', -2, -5, 2, 2); R('#9aa0a6', 8, -5, 2, 2); return; }
  if (id === 'rod') { for (let i = 0; i < 12; i++) R('#8a5a3a', -6 + i, 6 - i, 1, 1); R('#3b3f4a', -5, 4, 2, 2); g.strokeStyle = '#e8eef2'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x + 6, y - 6); g.lineTo(x + 6, y + 4); g.stroke(); R('#e0453a', 5, 4, 2, 2); return; }
  if (kind === 'seed') { const c = CROPS[k]; R('#c9a26a', -5, -6, 10, 12); R('#b08850', -5, -6, 10, 2); C(c ? c.col : '#3fae6a', 0, 1, 3); R('#3fae6a', 0, -3, 1, 2); return; }
  if (kind === 'crop') { const c = CROPS[k] || {}; R('#3fae6a', -1, -7, 2, 4); R('#4cc07a', 1, -7, 3, 2);
    if (k === 'corn') { R('#f2d36b', -2, -4, 5, 10); R('#3fae6a', -4, -2, 2, 8); R('#3fae6a', 3, -2, 2, 8); return; }
    if (k === 'blueberry' || k === 'cranberry') { C(c.col, -3, 1, 3); C(c.col, 2, 2, 3); C(c.col, 0, -2, 3); return; }
    if (k === 'parsnip' || k === 'beetroot') { C(c.col, 0, -1, 4); R(c.col, -1, 2, 2, 4); return; }
    if (k === 'aubergine') { g.fillStyle = c.col; g.beginPath(); g.ellipse(x, y + 2, 3, 6, 0.4, 0, Math.PI * 2); g.fill(); return; }
    C(c.col || '#3fae6a', 0, 1, k === 'pumpkin' || k === 'melon' ? 6 : 5); C('rgba(255,255,255,0.35)', -2, -1, 2); return; }
  if (kind === 'fish') { const f = FISH.find(z => z.k === k) || FISH[0];
    if (f.junk) { R('#6b4a2b', -4, -5, 5, 8); R('#6b4a2b', -4, 1, 9, 4); R('#4a3220', -4, 4, 9, 1); return; }
    g.fillStyle = f.col; g.beginPath(); g.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2); g.fill(); R(f.col, 6, -3, 2, 6); R('#1a1a1a', -4, -1, 1, 1); R('rgba(255,255,255,0.4)', -3, -3, 6, 1); return; }
  if (MINERALS[id]) { const m = MINERALS[id];
    if (m.gem) { g.fillStyle = m.col; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5, y - 1); g.lineTo(x, y + 6); g.lineTo(x - 5, y - 1); g.closePath(); g.fill(); R('rgba(255,255,255,0.6)', -1, -4, 2, 3); return; }
    C('#7d8288', 0, 1, 5); C('#959aa0', -1, -1, 3); if (id !== 'stone') { R(m.col, -2, 0, 2, 2); R(m.col, 2, -1, 2, 2); R(m.col, 0, 3, 2, 1); } return; }
  if (id === 'bag') { R('#8a5a3a', -6, -3, 12, 10); R('#a8744a', -5, -2, 10, 3); R('#6b4a2b', -3, -6, 6, 3); R('#a8744a', -2, -5, 4, 1); R('#d4b06a', -1, 1, 2, 2); return; }
  if (id === 'bread') { R('#c98a3a', -6, -3, 12, 7); R('#e0a85a', -5, -4, 10, 2); R('#b07a2a', -3, -1, 1, 3); R('#b07a2a', 1, -1, 1, 3); return; }
  if (id === 'coffee') { R('#f2f2f2', -4, -3, 8, 8); R('#6b4a2b', -3, -2, 6, 2); R('#f2f2f2', 4, -1, 2, 3); R('rgba(255,255,255,0.6)', -1, -7, 1, 3); return; }
  if (id === 'pie') { R('#c98a3a', -6, 0, 12, 4); R('#e0a85a', -6, -2, 12, 3); R('#b0453a', -3, -2, 2, 1); R('#b0453a', 2, -1, 2, 1); return; }
  if (kind === 'deco') { g.save(); g.translate(x, y + 2); g.scale(k === 'car' || k === 'windmill' || k === 'hedge' || k === 'pond' ? 0.55 : 0.75, k === 'car' || k === 'windmill' || k === 'hedge' || k === 'pond' ? 0.55 : 0.75); drawItem(g, k, 0, 0, 0); g.restore(); return; }
  R('#888', -4, -4, 8, 8);
}
function iconCanvas(id, size = 32) {
  const c = document.createElement('canvas'); c.width = size; c.height = size; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.scale(size / 16, size / 16); drawIcon(g, id, 8, 8); c.setAttribute('aria-hidden', 'true'); return c;
}
function drawCrop(g, k, x, y, prog, t) {
  // x, y: centre-bottom of the tile
  const c = CROPS[k] || CROPS.parsnip, st = prog >= 1 ? 4 : Math.min(3, Math.floor(prog * 4));
  const R = (col, a, b, w, h) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
  const sway = Math.round(Math.sin(t / 700 + x) * 0.6);
  if (st === 0) { R('#4cc07a', -1, -3, 1, 2); R('#4cc07a', 1, -4, 1, 3); return; }
  if (st === 1) { R('#3fae6a', 0, -6, 1, 5); R('#4cc07a', -3 + sway, -6, 3, 2); R('#4cc07a', 1 + sway, -7, 3, 2); return; }
  const tall = c.tall ? 6 : 0;
  R('#2f8a52', 0, -9 - tall, 1, 8 + tall); R('#3fae6a', -4 + sway, -8 - tall, 4, 2); R('#3fae6a', 1 + sway, -10 - tall, 4, 2); R('#4cc07a', -3 + sway, -5, 3, 2); R('#4cc07a', 1 + sway, -6, 3, 2);
  if (st === 3) { R(c.col, -1 + sway, -12 - tall, 3, 2); return; }
  if (st === 4) {
    if (k === 'corn') { R('#f2d36b', 2, -14, 3, 7); R('#f2d36b', -4, -12, 3, 6); }
    else if (k === 'pumpkin' || k === 'melon') { g.fillStyle = c.col; g.beginPath(); g.ellipse(x, y - 4, 6, 4, 0, 0, Math.PI * 2); g.fill(); R('rgba(255,255,255,0.3)', -3, -7, 3, 1); R('#2f8a52', 0, -9, 1, 2); }
    else if (k === 'blueberry' || k === 'cranberry' || k === 'tomato' || k === 'strawberry' || k === 'snowpea') { for (const [a, b] of [[-4, -8], [2, -10], [-1, -5], [3, -6]]) { g.fillStyle = c.col; g.beginPath(); g.arc(x + a + sway, y + b, 1.6, 0, Math.PI * 2); g.fill(); } }
    else if (k === 'cauliflower' || k === 'kale' || k === 'sprouts') { g.fillStyle = c.col; g.beginPath(); g.arc(x, y - 7, 4.5, 0, Math.PI * 2); g.fill(); R('rgba(255,255,255,0.35)', -2, -10, 2, 1); }
    else { g.fillStyle = c.col; g.beginPath(); g.arc(x + sway, y - 9, 3, 0, Math.PI * 2); g.fill(); }
    if (Math.floor(t / 600 + x) % 7 === 0) { R('#ffffff', 4, -14 - tall, 1, 1); R('#fff2b0', 5, -15 - tall, 1, 1); }
  }
}
function drawTool(g, id, x, y, dir, phase) {
  // the tool in your hands while you use it; phase 0..1 through the swing
  g.save(); g.translate(x, y);
  const ang = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  if (id === 'can') { g.translate(ang * 7, dir === 'up' ? -6 : 2); g.rotate(ang * 0.6 * phase); drawIcon(g, 'can', 0, 0); if (phase > 0.4) { g.fillStyle = '#9fd3f0'; for (let i = 0; i < 4; i++) g.fillRect(6 + i, 2 + ((i * 3 + Math.floor(phase * 20)) % 6), 1, 2); } }
  else if (id === 'rod') { g.translate(ang * 4, -2); g.rotate((ang || 1) * (-0.9 + phase * 1.6)); drawIcon(g, 'rod', 0, -4); }
  else { const sw = -1.4 + phase * 2.2; g.translate(ang * 5, dir === 'up' ? -8 : 0); g.rotate(((ang || (dir === 'up' ? -1 : 1))) * sw); drawIcon(g, id, 4, -6); }
  g.restore();
}

/* ======================= sound (tiny synth; off until you tap) ======================= */
let actx = null, soundOn = true;
function sfx(kind) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), v = actx.createGain(), t0 = actx.currentTime;
    const P = { dig: ['square', 140, 90, 0.08, 0.06], water: ['sine', 700, 420, 0.12, 0.05], pick: ['square', 300, 120, 0.06, 0.06], coin: ['triangle', 880, 1320, 0.16, 0.07], bite: ['square', 990, 990, 0.08, 0.06], catch: ['triangle', 520, 1040, 0.3, 0.08], fail: ['sawtooth', 220, 110, 0.25, 0.05], pop: ['triangle', 600, 900, 0.07, 0.05], step: ['square', 90, 70, 0.02, 0.02], door: ['triangle', 330, 220, 0.12, 0.05], cast: ['sine', 400, 900, 0.15, 0.04] }[kind];
    if (!P) return;
    o.type = P[0]; o.frequency.setValueAtTime(P[1], t0); o.frequency.exponentialRampToValueAtTime(P[2], t0 + P[3]);
    v.gain.setValueAtTime(P[4], t0); v.gain.exponentialRampToValueAtTime(0.0001, t0 + P[3]);
    o.connect(v); v.connect(actx.destination); o.start(t0); o.stop(t0 + P[3] + 0.02);
  } catch (e) { soundOn = false; }
}

/* ======================= building the world ======================= */
// solid footprints of town decorations (relative to the item's x, y)
const FOOT = { tree: [-3, 2, 7, 6], pine: [-3, 3, 7, 5], autumn: [-3, 2, 7, 6], blossom: [-3, 2, 7, 6], rock: [-5, -3, 10, 7], stall: [-9, -2, 18, 9], statue: [-6, 2, 12, 6], well: [-7, -3, 14, 9], windmill: [-5, -6, 10, 14], hedge: [-12, -4, 24, 8], tent: [-9, -2, 18, 8], car: [-10, -3, 20, 8], fountain: [-8, -4, 16, 10], pond: [-14, -6, 28, 12], bench: [-7, -2, 14, 5], lamp: [-1, 4, 3, 4], mailbox: [-1, 2, 3, 4], sign: [-1, 2, 3, 4], flag: [-1, 4, 3, 3], table: [-9, -2, 18, 8], campfire: [-6, 0, 12, 5], snowman: [-5, -2, 10, 8], bush: [-5, -3, 10, 6] };
const inRect = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const inPond = (x, y, m = 0) => ((x - POND.x) / (POND.rx + m)) ** 2 + ((y - POND.y) / (POND.ry + m)) ** 2 < 1;
const onPath = (x, y) => PATHS.some(([a, b, w, h]) => x >= a - 6 && x < a + w + 6 && y >= b - 6 && y < b + h + 6);

function townHouses(agents) {
  // the same houses, in the same places and colours, as the village page
  let plot = 0;
  return agents.map(a => {
    const r = rng(a.id);
    const s = SPOTS[a.id] ? { ...SPOTS[a.id] } : (() => { const p = PLOTS[plot++ % PLOTS.length]; const n = Math.floor(r() * 10); return { x: p.x, y: p.y, w: 3, h: 3, wall: n % WALLS.length, roof: n % ROOFS.length }; })();
    const w = { ...s, x: s.x + OX / T, y: s.y + OY / T };
    return { a, spot: w, door: { x: (w.x + w.w / 2) * T, y: (w.y + w.h) * T } };
  });
}

function buildWorld(decor, houses) {
  const set = decor.settings || {}, G = GROUNDS[set.ground] || GROUNDS.grass, sea = season();
  const r = rng('nemora-world');
  const bg = document.createElement('canvas'); bg.width = WW; bg.height = WH; const g = bg.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let y = 0; y < HT; y++) for (let x = 0; x < WT; x++) {
    g.fillStyle = G[Math.floor(r() * 3)]; g.fillRect(x * T, y * T, T, T);
    if (r() < 0.25) { g.fillStyle = G[1]; g.fillRect(x * T + Math.floor(r() * 14), y * T + Math.floor(r() * 14), 2, 1); }
    if (r() < 0.07) { g.fillStyle = G[2]; g.fillRect(x * T + Math.floor(r() * 12), y * T + Math.floor(r() * 10), 1, 3); g.fillRect(x * T + Math.floor(r() * 12), y * T + Math.floor(r() * 10), 1, 2); }
  }
  // the hills and the mine
  g.fillStyle = '#8f8470'; g.fillRect(MOUNT.x, MOUNT.y, MOUNT.w, MOUNT.h);
  for (let i = 0; i < 260; i++) { g.fillStyle = ['#9d927c', '#83796a', '#a69b84'][i % 3]; g.fillRect(MOUNT.x + r() * MOUNT.w, r() * (MOUNT.h - 14), 2 + r() * 6, 2 + r() * 3); }
  g.fillStyle = '#6f6656'; g.fillRect(MOUNT.x, MOUNT.h - 12, MOUNT.w, 12);
  for (let x = MOUNT.x; x < WW; x += 5) { g.fillStyle = x % 10 ? '#5f5748' : '#7a705e'; g.fillRect(x, MOUNT.h - 12 + (x % 3), 2, 10); }
  g.fillStyle = '#5f5748'; g.fillRect(MOUNT.x - 3, 0, 3, MOUNT.h);
  // cave mouth
  g.fillStyle = '#4a4238'; g.beginPath(); g.ellipse(CAVE.x, CAVE.y - 8, 15, 15, 0, Math.PI, 0); g.fill(); g.fillRect(CAVE.x - 15, CAVE.y - 8, 30, 8);
  g.fillStyle = '#17130f'; g.beginPath(); g.ellipse(CAVE.x, CAVE.y - 6, 11, 12, 0, Math.PI, 0); g.fill(); g.fillRect(CAVE.x - 11, CAVE.y - 6, 22, 6);
  g.fillStyle = '#7a5a36'; g.fillRect(CAVE.x - 13, CAVE.y - 20, 2, 20); g.fillRect(CAVE.x + 11, CAVE.y - 20, 2, 20); g.fillRect(CAVE.x - 13, CAVE.y - 21, 26, 3);
  // the pond
  g.fillStyle = '#d9c08a'; g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx + 7, POND.ry + 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3d8fc9'; g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f7ab0'; g.beginPath(); g.ellipse(POND.x + 6, POND.y + 6, POND.rx - 26, POND.ry - 22, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2; g.fillStyle = '#3a7a32'; g.fillRect(POND.x + Math.cos(a) * (POND.rx - 4), POND.y + Math.sin(a) * (POND.ry - 4), 3, 2); }
  // paths
  for (const [x, y, w, h] of PATHS) { g.fillStyle = PAL.pathEdge; g.fillRect(x - 1, y - 1, w + 2, h + 2); }
  for (const [x, y, w, h] of PATHS) { g.fillStyle = PAL.path; g.fillRect(x, y, w, h); }
  for (let i = 0; i < 220; i++) { const [x, y, w, h] = PATHS[i % PATHS.length]; g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(x + r() * w, y + r() * h, 2, 1); }
  // the field: a little darker, with a fence and an opening at the top
  g.fillStyle = 'rgba(70,50,20,0.10)'; g.fillRect(FARM.x, FARM.y, FARM.w, FARM.h);
  g.fillStyle = PAL.fence;
  const fx0 = FARM.x - 4, fx1 = FARM.x + FARM.w + 2, fy0 = FARM.y - 6, fy1 = FARM.y + FARM.h + 2;
  for (let x = fx0; x <= fx1; x += 8) { if (x > FARM_GAP.x - 6 && x < FARM_GAP.x + FARM_GAP.w + 2) continue; g.fillRect(x, fy0 - 4, 2, 8); g.fillRect(x, fy1 - 4, 2, 8); }
  for (let y = fy0; y <= fy1; y += 8) { g.fillRect(fx0, y - 4, 2, 8); g.fillRect(fx1, y - 4, 2, 8); }
  g.fillRect(fx0, fy0 - 2, FARM_GAP.x - 6 - fx0, 2); g.fillRect(FARM_GAP.x + FARM_GAP.w + 2, fy0 - 2, fx1 - FARM_GAP.x - FARM_GAP.w, 2);
  g.fillRect(fx0, fy1 - 2, fx1 - fx0 + 2, 2); g.fillRect(fx0, fy0, 2, fy1 - fy0); g.fillRect(fx1, fy0, 2, fy1 - fy0);
  // the real town, exactly as the village page draws it
  const town = document.createElement('canvas'); town.width = TOWN_W; town.height = TOWN_H; drawGround(town.getContext('2d'), set.ground);
  g.drawImage(town, OX, OY);
  // a wooden sign at the crossroads
  return bg;
}

function buildScenery(decor, houses) {
  // trees round the edges and in a few groves, plus everything solid in the world
  const sea = season(), r = rng('nemora-trees'), trees = [];
  const treeKind = () => { const v = r(); if (sea === 'autumn' && v < 0.45) return 'autumn'; if (sea === 'spring' && v < 0.3) return 'blossom'; return v < 0.55 ? 'tree' : 'pine'; };
  const free = (x, y) => !(x > OX - 20 && x < OX + TOWN_W + 20 && y > OY - 20 && y < OY + TOWN_H + 14) && !onPath(x, y) && !inRect(x, y, { x: FARM.x - 24, y: FARM.y - 30, w: FARM.w + 48, h: FARM.h + 56 })
    && !inRect(x, y, { x: (HOME.x - 2) * T, y: (HOME.y - 2) * T, w: (HOME.w + 6) * T, h: (HOME.h + 4) * T }) && !inRect(x, y, { x: (SHOP.x - 1) * T, y: (SHOP.y - 2) * T, w: (SHOP.w + 2) * T, h: (SHOP.h + 4) * T })
    && !inPond(x, y, 26) && !inRect(x, y, { x: MOUNT.x - 12, y: 0, w: MOUNT.w + 12, h: MOUNT.h + 18 });
  for (let ty = 0; ty < HT; ty++) for (let tx = 0; tx < WT; tx++) {
    const x = tx * T + 8 + (r() - 0.5) * 6, y = ty * T + 10 + (r() - 0.5) * 6;
    const edge = tx < 2 || tx > WT - 3 || ty > HT - 3 || (ty < 2 && tx < 44);
    const grove = (tx < 19 && ty < 8) || (tx < 27 && ty > 35) || (tx > 34 && ty > 34) || (tx > 19 && tx < 44 && ty < 8) || (tx > 58 && ty > 9 && ty < 34);
    if (!free(x, y)) continue;
    if (edge || (grove && r() < 0.22)) trees.push({ k: treeKind(), x, y });
  }
  for (let i = 0; i < 40; i++) { const x = 30 + r() * (WW - 60), y = 130 + r() * (WH - 170); if (free(x, y) && r() < 0.6) trees.push({ k: r() < 0.5 ? 'flowers' : 'bush', x, y }); }
  // town decorations, in world coordinates
  const deco = (decor.items || STARTER_DECOR).map(it => ({ k: it.k, x: it.x + OX, y: it.y + OY, town: true }));
  const rects = [], doors = [];
  const add = (x, y, w, h) => rects.push({ x, y, w, h });
  for (const it of trees.concat(deco)) { const f = FOOT[it.k]; if (f) add(it.x + f[0], it.y + f[1], f[2], f[3]); }
  const building = (s, to, label) => { add(s.x * T, s.y * T + 4, s.w * T, s.h * T - 4); doors.push({ x: (s.x + s.w / 2) * T - 6, y: (s.y + s.h) * T - 4, w: 12, h: 6, to, label, out: { x: (s.x + s.w / 2) * T, y: (s.y + s.h) * T + 10 } }); };
  building(HOME, 'home', 'your farmhouse'); building(SHOP, 'shop', 'the general store');
  for (const h of houses) building(h.spot, 'house:' + h.a.id, h.a.name + '\'s house');
  // town fence (with its gate), the fountain in the square
  const fy = OY + TOWN_H - 14, gx = OX + GATE.x;
  add(OX, fy + 1, gx - 18 - OX, 5); add(gx + 18, fy + 1, OX + TOWN_W - gx - 18, 5);
  // the farm fence
  const fx0 = FARM.x - 4, fx1 = FARM.x + FARM.w + 2, fy0 = FARM.y - 6, fy1 = FARM.y + FARM.h + 2;
  add(fx0, fy0 - 3, FARM_GAP.x - 6 - fx0, 4); add(FARM_GAP.x + FARM_GAP.w + 2, fy0 - 3, fx1 - FARM_GAP.x - FARM_GAP.w, 4);
  add(fx0, fy1 - 3, fx1 - fx0 + 2, 4); add(fx0 - 1, fy0, 4, fy1 - fy0); add(fx1 - 1, fy0, 4, fy1 - fy0);
  add(BIN.x - 8, BIN.y - 4, 16, 8); add(MAILBOX.x - 2, MAILBOX.y + 2, 4, 4);
  add(MOUNT.x, 0, MOUNT.w, MOUNT.h - 4);
  doors.push({ x: CAVE.x - 8, y: CAVE.y - 8, w: 16, h: 6, to: 'mine', label: 'the mine', out: { x: CAVE.x, y: CAVE.y + 12 } });
  const circles = [{ x: OX + SQUARE.x, y: OY + SQUARE.y, r: 15 }];
  return { trees, deco, rects, doors, circles };
}

/* ======================= a new game, the mine, the rooms ======================= */
const firstSeeds = () => ({ spring: 'parsnip', summer: 'tomato', autumn: 'aubergine', winter: 'snowpea' })[season()];
function newSave() {
  const inv = Array(24).fill(null);
  ['hoe', 'can', 'pick', 'rod'].forEach((id, i) => { inv[i] = { id, n: 1 }; });
  inv[4] = { id: 'seed:' + firstSeeds(), n: 15 }; inv[5] = { id: 'bread', n: 3 };
  const r = rng('farm-debris'), debris = {};
  for (let ty = FARM.y / T; ty < (FARM.y + FARM.h) / T; ty++) for (let tx = FARM.x / T; tx < (FARM.x + FARM.w) / T; tx++) {
    if (tx * T >= FARM_GAP.x - 8 && tx * T < FARM_GAP.x + FARM_GAP.w + 8 && ty * T < FARM.y + 3 * T) continue;
    const v = r(); if (v < 0.11) debris[tx + ',' + ty] = 'weed'; else if (v < 0.17) debris[tx + ',' + ty] = 'rock';
  }
  return { v: 1, created: Date.now(), coins: 500, earnedTotal: 0, energy: 100, maxEnergy: 100, energyAt: Date.now(), slept: 0,
    look: { skin: 0, hair: 1, style: 0, shirt: 6, legs: 0, acc: 0, face: 3, outfit: 1, shoes: 0, pet: 0 },
    scene: 'world', x: (HOME.x + HOME.w / 2) * T, y: (HOME.y + HOME.h) * T + 12, facing: 'down',
    inv, sel: 0, bag: 24, tools: { hoe: 0, can: 0, pick: 0, rod: 0 }, water: 40,
    farm: { tiles: {}, debris }, mine: { deepest: 0 }, stats: { shipped: 0, fish: 0, crops: 0, ore: 0, caught: {} }, seenIntro: false, sound: true };
}
function genMine(floor) {
  const W = 20, H = 14, rocks = {}, tier = floor < 10 ? 0 : floor < 20 ? 1 : 2;
  const gems = ['quartz', 'amethyst', 'topaz'].concat(floor >= 10 ? ['emerald', 'ruby'] : []).concat(floor >= 20 ? ['diamond'] : []);
  let left = 0;
  for (let y = 3; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (Math.abs(x - 3) <= 1 && y <= 4) continue;
    if (Math.random() > 0.44) continue;
    const v = Math.random(); let k = 'stone', hp = 1;
    if (v < 0.015 + floor * 0.0009) { k = 'gem:' + gems[Math.floor(Math.random() * gems.length)]; hp = 3; }
    else if (floor >= 20 && v < 0.11) { k = 'gold'; hp = 4; }
    else if (floor >= 10 && v < 0.2) { k = 'iron'; hp = 3; }
    else if (v < 0.3 && floor < 30) { k = 'copper'; hp = 2; }
    else if (v < 0.35) { k = 'coal'; hp = 2; }
    rocks[x + ',' + y] = { k, hp, max: hp }; left++;
  }
  return { floor, w: W, h: H, rocks, up: { x: 3, y: 2 }, ladder: null, left, tier, seed: Math.random() };
}
function drawMineBg(m) {
  const c = document.createElement('canvas'); c.width = m.w * T; c.height = m.h * T; const g = c.getContext('2d'); const r = rng('mine' + m.floor + m.seed);
  const pal = [['#6b5a45', '#735f49', '#655441'], ['#4f5a66', '#56616d', '#4a545f'], ['#5a4a6a', '#614f72', '#544563']][m.tier];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { g.fillStyle = pal[Math.floor(r() * 3)]; g.fillRect(x * T, y * T, T, T); if (r() < 0.3) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x * T + r() * 12, y * T + r() * 12, 3, 2); } }
  g.fillStyle = '#2a241d'; g.fillRect(0, 0, m.w * T, 2 * T + 6); g.fillRect(0, 0, T, m.h * T); g.fillRect((m.w - 1) * T, 0, T, m.h * T); g.fillRect(0, (m.h - 1) * T, m.w * T, T);
  for (let x = T; x < (m.w - 1) * T; x += 4) { g.fillStyle = x % 8 ? '#3a3229' : '#463c31'; g.fillRect(x, 2 * T, 3, 6 + (x % 5)); }
  // the ladder back up
  const lx = m.up.x * T + 4, ly = m.up.y * T - 10; g.fillStyle = '#8a5a3a'; g.fillRect(lx, ly, 2, 22); g.fillRect(lx + 6, ly, 2, 22); for (let i = 0; i < 5; i++) g.fillRect(lx, ly + 2 + i * 4, 8, 1);
  return c;
}
function drawMineRock(g, x, y, k, hp, max) {
  const R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  const gem = k.startsWith('gem:'), col = gem ? MINERALS[k.slice(4)].col : (MINERALS[k] || MINERALS.stone).col;
  R('rgba(0,0,0,0.25)', -6, 3, 13, 3);
  g.fillStyle = gem ? '#6a5a7a' : '#7d8288'; g.beginPath(); g.ellipse(x, y, 7, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = gem ? '#8a7a9a' : '#959aa0'; g.beginPath(); g.ellipse(x - 1, y - 2, 5, 3, 0, 0, Math.PI * 2); g.fill();
  if (k !== 'stone') { R(col, -3, -1, 2, 2); R(col, 2, -3, 2, 2); R(col, 1, 2, 2, 1); if (gem) R('#ffffff', 2, -3, 1, 1); }
  if (hp < max) { g.strokeStyle = 'rgba(30,30,30,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 3, y - 4); g.lineTo(x, y); g.lineTo(x - 1, y + 3); g.stroke(); }
}
function drawHome(g, t, s) {
  g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, RW, 56); g.fillStyle = 'rgba(0,0,0,0.05)'; for (let x = 0; x < RW; x += 10) g.fillRect(x, 0, 1, 56);
  g.fillStyle = '#b98b5a'; g.fillRect(0, 56, RW, RH - 56); g.fillStyle = 'rgba(0,0,0,0.10)'; for (let y = 60; y < RH; y += 8) g.fillRect(0, y, RW, 1);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 55, RW, 2);
  const L = london(), night = L.h >= 19 || L.h < 7;
  g.fillStyle = '#6b4a2b'; g.fillRect(150, 10, 40, 30); g.fillStyle = night ? '#1d2448' : '#9fd3f0'; g.fillRect(152, 12, 36, 26); g.fillStyle = '#6b4a2b'; g.fillRect(169, 12, 2, 26); g.fillRect(152, 24, 36, 2);
  // calendar
  g.fillStyle = '#ffffff'; g.fillRect(70, 14, 22, 26); g.fillStyle = '#b0453a'; g.fillRect(70, 14, 22, 6); g.fillStyle = '#3b3f4a'; for (let i = 0; i < 12; i++) g.fillRect(72 + (i % 4) * 5, 23 + Math.floor(i / 4) * 5, 3, 3);
  drawItem(g, 'fireplace', 120, 50, t); drawItem(g, 'rug', 120, 112, t); drawItem(g, 'plant', 16, 64, t);
  // TV on a stand
  g.fillStyle = '#5a3b22'; g.fillRect(24, 74, 34, 8); drawItem(g, 'tv', 41, 72, t);
  // bed
  g.fillStyle = '#6b4a2b'; g.fillRect(186, 98, 44, 22); g.fillStyle = '#efe6d2'; g.fillRect(188, 96, 40, 16); g.fillStyle = '#d84f4f'; g.fillRect(196, 100, 32, 12); g.fillStyle = '#ffffff'; g.fillRect(189, 98, 8, 6);
  g.fillStyle = '#7a5236'; g.fillRect(104, 140, 32, 4);
}
function drawShopRoom(g, t) {
  g.fillStyle = '#efe0d0'; g.fillRect(0, 0, RW, 56); g.fillStyle = '#9a6e45'; g.fillRect(0, 56, RW, RH - 56);
  g.fillStyle = 'rgba(0,0,0,0.10)'; for (let y = 60; y < RH; y += 8) g.fillRect(0, y, RW, 1);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 55, RW, 2);
  // shelves of stock
  for (let s = 0; s < 3; s++) { const sx = 14 + s * 76; g.fillStyle = '#6b4a2b'; g.fillRect(sx, 8, 60, 44); for (let i = 0; i < 3; i++) { g.fillStyle = '#4a3220'; g.fillRect(sx + 2, 20 + i * 12, 56, 2); for (let j = 0; j < 7; j++) { g.fillStyle = ['#c9a26a', '#d84f4f', '#3fae6a', '#f2d36b', '#3f6fd8', '#e0802a', '#a86ae0'][(j + i + s) % 7]; g.fillRect(sx + 4 + j * 8, 12 + i * 12, 5, 8); } } }
  g.fillStyle = '#d4b06a'; g.fillRect(96, 2, 48, 8); g.fillStyle = '#17130a'; g.fillRect(100, 5, 40, 2);
  // sacks of seed
  for (const [x, c] of [[24, '#e0a33a'], [40, '#3fae6a'], [200, '#d84f4f'], [216, '#a86ae0']]) { g.fillStyle = '#c9a26a'; g.fillRect(x - 6, 100, 12, 14); g.fillStyle = c; g.fillRect(x - 4, 98, 8, 4); }
  // the counter, with the shopkeeper behind it
  g.save(); g.translate(120, 76); g.scale(2, 2); drawPerson(g, 0, 0, { skin: 2, hair: 4, style: 7, shirt: 3, legs: 0, acc: 6, face: 5, outfit: 4, shoes: 0, pet: 0 }, { t }); g.restore();
  g.fillStyle = '#7a5236'; g.fillRect(64, 80, 112, 12); g.fillStyle = '#5a3b22'; g.fillRect(64, 92, 112, 6); g.fillStyle = '#d4b06a'; g.fillRect(70, 82, 10, 3);
  g.fillStyle = '#7a5236'; g.fillRect(104, 140, 32, 4);
}

/* ======================= the game ======================= */
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmt = n => Math.floor(n).toLocaleString('en-GB');
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const ENERGY = { hoe: 2, can: 1, pick: 2, rod: 3 };
const ROOM_DOOR = { x: 120, w: 32 };

export async function startGame(opts) {
  const { api, onExit, onApprove } = opts;
  let agents = opts.agents || [], decor = opts.decor || {}, town = opts.town || {};
  let loaded = null;
  try { loaded = await api('admin/game'); } catch (e) { loaded = null; }
  if (!loaded) throw new Error('The game couldn\'t load your save. Check your connection and try again.');
  let S = loaded.save && loaded.save.v ? loaded.save : newSave(), rev = loaded.rev || 0, earnings = loaded.earnings || { total: 0, lines: [] };
  // older saves get anything added since
  const fresh = newSave(); for (const k of Object.keys(fresh)) if (S[k] === undefined) S[k] = fresh[k];
  for (const k of Object.keys(fresh.tools)) if (S.tools[k] === undefined) S.tools[k] = 0;
  while (S.inv.length < S.bag) S.inv.push(null);
  soundOn = S.sound !== false;
  let dirty = !loaded.save || !loaded.save.v, saving = false;

  /* ---------- the screen ---------- */
  if (!document.querySelector('link[data-game-css]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/admin/game.css?v=1'; l.dataset.gameCss = '1'; document.head.append(l); }
  const root = el('div', 'game'); root.setAttribute('role', 'application'); root.setAttribute('aria-label', 'NEMORA village game');
  const canvas = el('canvas', 'g-canvas'); canvas.setAttribute('aria-label', 'The village. Move with the arrow keys or WASD, Space to use your tool, E to talk or pick things up.');
  const hud = el('div', 'g-hud');
  const place = el('div', 'g-box g-where'), clock = el('div', 'g-clock'), placeName = el('div', 'g-place'); place.append(placeName, clock);
  const purse = el('div', 'g-box g-purse'), coinsEl = el('div', 'g-coins'), energyWrap = el('div', 'g-energy'), energyBar = el('i'), energyTxt = el('span', 'g-sr'); energyWrap.append(energyBar, energyTxt); energyWrap.setAttribute('role', 'meter'); energyWrap.setAttribute('aria-label', 'Energy');
  const waterEl = el('div', 'g-water'); purse.append(coinsEl, energyWrap, waterEl);
  const topBtns = el('div', 'g-topbtns');
  const bagBtn = el('button', 'g-btn', 'Bag'), menuBtn = el('button', 'g-btn', 'Menu'); bagBtn.type = menuBtn.type = 'button';
  topBtns.append(bagBtn, menuBtn); hud.append(place, purse, topBtns);
  const prompt = el('div', 'g-prompt'); prompt.hidden = true; prompt.setAttribute('aria-live', 'polite');
  const toasts = el('div', 'g-toasts'); toasts.setAttribute('aria-live', 'polite');
  const hotbar = el('div', 'g-hotbar'); hotbar.setAttribute('role', 'toolbar'); hotbar.setAttribute('aria-label', 'Toolbar');
  const touch = el('div', 'g-touch'), stick = el('div', 'g-stick'), knob = el('div', 'g-knob'); stick.append(knob);
  const useBtn = el('button', 'g-use', 'Use'), actBtn = el('button', 'g-act', 'A'); useBtn.type = actBtn.type = 'button'; useBtn.setAttribute('aria-label', 'Use tool'); actBtn.setAttribute('aria-label', 'Talk or pick up');
  touch.append(stick, actBtn, useBtn);
  const panel = el('div', 'g-panel'); panel.hidden = true;
  const fade = el('div', 'g-fade');
  root.append(canvas, hud, prompt, toasts, hotbar, touch, panel, fade);
  document.body.append(root); document.documentElement.classList.add('game-open');
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  root.classList.toggle('touch', isTouch);
  const g = canvas.getContext('2d');

  /* ---------- the world ---------- */
  let houses, bg, scen, people;
  function rebuild() {
    houses = townHouses(agents); bg = buildWorld(decor, houses); scen = buildScenery(decor, houses);
    const old = people || [];
    people = houses.map((h, i) => {
      const prev = old.find(p => p.a.id === h.a.id);
      const r = rng(h.a.id + Date.now()), m = mood(h.a);
      const start = m === 'hiring' ? { x: OX + GATE.x + (i % 3 - 1) * 12, y: OY + GATE.y - 4 } : { x: h.door.x, y: h.door.y + 9 };
      return prev ? { ...prev, a: h.a, m, spot: h.spot, door: h.door, look: lookOf(h.a) } : { a: h.a, m, spot: h.spot, door: h.door, x: start.x, y: start.y, tx: start.x, ty: start.y, wait: r() * 3000, moving: false, dir: 1, robot: h.a.kind === 'system', look: lookOf(h.a), r };
    });
  }
  rebuild();
  const set = decor.settings || {};
  const raining = () => set.weather === 'rain';

  /* ---------- you ---------- */
  const P = { x: S.x, y: S.y, facing: S.facing || 'down', moving: false, anim: null };
  let sc = { type: 'world' };       // where you are: world, home, shop, house, mine
  let mine = null, mineBg = null;
  if (S.scene !== 'world' || !Number.isFinite(P.x)) { P.x = fresh.x; P.y = fresh.y; }
  const pts = [], floats = [];
  let F = null;                      // fishing
  let paused = false, modal = null;

  /* ---------- controls ---------- */
  const keys = new Set(); let useHeld = false, joy = { x: 0, y: 0 };
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  function onKey(e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const down = e.type === 'keydown';
    if (modal) { if (down && e.code === 'Escape') { e.preventDefault(); closeModal(); } return; }
    if (KEYMAP[e.code]) { e.preventDefault(); down ? keys.add(KEYMAP[e.code]) : keys.delete(KEYMAP[e.code]); return; }
    if (['Space', 'KeyC', 'KeyJ'].includes(e.code)) { e.preventDefault(); if (down && !e.repeat) useDown(); if (!down) useUp(); return; }
    if (!down) return;
    if (['KeyE', 'KeyX', 'Enter', 'KeyK'].includes(e.code)) { e.preventDefault(); interact(); }
    else if (/^Digit[0-9]$/.test(e.code)) { const n = +e.code.slice(5); selectSlot(n === 0 ? 9 : n - 1); }
    else if (['KeyI', 'Tab', 'KeyQ'].includes(e.code)) { e.preventDefault(); openBag(); }
    else if (e.code === 'Escape') { e.preventDefault(); openMenu(); }
  }
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
  const blurKeys = () => { keys.clear(); if (useHeld) useUp(); };
  window.addEventListener('blur', blurKeys);
  // on-screen joystick: drag anywhere in its circle
  let stickId = null;
  const stickMove = e => { const b = stick.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, R = b.width / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } joy = { x: dx / R, y: dy / R }; knob.style.setProperty('transform', `translate(${dx}px, ${dy}px)`); };
  stick.addEventListener('pointerdown', e => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
  const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; joy = { x: 0, y: 0 }; knob.style.setProperty('transform', 'none'); };
  stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
  useBtn.addEventListener('pointerdown', e => { e.preventDefault(); useBtn.setPointerCapture(e.pointerId); useDown(); });
  useBtn.addEventListener('pointerup', () => useUp()); useBtn.addEventListener('pointercancel', () => useUp());
  actBtn.addEventListener('click', () => interact());
  bagBtn.addEventListener('click', () => openBag()); menuBtn.addEventListener('click', () => openMenu());
  root.addEventListener('contextmenu', e => e.preventDefault());

  /* ---------- the bag ---------- */
  const item = i => S.inv[i];
  const selected = () => S.inv[S.sel];
  function addItem(id, n = 1) {
    const info = itemInfo(id), stack = info.type !== 'tool';
    let left = n;
    if (stack) for (const s of S.inv) if (s && s.id === id && s.n < 99) { const k = Math.min(99 - s.n, left); s.n += k; left -= k; if (!left) break; }
    while (left > 0) { const i = S.inv.findIndex(s => !s); if (i < 0) break; const k = stack ? Math.min(99, left) : 1; S.inv[i] = { id, n: k }; left -= k; }
    dirty = true; drawHotbar();
    if (left > 0) { toast('Your bag is full.'); return false; }
    return true;
  }
  function takeItem(i, n = 1) { const s = S.inv[i]; if (!s) return; s.n -= n; if (s.n <= 0) S.inv[i] = null; dirty = true; drawHotbar(); }
  function selectSlot(i) { if (i < 0 || i >= 10) return; S.sel = i; dirty = true; drawHotbar(); }
  const slotEls = [];
  function drawHotbar() {
    if (!slotEls.length) for (let i = 0; i < 10; i++) { const b = el('button', 'g-slot'); b.type = 'button'; b.addEventListener('click', () => selectSlot(i)); hotbar.append(b); slotEls.push(b); }
    slotEls.forEach((b, i) => {
      const s = S.inv[i], key = s ? s.id + ':' + s.n : '';
      b.classList.toggle('on', S.sel === i); b.setAttribute('aria-pressed', S.sel === i ? 'true' : 'false');
      if (b.dataset.k === key) return; b.dataset.k = key;
      b.replaceChildren(); b.setAttribute('aria-label', (i + 1) + ': ' + (s ? itemInfo(s.id).name + (s.n > 1 ? ', ' + s.n : '') : 'empty'));
      if (s) { b.append(iconCanvas(s.id, 32)); if (s.n > 1) b.append(el('span', 'g-n', String(s.n))); if (TOOLS[s.id] && S.tools[s.id]) b.append(el('span', 'g-lv', TOOL_LV[S.tools[s.id]][0])); }
    });
  }

  /* ---------- messages on screen ---------- */
  function toast(text) { const t = el('div', 'g-toast', text); toasts.append(t); setTimeout(() => t.classList.add('out'), 2400); setTimeout(() => t.remove(), 2800); while (toasts.children.length > 3) toasts.firstChild.remove(); }
  function float(x, y, text, col) { floats.push({ x, y, text, col: col || '#ffffff', t0: performance.now() }); }
  function burst(x, y, col, n = 8) { for (let i = 0; i < n; i++) pts.push({ x, y, vx: (Math.random() - 0.5) * 0.12, vy: -Math.random() * 0.14, life: 500 + Math.random() * 300, t: 0, col }); }

  /* ---------- energy, time ---------- */
  function regen() { const now = Date.now(), k = Math.floor((now - (S.energyAt || now)) / 45000); if (k > 0) { S.energy = Math.min(S.maxEnergy, S.energy + k); S.energyAt += k * 45000; dirty = true; } }
  function spend(n) { if (S.energy < n) { toast('You\'re worn out. Eat something or have a sleep.'); return false; } S.energy -= n; if (S.energy < S.maxEnergy && !S.energyAt) S.energyAt = Date.now(); dirty = true; return true; }

  /* ---------- the field ---------- */
  const tileKey = (tx, ty) => tx + ',' + ty;
  const inFarm = (tx, ty) => tx * T >= FARM.x && tx * T < FARM.x + FARM.w && ty * T >= FARM.y && ty * T < FARM.y + FARM.h;
  function grow(tile, now = Date.now()) {
    const c = tile.crop; if (!c) return 0;
    if (raining()) tile.wet = Math.max(tile.wet || 0, now + 8 * 3600e3);
    const wetTill = Math.min(now, tile.wet || 0); if (wetTill > c.last) c.grown += wetTill - c.last;
    c.last = now; const need = CROPS[c.k].h * 3600e3; return Math.min(1, c.grown / need);
  }

  /* ---------- where things are ---------- */
  const feet = (x = P.x, y = P.y) => ({ x, y: y + 6 });
  const front = () => { const [dx, dy] = DIRS[P.facing]; const f = feet(); return { x: f.x + dx * 11, y: f.y + dy * 11 }; };
  function solidWorld(x, y) {
    if (x < 4 || y < 4 || x > WW - 4 || y > WH - 4) return true;
    for (const r of scen.rects) if (inRect(x, y, r)) return true;
    for (const c of scen.circles) if (Math.hypot(x - c.x, y - c.y) < c.r) return true;
    if (inPond(x, y)) return true;
    const tx = Math.floor(x / T), ty = Math.floor(y / T); if (S.farm.debris[tileKey(tx, ty)] === 'rock') return true;
    return false;
  }
  function roomSolids() {
    if (sc.type === 'home') return [{ x: 184, y: 94, w: 48, h: 28 }, { x: 22, y: 68, w: 38, h: 16 }];
    if (sc.type === 'shop') return [{ x: 62, y: 78, w: 116, h: 22 }, { x: 14, y: 96, w: 40, h: 20 }, { x: 190, y: 96, w: 40, h: 20 }];
    return [{ x: 76, y: 86, w: 56, h: 18 }, { x: 184, y: 94, w: 48, h: 28 }];
  }
  function blocked(x, y) {
    if (sc.type === 'world') { const pts4 = [[x - 4, y + 4], [x + 4, y + 4], [x - 4, y + 8], [x + 4, y + 8]]; return pts4.some(([a, b]) => solidWorld(a, b)); }
    if (sc.type === 'mine') {
      const pts4 = [[x - 4, y + 4], [x + 4, y + 4], [x - 4, y + 8], [x + 4, y + 8]];
      return pts4.some(([a, b]) => { const tx = Math.floor(a / T), ty = Math.floor(b / T); return tx < 1 || tx > mine.w - 2 || b < 2 * T + 4 || ty > mine.h - 2 || !!mine.rocks[tileKey(tx, ty)]; });
    }
    // rooms: people are drawn twice as big
    const fx0 = x - 7, fx1 = x + 7, fy0 = y + 10, fy1 = y + 16;
    if (fy0 < 64 || fx0 < 10 || fx1 > RW - 10) return true;
    if (fy1 > RH - 2 && Math.abs(x - ROOM_DOOR.x) > ROOM_DOOR.w / 2 - 6) return true;
    return roomSolids().some(r => fx1 > r.x && fx0 < r.x + r.w && fy1 > r.y && fy0 < r.y + r.h);
  }
  function doorAt(x, y) { if (sc.type !== 'world') return null; const f = { x, y: y + 4 }; return scen.doors.find(d => inRect(f.x, f.y, d) || inRect(f.x - 3, f.y, d) || inRect(f.x + 3, f.y, d)) || null; }

  /* ---------- going places ---------- */
  let fading = 0;
  function go(fn) { if (fading) return; fading = 1; fade.classList.add('on'); sfx('door'); setTimeout(() => { fn(); keys.clear(); setTimeout(() => { fade.classList.remove('on'); fading = 0; }, 60); }, 220); }
  let lastDoor = null;
  function enter(d) {
    F = null;
    if (d.to === 'mine') { return chooseFloor(); }
    go(() => {
      lastDoor = d;
      if (d.to === 'home') sc = { type: 'home' };
      else if (d.to === 'shop') sc = { type: 'shop' };
      else { const id = d.to.slice(6); const a = agents.find(x => x.id === id); sc = { type: 'house', a }; }
      P.x = ROOM_DOOR.x; P.y = RH - 30; P.facing = 'up'; updatePlace();
    });
  }
  function leave() {
    go(() => {
      const out = lastDoor ? lastDoor.out : { x: fresh.x, y: fresh.y };
      sc = { type: 'world' }; P.x = out.x; P.y = out.y; P.facing = 'down'; mine = null; updatePlace();
    });
  }
  function enterMine(floor) {
    go(() => {
      lastDoor = scen.doors.find(d => d.to === 'mine');
      mine = genMine(floor); mineBg = drawMineBg(mine); sc = { type: 'mine' };
      P.x = mine.up.x * T + 8; P.y = 3 * T - 4; P.facing = 'down';
      if (floor > S.mine.deepest) { S.mine.deepest = floor; dirty = true; }
      updatePlace(); toast('Floor ' + floor);
    });
  }
  function chooseFloor() {
    const deep = S.mine.deepest || 0, stops = [1]; for (let f = 5; f <= deep; f += 5) stops.push(f);
    if (stops.length === 1) return enterMine(1);
    dialog({ name: 'The lift', text: 'Which floor? You\'ve been down to floor ' + deep + '.', choices: stops.slice(-6).map(f => ({ label: 'Floor ' + f, fn: () => { closeModal(); enterMine(f); } })).concat([{ label: 'Not now', fn: closeModal }]) });
  }
  function updatePlace() {
    placeName.textContent = sc.type === 'world' ? (set.name || 'Nemoraville') : sc.type === 'home' ? 'Your farmhouse' : sc.type === 'shop' ? 'General store' : sc.type === 'mine' ? 'The mine · floor ' + mine.floor : (sc.a ? sc.a.name + '\'s house' : 'A house');
  }

  /* ---------- the person or thing in front of you ---------- */
  function target() {
    const f = front();
    if (sc.type === 'world') {
      let best = null, bd = 20;
      for (const p of people) { if (!visibleOutside(p)) continue; const d = Math.hypot(p.x - f.x, p.y + 2 - f.y); if (d < bd) { bd = d; best = p; } }
      if (best) return { kind: 'agent', p: best, label: 'Talk to ' + best.a.name };
      if (Math.hypot(BIN.x - f.x, BIN.y - f.y) < 16) return { kind: 'bin', label: 'Ship things to sell' };
      if (Math.hypot(MAILBOX.x - f.x, MAILBOX.y + 2 - f.y) < 14) return { kind: 'mail', label: earnings.total ? 'Open your post' : 'Check the post' };
      const tx = Math.floor(f.x / T), ty = Math.floor(f.y / T), tile = S.farm.tiles[tileKey(tx, ty)];
      if (tile && tile.crop && grow(tile) >= 1) return { kind: 'harvest', tx, ty, label: 'Pick the ' + CROPS[tile.crop.k].name.toLowerCase() };
      if (tile && tile.crop) return { kind: 'crop', tx, ty, tile, label: 'Look at the ' + CROPS[tile.crop.k].name.toLowerCase() };
      const it = scen.deco.find(d => Math.abs(d.x - f.x) < 9 && Math.abs(d.y - f.y) < 10);
      if (it) return { kind: 'deco', it, label: 'Pick up the ' + (TOWN_ITEMS.find(x => x[0] === it.k) || [, 'thing'])[1].toLowerCase() };
      if (inPond(f.x, f.y, 4) && selected() && selected().id === 'can') return null;
      return null;
    }
    if (sc.type === 'house' && sc.a) { const at = agentInRoom(sc.a); if (Math.hypot(P.x - at.x, P.y - at.y) < 46) return { kind: 'agent', p: { a: sc.a }, label: 'Talk to ' + sc.a.name }; return null; }
    if (sc.type === 'home') {
      if (Math.hypot(P.x - 206, P.y + 16 - 112) < 42) return { kind: 'bed', label: 'Sleep' };
      if (Math.hypot(P.x - 41, P.y + 16 - 88) < 30) return { kind: 'tv', label: 'Watch the NEMORA news' };
      if (Math.abs(P.x - 81) < 18 && P.y + 16 < 84) return { kind: 'calendar', label: 'Look at the calendar' };
      return null;
    }
    if (sc.type === 'shop') { if (Math.abs(P.x - 120) < 64 && P.y + 16 < 124 && P.facing === 'up') return { kind: 'shop', label: 'Shop' }; return null; }
    if (sc.type === 'mine') {
      const ft = feet(), tx = Math.floor(ft.x / T), ty = Math.floor(ft.y / T);
      if (Math.abs(tx - mine.up.x) <= 1 && ty <= mine.up.y + 1) return { kind: 'up', label: 'Climb back up' };
      if (mine.ladder && Math.abs(tx - mine.ladder.x) <= 0 && Math.abs(ty - mine.ladder.y) <= 0) return { kind: 'down', label: 'Climb down to floor ' + (mine.floor + 1) };
      if (mine.ladder) { const fr = front(); if (Math.floor(fr.x / T) === mine.ladder.x && Math.floor(fr.y / T) === mine.ladder.y) return { kind: 'down', label: 'Climb down to floor ' + (mine.floor + 1) }; }
    }
    return null;
  }
  const visibleOutside = p => !['busy', 'asleep'].includes(p.m);
  function agentInRoom(a) { const m = mood(a); if (m === 'asleep') return { x: 206, y: 96 }; if (['busy', 'trouble', 'stuck'].includes(m)) return { x: 94, y: 78 }; const t = performance.now(); return { x: 60 + Math.sin(t / 1400) * 18, y: 92 }; }

  function interact() {
    if (modal || fading || P.anim) return;
    if (F) { if (F.phase === 'bite') return useDown(); return; }
    const tg = target(); if (!tg) { const s = selected(); if (s && itemInfo(s.id).energy && !TOOLS[s.id]) return eat(S.sel); return; }
    sfx('pop');
    if (tg.kind === 'agent') return talkTo(tg.p.a);
    if (tg.kind === 'bin') return openBin();
    if (tg.kind === 'mail') return openMail();
    if (tg.kind === 'harvest') return harvest(tg.tx, tg.ty);
    if (tg.kind === 'crop') { const pr = grow(tg.tile), c = CROPS[tg.tile.crop.k], wet = (tg.tile.wet || 0) > Date.now(); const left = Math.max(0, c.h * 3600e3 - tg.tile.crop.grown); return toast(c.name + ': ' + Math.round(pr * 100) + '% grown' + (wet ? ', watered. About ' + niceTime(left) + ' to go.' : '. It needs water to grow.')); }
    if (tg.kind === 'deco') return pickUpDeco(tg.it);
    if (tg.kind === 'bed') return sleep();
    if (tg.kind === 'tv') return watchTv();
    if (tg.kind === 'calendar') { const L = london(); return dialog({ name: 'Calendar', text: L.wd + ' ' + L.day + ', ' + season() + '.\n\nCrops grow in real time while the soil is wet (watering lasts 8 hours; rain does it for you). Seeds only grow in their own season, and the shop sells what\'s in season now.', choices: [{ label: 'OK', fn: closeModal }] }); }
    if (tg.kind === 'shop') return openShop();
    if (tg.kind === 'up') return leave();
    if (tg.kind === 'down') return enterMine(mine.floor + 1);
  }
  const niceTime = ms => { const h = Math.floor(ms / 3600e3), m = Math.ceil((ms % 3600e3) / 60000); return h ? h + 'h ' + m + 'm' : m + ' min'; };

  /* ---------- using what's in your hand ---------- */
  function useDown() {
    useHeld = true;
    if (modal || fading) return;
    if (F) {
      if (F.phase === 'bite') { startReel(); return; }
      if (F.phase === 'wait') { toast('You reel in. Nothing yet.'); F = null; return; }
      return;
    }
    if (P.anim) return;
    const s = selected(); if (!s) return;
    if (s.id === 'rod') { if (sc.type !== 'world') return toast('There\'s nowhere to fish here. Try the pond.'); F = { phase: 'charge', p: 0, d: 1 }; return; }
    useItem(s);
  }
  function useUp() {
    useHeld = false;
    if (F && F.phase === 'charge') cast();
  }
  function swing(id, fn) { P.anim = { id, t0: performance.now(), dur: 320, fn, done: false }; }
  function useItem(s) {
    const info = itemInfo(s.id), f = front(), tx = Math.floor(f.x / T), ty = Math.floor(f.y / T), key = tileKey(tx, ty);
    if (s.id === 'hoe') {
      if (sc.type !== 'world') return;
      const deb = S.farm.debris[key];
      if (deb === 'rock') return toast('Break rocks with your pickaxe.');
      if (!inFarm(tx, ty)) return toast('Dig inside the fence on your farm.');
      if (!spend(deb ? 1 : ENERGY.hoe)) return;
      return swing('hoe', () => {
        if (deb === 'weed') { delete S.farm.debris[key]; burst(tx * T + 8, ty * T + 8, '#4cc07a'); sfx('dig'); if (Math.random() < 0.15) { addItem('seed:' + firstSeeds()); float(tx * T + 8, ty * T, '+1 seeds', '#f2d36b'); } return; }
        if (S.farm.tiles[key]) return;
        S.farm.tiles[key] = { till: 1, wet: 0 }; burst(tx * T + 8, ty * T + 10, '#7a5232', 6); sfx('dig'); dirty = true;
      });
    }
    if (s.id === 'can') {
      if (sc.type === 'world' && (inPond(f.x, f.y, 2) || inPond(f.x + DIRS[P.facing][0] * 8, f.y + DIRS[P.facing][1] * 8, 2))) { return swing('can', () => { S.water = CAN_SIZE[S.tools.can]; sfx('water'); toast('Watering can filled.'); drawHud(true); }); }
      if (sc.type !== 'world') return;
      const tile = S.farm.tiles[key]; if (!tile) return toast('Water dug soil, or fill up at the pond.');
      if (S.water <= 0) return toast('Your watering can is empty. Fill it at the pond.');
      if (!spend(ENERGY.can)) return;
      return swing('can', () => { grow(tile); tile.wet = Date.now() + 8 * 3600e3; S.water--; sfx('water'); burst(tx * T + 8, ty * T + 8, '#9fd3f0', 6); dirty = true; });
    }
    if (s.id === 'pick') {
      if (sc.type === 'world') {
        if (S.farm.debris[key] === 'rock') { if (!spend(ENERGY.pick)) return; return swing('pick', () => { delete S.farm.debris[key]; burst(tx * T + 8, ty * T + 8, '#9aa0a6', 10); sfx('pick'); addItem('stone'); float(tx * T + 8, ty * T, '+1 Stone'); dirty = true; }); }
        if (S.farm.tiles[key] && !S.farm.tiles[key].crop) { if (!spend(1)) return; return swing('pick', () => { delete S.farm.tiles[key]; sfx('dig'); }); }
        return;
      }
      if (sc.type === 'mine') {
        const rock = mine.rocks[key]; if (!rock) return;
        if (!spend(ENERGY.pick)) return;
        return swing('pick', () => {
          rock.hp -= PICK_POW[S.tools.pick]; sfx('pick'); burst(tx * T + 8, ty * T + 8, '#9aa0a6', 6);
          if (rock.hp > 0) return;
          delete mine.rocks[key]; mine.left--;
          const id = rock.k.startsWith('gem:') ? rock.k.slice(4) : rock.k, n = id === 'stone' ? 1 : (id === 'gold' || MINERALS[id].gem ? 1 : 1 + (Math.random() < 0.35 ? 1 : 0));
          addItem(id, n); S.stats.ore += n; float(tx * T + 8, ty * T, '+' + n + ' ' + MINERALS[id].name, MINERALS[id].gem ? MINERALS[id].col : '#ffffff');
          if (id === 'stone' && Math.random() < 0.06) addItem('coal');
          burst(tx * T + 8, ty * T + 8, MINERALS[id].col, 10);
          if (!mine.ladder && (mine.left <= 2 || Math.random() < 0.025 + 0.12 / Math.max(1, mine.left))) { mine.ladder = { x: tx, y: ty }; toast('You found a ladder down.'); sfx('coin'); }
          dirty = true;
        });
      }
      return;
    }
    if (info.type === 'seed') {
      if (sc.type !== 'world') return;
      const tile = S.farm.tiles[key]; if (!tile) return toast('Plant seeds in dug soil. Use your hoe first.');
      if (tile.crop) return toast('Something\'s already growing there.');
      const c = CROPS[info.crop]; if (!c.s.includes(season())) return toast(c.name + ' won\'t grow in ' + season() + '.');
      tile.crop = { k: info.crop, grown: 0, last: Date.now() }; takeItem(S.sel); sfx('pop'); burst(tx * T + 8, ty * T + 10, '#7a5232', 4); dirty = true; S.stats.planted = (S.stats.planted || 0) + 1;
      return;
    }
    if (info.type === 'deco') return placeDeco(s, f);
    if (info.energy) return eat(S.sel);
    if (info.type === 'mineral') return toast('Ship it in the bin by your farmhouse to sell it.');
  }
  function eat(i) {
    const s = S.inv[i]; if (!s) return; const info = itemInfo(s.id); if (!info.energy) return;
    if (S.energy >= S.maxEnergy) return toast('You\'re full of energy already.');
    S.energy = Math.min(S.maxEnergy, S.energy + info.energy); takeItem(i); sfx('pop'); float(P.x, P.y - 14, '+' + info.energy + ' energy', '#7fe08a'); dirty = true;
  }
  function harvest(tx, ty) {
    const key = tileKey(tx, ty), tile = S.farm.tiles[key], c = CROPS[tile.crop.k], n = c.yield || 1;
    if (!addItem('crop:' + tile.crop.k, n)) return;
    float(tx * T + 8, ty * T - 4, '+' + n + ' ' + c.name, '#f2d36b'); burst(tx * T + 8, ty * T + 6, c.col, 8); sfx('pop');
    S.stats.crops += n;
    if (c.re) tile.crop = { k: tile.crop.k, grown: (c.h - c.re) * 3600e3, last: Date.now() }; else delete tile.crop;
    dirty = true;
  }

  /* ---------- fishing ---------- */
  function cast() {
    const p = F.p, [dx, dy] = DIRS[P.facing], f = feet();
    const dist = 16 + p * 70, bx = f.x + dx * dist, by = f.y + dy * dist - (dy ? 0 : 2);
    if (!inPond(bx, by, -3)) { F = null; return toast(p < 0.25 ? 'Hold the button longer to cast further.' : 'Cast into the pond.'); }
    if (!spend(ENERGY.rod)) { F = null; return; }
    sfx('cast'); F = { phase: 'cast', t0: performance.now(), bx, by };
  }
  function pickFish() {
    const L = london(), night = L.h >= 19 || L.h < 6, sea = season();
    const pool = FISH.filter(f => (!f.night || night) && (!f.day || !night) && (!f.seasons || f.seasons.includes(sea)));
    const tot = pool.reduce((s, f) => s + f.w, 0); let v = Math.random() * tot;
    for (const f of pool) { v -= f.w; if (v <= 0) return f; } return pool[0];
  }
  function startReel() {
    const fish = pickFish(); sfx('pop');
    if (fish.junk) { addItem('fish:' + fish.k); float(P.x, P.y - 16, 'An old boot…', '#c8ccd2'); F = null; return; }
    const H = 140, bar = ROD_BAR[S.tools.rod];
    F = { phase: 'reel', fish, H, bar, barY: H - bar, barV: 0, fy: H / 2, fv: 0, tgt: H / 2, next: 0, prog: 0.3, t0: performance.now() };
  }
  function stepFish(dt, t) {
    if (!F) return;
    if (F.phase === 'charge') { F.p += F.d * dt * 0.0012; if (F.p >= 1) { F.p = 1; F.d = -1; } if (F.p <= 0) { F.p = 0; F.d = 1; } return; }
    if (F.phase === 'cast' && t - F.t0 > 450) { F.phase = 'wait'; F.until = t + 1800 + Math.random() * 6000; return; }
    if (F.phase === 'wait' && t > F.until) { F.phase = 'bite'; F.until = t + 950; sfx('bite'); return; }
    if (F.phase === 'bite' && t > F.until) { toast('It got away. Press as soon as you see the "!".'); F = null; return; }
    if (F.phase === 'reel') {
      const d = F.fish.diff;
      F.barV += (useHeld ? -0.0011 : 0.0009) * dt; F.barV = Math.max(-0.35, Math.min(0.35, F.barV)); F.barY += F.barV * dt;
      if (F.barY < 0) { F.barY = 0; F.barV *= -0.3; } if (F.barY > F.H - F.bar) { F.barY = F.H - F.bar; F.barV *= -0.3; }
      if (t > F.next) { F.tgt = 6 + Math.random() * (F.H - 12); F.next = t + 400 + Math.random() * (1600 - d * 10); }
      const sp = 0.02 + d / 1600; F.fv += Math.sign(F.tgt - F.fy) * sp * 0.02 * dt; F.fv *= 0.9; F.fy = Math.max(4, Math.min(F.H - 4, F.fy + F.fv * dt * 0.6 + (Math.random() - 0.5) * d / 40));
      const inBar = F.fy >= F.barY && F.fy <= F.barY + F.bar;
      F.prog += (inBar ? 0.00042 : -0.00030 - d / 500000) * dt;
      if (F.prog >= 1) { const fish = F.fish; F = null; if (addItem('fish:' + fish.k)) { S.stats.fish++; S.stats.caught[fish.k] = (S.stats.caught[fish.k] || 0) + 1; sfx('catch'); float(P.x, P.y - 18, 'You caught a ' + fish.name + '!', '#f2d36b'); burst(P.x, P.y - 4, '#9fd3f0', 12); dirty = true; } }
      else if (F.prog <= 0) { F = null; sfx('fail'); toast('The fish got away.'); }
    }
  }

  /* ---------- panels: dialogue, shop, bag, menus ---------- */
  function openModal(node, cls) {
    modal = node; keys.clear(); if (F && F.phase !== 'reel') F = null;
    panel.className = 'g-panel ' + (cls || ''); panel.replaceChildren(node); panel.hidden = false;
    requestAnimationFrame(() => { const f = panel.querySelector('[autofocus], input, textarea, button'); if (f) f.focus(); });
  }
  function closeModal() { modal = null; panel.hidden = true; panel.replaceChildren(); canvas.focus && canvas.focus(); drawHotbar(); }
  panel.addEventListener('pointerdown', e => { if (e.target === panel) closeModal(); });
  function head(title, sub) { const h = el('div', 'g-head'); h.append(el('h2', '', title)); if (sub) h.append(el('p', 'g-sub', sub)); const x = el('button', 'g-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', closeModal); h.append(x); return h; }
  function btn(label, fn, cls) { const b = el('button', 'g-b ' + (cls || ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; }

  // a talking box at the bottom, with the speaker's face, typed out a letter at a time
  function dialog({ look, robot, name, text, choices }) {
    const box = el('div', 'g-dialog');
    const face = el('div', 'g-face'); if (look) face.append(personIcon(look, 3)); else face.classList.add('none');
    const body = el('div', 'g-dbody'), nm = el('div', 'g-name', name || ''), tx = el('p', 'g-text'), ch = el('div', 'g-choices');
    body.append(nm, tx, ch); box.append(face, body);
    let i = 0, timer = null; const full = String(text || '');
    const finish = () => { clearInterval(timer); tx.textContent = full; ch.hidden = false; const b = ch.querySelector('button'); if (b) b.focus(); };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { tx.textContent = full; } else { ch.hidden = true; timer = setInterval(() => { i += 2; tx.textContent = full.slice(0, i); if (i >= full.length) finish(); }, 16); }
    tx.addEventListener('click', finish);
    for (const c of choices || [{ label: 'OK', fn: closeModal }]) ch.append(btn(c.label, c.fn, c.cls));
    openModal(box, 'bottom');
    box.addEventListener('keydown', e => { if (e.key === 'Enter' && ch.hidden) { e.preventDefault(); finish(); } });
  }

  /* ---------- your agents ---------- */
  function greeting(a) {
    const pe = a.personality || {}, m = mood(a), cp = pe.catchphrase ? pe.catchphrase + ' ' : '';
    const nextRun = a.next ? new Date(a.next).toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Europe/London' }) : '';
    if (a.kind === 'system') return 'Beep. I check every website and send out approved posts every 15 minutes. ' + (a.last_summary ? 'Last time: ' + a.last_summary : '');
    if (m === 'hiring') return 'Hello! I start tomorrow, once the Boss has set me up.';
    if (m === 'leaving') return 'I\'m packing up. It\'s been good working for you.';
    if (m === 'asleep') return 'Zzz… (' + a.name + ' is paused. Switch them back on in the village page.)';
    if (m === 'trouble') return 'Charlie! Something went wrong on my last run. ' + (a.last_summary || '');
    if (m === 'stuck') return 'I\'m stuck: ' + String(a.stuck).toLowerCase() + '. ' + (a.last_summary ? 'Last time: ' + a.last_summary : '');
    if (m === 'busy') return 'Can\'t stop, I\'m in the middle of a run! ' + (a.last_summary ? 'Last time: ' + a.last_summary : '');
    return cp + (a.last_summary ? 'Last time: ' + a.last_summary + ' ' : '') + (nextRun ? 'Back at my desk ' + nextRun + '.' : '');
  }
  function talkTo(a) {
    const choices = [];
    if ((a.approvals || []).length && onApprove) choices.push({ label: 'What needs my OK?', cls: 'gold', fn: () => { closeModal(); exit(() => onApprove(a)); } });
    if (a.kind !== 'system') {
      choices.push({ label: 'Chat', fn: () => ask(a, 'chat') });
      choices.push({ label: 'Give a job', fn: () => ask(a, 'task') });
      choices.push({ label: 'Any news?', fn: () => news(a) });
    }
    choices.push({ label: 'Bye', fn: closeModal });
    dialog({ look: lookOf(a), name: a.name + (a.role ? ' · ' + a.role : ''), text: greeting(a), choices });
  }
  function ask(a, kind) {
    const box = el('div', 'g-card');
    box.append(head(kind === 'task' ? 'A job for ' + a.name : 'Say something to ' + a.name, kind === 'task' ? 'They\'ll do it on their next run, within their job.' : null));
    const ta = el('textarea', 'g-input'); ta.rows = 3; ta.maxLength = 2000; ta.setAttribute('aria-label', 'Message to ' + a.name); ta.autofocus = true;
    const send = btn('Send', async () => {
      if (!ta.value.trim()) return; send.disabled = true; send.textContent = a.name + ' is thinking…';
      try {
        const r = await api('admin/agents/' + a.id + '/messages', { method: 'POST', body: { text: ta.value, kind } });
        a.unread_out = 0;
        dialog({ look: lookOf(a), name: a.name, text: r && r.quick ? r.quick : 'Got it. I\'ll reply properly on my next run' + (a.next ? ', ' + new Date(a.next).toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Europe/London' }) : '') + '.', choices: [{ label: 'Thanks', fn: closeModal }] });
      } catch (e) { send.disabled = false; send.textContent = 'Send'; toast(e.message || 'That didn\'t send. Try again.'); }
    }, 'gold');
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send.click(); });
    box.append(ta, el('div', 'g-row', null)); box.lastChild.append(send, btn('Cancel', closeModal));
    openModal(box);
  }
  async function news(a) {
    let msgs = [];
    try { msgs = ((await api('admin/agents/' + a.id + '/messages')).messages || []).filter(m => m.dir === 'out').slice(-3); } catch (e) {}
    a.unread_out = 0;
    const text = msgs.length ? msgs.map(m => m.text).join('\n\n') : (a.last_summary ? 'Nothing new for you. Last time: ' + a.last_summary : 'Nothing new yet.');
    dialog({ look: lookOf(a), name: a.name, text, choices: [{ label: 'Reply', fn: () => ask(a, 'chat') }, { label: 'Bye', fn: closeModal }] });
  }

  /* ---------- your farmhouse ---------- */
  function sleep() {
    const since = Date.now() - (S.slept || 0);
    if (since < 3 * 3600e3) return dialog({ name: 'Your bed', text: 'You\'re not sleepy yet. You can have a proper sleep again in ' + niceTime(3 * 3600e3 - since) + '.', choices: [{ label: 'OK', fn: closeModal }] });
    dialog({ name: 'Your bed', text: 'Have a sleep? You\'ll wake up with full energy.', choices: [{ label: 'Sleep', cls: 'gold', fn: () => { closeModal(); go(() => { S.energy = S.maxEnergy; S.energyAt = Date.now(); S.slept = Date.now(); dirty = true; save(true); toast('You feel rested. Energy full.'); }); } }, { label: 'Not now', fn: closeModal }] });
  }
  function watchTv() {
    const b = town.board || {}, n = v => v == null ? 'no data' : fmt(v);
    const lines = ['NEMORA news, ' + london().wd + '.', 'Emails sent today: ' + n(b.sent_today) + ' (' + n(b.sent_week) + ' this week).', 'Interested prospects: ' + n(b.interested) + '.', 'Posts live this week: ' + n(b.posts_week) + '.', 'Websites up: ' + (b.sites_live == null ? 'no data' : (b.sites_live - (b.sites_down || 0)) + ' of ' + b.sites_live) + '.'];
    dialog({ name: 'TV', text: lines.join('\n'), choices: [{ label: 'Turn it off', fn: closeModal }] });
  }

  /* ---------- the post: coins from real work ---------- */
  async function refreshEarnings() { try { const r = await api('admin/game'); earnings = r.earnings || earnings; } catch (e) {} }
  function openMail() {
    if (!earnings.total) return dialog({ name: 'Your post box', text: 'No post today. When your team sends emails, publishes posts, answers comments or wins clients, the Boss sends you coins here.', choices: [{ label: 'OK', fn: closeModal }] });
    const box = el('div', 'g-card g-letter');
    box.append(head(earnings.first ? 'Welcome to the village, Charlie' : 'A letter from the Boss', earnings.first ? 'Everything the team has done so far, paid in coins.' : 'Here\'s what the team did since you last checked.'));
    const ul = el('ul', 'g-lines');
    for (const l of earnings.lines) { const li = el('li'); li.append(el('span', '', l.label + (l.each ? ' × ' + l.n : '')), el('b', '', '+' + fmt(l.coins))); ul.append(li); }
    const tot = el('p', 'g-total'); tot.append(el('span', '', 'Total'), el('b', '', fmt(earnings.total) + ' coins'));
    const take = btn('Collect ' + fmt(earnings.total) + ' coins', async () => {
      take.disabled = true;
      try {
        await save(true);
        const r = await api('admin/game/claim', { method: 'POST' });
        if (r && r.save) { S.coins = r.save.coins; S.earnedTotal = r.save.earnedTotal; rev = r.rev; }
        sfx('coin'); toast('+' + fmt(r.total) + ' coins'); float(P.x, P.y - 16, '+' + fmt(r.total), '#f2d36b'); earnings = { total: 0, lines: [] }; closeModal(); drawHud(true);
      } catch (e) { take.disabled = false; toast(e.message || 'Couldn\'t collect. Try again.'); }
    }, 'gold');
    box.append(ul, tot, take); openModal(box);
  }

  /* ---------- the shipping bin ---------- */
  function openBin() {
    const box = el('div', 'g-card'); box.append(head('Shipping bin', 'Anything you put in is sold straight away.'));
    const list = el('div', 'g-list'); box.append(list);
    const draw = () => {
      list.replaceChildren();
      const rows = S.inv.map((s, i) => ({ s, i })).filter(({ s }) => s && !TOOLS[s.id] && itemInfo(s.id).sell > 0 && itemInfo(s.id).type !== 'deco');
      if (!rows.length) { list.append(el('p', 'g-sub', 'Nothing to sell. Grow crops, catch fish or mine ore, then bring them here.')); return; }
      for (const { s, i } of rows) {
        const info = itemInfo(s.id);
        const row = el('div', 'g-item'); row.append(iconCanvas(s.id, 32), el('span', 'g-iname', info.name + (s.n > 1 ? ' × ' + s.n : '')), el('span', 'g-price', fmt(info.sell) + ' each'));
        const sell = n => { S.coins += info.sell * n; S.stats.shipped += info.sell * n; takeItem(i, n); sfx('coin'); dirty = true; drawHud(true); draw(); };
        row.append(btn('Sell 1', () => sell(1)), s.n > 1 ? btn('Sell all', () => sell(S.inv[i] ? S.inv[i].n : 0)) : el('span'));
        list.append(row);
      }
      const bulk = rows.filter(({ s }) => ['crop', 'fish', 'mineral'].includes(itemInfo(s.id).type)), bulkSum = bulk.reduce((t, { s }) => t + itemInfo(s.id).sell * s.n, 0);
      if (bulk.length) list.append(btn('Sell all crops, fish and ore (' + fmt(bulkSum) + ' coins)', () => { for (const { s, i } of bulk) { if (!S.inv[i]) continue; S.coins += itemInfo(s.id).sell * S.inv[i].n; S.stats.shipped += itemInfo(s.id).sell * S.inv[i].n; S.inv[i] = null; } sfx('coin'); dirty = true; drawHud(true); drawHotbar(); draw(); }, 'gold wide'));
    };
    draw(); openModal(box);
  }

  /* ---------- the shop ---------- */
  let shopTab = 'seeds';
  function openShop() {
    const box = el('div', 'g-card g-shop'); box.append(head('General store', 'Coins: ' + fmt(S.coins)));
    const tabs = el('div', 'g-tabs'), list = el('div', 'g-list'); box.append(tabs, list);
    const sub = box.querySelector('.g-sub');
    const buy = (id, price, n = 1) => { if (S.coins < price) { toast('Not enough coins.'); sfx('fail'); return; } if (!addItem(id, n)) return; S.coins -= price; sfx('coin'); dirty = true; drawHud(true); sub.textContent = 'Coins: ' + fmt(S.coins); draw(); };
    const row = (id, label, note, price, fn, can = true) => { const r = el('div', 'g-item'); r.append(iconCanvas(id, 32), el('span', 'g-iname', label), el('span', 'g-price', note)); const b = btn(price == null ? 'Owned' : fmt(price) + ' c', fn); b.disabled = !can || price == null || S.coins < price; r.append(b); list.append(r); };
    const draw = () => {
      tabs.replaceChildren(...[['seeds', 'Seeds'], ['tools', 'Upgrades'], ['food', 'Food'], ['deco', 'Decorations']].map(([k, l]) => { const b = btn(l, () => { shopTab = k; draw(); }, shopTab === k ? 'on' : ''); b.setAttribute('aria-pressed', shopTab === k ? 'true' : 'false'); return b; }));
      list.replaceChildren();
      if (shopTab === 'seeds') {
        const sea = season(); list.append(el('p', 'g-sub', 'In season now: ' + sea + '. Each packet grows in real time; berries and some veg keep cropping.'));
        for (const [k, c] of Object.entries(CROPS).filter(([, c]) => c.s.includes(sea))) row('seed:' + k, itemInfo('seed:' + k).name, c.h + 'h to grow' + (c.re ? ', again every ' + c.re + 'h' : '') + ' · sells ' + c.sell, c.seed, () => buy('seed:' + k, c.seed));
        for (const [k, c] of Object.entries(CROPS).filter(([, c]) => c.s.includes(sea))) row('seed:' + k, '5 × ' + itemInfo('seed:' + k).name, 'Save a bit', c.seed * 5 - Math.round(c.seed * 0.5), () => buy('seed:' + k, c.seed * 5 - Math.round(c.seed * 0.5), 5));
      }
      if (shopTab === 'tools') {
        const up = (id, what) => { const lv = S.tools[id]; if (lv >= 3) return row(id, TOOL_LV[lv] + ' ' + TOOLS[id].toLowerCase(), 'The best there is', null, () => {}); row(id, TOOL_LV[lv + 1] + ' ' + TOOLS[id].toLowerCase(), what(lv + 1), TOOL_COST[lv + 1], () => { if (S.coins < TOOL_COST[lv + 1]) return; S.coins -= TOOL_COST[lv + 1]; S.tools[id] = lv + 1; if (id === 'can') S.water = CAN_SIZE[lv + 1]; sfx('coin'); dirty = true; drawHud(true); drawHotbar(); sub.textContent = 'Coins: ' + fmt(S.coins); draw(); }); };
        up('can', l => 'Holds ' + CAN_SIZE[l] + ' waterings'); up('pick', l => 'Breaks rocks ' + PICK_POW[l] + '× faster'); up('rod', l => 'A bigger catch bar: easier fish');
        if (S.bag < 36) row('bag', 'Bigger bag', '36 slots instead of 24', 2000, () => { if (S.coins < 2000) return; S.coins -= 2000; S.bag = 36; while (S.inv.length < 36) S.inv.push(null); sfx('coin'); dirty = true; drawHud(true); sub.textContent = 'Coins: ' + fmt(S.coins); draw(); });
        if (S.maxEnergy < 150) row('pie', 'Energy tonic', 'Raises your max energy by 25', 3000, () => { if (S.coins < 3000) return; S.coins -= 3000; S.maxEnergy += 25; S.energy += 25; sfx('coin'); dirty = true; drawHud(true); sub.textContent = 'Coins: ' + fmt(S.coins); draw(); });
      }
      if (shopTab === 'food') for (const [k, f] of Object.entries(FOOD)) row(k, f.name, '+' + f.energy + ' energy', f.price, () => buy(k, f.price));
      if (shopTab === 'deco') { list.append(el('p', 'g-sub', 'Buy something, then stand in town, pick it on your toolbar and press Use to put it down. It shows on the village page too.')); for (const [k, l] of TOWN_ITEMS) row('deco:' + k, l, 'For the town', DECO_PRICE[k] || 100, () => buy('deco:' + k, DECO_PRICE[k] || 100)); }
    };
    draw(); openModal(box);
  }

  /* ---------- decorating the town for real ---------- */
  async function saveDecor() {
    try { await api('admin/village', { method: 'PUT', body: { business: 'NEMORA', decor } }); return true; }
    catch (e) { toast('Couldn\'t save the town: ' + (e.message || 'try again')); return false; }
  }
  async function placeDeco(s, f) {
    if (sc.type !== 'world') return toast('Put decorations down in town.');
    const lx = Math.round(f.x - OX), ly = Math.round(f.y - OY);
    if (lx < 8 || ly < 8 || lx > TOWN_W - 8 || ly > TOWN_H - 18) return toast('Decorations go inside the town.');
    if (solidWorld(f.x, f.y) || Math.hypot(f.x - P.x, f.y - P.y - 6) < 6) return toast('There\'s something in the way.');
    const k = itemInfo(s.id).deco, items = (decor.items || STARTER_DECOR).slice();
    if (items.length >= 250) return toast('The town is full of decorations.');
    items.push({ k, x: lx, y: ly }); const prev = decor.items; decor.items = items;
    if (!(await saveDecor())) { decor.items = prev; return; }
    takeItem(S.sel); sfx('pop'); burst(f.x, f.y, '#f2d36b', 8); scen = buildScenery(decor, houses);
  }
  function pickUpDeco(it) {
    const name = (TOWN_ITEMS.find(x => x[0] === it.k) || [, 'thing'])[1];
    dialog({ name: 'Town decoration', text: 'Pick up the ' + name.toLowerCase() + '? It goes in your bag, and you can put it down somewhere else.', choices: [{ label: 'Pick it up', cls: 'gold', fn: async () => {
      closeModal();
      const items = (decor.items || STARTER_DECOR).slice(), i = items.findIndex(d => d.k === it.k && d.x + OX === it.x && d.y + OY === it.y); if (i < 0) return;
      if (!S.inv.some(s => !s) && !S.inv.some(s => s && s.id === 'deco:' + it.k && s.n < 99)) return toast('Your bag is full.');
      items.splice(i, 1); const prev = decor.items; decor.items = items;
      if (!(await saveDecor())) { decor.items = prev; return; }
      addItem('deco:' + it.k); sfx('pop'); scen = buildScenery(decor, houses);
    } }, { label: 'Leave it', fn: closeModal }] });
  }

  /* ---------- your bag ---------- */
  let pick = null;
  function openBag() {
    const box = el('div', 'g-card g-bag'); box.append(head('Your bag', 'Tap one thing, then another, to swap them. The top row is your toolbar.'));
    const grid = el('div', 'g-grid'), info = el('div', 'g-info'); box.append(grid, info);
    const draw = () => {
      grid.replaceChildren();
      S.inv.forEach((s, i) => {
        const b = el('button', 'g-slot' + (i < 10 ? ' bar' : '') + (pick === i ? ' on' : '')); b.type = 'button';
        b.setAttribute('aria-label', (s ? itemInfo(s.id).name + (s.n > 1 ? ', ' + s.n : '') : 'empty') + (i < 10 ? ' (toolbar ' + (i + 1) + ')' : ''));
        if (s) { b.append(iconCanvas(s.id, 32)); if (s.n > 1) b.append(el('span', 'g-n', String(s.n))); }
        b.addEventListener('click', () => { if (pick == null) { pick = s ? i : null; } else { const a = S.inv[pick]; S.inv[pick] = S.inv[i]; S.inv[i] = a; pick = null; dirty = true; } draw(); drawHotbar(); });
        grid.append(b);
      });
      info.replaceChildren();
      const s = pick != null ? S.inv[pick] : null;
      if (s) {
        const it = itemInfo(s.id); info.append(el('b', '', it.name), el('span', 'g-sub', [TOOLS[s.id] ? TOOL_LV[S.tools[s.id]] + ' tool' : '', it.sell ? 'Sells for ' + fmt(it.sell) : '', it.energy ? '+' + it.energy + ' energy' : ''].filter(Boolean).join(' · ')));
        const row = el('div', 'g-row');
        if (it.energy) row.append(btn('Eat', () => { eat(pick); pick = null; draw(); }));
        if (!TOOLS[s.id]) row.append(btn('Throw away', () => { S.inv[pick] = null; pick = null; dirty = true; draw(); drawHotbar(); }, 'quiet'));
        info.append(row);
      } else info.append(el('span', 'g-sub', 'Coins: ' + fmt(S.coins) + ' · Shipped so far: ' + fmt(S.stats.shipped) + ' · Fish caught: ' + S.stats.fish + ' · Deepest mine floor: ' + (S.mine.deepest || 0)));
    };
    pick = null; draw(); openModal(box);
  }

  /* ---------- the menu ---------- */
  function openMenu() {
    const box = el('div', 'g-card g-menu'); box.append(head('Menu'));
    const list = el('div', 'g-col');
    list.append(btn('Back to the game', closeModal, 'gold'), btn('How to play', howTo), btn('Change how you look', lookPanel), btn(soundOn ? 'Sound: on' : 'Sound: off', e => { soundOn = !soundOn; S.sound = soundOn; dirty = true; e.currentTarget.textContent = soundOn ? 'Sound: on' : 'Sound: off'; }),
      btn('Save now', async () => { await save(true); toast('Saved.'); }), btn('Start a new farm', restart, 'quiet'), btn('Leave the game', () => exit()));
    box.append(list); openModal(box);
  }
  function howTo() {
    dialog({ name: 'How to play', text: (isTouch ? 'Move with the stick. "Use" uses whatever you\'re holding, "A" talks, picks things up and opens doors you\'re facing. Tap the toolbar to change what you hold.' : 'Move with WASD or the arrow keys. Space uses whatever you\'re holding, E talks, picks things up and checks things. 1 to 0 pick from your toolbar, I opens your bag, Esc opens the menu.')
      + '\n\nYour farm is west of town: dig with the hoe, plant seeds, water them, and they grow in real time. Fish at the pond to the east (hold Use to cast, press when you see "!", then hold to keep the green bar on the fish). The mine is in the hills to the north-east. Sell things in the bin by your farmhouse, and check your post box: the Boss pays you coins for the real work your team does. Talk to any agent to chat or give them a job.', choices: [{ label: 'Got it', fn: closeModal }] });
  }
  function lookPanel() {
    const box = el('div', 'g-card'); box.append(head('How you look'));
    const pv = el('div', 'g-preview'), rows = el('div', 'g-col');
    const keysL = [['skin', 'Skin'], ['hair', 'Hair colour'], ['style', 'Hair'], ['face', 'Face'], ['outfit', 'Outfit'], ['shirt', 'Top colour'], ['legs', 'Trousers'], ['acc', 'Extra'], ['shoes', 'Shoes']];
    const draw = () => { pv.replaceChildren(personIcon(S.look, 4)); };
    for (const [k, l] of keysL) {
      const r = el('div', 'g-row'); const v = el('span', 'g-iname', l);
      r.append(btn('‹', () => { S.look[k] = (S.look[k] - 1 + LOOK[k].length) % LOOK[k].length; dirty = true; draw(); }), v, btn('›', () => { S.look[k] = (S.look[k] + 1) % LOOK[k].length; dirty = true; draw(); }));
      rows.append(r);
    }
    draw(); box.append(pv, rows, btn('Done', closeModal, 'gold')); openModal(box);
  }
  function restart() {
    dialog({ name: 'Start again?', text: 'This clears your farm, bag, coins and tools. Coins already collected for past work won\'t be paid again.', choices: [{ label: 'Yes, start again', cls: 'danger', fn: async () => {
      try { await api('admin/game/reset', { method: 'POST' }); const r = await api('admin/game'); rev = r.rev; earnings = r.earnings || earnings; } catch (e) { return toast('Couldn\'t reset. Try again.'); }
      S = newSave(); dirty = true; P.x = S.x; P.y = S.y; sc = { type: 'world' }; mine = null; closeModal(); await save(true); drawHotbar(); drawHud(true); updatePlace(); toast('A fresh start.');
    } }, { label: 'Keep my farm', fn: closeModal }] });
  }

  /* ---------- saving (to your login, so it follows you between phone and laptop) ---------- */
  async function save(force) {
    if (saving || (!dirty && !force)) return;
    saving = true;
    if (sc.type === 'world') { S.x = Math.round(P.x); S.y = Math.round(P.y); } else if (lastDoor) { S.x = lastDoor.out.x; S.y = lastDoor.out.y; }
    S.scene = 'world'; S.facing = P.facing;
    try {
      const r = await api('admin/game', { method: 'PUT', body: { data: S, rev } });
      if (r && r.rev) rev = r.rev; dirty = false;
    } catch (e) {
      if (e && e.status === 409 && e.data && e.data.save) { S = e.data.save; rev = e.data.rev; P.x = S.x; P.y = S.y; sc = { type: 'world' }; drawHotbar(); drawHud(true); toast('Loaded your newer save from another device.'); dirty = false; }
    } finally { saving = false; }
  }
  const saveTimer = setInterval(() => { regen(); save(); }, 20000);
  const vis = () => { if (document.visibilityState === 'hidden') save(); };
  document.addEventListener('visibilitychange', vis);
  // keep the village up to date while you play: who's working, replies, new hires
  const refreshTimer = setInterval(async () => {
    try { const d = await api('admin/agents'); const t = d.town || {}; for (const a of d.agents) { a.stuck = (t.stuck || {})[a.id] || ''; a.approvals = (t.approvals || {})[a.id] || []; } const ids = new Set(agents.map(a => a.id)); agents = d.agents.filter(a => ids.has(a.id) || a.status !== 'retired'); town = t; rebuild(); } catch (e) {}
    refreshEarnings();
  }, 120000);

  /* ---------- moving about ---------- */
  function step(dt, t) {
    stepFish(dt, t);
    if (P.anim) { const k = (t - P.anim.t0) / P.anim.dur; if (k >= 0.5 && !P.anim.done) { P.anim.done = true; P.anim.fn && P.anim.fn(); } if (k >= 1) P.anim = null; }
    let vx = 0, vy = 0;
    if (!modal && !fading && !P.anim && !(F && F.phase !== 'charge')) {
      if (keys.has('left')) vx -= 1; if (keys.has('right')) vx += 1; if (keys.has('up')) vy -= 1; if (keys.has('down')) vy += 1;
      if (Math.hypot(joy.x, joy.y) > 0.2) { vx = joy.x; vy = joy.y; }
    }
    const mag = Math.hypot(vx, vy);
    P.moving = mag > 0.1 && !(F && F.phase === 'charge');
    if (P.moving) {
      if (Math.abs(vx) > Math.abs(vy)) P.facing = vx > 0 ? 'right' : 'left'; else P.facing = vy > 0 ? 'down' : 'up';
      const room = !['world', 'mine'].includes(sc.type), sp = (room ? 0.11 : 0.075) * Math.min(1, mag) / Math.max(1, mag) * dt;
      const nx = P.x + vx * sp, ny = P.y + vy * sp;
      if (sc.type === 'world' && vy < 0) { const d = doorAt(P.x, ny); if (d) { enter(d); return; } }
      if (room && ny + 16 > RH - 2 && Math.abs(P.x - ROOM_DOOR.x) < ROOM_DOOR.w / 2 - 4 && vy > 0) { leave(); return; }
      if (!blocked(nx, P.y)) P.x = nx;
      if (!blocked(P.x, ny)) P.y = ny;
      P.stepT = (P.stepT || 0) + dt; if (P.stepT > 330) { P.stepT = 0; if (sc.type !== 'world') sfx('step'); }
    }
    // your agents wander town just like on the village page
    if (sc.type === 'world') for (const p of people) {
      p.m = mood(p.a);
      if (!visibleOutside(p) || ['trouble', 'hiring', 'leaving', 'stuck'].includes(p.m)) { p.moving = false; if (p.m !== 'hiring') { p.x = p.door.x; p.y = p.door.y + 9; } continue; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      const near = Math.hypot(p.x - P.x, p.y - P.y) < 22;
      if (near && !p.robot) { p.moving = false; p.dir = P.x > p.x ? 1 : -1; continue; }   // they stop to say hello
      if (d < 1) { p.moving = false; p.wait -= dt; if (p.wait <= 0) { const nt = wanderTo(p); p.tx = nt.x; p.ty = nt.y; p.wait = p.robot ? 300 : 1500 + p.r() * 4500; } }
      else { const v = (p.robot ? 0.03 : 0.022) * dt; p.x += dx / d * Math.min(v, d); p.y += dy / d * Math.min(v, d); p.moving = true; p.dir = dx > 0.2 ? 1 : dx < -0.2 ? -1 : p.dir; }
    }
    for (const q of pts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 0.0004 * dt; }
    for (let i = pts.length - 1; i >= 0; i--) if (pts[i].t > pts[i].life) pts.splice(i, 1);
    for (let i = floats.length - 1; i >= 0; i--) if (t - floats[i].t0 > 1400) floats.splice(i, 1);
  }
  function wanderTo(p) {
    const r = p.r(), SQ = { x: OX + SQUARE.x, y: OY + SQUARE.y };
    if (p.robot) { const ang = (performance.now() / 4000) % (Math.PI * 2); return { x: SQ.x + Math.cos(ang + 1) * 34, y: SQ.y + Math.sin(ang + 1) * 30 }; }
    if (r < 0.35) return { x: p.door.x + (p.r() - 0.5) * 30, y: p.door.y + 9 + p.r() * 10 };
    if (r < 0.8) { const ang = p.r() * Math.PI * 2; return { x: SQ.x + Math.cos(ang) * 32, y: SQ.y + Math.sin(ang) * 28 }; }
    return { x: OX + 20 + p.r() * (TOWN_W - 40), y: OY + 8.5 * T + (p.r() - 0.5) * 18 };
  }

  /* ---------- drawing ---------- */
  let dpr = 1, scale = 2, vw = 0, vh = 0, cssW = 0, cssH = 0;
  const shade = document.createElement('canvas'), sg = shade.getContext('2d');
  function resize() {
    cssW = root.clientWidth; cssH = root.clientHeight; dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    scale = Math.max(2, Math.min(4, Math.round(Math.min(cssW, cssH) / 200)));
    vw = cssW / scale; vh = cssH / scale;
  }
  const ro = new ResizeObserver(resize); ro.observe(root); resize();
  function darkness() {
    if (sc.type === 'mine') return 0.5;
    if (sc.type !== 'world') return 0;
    if (set.time === 'night') return 0.5; if (set.time === 'day') return 0; if (set.time === 'sunset') return 0.12;
    const L = london(), h = L.h + L.m / 60;
    if (h >= 21 || h < 5.5) return 0.52; if (h >= 18.5) return (h - 18.5) / 2.5 * 0.52; if (h < 7) return (7 - h) / 1.5 * 0.52; return 0;
  }
  const wr = rng('weather'), parts = set.weather && set.weather !== 'none' ? Array.from({ length: set.weather === 'rain' ? 150 : 80 }, () => ({ x: wr() * 400, y: wr() * 400, s: 0.5 + wr(), d: wr() * 6 })) : [];
  function render(t, dt) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = sc.type === 'mine' ? '#17130f' : sc.type === 'world' ? '#2a3a22' : '#1a1712'; g.fillRect(0, 0, canvas.width, canvas.height);
    const room = !['world', 'mine'].includes(sc.type);
    const sw = room ? RW : sc.type === 'mine' ? mine.w * T : WW, sh = room ? RH : sc.type === 'mine' ? mine.h * T : WH;
    let s = scale;
    if (room) s = Math.min(cssW / (RW + 8), (cssH - (isTouch ? 150 : 90)) / (RH + 8));
    const viewW = cssW / s, viewH = cssH / s;
    let cx = sw <= viewW ? (sw - viewW) / 2 : Math.max(0, Math.min(sw - viewW, P.x - viewW / 2));
    let cy = sh <= viewH ? (sh - viewH) / 2 - (room ? (isTouch ? 30 : 10) / s : 0) : Math.max(0, Math.min(sh - viewH, P.y - viewH / 2));
    cx = Math.round(cx * s) / s; cy = Math.round(cy * s) / s;
    g.setTransform(dpr * s, 0, 0, dpr * s, -cx * dpr * s, -cy * dpr * s);
    const draws = [], labels = [], inView = (x, y, m = 40) => x > cx - m && x < cx + viewW + m && y > cy - m && y < cy + viewH + m * 1.5;
    const L = london(), night = darkness() > 0.2;
    if (sc.type === 'world') {
      const sx = Math.max(0, Math.floor(cx)), sy = Math.max(0, Math.floor(cy)), w = Math.min(WW - sx, Math.ceil(viewW) + 2), h = Math.min(WH - sy, Math.ceil(viewH) + 2);
      g.drawImage(bg, sx, sy, w, h, sx, sy, w, h);
      // the square's fountain and the pond shimmer
      const SQ = { x: OX + SQUARE.x, y: OY + SQUARE.y };
      g.fillStyle = PAL.water[Math.floor(t / 400) % 2]; g.beginPath(); g.arc(SQ.x, SQ.y, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(SQ.x - 1, SQ.y - 6 - (Math.floor(t / 200) % 3), 2, 4);
      g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 8; i++) { const a = i * 0.8 + t / 3000, rr = 0.35 + (i % 4) * 0.14; g.fillRect(POND.x + Math.cos(a) * POND.rx * rr - 4, POND.y + Math.sin(a * 1.3) * POND.ry * rr, 7, 1); }
      // the field
      const now = Date.now();
      for (const [k, tile] of Object.entries(S.farm.tiles)) {
        const [tx, ty] = k.split(',').map(Number), x = tx * T, y = ty * T; if (!inView(x, y)) continue;
        const wet = (tile.wet || 0) > now || raining();
        g.fillStyle = wet ? '#5a3a22' : '#8a6038'; g.fillRect(x + 1, y + 1, T - 2, T - 2);
        g.fillStyle = wet ? '#4a2f1a' : '#7a5232'; g.fillRect(x + 2, y + 4, T - 4, 1); g.fillRect(x + 2, y + 9, T - 4, 1);
        if (tile.crop) { const pr = grow(tile, now); draws.push({ y: y + 14, f: () => drawCrop(g, tile.crop.k, x + 8, y + 14, pr, t) }); }
      }
      for (const [k, d] of Object.entries(S.farm.debris)) {
        const [tx, ty] = k.split(',').map(Number), x = tx * T + 8, y = ty * T + 10; if (!inView(x, y)) continue;
        if (d === 'rock') draws.push({ y, f: () => drawItem(g, 'rock', x, y - 1, 0) });
        else draws.push({ y, f: () => { g.fillStyle = '#3a7a32'; g.fillRect(x - 4, y - 2, 2, 4); g.fillRect(x - 1, y - 4, 2, 6); g.fillRect(x + 2, y - 3, 2, 5); g.fillStyle = '#4a8f3e'; g.fillRect(x - 1, y - 5, 2, 2); } });
      }
      for (const it of scen.trees) if (inView(it.x, it.y)) draws.push({ y: it.y, f: () => drawItem(g, it.k, it.x, it.y, night ? 1 : 0) });
      for (const it of scen.deco) if (inView(it.x, it.y)) draws.push({ y: it.y, f: () => drawItem(g, it.k, it.x, it.y, night ? 1 : 0) });
      // buildings: yours, the shop, and every agent's house
      const bld = (s2, o, after) => { if (inView(s2.x * T, s2.y * T, 120)) draws.push({ y: (s2.y + s2.h) * T - 1, f: () => { drawBuilding(g, s2, o, t); after && after(); } }); };
      bld(HOME, { lit: night }, () => { label(g, 'Home', (HOME.x + HOME.w / 2) * T, HOME.y * T - 2, t); });
      bld(SHOP, { lit: night }, () => { const x = (SHOP.x + SHOP.w / 2) * T, y = (SHOP.y + 1.6) * T; g.fillStyle = '#d4b06a'; g.fillRect(x - 16, y, 32, 7); g.fillStyle = '#17130a'; g.font = '600 5px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('STORE', x, y + 5.5); });
      const nearest = Math.min(...people.filter(visibleOutside).map(q => Math.hypot(q.x - P.x, q.y - P.y)), 99);
      for (const p of people) {
        const hs = (decor.houses || {})[p.a.id] || {};
        bld(p.spot, { lit: night && p.m !== 'asleep', wall: hs.wall != null ? WALLS[hs.wall] : null, roof: hs.roof != null ? ROOFS[hs.roof] : null, door: hs.door }, () => {
          if (p.m === 'busy') bubble(g, 'Working…', (p.spot.x + p.spot.w / 2) * T, p.spot.y * T - 2, '#ffffff', '#17130a');
          if (p.m === 'asleep') bubble(g, 'Zz', (p.spot.x + p.spot.w / 2) * T, p.spot.y * T - 2, '#26305c', '#ffffff');
        });
        if (!visibleOutside(p) || !inView(p.x, p.y)) continue;
        draws.push({ y: p.y + 6, f: () => {
          drawPerson(g, p.x, p.y, p.look, { t, moving: p.moving, dir: p.dir, robot: p.robot });
          if (p.m === 'stuck') drawCloud(g, p.x, p.y - 20, t);
          const near = Math.hypot(p.x - P.x, p.y - P.y) < 60;
          if ((p.a.approvals || []).length) bubble(g, '!', p.x, p.y - 14 + Math.round(Math.sin(t / 200)), '#ffe08a', '#17130a');
          else if (p.m === 'trouble') bubble(g, '!', p.x, p.y - 14, '#e0453a', '#ffffff');
          else if (p.a.unread_out) bubble(g, '✉', p.x, p.y - 14 + Math.round(Math.sin(t / 250)), '#ffffff', '#3d6db5');
          else if (p.m === 'hiring') bubble(g, 'Starts tomorrow', p.x, p.y - 14, '#ffffff', '#17130a');
          if (near && Math.hypot(p.x - P.x, p.y - P.y) === nearest) labels.push(() => label(g, p.a.name, p.x, p.y + 12, t));
        } });
        const pet = LOOK.pet[p.look.pet];
        if (pet && pet !== 'none' && !p.robot) { p.px = (p.px ?? p.x) + ((p.x - 8 * p.dir) - (p.px ?? p.x)) * Math.min(1, dt / 300); p.py = (p.py ?? p.y) + ((p.y + 4) - (p.py ?? p.y)) * Math.min(1, dt / 300); draws.push({ y: p.py + 3, f: () => drawPet(g, p.px, p.py, pet, t, p.moving) }); }
      }
      // the bin and the post box
      draws.push({ y: BIN.y + 4, f: () => { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(BIN.x - 8, BIN.y + 3, 17, 3); g.fillStyle = '#8a6240'; g.fillRect(BIN.x - 8, BIN.y - 5, 16, 9); g.fillStyle = '#6b4a2b'; g.fillRect(BIN.x - 9, BIN.y - 7, 18, 3); g.fillStyle = '#5a3b22'; for (let i = -6; i < 8; i += 4) g.fillRect(BIN.x + i, BIN.y - 4, 1, 7); } });
      draws.push({ y: MAILBOX.y + 6, f: () => { drawItem(g, 'mailbox', MAILBOX.x, MAILBOX.y, 0); if (earnings.total) bubble(g, '!', MAILBOX.x, MAILBOX.y - 10 + Math.round(Math.sin(t / 200)), '#ffe08a', '#17130a'); } });
    } else if (sc.type === 'mine') {
      g.drawImage(mineBg, 0, 0);
      if (mine.ladder) { const lx = mine.ladder.x * T, ly = mine.ladder.y * T; g.fillStyle = '#17130f'; g.fillRect(lx + 2, ly + 2, 12, 12); g.fillStyle = '#8a5a3a'; g.fillRect(lx + 4, ly + 2, 2, 12); g.fillRect(lx + 10, ly + 2, 2, 12); for (let i = 0; i < 3; i++) g.fillRect(lx + 4, ly + 4 + i * 4, 8, 1); }
      for (const [k, r] of Object.entries(mine.rocks)) { const [tx, ty] = k.split(',').map(Number); draws.push({ y: ty * T + 12, f: () => drawMineRock(g, tx * T + 8, ty * T + 9, r.k, r.hp, r.max) }); }
    } else {
      if (sc.type === 'home') drawHome(g, t, S); else if (sc.type === 'shop') drawShopRoom(g, t);
      else if (sc.a) { const style = (decor.rooms || {})[sc.a.id] || {}; drawRoom(g, sc.a, { floor: FLOORS[style.floor || 0], paper: PAPERS[style.paper || 0], items: style.items || [] }, t, false); g.fillStyle = '#7a5236'; g.fillRect(104, 140, 32, 4); g.fillStyle = '#d4b06a'; g.fillRect(14, 14, 50, 12); g.font = '700 6px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#17130a'; g.fillText(sc.a.name.length > 12 ? sc.a.name.slice(0, 11) + '…' : sc.a.name, 39, 22); }
    }
    // you
    const look = S.look;
    draws.push({ y: P.y + (room ? 16 : 6), f: () => {
      g.save(); g.translate(P.x, P.y); if (room) g.scale(2, 2);
      const back = P.facing === 'up', moving = P.moving;
      if (P.anim && P.facing !== 'down') drawTool(g, P.anim.id, 0, 0, P.facing, Math.min(1, (t - P.anim.t0) / P.anim.dur));
      drawPerson(g, 0, 0, look, { t, moving, dir: P.facing === 'left' ? -1 : 1 });
      if (back) { const hair = LOOK.hair[look.hair] || LOOK.hair[0]; g.fillStyle = hair; g.fillRect(-2, -8, 5, 5); }
      if (P.anim && P.facing === 'down') drawTool(g, P.anim.id, 0, 0, P.facing, Math.min(1, (t - P.anim.t0) / P.anim.dur));
      if (F && F.phase === 'charge') { g.fillStyle = '#17130a'; g.fillRect(-9, -24, 18, 4); g.fillStyle = F.p > 0.8 ? '#7fe08a' : '#f2d36b'; g.fillRect(-8, -23, Math.round(16 * F.p), 2); }
      if (F && F.phase === 'bite') bubble(g, '!', 0, -16, '#ffe08a', '#e0453a');
      g.restore();
    } });
    draws.sort((a, b) => a.y - b.y).forEach(d => d.f());
    // the line and the float
    if (F && (F.phase === 'cast' || F.phase === 'wait' || F.phase === 'bite' || F.phase === 'reel')) {
      const k = F.phase === 'cast' ? Math.min(1, (t - F.t0) / 450) : 1, [dx] = DIRS[P.facing];
      const rx = P.x + (dx || 1) * 9, ry = P.y - 12, bx = rx + (F.bx - rx) * k, by = ry + (F.by - ry) * k - Math.sin(k * Math.PI) * 24;
      const bob = F.phase === 'bite' ? Math.round(Math.sin(t / 60) * 1.5) + 1 : Math.round(Math.sin(t / 400));
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(rx, ry); g.quadraticCurveTo((rx + bx) / 2, Math.max(ry, by) + 8, bx, by + bob); g.stroke();
      g.fillStyle = '#ffffff'; g.fillRect(bx - 1, by - 2 + bob, 3, 2); g.fillStyle = '#e0453a'; g.fillRect(bx - 1, by + bob, 3, 2);
      if (F.phase === 'bite') { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(bx + 0.5, by + 2, 5 + (t % 300) / 60, 2, 0, 0, Math.PI * 2); g.fill(); }
    }
    // night, lamps and your lantern
    const dk = darkness();
    if (dk > 0) {
      const W2 = Math.ceil(viewW), H2 = Math.ceil(viewH); if (shade.width !== W2 || shade.height !== H2) { shade.width = W2; shade.height = H2; }
      sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, W2, H2); sg.fillStyle = sc.type === 'mine' ? `rgba(8,6,4,${dk})` : `rgba(12,16,48,${dk})`; sg.fillRect(0, 0, W2, H2);
      sg.globalCompositeOperation = 'destination-out';
      const light = (x, y, r, a = 1) => { const gr = sg.createRadialGradient(x - cx, y - cy, 0, x - cx, y - cy, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(x - cx - r, y - cy - r, r * 2, r * 2); };
      light(P.x, P.y, sc.type === 'mine' ? 78 : 46, 0.95);
      if (sc.type === 'world') {
        for (const it of scen.deco) if ((it.k === 'lamp' || it.k === 'campfire' || it.k === 'lights') && inView(it.x, it.y)) light(it.x, it.y - 6, 30, 0.9);
        for (const p of people) if (p.m !== 'asleep') light((p.spot.x + p.spot.w / 2) * T, (p.spot.y + p.spot.h) * T, 24, 0.7);
        light((HOME.x + HOME.w / 2) * T, (HOME.y + HOME.h) * T, 26, 0.7); light((SHOP.x + SHOP.w / 2) * T, (SHOP.y + SHOP.h) * T, 26, 0.7);
      }
      if (sc.type === 'mine') for (const [k, r] of Object.entries(mine.rocks)) if (r.k.startsWith('gem:')) { const [tx, ty] = k.split(',').map(Number); light(tx * T + 8, ty * T + 8, 12, 0.5); }
      g.save(); g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0); g.drawImage(shade, 0, 0); g.restore();
    }
    for (const q of pts) { g.fillStyle = q.col; g.globalAlpha = Math.max(0, 1 - q.t / q.life); g.fillRect(q.x, q.y, 2, 2); } g.globalAlpha = 1;
    for (const f of floats) { const k = (t - f.t0) / 1400; g.globalAlpha = Math.max(0, 1 - k * k); g.font = '700 6px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(f.text, f.x + 0.5, f.y - k * 16 + 0.5); g.fillStyle = f.col; g.fillText(f.text, f.x, f.y - k * 16); } g.globalAlpha = 1;
    labels.forEach(fn => fn());
    // weather (outside only)
    if (sc.type === 'world' && parts.length) {
      g.save(); g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      for (const q of parts) {
        if (set.weather === 'rain') { q.y += 0.35 * dt * q.s; q.x -= 0.05 * dt; g.fillStyle = 'rgba(180,210,240,0.6)'; g.fillRect(q.x % viewW, q.y % viewH, 1, 4); }
        else if (set.weather === 'snow') { q.y += 0.03 * dt * q.s; q.x += Math.sin(t / 900 + q.d) * 0.15; g.fillStyle = '#ffffff'; g.fillRect(((q.x % viewW) + viewW) % viewW, q.y % viewH, q.s > 1 ? 2 : 1, q.s > 1 ? 2 : 1); }
        else { q.y += 0.025 * dt * q.s; q.x += Math.sin(t / 700 + q.d) * 0.3; g.fillStyle = set.weather === 'petals' ? '#f7b7cf' : ['#d0702a', '#e8a03a', '#b0453a'][Math.floor(q.d) % 3]; g.fillRect(((q.x % viewW) + viewW) % viewW, q.y % viewH, 2, 1); }
      }
      if (set.weather === 'rain') { g.fillStyle = 'rgba(40,60,90,0.12)'; g.fillRect(0, 0, viewW, viewH); }
      g.restore();
    }
    // the fishing meter
    if (F && F.phase === 'reel') {
      g.save(); g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      const mx = Math.min(viewW - 34, viewW / 2 + 26), my = Math.max(10, viewH / 2 - F.H / 2 - 10);
      g.fillStyle = '#5a3b22'; g.fillRect(mx - 4, my - 4, 30, F.H + 8); g.fillStyle = '#2d4a6a'; g.fillRect(mx, my, 14, F.H);
      g.fillStyle = useHeld ? 'rgba(127,224,138,0.95)' : 'rgba(127,224,138,0.75)'; g.fillRect(mx + 1, my + F.barY, 12, F.bar);
      drawIcon(g, 'fish:' + F.fish.k, mx + 7, my + F.fy);
      g.fillStyle = '#17130a'; g.fillRect(mx + 17, my, 5, F.H); g.fillStyle = F.prog > 0.6 ? '#7fe08a' : F.prog > 0.3 ? '#f2d36b' : '#e0453a'; g.fillRect(mx + 18, my + F.H * (1 - F.prog), 3, F.H * F.prog);
      g.font = '700 6px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.fillText(isTouch ? 'Hold Use' : 'Hold Space', mx + 9, my + F.H + 13);
      g.restore();
    }
  }
  function bubble(c, text, x, y, bgc, fg) {
    c.font = '700 6px system-ui, sans-serif'; c.textAlign = 'center'; const w = Math.max(8, c.measureText(text).width + 6);
    c.fillStyle = bgc; c.fillRect(Math.round(x - w / 2), Math.round(y - 9), Math.round(w), 9); c.fillRect(Math.round(x - 1), Math.round(y), 3, 2);
    c.fillStyle = fg; c.fillText(text, x, y - 2.5);
  }
  function label(c, text, x, y) {
    c.font = '600 5.5px system-ui, sans-serif'; c.textAlign = 'center'; const w = c.measureText(text).width + 6;
    c.fillStyle = 'rgba(16,18,25,0.72)'; c.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), 8); c.fillStyle = '#ffffff'; c.fillText(text, x, y + 6);
  }

  /* ---------- the bits round the edge ---------- */
  let hudKey = '';
  function drawHud(force) {
    const L = london(), sel = selected();
    const key = [S.coins, Math.round(S.energy), S.maxEnergy, S.water, sel && sel.id, L.h, L.m, force ? Math.random() : 0].join('|');
    if (key === hudKey) return; hudKey = key;
    clock.textContent = L.wd + ' ' + L.day + ' · ' + String(L.h).padStart(2, '0') + ':' + String(L.m).padStart(2, '0') + ' · ' + season()[0].toUpperCase() + season().slice(1);
    coinsEl.textContent = fmt(S.coins);
    const pc = Math.max(0, Math.min(1, S.energy / S.maxEnergy)); energyBar.style.setProperty('transform', `scaleX(${pc})`); energyWrap.classList.toggle('low', pc < 0.25);
    energyTxt.textContent = Math.round(S.energy) + ' of ' + S.maxEnergy + ' energy'; energyWrap.setAttribute('aria-valuenow', String(Math.round(S.energy))); energyWrap.setAttribute('aria-valuemax', String(S.maxEnergy));
    waterEl.hidden = !(sel && sel.id === 'can'); waterEl.textContent = 'Water ' + S.water + '/' + CAN_SIZE[S.tools.can];
  }
  let promptKey = '';
  function drawPrompt() {
    let text = '';
    if (!modal && !F) { const tg = target(); if (tg) text = (isTouch ? 'A: ' : 'E: ') + tg.label; }
    if (F && F.phase === 'wait') text = 'Waiting for a bite…';
    if (F && F.phase === 'charge') text = 'Let go to cast';
    if (text === promptKey) return; promptKey = text; prompt.textContent = text; prompt.hidden = !text;
  }

  /* ---------- go ---------- */
  let raf = 0, last = performance.now(), alive = true;
  function frame(t) {
    if (!alive) return;
    const dt = Math.min(50, t - last); last = t;
    if (!modal || (F && F.phase === 'reel')) step(dt, t);
    render(t, dt); drawHud(); drawPrompt();
    raf = requestAnimationFrame(frame);
  }
  function exit(after) {
    alive = false; cancelAnimationFrame(raf); clearInterval(saveTimer); clearInterval(refreshTimer); ro.disconnect();
    window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', blurKeys); document.removeEventListener('visibilitychange', vis);
    save(true).finally(() => { root.remove(); document.documentElement.classList.remove('game-open'); (after || onExit || (() => {}))(); });
  }
  regen(); drawHotbar(); drawHud(true); updatePlace();
  // for automated tests only (?gamedebug in the address): lets a test move you about and read the state
  if (/[?&]gamedebug\b/.test(location.search)) window.__game = { get S() { return S; }, P, get sc() { return sc; }, get F() { return F; }, get mine() { return mine; }, get people() { return people; }, get modal() { return !!modal; }, enterMine, save, scen: () => scen };
  raf = requestAnimationFrame(frame);
  if (!S.seenIntro) {
    S.seenIntro = true; dirty = true;
    const lyn = agents.find(a => a.id === 'lyn'), boss = agents.find(a => a.id === 'boss'), guide = lyn || boss;
    setTimeout(() => dialog({ look: guide ? lookOf(guide) : null, name: guide ? guide.name : 'Welcome', text: 'Welcome to ' + (set.name || 'Nemoraville') + ', Charlie! This is your farm. Dig the field with your hoe, plant the seeds in your bag and water them: they grow in real time. The pond\'s east of town and the mine\'s up in the hills. Check your post box by the door: the Boss pays you coins for everything the team gets done for real.', choices: [{ label: 'Let\'s go', fn: closeModal }, { label: 'How do I play?', fn: howTo }] }), 400);
  } else if (earnings.total) setTimeout(() => toast('You\'ve got post: ' + fmt(earnings.total) + ' coins from the team.'), 600);
  return { exit };
}
