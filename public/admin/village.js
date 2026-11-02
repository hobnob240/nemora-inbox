// NEMORA village: a little pixel-art town where each AI agent lives, works and wanders.
// Everything is drawn in code (no image files). It shows real state: busy agents sit at their desk with the roof off
// so you can see them working, paused agents sleep, anyone who needs Charlie has a red "!", new hires wait at the gate.
// Charlie can decorate the town and each room, recolour houses, and dress each agent.
const W = 480, H = 272, T = 16;
const PAL = {
  grass: ['#5b8f3a', '#64983f', '#548536'], path: '#c9b38a', pathEdge: '#b39b70', stone: '#9aa0a6', stoneD: '#6f757c', water: ['#4aa3df', '#62b6ea'],
  tree: '#2f6b2a', treeL: '#3f8a36', trunk: '#6b4a2b', fence: '#8a6a43', flower: ['#f2d36b', '#f08aa0', '#ffffff', '#b98cf2'],
  night: 'rgba(16,22,58,0.38)', lit: '#ffd86b', dark: '#2a2f3d'
};
export const LOOK = {
  skin: ['#f1c7a3', '#e2ad86', '#c68a62', '#9a6243', '#6e432c'],
  hair: ['#2b2118', '#6b3f22', '#d8b25a', '#1a1a1a', '#a33b2b', '#dcdcdc', '#e06aa8', '#4a7be0'],
  style: ['short', 'long', 'bun', 'spiky', 'bald', 'cap', 'afro', 'ponytail', 'mohawk', 'curly'],
  face: ['none', 'beard', 'moustache', 'stubble', 'freckles', 'blush'],
  outfit: ['tshirt', 'hoodie', 'suit', 'dress', 'overalls', 'jumper', 'lab coat'],
  shoes: ['#2a2a2a', '#f2f2f2', '#8a5a3a', '#d84f4f'],
  pet: ['none', 'dog', 'cat', 'bird', 'fox', 'bunny', 'robot dog'],
  shirt: ['#3f6fd8', '#d84f4f', '#3fae6a', '#e0a33a', '#8a58d6', '#2fb3b3', '#2d2f38', '#f2f2f2'],
  legs: ['#2d3140', '#4a5a7a', '#6b4a2b', '#3a5a3a'],
  acc: ['none', 'glasses', 'headphones', 'hat', 'crown', 'bow', 'scarf', 'wizard hat', 'flower', 'earrings', 'cape', 'sunglasses']
};
export const WALLS = ['#e9dcc0', '#d9e4ef', '#efe0d0', '#f3d9e3', '#e6e0cf', '#e0efe6', '#c8ccd2', '#f6f0e1', '#e4d4f2', '#d8eec9'];
export const ROOFS = ['#b0453a', '#3d6db5', '#7a5236', '#a8487a', '#5a6b3a', '#3a8a6a', '#5b6270', '#2f2f38', '#c07a2a', '#7a5aa8'];
// town decorations and room furniture, each drawn in code
export const TOWN_ITEMS = [['tree', 'Tree'], ['pine', 'Pine tree'], ['bush', 'Bush'], ['flowers', 'Flowers'], ['bench', 'Bench'], ['lamp', 'Street lamp'], ['pond', 'Pond'], ['rock', 'Rock'], ['stall', 'Market stall'], ['statue', 'Statue'], ['mailbox', 'Mailbox'], ['sign', 'Signpost'], ['flag', 'Flag'], ['table', 'Picnic table'], ['cat', 'Cat'], ['car', 'Car'], ['well', 'Well'], ['campfire', 'Campfire'], ['tent', 'Tent'], ['windmill', 'Windmill'], ['hedge', 'Hedge'], ['mushrooms', 'Mushrooms'], ['autumn', 'Autumn tree'], ['blossom', 'Blossom tree'], ['lights', 'Fairy lights'], ['banner', 'Banner'], ['snowman', 'Snowman'], ['fountain', 'Small fountain']];
export const ROOM_ITEMS = [['plant', 'Plant'], ['rug', 'Rug'], ['shelf', 'Bookshelf'], ['lampf', 'Floor lamp'], ['sofa', 'Sofa'], ['picture', 'Picture'], ['trophy', 'Trophy'], ['coffee', 'Coffee machine'], ['cat', 'Cat'], ['board', 'Whiteboard'], ['clock', 'Clock'], ['bin', 'Bin'], ['aquarium', 'Fish tank'], ['guitar', 'Guitar'], ['cactus', 'Cactus'], ['poster', 'Poster'], ['beanbag', 'Bean bag'], ['fridge', 'Fridge'], ['fireplace', 'Fireplace'], ['piano', 'Piano'], ['tv', 'TV'], ['gamechair', 'Gaming chair'], ['dog', 'Dog bed'], ['globe', 'Globe']];
export const GROUNDS = { grass: ['#5b8f3a', '#64983f', '#548536'], autumn: ['#8a8f3a', '#9a8a3f', '#7a7a36'], snow: ['#e8eef2', '#f4f7f9', '#dfe7ec'], sand: ['#d9c08a', '#e2cb96', '#cfb47c'], night: ['#2f5a3a', '#35643f', '#2a5236'] };
export const WEATHERS = [['none', 'Clear'], ['rain', 'Rain'], ['snow', 'Snow'], ['leaves', 'Falling leaves'], ['petals', 'Blossom']];
export const TIMES = [['auto', 'Real time'], ['day', 'Always day'], ['sunset', 'Sunset'], ['night', 'Always night']];
export const FLOORS = ['#b98b5a', '#9a6e45', '#d2b48c', '#8f8f96', '#6d7fa0', '#c9a2a2'];
export const PAPERS = ['#efe6d2', '#dfe9f2', '#f2e1dc', '#e3f0e0', '#ece2f3', '#2f3445'];

const SPOTS = {
  boss: { x: 12.5, y: 1, w: 5, h: 4, wall: 0, roof: 0, flag: true },
  outreach: { x: 2, y: 2, w: 4, h: 3, wall: 1, roof: 1 },
  replies: { x: 7, y: 2, w: 3, h: 3, wall: 2, roof: 2 },
  social: { x: 20, y: 2, w: 4, h: 3, wall: 3, roof: 3 },
  guides: { x: 3, y: 10, w: 4, h: 3, wall: 4, roof: 4 },
  care: { x: 22, y: 10, w: 4, h: 3, wall: 5, roof: 5 },
  autopilot: { x: 25.5, y: 3, w: 2, h: 3, wall: 6, roof: 6, tower: true },
  lyn: { x: 17.5, y: 10, w: 4, h: 3, wall: 8, roof: 9, flag: true }
};
const PLOTS = [{ x: 8.5, y: 10 }, { x: 26, y: 12.5 }, { x: 1.5, y: 6.5 }, { x: 26, y: 7.5 }, { x: 12, y: 12.5 }, { x: 19.5, y: 6.5 }];
const GATE = { x: 14.5 * T, y: 16.2 * T };
const SQUARE = { x: 15 * T, y: 8.5 * T };

function rng(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
// an agent's look: saved JSON, or a number from the early version
export function lookOf(a) {
  let l = null; try { l = typeof a.look === 'string' && a.look.startsWith('{') ? JSON.parse(a.look) : null; } catch (e) {}
  if (l) return { skin: +l.skin || 0, hair: +l.hair || 0, style: +l.style || 0, shirt: +l.shirt || 0, legs: +l.legs || 0, acc: +l.acc || 0, face: +l.face || 0, outfit: +l.outfit || 0, shoes: +l.shoes || 0, pet: +l.pet || 0 };
  if (a.id === 'lyn') return { skin: 1, hair: 4, style: 7, shirt: 4, legs: 0, acc: 1, face: 5, outfit: 5, shoes: 0, pet: 2 };
  const n = Number(a.look) || [...String(a.id)].reduce((s, c) => s + c.charCodeAt(0), 0);
  return { skin: n % 5, hair: (n * 7 + 2) % 6, style: a.id === 'boss' ? 0 : n % 4, shirt: n % 6, legs: 0, acc: a.id === 'boss' ? 4 : 0, face: a.id === 'boss' ? 1 : 0, outfit: a.id === 'boss' ? 2 : 0, shoes: 0, pet: 0 };
}

/* ---------- drawing ---------- */
function drawGround(g, ground) {
  const r = rng('nemora'), G = GROUNDS[ground] || GROUNDS.grass;
  for (let y = 0; y < H / T + 1; y++) for (let x = 0; x < W / T; x++) { g.fillStyle = G[Math.floor(r() * 3)]; g.fillRect(x * T, y * T, T, T); if (r() < 0.25) { g.fillStyle = G[1]; g.fillRect(x * T + Math.floor(r() * 14), y * T + Math.floor(r() * 14), 2, 1); } }
  const path = (x, y, w, h) => { g.fillStyle = PAL.pathEdge; g.fillRect(x - 1, y - 1, w + 2, h + 2); g.fillStyle = PAL.path; g.fillRect(x, y, w, h); };
  path(0, 7.5 * T, W, 2 * T); path(14 * T, 5 * T, 2 * T, H - 5 * T);
  for (const s of Object.values(SPOTS)) if (s.y < 7) path((s.x + s.w / 2 - 0.5) * T, (s.y + s.h) * T, T, 7.5 * T - (s.y + s.h) * T);
  for (const s of [SPOTS.guides, SPOTS.care]) path((s.x + s.w / 2 - 0.5) * T, 9.5 * T, T, s.y * T - 9.5 * T);
  g.fillStyle = PAL.pathEdge; g.beginPath(); g.arc(SQUARE.x, SQUARE.y, 44, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.path; g.beginPath(); g.arc(SQUARE.x, SQUARE.y, 42, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.stoneD; g.beginPath(); g.arc(SQUARE.x, SQUARE.y, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.stone; g.beginPath(); g.arc(SQUARE.x, SQUARE.y, 14, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.fence; for (let x = 0; x < W; x += 6) { if (Math.abs(x - GATE.x) < 18) continue; g.fillRect(x, H - 14, 2, 10); } g.fillRect(0, H - 11, GATE.x - 18, 2); g.fillRect(GATE.x + 18, H - 11, W, 2);
  g.fillStyle = '#7a5a36'; g.fillRect(GATE.x - 20, H - 22, 3, 18); g.fillRect(GATE.x + 17, H - 22, 3, 18); g.fillStyle = '#e9dcc0'; g.fillRect(GATE.x - 14, H - 30, 28, 8); g.fillStyle = PAL.dark; g.fillRect(GATE.x - 11, H - 27, 22, 1); g.fillRect(GATE.x - 11, H - 25, 16, 1);
}
// a few starter trees so a fresh town isn't bare; Charlie's own decorations replace them once he decorates
export const STARTER_DECOR = [['tree', 40, 30], ['tree', 180, 40], ['pine', 300, 36], ['tree', 440, 110], ['bush', 30, 190], ['flowers', 150, 175], ['tree', 300, 200], ['flowers', 420, 230], ['pine', 90, 240], ['bench', 205, 118], ['lamp', 275, 112], ['tree', 455, 30], ['bush', 335, 175]].map(([k, x, y]) => ({ k, x, y }));

export function drawItem(g, k, x, y, t = 0) {
  x = Math.round(x); y = Math.round(y);
  const R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  const C = (c, a, b, r) => { g.fillStyle = c; g.beginPath(); g.arc(x + a, y + b, r, 0, Math.PI * 2); g.fill(); };
  switch (k) {
    case 'tree': R('rgba(0,0,0,.2)', -6, 7, 13, 3); R(PAL.trunk, -1, 2, 3, 7); C(PAL.tree, 0, -2, 7); C(PAL.treeL, -2, -4, 4); break;
    case 'pine': R('rgba(0,0,0,.2)', -5, 7, 11, 3); R(PAL.trunk, -1, 4, 3, 5); for (let i = 0; i < 4; i++) R(i % 2 ? '#2a5e2a' : '#336f30', -2 - i * 2, -8 + i * 3, 5 + i * 4, 3); break;
    case 'bush': C('#3a7a32', 0, 0, 5); C('#4a8f3e', -3, -1, 3); C('#4a8f3e', 3, -1, 3); break;
    case 'flowers': [['#f2d36b', -4, 0], ['#f08aa0', 0, -2], ['#ffffff', 3, 1], ['#b98cf2', -1, 3], ['#f08aa0', 4, -3]].forEach(([c, a, b]) => { R('#3a7a32', a, b + 1, 1, 2); R(c, a - 1, b - 1, 3, 2); }); break;
    case 'bench': R('rgba(0,0,0,.2)', -7, 4, 15, 2); R('#7a5236', -7, -2, 14, 2); R('#8a6240', -7, 1, 14, 2); R('#4a4a4a', -6, 3, 1, 3); R('#4a4a4a', 5, 3, 1, 3); break;
    case 'lamp': R('rgba(0,0,0,.2)', -3, 8, 7, 2); R('#3b3f4a', 0, -10, 1, 18); R('#3b3f4a', -2, -12, 5, 2); R(t ? PAL.lit : '#fff2b0', -1, -11, 3, 2); break;
    case 'pond': g.fillStyle = '#3d8fc9'; g.beginPath(); g.ellipse(x, y, 14, 7, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#62b6ea'; g.beginPath(); g.ellipse(x - 3, y - 2, 6, 2, 0, 0, Math.PI * 2); g.fill(); R('#3a7a32', 9, -4, 3, 2); break;
    case 'rock': C('#7d8288', 0, 0, 5); C('#959aa0', -1, -2, 3); break;
    case 'stall': R('rgba(0,0,0,.2)', -9, 7, 19, 3); R('#8a6240', -8, -2, 16, 9); for (let i = 0; i < 4; i++) R(i % 2 ? '#ffffff' : '#d84f4f', -10 + i * 5, -8, 5, 5); R('#f2d36b', -5, 0, 3, 2); R('#3fae6a', 1, 0, 3, 2); break;
    case 'statue': R('rgba(0,0,0,.2)', -6, 8, 13, 2); R('#9aa0a6', -6, 3, 12, 5); R('#b8bdc2', -2, -9, 4, 12); C('#b8bdc2', 0, -11, 3); break;
    case 'mailbox': R('#6b4a2b', 0, -2, 1, 9); R('#d84f4f', -3, -7, 7, 5); R('#ffffff', 2, -6, 1, 1); break;
    case 'sign': R('#6b4a2b', 0, -4, 1, 11); R('#e9dcc0', -6, -9, 13, 6); R(PAL.dark, -4, -7, 9, 1); R(PAL.dark, -4, -5, 6, 1); break;
    case 'flag': R('#6b4a2b', 0, -14, 1, 21); R('#d4b06a', 1, -14 + Math.round(Math.sin(t / 300)), 8, 5); break;
    case 'table': R('rgba(0,0,0,.2)', -8, 5, 17, 2); R('#8a6240', -8, -2, 16, 3); R('#7a5236', -9, 2, 2, 4); R('#7a5236', 7, 2, 2, 4); R('#e0564e', -3, -3, 4, 1); break;
    case 'cat': R('#3a3a3a', -3, -1, 6, 4); R('#3a3a3a', 2, -4, 3, 3); R('#3a3a3a', 2, -5, 1, 1); R('#3a3a3a', 4, -5, 1, 1); R('#f2d36b', 3, -3, 1, 1); R('#3a3a3a', -5, -3 + Math.round(Math.sin(t / 250)), 1, 3); break;
    case 'car': R('rgba(0,0,0,.25)', -10, 4, 21, 3); R('#d84f4f', -10, -3, 20, 7); R('#b03a3a', -6, -7, 11, 4); R('#9fd3f0', -4, -6, 3, 2); R('#9fd3f0', 1, -6, 3, 2); C('#222', -6, 4, 2); C('#222', 6, 4, 2); break;
    case 'well': R('rgba(0,0,0,.2)', -7, 6, 15, 2); C('#7d8288', 0, 2, 7); C('#2d4a6a', 0, 2, 4); R('#6b4a2b', -7, -10, 1, 12); R('#6b4a2b', 6, -10, 1, 12); R('#b0453a', -9, -12, 19, 3); break;
    case 'campfire': R('#6b4a2b', -6, 3, 12, 2); R('#6b4a2b', -4, 1, 8, 2); { const f = Math.floor(t / 120) % 3; R('#e0563a', -3, -2 - f, 6, 4 + f); R('#f2a13a', -2, -1 - f, 4, 3); R('#ffe08a', -1, 0, 2, 2); } break;
    case 'tent': R('rgba(0,0,0,.2)', -10, 6, 21, 2); for (let i = 0; i < 12; i++) R(i % 4 < 2 ? '#3fae6a' : '#2f8a52', -1 - Math.floor(i * 0.8), -6 + i, 3 + Math.floor(i * 1.6), 1); R('#1d3a2a', -1, 2, 3, 4); break;
    case 'windmill': R('#e9dcc0', -4, -6, 9, 14); R('#b0453a', -5, -9, 11, 3); { const a = t / 600; g.strokeStyle = '#6b4a2b'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + Math.cos(a + i * Math.PI / 2) * 10, y - 6 + Math.sin(a + i * Math.PI / 2) * 10); g.stroke(); } } R('#5a3b22', -1, 3, 3, 5); break;
    case 'hedge': R('#2f6b2a', -12, -4, 24, 8); R('#3f8a36', -12, -4, 24, 2); break;
    case 'mushrooms': R('#f2f2f2', -3, 0, 1, 3); R('#d84f4f', -5, -2, 5, 2); R('#f2f2f2', 2, 1, 1, 2); R('#d84f4f', 1, 0, 3, 1); break;
    case 'autumn': R('rgba(0,0,0,.2)', -6, 7, 13, 3); R(PAL.trunk, -1, 2, 3, 7); C('#d0702a', 0, -2, 7); C('#e8a03a', -2, -4, 4); break;
    case 'blossom': R('rgba(0,0,0,.2)', -6, 7, 13, 3); R(PAL.trunk, -1, 2, 3, 7); C('#f0a0c0', 0, -2, 7); C('#fbd0e0', -2, -4, 4); break;
    case 'lights': R('#3b3f4a', -14, -6, 1, 14); R('#3b3f4a', 14, -6, 1, 14); for (let i = 0; i < 9; i++) R(['#f2d36b', '#f08aa0', '#62b6ea', '#3fae6a'][(i + Math.floor(t / 400)) % 4], -12 + i * 3, -5 + Math.round(Math.sin(i / 8 * Math.PI) * 3), 2, 2); break;
    case 'banner': R('#6b4a2b', -10, -12, 1, 20); R('#6b4a2b', 10, -12, 1, 20); R('#d4b06a', -9, -11, 19, 6); R('#17130a', -6, -9, 13, 1); break;
    case 'snowman': C('#f4f7f9', 0, 2, 5); C('#f4f7f9', 0, -5, 3); R('#1a1a1a', -1, -6, 1, 1); R('#1a1a1a', 1, -6, 1, 1); R('#e07a2a', 0, -5, 2, 1); R('#d84f4f', -3, -3, 6, 1); break;
    case 'fountain': C('#7d8288', 0, 2, 8); C(PAL.water[Math.floor(t / 400) % 2], 0, 2, 6); R('#9aa0a6', -1, -5, 2, 7); R('#ffffff', 0, -7 - (Math.floor(t / 200) % 2), 1, 2); break;
    // room furniture
    case 'aquarium': R('#3b3f4a', -11, -2, 22, 2); R('#62b6ea', -10, -12, 20, 10); R('#3fae6a', -8, -6, 1, 4); R('#3fae6a', 6, -7, 1, 5); R('#f2a13a', -4 + Math.round(Math.sin(t / 700) * 4), -9, 3, 2); R('#f08aa0', 2 - Math.round(Math.sin(t / 900) * 3), -5, 2, 1); break;
    case 'guitar': R('#b07a4a', -3, -2, 6, 7); R('#6b4a2b', -1, -1, 2, 2); R('#6b4a2b', 0, -12, 1, 10); R('#3b3f4a', -1, -13, 3, 2); break;
    case 'cactus': R('#8a5a3a', -3, 2, 6, 5); R('#3fae6a', -1, -8, 3, 10); R('#3fae6a', -4, -5, 2, 4); R('#3fae6a', 3, -6, 2, 3); break;
    case 'poster': R('#2d2f38', -7, -10, 14, 18); R('#d84f4f', -5, -8, 10, 6); R('#f2d36b', -5, 0, 10, 2); R('#f2f2f2', -5, 4, 7, 1); break;
    case 'beanbag': g.fillStyle = '#e0a33a'; g.beginPath(); g.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f0b84a'; g.beginPath(); g.ellipse(x - 2, y - 2, 5, 3, 0, 0, Math.PI * 2); g.fill(); break;
    case 'fridge': R('#dfe3e8', -6, -18, 12, 24); R('#c8ccd2', -6, -9, 12, 1); R('#9aa0a6', 3, -15, 1, 4); R('#9aa0a6', 3, -6, 1, 5); break;
    case 'fireplace': R('#8a5a3a', -14, -14, 28, 20); R('#2d2f38', -8, -6, 16, 12); { const f = Math.floor(t / 120) % 3; R('#e0563a', -5, 1 - f, 10, 5 + f); R('#f2a13a', -3, 2 - f, 6, 4); } R('#6b4a2b', -16, -16, 32, 3); break;
    case 'piano': R('#1a1a1a', -14, -10, 28, 14); R('#f2f2f2', -12, -2, 24, 4); for (let i = 0; i < 8; i++) R('#1a1a1a', -11 + i * 3, -2, 1, 2); R('#1a1a1a', -13, 4, 2, 4); R('#1a1a1a', 11, 4, 2, 4); break;
    case 'tv': R('#2d2f38', -12, -14, 24, 15); R(['#62b6ea', '#3fae6a', '#e0a33a'][Math.floor(t / 1500) % 3], -10, -12, 20, 11); R('#2d2f38', -1, 1, 2, 3); R('#2d2f38', -6, 4, 12, 2); break;
    case 'gamechair': R('#d84f4f', -5, -14, 10, 12); R('#1a1a1a', -3, -12, 6, 8); R('#d84f4f', -6, -2, 12, 4); R('#3b3f4a', -1, 2, 2, 4); R('#3b3f4a', -5, 6, 10, 1); break;
    case 'dog': g.fillStyle = '#8a5a3a'; g.beginPath(); g.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); g.fill(); R('#b07a4a', -5, -3, 9, 4); R('#b07a4a', 3, -5, 3, 3); R('#1a1a1a', 4, -4, 1, 1); break;
    case 'globe': R('#6b4a2b', -4, 4, 8, 2); R('#6b4a2b', 0, 0, 1, 4); C('#3d8fc9', 0, -4, 5); R('#3fae6a', -2, -6, 3, 2); R('#3fae6a', 1, -3, 2, 2); break;
    // room furniture (originals)
    case 'plant': R('#8a5a3a', -3, 2, 6, 6); C('#3fae6a', 0, -2, 5); C('#4cc07a', -2, -4, 3); break;
    case 'rug': g.fillStyle = '#b0453a'; g.fillRect(x - 18, y - 8, 36, 16); g.fillStyle = '#d4b06a'; g.fillRect(x - 15, y - 5, 30, 10); g.fillStyle = '#b0453a'; g.fillRect(x - 11, y - 2, 22, 4); break;
    case 'shelf': R('#6b4a2b', -9, -16, 18, 24); for (let i = 0; i < 3; i++) { R('#4a3220', -8, -14 + i * 8, 16, 1); ['#d84f4f', '#3f6fd8', '#3fae6a', '#e0a33a', '#8a58d6'].forEach((c, j) => R(c, -7 + j * 3, -20 + i * 8 + 8, 2, 5)); } break;
    case 'lampf': R('#3b3f4a', 0, -12, 1, 20); R('#3b3f4a', -3, 7, 7, 1); R('#f6e6b0', -4, -16, 9, 5); break;
    case 'sofa': R('#3f6fd8', -14, -6, 28, 6); R('#5a86e6', -14, -1, 28, 6); R('#3f6fd8', -16, -4, 3, 10); R('#3f6fd8', 13, -4, 3, 10); break;
    case 'picture': R('#6b4a2b', -7, -6, 14, 11); R('#9fd3f0', -6, -5, 12, 9); R('#3fae6a', -6, 0, 12, 4); C('#f2d36b', 3, -2, 2); break;
    case 'trophy': R('#6b4a2b', -3, 3, 6, 2); R('#e8c35a', -1, 0, 2, 3); R('#e8c35a', -4, -6, 8, 6); R('#fff2b0', -3, -5, 2, 2); break;
    case 'coffee': R('#2d2f38', -5, -8, 10, 14); R('#5b6270', -4, -6, 8, 4); R('#ffffff', -2, 1, 4, 3); R('#6b4a2b', -1, 2, 2, 1); break;
    case 'board': R('#c8ccd2', -14, -10, 28, 16); R('#ffffff', -13, -9, 26, 14); R('#3f6fd8', -10, -6, 12, 1); R('#d84f4f', -10, -3, 18, 1); R('#3fae6a', -10, 0, 8, 1); break;
    case 'clock': C('#6b4a2b', 0, 0, 6); C('#ffffff', 0, 0, 5); g.strokeStyle = PAL.dark; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 * Math.cos(t / 900), y + 3 * Math.sin(t / 900)); g.stroke(); break;
    case 'bin': R('#5b6270', -3, -4, 7, 9); R('#3b3f4a', -4, -5, 9, 2); break;
  }
}

function drawBuilding(g, s, opts, t) {
  const x = Math.round(s.x * T), y = Math.round(s.y * T), w = s.w * T, h = s.h * T;
  const wall = opts.wall || WALLS[s.wall], roof = opts.roof || ROOFS[s.roof], roofH = s.tower ? 18 : Math.round(h * 0.42);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 3, y + 6, w, h);
  if (opts.open) {
    // roof off: you can see inside. Floor, back wall, desk, computer.
    g.fillStyle = wall; g.fillRect(x, y + 4, w, h - 4);
    g.fillStyle = opts.floor || FLOORS[0]; g.fillRect(x + 3, y + 10, w - 6, h - 13);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = y + 13; i < y + h - 3; i += 4) g.fillRect(x + 3, i, w - 6, 1);
    g.fillStyle = opts.paper || PAPERS[0]; g.fillRect(x + 3, y + 6, w - 6, 5);
    g.fillStyle = roof; g.fillRect(x - 1, y + 2, w + 2, 3);
    const dx = x + Math.round(w / 2) - 8, dy = y + h - 20;
    g.fillStyle = '#7a5236'; g.fillRect(dx, dy + 6, 16, 5); g.fillStyle = '#5a3b22'; g.fillRect(dx + 1, dy + 11, 2, 3); g.fillRect(dx + 13, dy + 11, 2, 3);
    g.fillStyle = '#2d2f38'; g.fillRect(dx + 4, dy - 1, 8, 6); g.fillStyle = Math.floor(t / 250) % 2 ? '#9fe0ff' : '#7fd0f5'; g.fillRect(dx + 5, dy, 6, 4);
    g.fillStyle = '#ffffff'; g.fillRect(dx + 6, dy + 1 + (Math.floor(t / 300) % 3), 3, 1);
    g.fillStyle = '#5a3b22'; g.fillRect(x + Math.round(w / 2) - 4, y + h - 2, 8, 2);
    return { deskX: dx + 8, deskY: dy + 6 };
  }
  g.fillStyle = wall; g.fillRect(x, y + roofH, w, h - roofH);
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, y + h - 4, w, 4);
  g.fillStyle = roof; for (let i = 0; i < roofH; i += 2) { const inset = Math.round((roofH - i) * (s.tower ? 0.5 : 0.55)); g.fillRect(x - 3 + inset, y + i, w + 6 - inset * 2, 2); }
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x - 3 + Math.round(roofH * 0.55), y + roofH - 2, w + 6 - Math.round(roofH * 1.1), 1);
  const dx = x + Math.round(w / 2) - 4; g.fillStyle = opts.door || '#5a3b22'; g.fillRect(dx, y + h - 12, 8, 12); g.fillStyle = '#e0b04a'; g.fillRect(dx + 6, y + h - 7, 1, 1);
  const wins = s.tower ? [[x + w / 2 - 3, y + roofH + 4]] : [[x + 5, y + roofH + 5], [x + w - 13, y + roofH + 5]];
  for (const [wx, wy] of wins) { g.fillStyle = '#3b3f4a'; g.fillRect(wx - 1, wy - 1, 10, 9); g.fillStyle = opts.lit ? PAL.lit : '#5d7a99'; g.fillRect(wx, wy, 8, 7); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(wx, wy, 3, 2); }
  if (s.tower) { const cx = x + w / 2, cy = y + 9; g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill(); g.strokeStyle = PAL.dark; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 3 * Math.cos(t / 1000), cy + 3 * Math.sin(t / 1000)); g.stroke(); }
  if (s.flag) drawItem(g, 'flag', x + w - 6, y, t);
  return null;
}

// a person, standing/walking, or sitting at a desk (seated: legs hidden by the desk, arms typing)
export function drawPerson(g, x, y, look, o = {}) {
  x = Math.round(x); y = Math.round(y);
  const t = o.t || 0, step = o.moving ? Math.floor(t / 140) % 2 : 0;
  const R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  if (o.robot) {
    R('rgba(0,0,0,0.25)', -4, 7, 9, 2); R('#9aa3ad', -4, -6, 9, 8); R('#c8ced5', -3, -5, 7, 6); R('#58c4f0', -2, -3, 2, 2); R('#58c4f0', 1, -3, 2, 2);
    R('#6f777f', 0, -9, 1, 3); R(t % 1000 < 500 ? '#f05a5a' : '#ffd86b', 0, -10, 1, 1); R('#7b848e', -3, 2, 7, 4); R(PAL.dark, -3 + step, 6, 2, 2); R(PAL.dark, 2 - step, 6, 2, 2); return;
  }
  const skin = LOOK.skin[look.skin] || LOOK.skin[0], hair = LOOK.hair[look.hair] || LOOK.hair[0], shirt = LOOK.shirt[look.shirt] || LOOK.shirt[0], legs = LOOK.legs[look.legs] || LOOK.legs[0];
  const style = LOOK.style[look.style] || 'short', acc = LOOK.acc[look.acc] || 'none', face = LOOK.face[look.face] || 'none', outfit = LOOK.outfit[look.outfit] || 'tshirt', shoes = LOOK.shoes[look.shoes] || LOOK.shoes[0];
  if (acc === 'cape' && !o.lying) R('#b0453a', -4, -2, 9, 9);
  if (!o.seated) { R('rgba(0,0,0,0.25)', -4, 7, 9, 2); if (outfit === 'dress') { R(shirt, -3, 3, 7, 3); R(skin, -2, 6, 1, 1); R(skin, 2, 6, 1, 1); } else { R(outfit === 'overalls' ? '#3d6db5' : legs, -2, 3, 2, 4 - step); R(outfit === 'overalls' ? '#3d6db5' : legs, 1, 3, 2, 3 + step); } R(shoes, -2, 7 - step, 2, 1); R(shoes, 1, 6 + step, 2, 1); }
  if (o.lying) { R(skin, -7, -2, 5, 4); R(hair, -8, -2, 2, 4); return; }
  R(shirt, -3, -2, 7, 6); R('rgba(0,0,0,0.15)', -3, 3, 7, 1);
  if (outfit === 'hoodie') { R(shirt, -3, -3, 7, 1); R('rgba(0,0,0,0.2)', -1, 1, 3, 2); }
  if (outfit === 'suit') { R('#2d2f38', -3, -2, 2, 6); R('#2d2f38', 2, -2, 2, 6); R('#f2f2f2', -1, -2, 3, 2); R('#b0453a', 0, -1, 1, 3); }
  if (outfit === 'overalls') { R('#3d6db5', -2, 0, 5, 4); R('#3d6db5', -2, -2, 1, 2); R('#3d6db5', 2, -2, 1, 2); }
  if (outfit === 'jumper') { R('rgba(255,255,255,0.25)', -3, 0, 7, 1); R('rgba(255,255,255,0.25)', -3, 2, 7, 1); }
  if (outfit === 'lab coat') { R('#f2f2f2', -3, -2, 2, 7); R('#f2f2f2', 2, -2, 2, 7); }
  if (acc === 'crown') R('#d4b06a', 0, -2, 1, 4);
  if (acc === 'scarf') R('#d84f4f', -2, -3, 5, 2);
  const typing = o.seated ? (Math.floor(t / 160) % 2) : 0;
  if (o.seated) { R(skin, -4, 1 - typing, 2, 2); R(skin, 3, typing, 2, 2); } else { R(skin, -4, -1 + step, 1, 3); R(skin, 4, -step, 1, 3); }
  R(skin, -2, -7, 5, 5);
  if (style === 'long') { R(hair, -3, -8, 7, 2); R(hair, -3, -6, 1, 5); R(hair, 3, -6, 1, 5); }
  else if (style === 'bun') { R(hair, -2, -8, 5, 2); R(hair, 0, -10, 2, 2); }
  else if (style === 'spiky') { R(hair, -2, -8, 5, 2); R(hair, -2, -9, 1, 1); R(hair, 0, -10, 1, 2); R(hair, 2, -9, 1, 1); }
  else if (style === 'cap') { R(hair, -2, -9, 5, 3); R(hair, 2, -7, 3, 1); }
  else if (style === 'short') { R(hair, -2, -8, 5, 2); R(hair, -3, -7, 1, 2); }
  else if (style === 'afro') { R(hair, -4, -10, 9, 4); R(hair, -4, -7, 1, 3); R(hair, 4, -7, 1, 3); }
  else if (style === 'ponytail') { R(hair, -2, -8, 5, 2); R(hair, -4, -7, 2, 4); }
  else if (style === 'mohawk') { R(hair, 0, -10, 1, 3); }
  else if (style === 'curly') { R(hair, -3, -9, 7, 3); R(hair, -3, -6, 1, 2); R(hair, 3, -6, 1, 2); R('rgba(255,255,255,0.15)', -2, -9, 1, 1); R('rgba(255,255,255,0.15)', 1, -8, 1, 1); }
  const dir = o.dir || 1;
  R(PAL.dark, dir >= 0 ? 1 : -1, -5, 1, 1); if (o.seated) R(PAL.dark, -1, -5, 1, 1);
  if (acc === 'glasses') { R('#1a1a1a', -2, -5, 2, 1); R('#1a1a1a', 1, -5, 2, 1); }
  if (acc === 'headphones') { R('#2d2f38', -3, -6, 1, 3); R('#2d2f38', 3, -6, 1, 3); R('#2d2f38', -2, -9, 5, 1); }
  if (acc === 'hat') { R('#3b3f4a', -4, -8, 9, 1); R('#3b3f4a', -2, -11, 5, 3); }
  if (acc === 'crown') { R('#e8c35a', -2, -10, 5, 2); R('#e8c35a', -2, -11, 1, 1); R('#e8c35a', 0, -11, 1, 1); R('#e8c35a', 2, -11, 1, 1); }
  if (acc === 'bow') { R('#e06aa8', 2, -9, 3, 2); }
  if (acc === 'wizard hat') { R('#5a3fa0', -4, -8, 9, 1); R('#5a3fa0', -2, -10, 5, 2); R('#5a3fa0', -1, -12, 3, 2); R('#5a3fa0', 0, -14, 1, 2); R('#f2d36b', 0, -10, 1, 1); }
  if (acc === 'flower') { R('#f08aa0', 2, -9, 2, 2); R('#f2d36b', 2, -9, 1, 1); }
  if (acc === 'earrings') { R('#e8c35a', -3, -4, 1, 1); R('#e8c35a', 3, -4, 1, 1); }
  if (acc === 'sunglasses') R('#1a1a1a', -2, -5, 5, 1);
  if (face === 'beard') { R(hair, -2, -4, 5, 2); R(hair, -2, -5, 1, 1); R(hair, 2, -5, 1, 1); }
  if (face === 'moustache') R(hair, -1, -4, 3, 1);
  if (face === 'stubble') { R('rgba(0,0,0,0.18)', -2, -4, 5, 2); }
  if (face === 'freckles') { R('#b06a4a', -1, -4, 1, 1); R('#b06a4a', 2, -4, 1, 1); }
  if (face === 'blush') { R('#f08aa0', -2, -4, 1, 1); R('#f08aa0', 2, -4, 1, 1); }
}

export function drawPet(g, x, y, kind, t = 0, moving) {
  x = Math.round(x); y = Math.round(y); const R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  const hop = moving ? Math.floor(t / 120) % 2 : 0;
  R('rgba(0,0,0,0.2)', -3, 3, 7, 1);
  if (kind === 'dog') { R('#b07a4a', -3, -1 - hop, 6, 3); R('#b07a4a', 2, -3 - hop, 3, 3); R('#6b4a2b', 4, -3 - hop, 1, 2); R('#1a1a1a', 3, -2 - hop, 1, 1); R('#b07a4a', -3, -3 - hop + Math.round(Math.sin(t / 120)), 1, 2); R('#6b4a2b', -2, 2, 1, 1); R('#6b4a2b', 1, 2, 1, 1); }
  if (kind === 'cat') { R('#3a3a3a', -3, -1 - hop, 5, 3); R('#3a3a3a', 1, -3 - hop, 3, 2); R('#3a3a3a', 1, -4 - hop, 1, 1); R('#3a3a3a', 3, -4 - hop, 1, 1); R('#f2d36b', 2, -3 - hop, 1, 1); R('#3a3a3a', -4, -3 + Math.round(Math.sin(t / 250)), 1, 3); }
  if (kind === 'bird') { const f = Math.floor(t / 100) % 2; R('#3f6fd8', -1, -9 - f, 3, 2); R('#3f6fd8', f ? -3 : -2, -10, 2, 1); R('#3f6fd8', f ? 2 : 1, -10, 2, 1); R('#e0a33a', 2, -9 - f, 1, 1); }
  if (kind === 'fox') { R('#e07a2a', -3, -1 - hop, 6, 3); R('#e07a2a', 2, -3 - hop, 3, 3); R('#f2f2f2', 4, -2 - hop, 1, 1); R('#1a1a1a', 3, -3 - hop, 1, 1); R('#e07a2a', -5, -2 - hop, 2, 2); R('#f2f2f2', -6, -2 - hop, 1, 1); }
  if (kind === 'bunny') { R('#f2f2f2', -2, -1 - hop * 2, 5, 3); R('#f2f2f2', 1, -4 - hop * 2, 1, 3); R('#f2f2f2', 3, -4 - hop * 2, 1, 3); R('#f08aa0', 2, -1 - hop * 2, 1, 1); }
  if (kind === 'robot dog') { R('#9aa3ad', -3, -2 - hop, 6, 3); R('#9aa3ad', 2, -4 - hop, 3, 3); R('#58c4f0', 3, -3 - hop, 1, 1); R('#6f777f', -2, 1, 1, 2); R('#6f777f', 1, 1, 1, 2); }
}

// the state each agent shows in town
export function mood(a) {
  if (a.health === 'hiring') return 'hiring';
  if (a.health === 'retiring') return 'leaving';
  if (!a.enabled) return 'asleep';
  if (['missed', 'failed', 'attention'].includes(a.health)) return 'trouble';
  if (a.last_run && Date.now() - Date.parse(a.last_run) < 20 * 60000 && a.kind !== 'system') return 'busy';
  return 'idle';
}
const BUBBLE = { hiring: 'Starts tomorrow', leaving: 'Leaving', asleep: 'Zz', trouble: '!', busy: 'Working…' };

/* ---------- the room view: one agent's house from the inside ---------- */
export const RW = 240, RH = 144;
export function drawRoom(g, a, style, t, edit) {
  const look = lookOf(a), m = mood(a);
  g.imageSmoothingEnabled = false;
  g.fillStyle = style.paper || PAPERS[0]; g.fillRect(0, 0, RW, 56);
  g.fillStyle = 'rgba(0,0,0,0.06)'; for (let x = 0; x < RW; x += 12) g.fillRect(x, 0, 1, 56);
  g.fillStyle = style.floor || FLOORS[0]; g.fillRect(0, 56, RW, RH - 56);
  g.fillStyle = 'rgba(0,0,0,0.10)'; for (let y = 60; y < RH; y += 8) g.fillRect(0, y, RW, 1);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 55, RW, 2);
  // window shows day or night
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const night = hour >= 19 || hour < 7;
  g.fillStyle = '#6b4a2b'; g.fillRect(150, 10, 40, 30); g.fillStyle = night ? '#1d2448' : '#9fd3f0'; g.fillRect(152, 12, 36, 26);
  if (night) { g.fillStyle = '#fff2b0'; g.fillRect(178, 16, 4, 4); g.fillStyle = '#ffffff'; g.fillRect(160, 18, 1, 1); g.fillRect(170, 28, 1, 1); } else { g.fillStyle = '#f2d36b'; g.beginPath(); g.arc(160, 20, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3fae6a'; g.fillRect(152, 32, 36, 6); }
  g.fillStyle = '#6b4a2b'; g.fillRect(169, 12, 2, 26); g.fillRect(152, 24, 36, 2);
  // the name plate
  g.fillStyle = '#d4b06a'; g.fillRect(14, 14, 50, 12); g.fillStyle = '#17130a'; g.fillRect(17, 19, 44, 2);
  // Charlie's furniture, drawn behind or in front by height
  const items = (style.items || []).slice().sort((p, q) => p.y - q.y);
  const desk = { x: 104, y: 92 };
  const drawDesk = () => {
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(desk.x - 26, desk.y + 18, 54, 4);
    g.fillStyle = '#7a5236'; g.fillRect(desk.x - 26, desk.y, 52, 8); g.fillStyle = '#5a3b22'; g.fillRect(desk.x - 24, desk.y + 8, 4, 12); g.fillRect(desk.x + 20, desk.y + 8, 4, 12);
    // computer: its screen shows the agent's state
    const mx = desk.x + 10; g.fillStyle = '#2d2f38'; g.fillRect(mx - 10, desk.y - 18, 22, 16); g.fillRect(mx, desk.y - 2, 3, 2);
    const scr = m === 'busy' ? '#16324a' : m === 'trouble' ? '#4a1616' : m === 'asleep' ? '#111318' : '#16324a';
    g.fillStyle = scr; g.fillRect(mx - 8, desk.y - 16, 18, 12);
    if (m === 'busy') { g.fillStyle = '#7fd0f5'; for (let i = 0; i < 4; i++) g.fillRect(mx - 7, desk.y - 15 + i * 3, 4 + ((Math.floor(t / 120) + i * 3) % 12), 1); }
    else if (m === 'trouble') { g.fillStyle = Math.floor(t / 400) % 2 ? '#ff6b61' : '#ffffff'; g.fillRect(mx, desk.y - 14, 2, 5); g.fillRect(mx, desk.y - 8, 2, 2); }
    else if (m !== 'asleep') { g.fillStyle = '#4a7090'; g.fillRect(mx - 6, desk.y - 13, 14, 1); g.fillRect(mx - 6, desk.y - 10, 9, 1); }
    g.fillStyle = '#c8ccd2'; g.fillRect(desk.x - 14, desk.y + 2, 14, 2); g.fillStyle = '#e9dcc0'; g.fillRect(desk.x - 22, desk.y + 1, 6, 4);
  };
  const bed = () => { g.fillStyle = '#6b4a2b'; g.fillRect(186, 98, 44, 22); g.fillStyle = '#efe6d2'; g.fillRect(188, 96, 40, 16); g.fillStyle = '#3f6fd8'; g.fillRect(196, 100, 32, 12); g.fillStyle = '#ffffff'; g.fillRect(189, 98, 8, 6); };
  bed();
  for (const it of items.filter(i => i.y < desk.y)) drawItem(g, it.k, it.x, it.y, t);
  // the agent: sitting at the desk working, standing about, asleep in bed, or worried at the screen
  const S = (x, y, o) => { g.save(); g.translate(x, y); g.scale(2, 2); drawPerson(g, 0, 0, look, { ...o, t }); g.restore(); };
  if (m === 'asleep') { g.save(); g.translate(206, 103); g.scale(2, 2); drawPerson(g, 0, 0, look, { lying: true }); g.restore(); }
  drawDesk();
  if (m === 'busy' || m === 'trouble') { g.fillStyle = '#3b3f4a'; g.fillRect(desk.x - 18, desk.y - 8, 16, 10); S(desk.x - 10, desk.y - 2, { seated: true, robot: a.kind === 'system' }); g.fillStyle = '#7a5236'; g.fillRect(desk.x - 26, desk.y + 2, 30, 6); g.fillStyle = '#c8ccd2'; g.fillRect(desk.x - 16, desk.y + 2, 12, 2); }
  if (m === 'idle' || m === 'hiring' || m === 'leaving') S(60 + Math.sin(t / 1400) * 18, 108, { moving: true, robot: a.kind === 'system', dir: Math.cos(t / 1400) > 0 ? 1 : -1 });
  for (const it of items.filter(i => i.y >= desk.y)) drawItem(g, it.k, it.x, it.y, t);
  if (m === 'asleep') { g.fillStyle = '#26305c'; const zz = Math.floor(t / 500) % 3; for (let i = 0; i <= zz; i++) { g.fillRect(216 + i * 6, 88 - i * 6, 4, 1); g.fillRect(219 + i * 6, 89 - i * 6, 1, 1); g.fillRect(218 + i * 6, 90 - i * 6, 1, 1); g.fillRect(216 + i * 6, 91 - i * 6, 4, 1); } }
  if (edit) { g.strokeStyle = 'rgba(212,176,106,0.6)'; g.setLineDash([3, 3]); g.strokeRect(0.5, 56.5, RW - 1, RH - 57); g.setLineDash([]); }
}

/* ---------- the town ---------- */
export function mountVillage(host, agents, { onSelect, selected, reduced, decor, edit } = {}) {
  decor = decor || {};
  const wrap = document.createElement('div'); wrap.className = 'village' + (edit ? ' editing' : '');
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Village map: ' + agents.map(a => `${a.name}, ${(BUBBLE[mood(a)] || 'around town').replace('…', '')}`).join('; '));
  const layer = document.createElement('div'); layer.className = 'village-layer';
  wrap.append(canvas, layer); host.append(wrap);
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
  const set = decor.settings || {};
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const night = set.time === 'night' || (set.time !== 'day' && set.time !== 'sunset' && (hour >= 19 || hour < 7));
  const sunset = set.time === 'sunset' || (set.time === 'auto' || !set.time) && (hour === 18 || hour === 7);
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H; drawGround(bg.getContext('2d'), set.ground);
  // weather: a few hundred particles drawn over the town
  const wr = rng('weather'), parts = set.weather && set.weather !== 'none' ? Array.from({ length: set.weather === 'rain' ? 160 : 90 }, () => ({ x: wr() * W, y: wr() * H, s: 0.5 + wr(), d: wr() * 6 })) : [];
  const gateName = document.createElement('span'); gateName.className = 'v-gate'; gateName.textContent = set.name || ''; gateName.hidden = !set.name;
  const items = () => decor.items || STARTER_DECOR;

  let plot = 0;
  const people = agents.map((a, i) => {
    const r = rng(a.id);
    const spot = SPOTS[a.id] ? { ...SPOTS[a.id] } : (() => { const p = PLOTS[plot++ % PLOTS.length]; const n = Math.floor(r() * 10); return { x: p.x, y: p.y, w: 3, h: 3, wall: n % WALLS.length, roof: n % ROOFS.length }; })();
    const door = { x: (spot.x + spot.w / 2) * T, y: (spot.y + spot.h) * T + 9 };
    const m = mood(a);
    const start = m === 'hiring' ? { x: GATE.x + (i % 3 - 1) * 12, y: GATE.y - 4 } : { ...door };
    return { a, spot, door, m, x: start.x, y: start.y, tx: start.x, ty: start.y, wait: r() * 3000, moving: false, dir: 1, robot: a.kind === 'system', look: lookOf(a), r, desk: null };
  });

  const tags = people.map(p => {
    const sign = document.createElement('span'); sign.className = 'v-sign'; sign.textContent = p.a.name;
    const bub = document.createElement('span'); bub.className = 'v-bubble v-' + p.m; bub.textContent = BUBBLE[p.m] || ''; bub.hidden = !BUBBLE[p.m];
    if (p.a.unread_out) { bub.className = 'v-bubble v-mail'; bub.textContent = 'New reply for you'; bub.hidden = false; p.fixedBubble = true; } else p.fixedBubble = !!BUBBLE[p.m];
    const hit = document.createElement('button'); hit.type = 'button'; hit.className = 'v-hit'; hit.setAttribute('aria-label', p.a.name + ': ' + (p.a.role || '') + '. Show their house');
    hit.addEventListener('click', e => { if (edit) return; e.stopPropagation(); select(p); });
    layer.append(sign, bub, hit); return { sign, bub, hit };
  });
  layer.append(gateName);
  // idle chatter: now and then someone says their catchphrase or what they last did
  const lines = p => { const pe = p.a.personality || {}; const out = []; if (pe.catchphrase) out.push(pe.catchphrase); if (p.a.last_summary) out.push(p.a.last_summary.length > 60 ? p.a.last_summary.slice(0, 57) + '…' : p.a.last_summary); if (p.a.next) out.push('Back at my desk ' + new Date(p.a.next).toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit' })); return out; };
  let chatT = 0;
  let sel = people.find(p => p.a.id === selected) || null;
  function select(p) { sel = p; onSelect && onSelect(p.a); }

  // decorating the town: tap empty grass to place the chosen thing, tap a placed thing to remove it
  const toWorld = e => { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width * W, y: (e.clientY - b.top) / b.height * H }; };
  canvas.addEventListener('click', e => {
    if (!edit) return; const pt = toWorld(e);
    const list = items().slice(); const hitI = list.findIndex(it => Math.abs(it.x - pt.x) < 9 && Math.abs(it.y - pt.y) < 10);
    if (hitI >= 0 && (edit.tool === 'remove' || !edit.tool)) list.splice(hitI, 1);
    else if (edit.tool && edit.tool !== 'remove') { if (list.length >= 250) return; list.push({ k: edit.tool, x: Math.round(pt.x), y: Math.round(pt.y) }); }
    else return;
    decor.items = list; edit.onChange && edit.onChange(decor);
  });

  const place = (el, x, y) => { el.style.setProperty('left', (x / W * 100) + '%'); el.style.setProperty('top', (y / H * 100) + '%'); };
  function pickTarget(p) {
    const r = p.r();
    if (p.robot) { const ang = (performance.now() / 4000) % (Math.PI * 2); return { x: SQUARE.x + Math.cos(ang + 1) * 34, y: SQUARE.y + Math.sin(ang + 1) * 30 }; }
    if (r < 0.35) return { x: p.door.x + (p.r() - 0.5) * 30, y: p.door.y + p.r() * 10 };
    if (r < 0.75) { const ang = p.r() * Math.PI * 2; return { x: SQUARE.x + Math.cos(ang) * 32, y: SQUARE.y + Math.sin(ang) * 28 }; }
    if (r < 0.85) return { x: (SPOTS.boss.x + SPOTS.boss.w / 2) * T + (p.r() - 0.5) * 24, y: (SPOTS.boss.y + SPOTS.boss.h) * T + 14 };
    return { x: p.r() * (W - 40) + 20, y: 8.5 * T + (p.r() - 0.5) * 18 };
  }
  let last = performance.now(), raf = 0, alive = true;
  function frame(t) {
    if (!alive) return;
    if (!document.body.contains(canvas)) { alive = false; return; }
    const dt = Math.min(64, t - last); last = t;
    g.drawImage(bg, 0, 0);
    g.fillStyle = PAL.water[Math.floor(t / 400) % 2]; g.beginPath(); g.arc(SQUARE.x, SQUARE.y, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(SQUARE.x - 1, SQUARE.y - 6 - (Math.floor(t / 200) % 3), 2, 4);
    // decorations and people share one depth order, so things stand in front of and behind each other properly
    const draws = [];
    for (const it of items()) draws.push({ y: it.y, f: () => drawItem(g, it.k, it.x, it.y, night ? 1 : 0) });
    for (const p of people) {
      const hs = (decor.houses || {})[p.a.id] || {};
      const open = p.m === 'busy';
      draws.push({ y: (p.spot.y + p.spot.h) * T - 1, f: () => { p.desk = drawBuilding(g, p.spot, { open, lit: night && p.m !== 'asleep', wall: hs.wall != null ? WALLS[hs.wall] : null, roof: hs.roof != null ? ROOFS[hs.roof] : null, door: hs.door, floor: (decor.rooms || {})[p.a.id] && FLOORS[(decor.rooms[p.a.id]).floor], paper: (decor.rooms || {})[p.a.id] && PAPERS[(decor.rooms[p.a.id]).paper] }, t); if (open && p.desk) drawPerson(g, p.desk.deskX - 10, p.desk.deskY - 2, p.look, { seated: true, t, robot: p.robot }); } });
      if (!open) {
        const still = reduced || edit || ['asleep', 'trouble', 'hiring', 'leaving'].includes(p.m);
        if (!still) {
          const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
          if (d < 1) { p.moving = false; p.wait -= dt; if (p.wait <= 0) { const nt = pickTarget(p); p.tx = nt.x; p.ty = nt.y; p.wait = p.robot ? 300 : 1500 + p.r() * 4500; } }
          else { const v = (p.robot ? 0.03 : 0.022) * dt; p.x += dx / d * Math.min(v, d); p.y += dy / d * Math.min(v, d); p.moving = true; p.dir = dx > 0.2 ? 1 : dx < -0.2 ? -1 : p.dir; }
        } else p.moving = false;
        draws.push({ y: p.y + 6, f: () => drawPerson(g, p.x, p.y, p.look, { t, moving: p.moving, dir: p.dir, robot: p.robot }) });
        const pet = LOOK.pet[p.look.pet];
        if (pet && pet !== 'none' && !p.robot) { p.px = (p.px ?? p.x) + ((p.x - 8 * p.dir) - (p.px ?? p.x)) * Math.min(1, dt / 300); p.py = (p.py ?? p.y) + ((p.y + 4) - (p.py ?? p.y)) * Math.min(1, dt / 300); draws.push({ y: p.py + 3, f: () => drawPet(g, p.px, p.py, pet, t, p.moving) }); }
      }
    }
    draws.sort((a, b) => a.y - b.y).forEach(d => d.f());
    if (sel && !edit) { g.strokeStyle = '#ffe08a'; g.lineWidth = 1; if (sel.m === 'busy') g.strokeRect(Math.round(sel.spot.x * T) - 1.5, Math.round(sel.spot.y * T) + 0.5, sel.spot.w * T + 3, sel.spot.h * T); else g.strokeRect(Math.round(sel.x) - 7.5, Math.round(sel.y) - 13.5, 15, 23); }
    if (parts.length) for (const q of parts) {
      if (set.weather === 'rain') { q.y += 0.35 * dt * q.s; q.x -= 0.05 * dt; g.fillStyle = 'rgba(180,210,240,0.6)'; g.fillRect(q.x, q.y, 1, 4); }
      else if (set.weather === 'snow') { q.y += 0.03 * dt * q.s; q.x += Math.sin(t / 900 + q.d) * 0.15; g.fillStyle = '#ffffff'; g.fillRect(q.x, q.y, q.s > 1 ? 2 : 1, q.s > 1 ? 2 : 1); }
      else { q.y += 0.025 * dt * q.s; q.x += Math.sin(t / 700 + q.d) * 0.3; g.fillStyle = set.weather === 'petals' ? '#f7b7cf' : ['#d0702a', '#e8a03a', '#b0453a'][Math.floor(q.d) % 3]; g.fillRect(q.x, q.y, 2, 1); }
      if (q.y > H) { q.y = -4; q.x = wr() * W; } if (q.x < 0) q.x = W;
    }
    if (set.weather === 'rain') { g.fillStyle = 'rgba(40,60,90,0.12)'; g.fillRect(0, 0, W, H); }
    if (sunset && !night) { g.fillStyle = 'rgba(240,120,60,0.16)'; g.fillRect(0, 0, W, H); }
    if (night) { g.fillStyle = PAL.night; g.fillRect(0, 0, W, H); for (const p of people) if (p.m !== 'asleep') { g.fillStyle = 'rgba(255,216,107,0.18)'; g.beginPath(); g.arc((p.spot.x + p.spot.w / 2) * T, (p.spot.y + p.spot.h) * T, 18, 0, Math.PI * 2); g.fill(); } for (const it of items()) if (it.k === 'lamp') { g.fillStyle = 'rgba(255,216,107,0.22)'; g.beginPath(); g.arc(it.x, it.y - 8, 14, 0, Math.PI * 2); g.fill(); } }
    place(gateName, GATE.x, H - 32);
    chatT -= dt;
    if (chatT <= 0 && !edit) { chatT = 5000 + Math.random() * 5000; const idle = people.map((p, i) => [p, i]).filter(([p]) => !p.fixedBubble && lines(p).length); if (idle.length) { const [p, i] = idle[Math.floor(Math.random() * idle.length)]; const ls = lines(p); tags[i].bub.textContent = ls[Math.floor(Math.random() * ls.length)]; tags[i].bub.className = 'v-bubble v-chat'; tags[i].bub.hidden = false; p.chatUntil = t + 3800; } }
    people.forEach((p, i) => {
      if (!p.fixedBubble && p.chatUntil && t > p.chatUntil) { tags[i].bub.hidden = true; p.chatUntil = 0; }
      const bx = p.m === 'busy' ? p.door.x : p.x, by = p.m === 'busy' ? p.spot.y * T + 2 : p.y - 12;
      place(tags[i].bub, bx, by); place(tags[i].sign, (p.spot.x + p.spot.w / 2) * T, (p.spot.y + p.spot.h) * T + 2);
      const hx = p.m === 'busy' ? (p.spot.x + p.spot.w / 2) * T : p.x, hy = p.m === 'busy' ? (p.spot.y + p.spot.h / 2) * T : p.y - 3;
      place(tags[i].hit, hx, hy); tags[i].hit.classList.toggle('v-big', p.m === 'busy');
      tags[i].sign.classList.toggle('on', sel === p && !edit); tags[i].hit.hidden = !!edit;
    });
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { destroy() { alive = false; cancelAnimationFrame(raf); wrap.remove(); }, night };
}

/* ---------- small previews for the pickers ---------- */
export function itemIcon(k) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = 'rgba(91,143,58,0.25)'; g.fillRect(0, 0, 32, 32); drawItem(g, k, 16, 20, 0); c.setAttribute('aria-hidden', 'true'); return c;
}
export function personIcon(look, scale = 4) {
  const c = document.createElement('canvas'); c.width = 22 * scale; c.height = 24 * scale; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.scale(scale, scale); drawPerson(g, 12, 14, look, {}); const pet = LOOK.pet[look.pet]; if (pet && pet !== 'none') drawPet(g, 4, 19, pet, 0, false); c.setAttribute('aria-hidden', 'true'); return c;
}
