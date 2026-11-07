'use strict';
// Every image in the game is drawn here with code. Nothing is loaded from disk.
const THEMES = {
  town: { g: ['#a58a5c', '#9b8053', '#b09669', '#94794d'], p: ['#c8b287', '#bca67b', '#d2bd92'], c: ['#6e5236', '#5b432c', '#826445'], t: ['#8a6f49', '#7e6440'], w: '#4f7f8f', w2: '#6fa8b6', battle: 'town' },
  crags: { g: ['#8e7a5e', '#806e53', '#9b886b', '#776549'], p: ['#ab9976', '#9f8d6b', '#b6a582'], c: ['#6b4f3c', '#553f30', '#80604a'], t: ['#5a4634', '#4f3d2d'], w: '#3f6f7f', w2: '#5f98a8', battle: 'crags' },
  chasm: { g: ['#4b514b', '#424741', '#555b53', '#3c413b'], p: ['#5f6459', '#565b52', '#696e63'], c: ['#30353a', '#272b30', '#3c4247'], t: ['#1f2428', '#1b2024'], w: '#2a5864', w2: '#3f8090', battle: 'chasm' },
  vault: { g: ['#3e4662', '#363d57', '#47506f', '#30374f'], p: ['#5a668c', '#505c80', '#647198'], c: ['#20263f', '#1a1f34', '#2b3252'], t: ['#12162a', '#0f1324'], w: '#2f9ec4', w2: '#7fdcf0', battle: 'vault' },
  shadesmar: { g: ['#272338', '#201d30', '#2e2a42', '#1c192a'], p: ['#403a58', '#37324c', '#4a4364'], c: ['#141224', '#100e1c', '#1b1830'], t: ['#0c0a16', '#0a0812'], w: '#1c1c34', w2: '#8a90c0', battle: 'shadesmar' },
  dais: { g: ['#3a3048', '#322a40', '#44384f', '#2b2438'], p: ['#5c4a60', '#524256', '#68546c'], c: ['#1e1626', '#180f20', '#28203a'], t: ['#100a18', '#0c0814'], w: '#7a2a2a', w2: '#ff6a50', battle: 'everstorm' }
};

// ---------- tiles: terrain codes 0 wall, 1 ground, 2 path, 3 water, 4 pit, 5 bridge ----------
function tileNoise(c, x, y, cols, seed, grit = .16) {
  const r = mulberry(seed);
  c.fillStyle = cols[0]; c.fillRect(x, y, TS, TS);
  // Crem has a blotchy, wind-laid texture: short horizontal smears.
  for (let i = 0; i < 26; i++) {
    c.fillStyle = cols[1 + Math.floor(r() * (cols.length - 1))];
    const px = Math.floor(r() * TS), py = Math.floor(r() * TS), w = r() < .5 ? 3 : 1;
    c.fillRect(x + px, y + py, Math.min(w, TS - px), 1);
  }
  if (r() < grit) { c.fillStyle = 'rgba(20,14,10,.35)'; c.fillRect(x + 2 + Math.floor(r() * 10), y + 2 + Math.floor(r() * 10), 2, 1); c.fillStyle = 'rgba(255,240,200,.14)'; c.fillRect(x + 2 + Math.floor(r() * 10), y + 2 + Math.floor(r() * 10), 1, 1); }
  // Fine grain at half-pixel size, so the ground reads less flat up close.
  for (let i = 0; i < 20; i++) {
    c.fillStyle = r() < .5 ? 'rgba(255,245,220,.08)' : 'rgba(10,8,16,.1)';
    c.fillRect(x + Math.floor(r() * TS * RES) / RES, y + Math.floor(r() * TS * RES) / RES, 1 / RES, 1 / RES);
  }
}
function renderMapTiles(m) {
  const th = THEMES[m.theme], cv = hiCanvas(m.w * TS, m.h * TS), c = cv._c, T = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h) ? 0 : m.t[y * m.w + x];
  const open = t => t === 1 || t === 2 || t === 5;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const t = T(x, y), px = x * TS, py = y * TS, seed = x * 7349 + y * 9311 + 11;
    if (t === 1) tileNoise(c, px, py, th.g, seed);
    else if (t === 2) {
      tileNoise(c, px, py, th.p, seed, .05);
      const r = mulberry(seed);
      [[0, -1, 0, 0, TS, 2], [0, 1, 0, TS - 2, TS, 2], [-1, 0, 0, 0, 2, TS], [1, 0, TS - 2, 0, 2, TS]].forEach(([dx, dy, ax, ay, aw, ah]) => {
        if (T(x + dx, y + dy) === 1) { c.fillStyle = th.g[0]; for (let i = 0; i < 9; i++) c.fillRect(px + ax + Math.floor(r() * aw), py + ay + Math.floor(r() * ah), 1, 1); }
      });
    } else if (t === 3) { c.fillStyle = th.w; c.fillRect(px, py, TS, TS); }
    else if (t === 4) {
      c.fillStyle = '#05050b'; c.fillRect(px, py, TS, TS);
      if (T(x, y - 1) !== 4) { c.fillStyle = th.c[0]; c.fillRect(px, py, TS, 7); c.fillStyle = th.c[1]; c.fillRect(px, py + 7, TS, 3); }
    } else if (t === 5) {
      tileNoise(c, px, py, ['#6e5136', '#7c5e40', '#5f4630'], seed, 0);
      c.fillStyle = 'rgba(0,0,0,.4)'; for (let i = 3; i < TS; i += 5) c.fillRect(px, py + i, TS, 1);
    } else {
      // Wall: high ground top, with a two-tile cliff face where open ground lies below.
      const below = T(x, y + 1), below2 = T(x, y + 2), r = mulberry(seed);
      const face1 = below !== 0, face2 = !face1 && below2 !== 0 && y + 2 < m.h;
      if (face1 || face2) {
        tileNoise(c, px, py, th.c, seed, 0);
        // Strata: long horizontal bands read as layered stone.
        for (let s = 2; s < TS; s += 5) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(px, py + s + (x % 3 === 0 ? 1 : 0), TS, 1); c.fillStyle = 'rgba(255,240,210,.07)'; c.fillRect(px, py + s + 1 + (x % 3 === 0 ? 1 : 0), TS, 1); }
        for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(px + Math.floor(r() * 14), py + Math.floor(r() * 12), 1, 3 + Math.floor(r() * 3)); }
        if (face2) { c.fillStyle = th.t[0]; c.fillRect(px, py, TS, 2); c.fillStyle = 'rgba(255,240,210,.22)'; c.fillRect(px, py + 2, TS, 1); }
        if (face1) { c.fillStyle = 'rgba(0,0,0,.38)'; c.fillRect(px, py + TS - 2, TS, 2); }
      } else {
        tileNoise(c, px, py, th.t, seed, .3);
        c.fillStyle = 'rgba(255,240,210,.09)';
        if (T(x - 1, y) !== 0) c.fillRect(px, py, 1, TS);
        if (T(x + 1, y) !== 0) c.fillRect(px + TS - 1, py, 1, TS);
      }
    }
  }
  // Soft ambient shadows at the base of cliffs and against walls.
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!open(T(x, y))) continue;
    const px = x * TS, py = y * TS;
    if (T(x, y - 1) === 0) { c.fillStyle = 'rgba(8,6,16,.42)'; c.fillRect(px, py, TS, 3); c.fillStyle = 'rgba(8,6,16,.2)'; c.fillRect(px, py + 3, TS, 3); }
    if (T(x - 1, y) === 0) { c.fillStyle = 'rgba(8,6,16,.26)'; c.fillRect(px, py, 3, TS); }
    if (T(x + 1, y) === 0) { c.fillStyle = 'rgba(8,6,16,.18)'; c.fillRect(px + TS - 2, py, 2, TS); }
  }
  return cv;
}

// ---------- humanoids: 24x32 canvas, feet at y=31 ----------
function drawHumanoid(c, pal, pose) {
  const dir = pose.dir || 0, bob = pose.bob || 0, la = pose.legA || 0, lb = pose.legB || 0, kneel = pose.kneel ? 5 : 0;
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const coat = pal.coat, coat2 = pal.coat2, trim = pal.trim, skin = pal.skin, skin2 = pal.skin2, hair = pal.hair;
  const hairD = mix(hair, '#000000', .28), hairL = mix(hair, '#ffffff', .18);
  const y0 = bob + kneel;
  const plate = pal.plate;
  const pants = plate ? mix(pal.plate, '#000000', .25) : pal.pants, boots = plate ? mix(pal.plate, '#000000', .4) : pal.boots;
  if (dir === 2) {
    // Side view, facing right.
    const lean = pose.lean || 0;
    // back arm
    if (!pose.armsUp) { R(9 + lean - (pose.armB || 0), 15 + y0, 3, 7, coat2); R(9 + lean - (pose.armB || 0), 22 + y0, 3, 2, skin2); }
    // legs
    if (pose.kneel) { R(8, 25, 4, 5, pants); R(5, 29, 7, 2, boots); R(13, 25, 5, 3, pants); R(15, 27, 3, 4, pants); R(15, 29, 5, 2, boots); }
    else {
      R(9 + lb, 24 + bob, 4, 5 - Math.abs(lb) / 2, mix(pants, '#000000', .2)); R(9 + lb, 29 + bob - Math.abs(lb) / 2, 5, 2, boots);
      R(11 + la, 24 + bob, 4, 5 - Math.abs(la) / 2, pants); R(11 + la, 29 + bob - Math.abs(la) / 2, 5, 2, boots);
    }
    // torso + coat tail
    R(8 + lean, 14 + y0, 8, 10, plate || coat); R(7 + lean, 21 + y0, 2, 5, coat2); R(8 + lean, 23 + y0, 7, 2, coat2);
    R(14 + lean, 15 + y0, 2, 8, plate ? mix(plate, '#ffffff', .3) : trim); R(8 + lean, 21 + y0, 8, 1, plate ? mix(plate, '#000000', .3) : trim);
    // head
    const hx = 7 + lean, hy = 4 + y0;
    if (pal.style === 1) R(hx - 1, hy + 2, 4, 10, hairD);
    if (pal.style === 4) { R(hx - 2, hy + 4, 3, 9, hairD); R(hx - 2, hy + 13, 3, 1, trim || hairL); }
    R(hx + 1, hy + 1, 9, 9, skin); R(hx + 1, hy + 8, 2, 2, skin2); R(hx + 8, hy + 6, 2, 1, skin2);
    R(hx + 7, hy + 4, 2, 2, pal.eyeGlow || pal.eye); R(hx + 7, hy + 3, 3, 1, hairD);
    R(hx + 1, hy - 1, 9, 3, hair); R(hx, hy, 3, 6, hair); R(hx + 3, hy - 1, 5, 1, hairL);
    if (pal.style === 2) { R(hx + 2, hy - 4, 4, 3, hair); R(hx + 3, hy - 4, 2, 1, hairL); }
    if (pal.style === 3) { R(hx + 8, hy + 7, 2, 3, hair); R(hx + 4, hy + 8, 5, 2, hair); }
    if (pal.scar) R(hx + 6, hy + 6, 1, 3, '#7c4a3a');
    if (pal.goggles) { R(hx + 6, hy + 1, 4, 2, '#dcae58'); R(hx + 7, hy + 1, 2, 1, '#9fe8ff'); }
    if (plate) { R(hx, hy - 1, 10, 3, plate); R(hx, hy - 1, 3, 7, plate); R(hx + 3, hy - 1, 6, 1, mix(plate, '#ffffff', .4)); }
    // front arm
    if (pose.armsUp) { R(11 + lean, 8 + y0, 3, 8, coat); R(11 + lean, 6 + y0, 3, 2, skin); R(8 + lean, 9 + y0, 3, 7, coat2); }
    else { const fx = 11 + lean + (pose.armF || 0), fy = 15 + y0 + (pose.armRaise ? -3 : 0); R(fx, fy, 3, 7, plate || coat); R(fx, fy + 7, 3, 2, skin); }
    return;
  }
  // Front / back views.
  const back = dir === 1;
  if (pal.style === 1 && back) R(7, 6 + y0, 10, 11, hairD);
  R(8, 24 + bob, 3, 5 - la, pants); R(8, 29 + bob - la, 3, 2, boots);
  R(13, 24 + bob, 3, 5 - lb, pants); R(13, 29 + bob - lb, 3, 2, boots);
  R(5, 15 + y0 - la, 3, 7, plate || coat2); R(5, 22 + y0 - la, 3, 2, skin2);
  R(16, 15 + y0 - lb, 3, 7, plate || coat2); R(16, 22 + y0 - lb, 3, 2, skin2);
  R(7, 14 + y0, 10, 10, plate || coat); R(6, 22 + y0, 12, 3, coat2);
  if (!back) { R(11, 15 + y0, 2, 8, plate ? mix(plate, '#ffffff', .3) : trim); R(7, 21 + y0, 10, 1, plate ? mix(plate, '#000000', .3) : trim); R(7, 14 + y0, 2, 2, trim); R(15, 14 + y0, 2, 2, trim); }
  else R(7, 14 + y0, 10, 2, coat2);
  const hy = 4 + y0;
  if (pal.style === 1 && !back) { R(6, hy + 3, 2, 10, hairD); R(16, hy + 3, 2, 10, hairD); }
  R(7, hy + 1, 10, 9, skin);
  if (back) {
    R(7, hy - 1, 10, 9, hair); R(7, hy + 7, 10, 1, hairD); R(9, hy - 1, 5, 1, hairL);
    if (pal.style === 4) { R(11, hy + 7, 3, 8, hairD); R(11, hy + 15, 3, 1, pal.trim); }
    if (pal.style === 2) R(10, hy - 4, 4, 3, hair);
  } else {
    R(7, hy - 1, 10, 4, hair); R(7, hy + 3, 1, 3, hair); R(16, hy + 3, 1, 3, hair); R(9, hy - 1, 5, 1, hairL);
    R(9, hy + 5, 2, 2, pal.eyeGlow || pal.eye); R(13, hy + 5, 2, 2, pal.eyeGlow || pal.eye);
    R(9, hy + 4, 2, 1, hairD); R(13, hy + 4, 2, 1, hairD); R(11, hy + 8, 2, 1, skin2);
    if (pal.style === 2) { R(10, hy - 4, 4, 3, hair); }
    if (pal.style === 3) { R(8, hy + 8, 8, 2, hair); }
    if (pal.scar) R(14, hy + 3, 1, 4, '#7c4a3a');
    if (pal.goggles) { R(8, hy + 1, 8, 2, '#dcae58'); R(9, hy + 1, 2, 1, '#9fe8ff'); R(13, hy + 1, 2, 1, '#9fe8ff'); }
  }
  if (plate) { R(7, hy - 1, 10, 3, plate); R(9, hy - 1, 5, 1, mix(plate, '#ffffff', .4)); R(6, 14 + y0, 3, 3, plate); R(15, 14 + y0, 3, 3, plate); }
}
const humanCache = new Map();
function humanSprite(pal, palKey, pose) {
  const key = palKey + JSON.stringify(pose);
  if (humanCache.has(key)) return humanCache.get(key);
  const s = sprite(24, 32, c => drawHumanoid(c, pal, pose), undefined, true);
  humanCache.set(key, s);
  return s;
}
function walkPose(dir, frame, moving) {
  if (!moving) return { dir, bob: 0 };
  const f = frame % 4;
  if (dir === 2) return { dir, bob: f % 2 ? -1 : 0, legA: f === 1 ? 3 : f === 3 ? -3 : 0, legB: f === 1 ? -3 : f === 3 ? 3 : 0, armF: f === 1 ? -1 : f === 3 ? 1 : 0, armB: f === 1 ? -1 : f === 3 ? 1 : 0 };
  return { dir, bob: f % 2 ? -1 : 0, legA: f === 1 ? 2 : 0, legB: f === 3 ? 2 : 0 };
}

// ---------- palette helpers ----------
function heroPal(S) {
  const h = S.party[0], o = ORDER(h.order), L = LOOKS[h.look], ideal = S.ideal;
  const p = { skin: L.skin, skin2: L.skin2, hair: L.hair, style: L.style, eye: ideal >= 1 ? mix(L.eye, o.color, .75) : L.eye, coat: o.dark, coat2: mix(o.dark, '#000000', .3), trim: mix(o.color, '#ffffff', .25), pants: '#2c2a3a', boots: '#1e1a24' };
  if (ideal >= 1) p.eyeGlow = mix(o.color, '#ffffff', .4);
  if (ideal >= 4) p.plate = mix(o.color, '#b0b8c8', .45);
  return p;
}
const NPC_PALS = {
  child: { skin: '#b58a60', skin2: '#946d48', hair: '#2a1a14', style: 3, eye: '#2a1c14', coat: '#8f8a5a', coat2: '#6e6a44', trim: '#b7b27a', pants: '#54483a', boots: '#3a3026' },
  mother: { skin: '#c9966c', skin2: '#a87850', hair: '#1b1820', style: 1, eye: '#3a2c20', coat: '#7a5a8a', coat2: '#5c4268', trim: '#c7ae74', pants: '#3e2e4a', boots: '#241c2c' },
  merchant: { skin: '#8a5a3c', skin2: '#6e452c', hair: '#2a2424', style: 2, eye: '#241814', coat: '#3e7a6e', coat2: '#2c5a50', trim: '#e0c05c', pants: '#2c3a36', boots: '#1e2622' },
  inn: { skin: '#eed2b4', skin2: '#d0ae8c', hair: '#c04c2c', style: 3, eye: '#3b5c3a', coat: '#8a6c48', coat2: '#6e5438', trim: '#d8cba8', pants: '#3a3024', boots: '#241c14' },
  elder: { skin: '#a87850', skin2: '#8a6040', hair: '#d4d4cc', style: 2, eye: '#2a2018', coat: '#54405e', coat2: '#3e2e48', trim: '#c9a860', pants: '#2c2436', boots: '#1c1624' },
  villager: { skin: '#c9966c', skin2: '#a87850', hair: '#3a2820', style: 0, eye: '#3a2c20', coat: '#7a6a54', coat2: '#5e5040', trim: '#a8987a', pants: '#3e3428', boots: '#26201a' },
  villager2: { skin: '#9c6e4c', skin2: '#7e5638', hair: '#14121a', style: 1, eye: '#201410', coat: '#5a6a7e', coat2: '#44505e', trim: '#98a8b8', pants: '#2e3440', boots: '#1e222a' },
  listener: { skin: '#30303c', skin2: '#c04c34', hair: '#8a2a20', style: 3, eye: '#ffb060', coat: '#5a2a24', coat2: '#3e1c18', trim: '#c97c4c', pants: '#2e1c1c', boots: '#1c1212' },
  deserter: { skin: '#c9966c', skin2: '#a87850', hair: '#2a2420', style: 3, eye: '#2a1c14', coat: '#5a5a48', coat2: '#46463a', trim: '#7e7a58', pants: '#3a3428', boots: '#26201a', scar: true },
  hadrin: { skin: '#c9966c', skin2: '#a87850', hair: '#1c1c1c', style: 3, eye: '#5a1e12', coat: '#3c3e4e', coat2: '#2c2e3a', trim: '#8c8ea0', pants: '#26262e', boots: '#18181e', plate: '#7a7c8e', scar: true },
  cantor: { skin: '#201a22', skin2: '#c04c34', hair: '#141016', style: 1, eye: '#ff4a2a', eyeGlow: '#ff4a2a', coat: '#3a3440', coat2: '#262028', trim: '#c97c4c', pants: '#1c1820', boots: '#141018' }
};

// ---------- spren: the same shape vocabulary for field sprites, battle sprites, and portraits ----------
function drawSpren(c, cx, cy, r, shape, col, t = 0) {
  const lt = mix(col, '#ffffff', .55), dk = mix(col, '#000000', .35);
  c.save(); c.translate(cx, cy);
  const R = (x, y, w, h, q) => { c.fillStyle = q; c.fillRect(Math.round(x), Math.round(y), w, h); };
  switch (shape) {
    case 'person': { // ribbon-haired little figure
      R(-1, -r * .8, 3, 3, lt); R(-1, -r * .8 + 3, 3, r * .8, col); R(-3, -r * .3, 7, 1, col); R(-2, r * .3, 5, 2, lt); R(-3, r * .3 + 2, 7, 2, col);
      R(2 + t, -r * .8, 2, 1, lt); R(4 + t, -r * .8 + 1, 2, 1, col); R(6 + t, -r * .8, 1, 1, dk);
      break; }
    case 'star': { c.fillStyle = dk; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + t * .4, q = i % 2 ? r * .45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.fill(); c.fillStyle = '#05050d'; c.beginPath(); c.arc(0, 0, r * .28, 0, 7); c.fill(); R(-1, -r, 2, 2, lt); break; }
    case 'flame': { c.fillStyle = col; c.beginPath(); c.moveTo(-r * .6, r * .6); c.quadraticCurveTo(-r * .7, -r * .2, 0, -r); c.quadraticCurveTo(r * .7, -r * .2, r * .6, r * .6); c.closePath(); c.fill(); c.fillStyle = lt; c.beginPath(); c.moveTo(-r * .25, r * .55); c.quadraticCurveTo(-r * .3, 0, 0, -r * .35); c.quadraticCurveTo(r * .3, 0, r * .25, r * .55); c.closePath(); c.fill(); break; }
    case 'vine': { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12, q = r * a * .9; c.lineTo(Math.cos(a * 9 + t) * q * .7, r * .8 - a * r * 1.6); } c.stroke(); R(-r * .5, -r * .3, 2, 2, lt); R(r * .4, r * .2, 2, 2, lt); R(-1, -r, 3, 2, lt); break; }
    case 'mist': { for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? col : lt; c.beginPath(); c.ellipse(Math.cos(i * 2 + t) * r * .4, Math.sin(i * 2 + t) * r * .3, r * .55, r * .35, 0, 0, 7); c.fill(); } break; }
    case 'cryptic': { c.strokeStyle = col; c.lineWidth = 1; for (let i = 0; i < 3; i++) { const q = r * (1 - i * .3); c.beginPath(); c.moveTo(-q, 0); c.lineTo(0, -q); c.lineTo(q, 0); c.lineTo(0, q); c.closePath(); c.stroke(); } R(-1, -1, 3, 3, lt); R(-r, -1, 2, 2, lt); R(r - 1, -1, 2, 2, lt); R(-1, -r, 2, 2, lt); R(-1, r - 1, 2, 2, lt); break; }
    case 'ink': { R(-1, -r, 3, r * 2, dk); R(-3, -r * .7, 7, 2, dk); R(-r * .7, 0, r * 1.4, 2, col); R(0, -r, 1, r * 2, col); R(-2, r - 2, 5, 2, lt); R(-1, -r, 3, 2, lt); break; }
    case 'reacher': { c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * .7, 0, 7); c.fill(); c.fillStyle = dk; c.beginPath(); c.arc(0, 0, r * .4, 0, 7); c.fill(); R(-1, -r, 3, 2, lt); R(-1, r - 2, 3, 2, lt); R(-r, -1, 2, 3, lt); R(r - 2, -1, 2, 3, lt); break; }
    case 'stone': { c.fillStyle = dk; c.beginPath(); c.moveTo(-r, r * .7); c.lineTo(-r * .5, -r * .2); c.lineTo(-r * .1, r * .1); c.lineTo(r * .3, -r * .8); c.lineTo(r, r * .7); c.closePath(); c.fill(); c.fillStyle = col; c.beginPath(); c.moveTo(r * .3, -r * .8); c.lineTo(r * .7, 0); c.lineTo(0, r * .2); c.closePath(); c.fill(); R(r * .1, -r * .1, 2, 2, '#fff6d8'); break; }
    case 'bond': { c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.arc(-r * .35, 0, r * .55, 0, 7); c.stroke(); c.beginPath(); c.arc(r * .35, 0, r * .55, 0, 7); c.stroke(); c.fillStyle = lt; c.beginPath(); c.arc(0, 0, r * .28, 0, 7); c.fill(); break; }
  }
  c.restore();
}
const sprenCache = new Map();
function sprenSprite(o, big, frame = 0) {
  const key = o.id + big + frame;
  if (sprenCache.has(key)) return sprenCache.get(key);
  const size = big ? 40 : 15;
  const s = sprite(size, size, c => drawSpren(c, size / 2, size / 2, big ? 15 : 6, o.shape, o.color, frame), false);
  sprenCache.set(key, s);
  return s;
}

// ---------- order glyphs: small mirrored stroke designs original to this game ----------
const GLYPHS = {
  windrunner: [[0, -1, 0, 1], [-.8, -.3, 0, -1], [-.8, .4, 0, -.2], [-.4, .9, 0, .5]],
  skybreaker: [[0, -1, 0, 1], [-.9, -.8, .9, -.8], [-.9, -.8, 0, .1], [-.4, .9, .4, .9]],
  dustbringer: [[0, -1, -.7, .1], [-.7, .1, 0, .9], [0, -.3, -.3, .2], [-.3, .2, 0, .5]],
  edgedancer: [[-.9, .8, 0, -.9], [0, -.4, -.5, .8], [-.3, .1, 0, .3], [0, .3, 0, .9]],
  truthwatcher: [[-.9, 0, 0, -.7], [-.9, 0, 0, .7], [0, -.25, 0, .25], [0, -1, 0, -.7], [0, .7, 0, 1]],
  lightweaver: [[0, -1, -.8, 0], [-.8, 0, 0, 1], [0, -.5, -.4, 0], [-.4, 0, 0, .5]],
  elsecaller: [[-.8, -.9, -.8, .9], [-.8, -.9, 0, -.4], [-.8, .9, 0, .4], [0, -.4, 0, .4]],
  willshaper: [[-.9, -.5, 0, -1], [-.9, -.5, -.9, .9], [-.9, .1, 0, -.3], [0, -.3, 0, 1]],
  stoneward: [[-.9, .9, .9, .9], [-.9, .9, -.4, -.2], [-.4, -.2, 0, .3], [-.3, -1, 0, -.4], [0, -.4, 0, .9]],
  bondsmith: [[-.8, -.8, 0, 0], [-.8, .8, 0, 0], [-.8, -.8, -.8, .8], [0, -1, 0, -.5], [0, .5, 0, 1]]
};
const glyphCacheArt = new Map();
function orderGlyph(id, size, col) {
  const key = id + size + col;
  if (glyphCacheArt.has(key)) return glyphCacheArt.get(key);
  const r = size / 2 - 1;
  const s = sprite(size, size, c => {
    c.strokeStyle = col; c.lineWidth = Math.max(1.3, size / 11); c.lineCap = 'square';
    for (const [a, b, d, e] of GLYPHS[id]) for (const sg of a === 0 && d === 0 ? [1] : [1, -1]) { c.beginPath(); c.moveTo(size / 2 + a * r * sg, size / 2 + b * r); c.lineTo(size / 2 + d * r * sg, size / 2 + e * r); c.stroke(); }
  }, '#0a0d1c');
  glyphCacheArt.set(key, s);
  return s;
}
const SIGIL_ICON = {
  slash: (c) => { c.fillStyle = TYPES.slash.col; for (let i = 0; i < 8; i++) c.fillRect(1 + i, 8 - i, 2, 1); c.fillRect(1, 8, 2, 2); },
  pierce: (c) => { c.fillStyle = TYPES.pierce.col; c.fillRect(5, 1, 1, 9); c.fillRect(4, 2, 3, 2); c.fillRect(3, 3, 5, 1); },
  crush: (c) => { c.fillStyle = TYPES.crush.col; c.fillRect(2, 2, 7, 4); c.fillRect(5, 6, 1, 4); },
  light: (c) => { c.fillStyle = TYPES.light.col; c.fillRect(5, 1, 1, 9); c.fillRect(1, 5, 9, 1); c.fillRect(4, 3, 3, 5); c.fillRect(3, 4, 5, 3); }
};
const sigilSprites = {};
function sigilSprite(type) { return sigilSprites[type] || (sigilSprites[type] = sprite(11, 11, SIGIL_ICON[type])); }

// ---------- portraits: 44x44 busts ----------
const portraitCache = new Map();
function portrait(pal, key) {
  if (portraitCache.has(key)) return portraitCache.get(key);
  const s = sprite(44, 44, c => {
    const R = (x, y, w, h, q) => { c.fillStyle = q; c.fillRect(x, y, w, h); };
    const hd = mix(pal.hair, '#000000', .3), hl = mix(pal.hair, '#ffffff', .2);
    R(0, 0, 44, 44, mix(pal.coat2, '#0a0d1c', .7));
    if (pal.style === 1) R(9, 12, 26, 24, hd);
    R(5, 34, 34, 10, pal.plate || pal.coat); R(5, 34, 34, 2, pal.plate ? mix(pal.plate, '#ffffff', .3) : pal.trim); R(19, 34, 6, 10, pal.plate ? mix(pal.plate, '#000000', .2) : pal.coat2);
    R(18, 28, 8, 7, pal.skin2);
    R(11, 9, 22, 22, pal.skin); R(12, 30, 20, 2, pal.skin); R(11, 24, 3, 6, pal.skin2); R(30, 24, 3, 6, pal.skin2);
    const eye = pal.eyeGlow || pal.eye;
    R(15, 18, 5, 3, '#f0ece0'); R(25, 18, 5, 3, '#f0ece0'); R(17, 18, 3, 3, eye); R(26, 18, 3, 3, eye);
    R(14, 15, 7, 2, hd); R(24, 15, 7, 2, hd);
    R(21, 21, 2, 5, pal.skin2); R(18, 27, 8, 1, mix(pal.skin2, '#401010', .4));
    R(10, 5, 24, 8, pal.hair); R(9, 8, 3, 12, pal.hair); R(32, 8, 3, 12, pal.hair); R(13, 5, 12, 2, hl); R(12, 13, 4, 2, pal.hair); R(28, 13, 4, 2, pal.hair);
    if (pal.style === 2) { R(17, 0, 10, 6, pal.hair); R(19, 0, 5, 2, hl); }
    if (pal.style === 3) { R(12, 25, 20, 7, pal.hair); R(14, 26, 16, 1, hd); R(18, 27, 8, 1, '#3a1c18'); }
    if (pal.style === 4) { R(33, 12, 4, 26, hd); R(33, 37, 4, 2, pal.trim); }
    if (pal.scar) R(28, 12, 1, 12, '#7c4a3a');
    if (pal.goggles) { R(13, 9, 18, 5, '#8a6a30'); R(14, 10, 6, 3, '#9fe8ff'); R(24, 10, 6, 3, '#9fe8ff'); }
    if (pal.plate) { R(10, 4, 24, 5, pal.plate); R(9, 8, 3, 14, pal.plate); R(32, 8, 3, 14, pal.plate); R(12, 5, 14, 1, mix(pal.plate, '#ffffff', .5)); }
  });
  portraitCache.set(key, s);
  return s;
}
function sprenPortrait(o) {
  const key = 'spren-' + o.id;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const s = sprite(44, 44, c => { c.fillStyle = mix(o.dark, '#05060f', .72); c.fillRect(0, 0, 44, 44); c.fillStyle = rgba(o.color, .18); c.beginPath(); c.arc(22, 22, 20, 0, 7); c.fill(); drawSpren(c, 22, 22, 15, o.shape, o.color, 1); });
  portraitCache.set(key, s);
  return s;
}

// ---------- world objects ----------
const OBJ = {
  tree: { w: 30, h: 34, solid: [10, 6], draw: (c) => {
    c.fillStyle = '#4a3626'; c.fillRect(12, 18, 6, 15); c.fillStyle = '#5e4632'; c.fillRect(13, 18, 2, 15); c.fillRect(8, 29, 14, 4); c.fillStyle = '#4a3626'; c.fillRect(6, 31, 18, 2);
    for (const [x, y, r, q] of [[8, 13, 8, '#3f6a4a'], [22, 13, 8, '#36603f'], [15, 7, 9, '#4d7c55'], [15, 16, 8, '#40704a']]) { c.fillStyle = q; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    c.fillStyle = '#7fb078'; for (const [x, y] of [[10, 5], [18, 4], [14, 9], [21, 10], [6, 12]]) c.fillRect(x, y, 2, 1);
  } },
  boulder: { w: 22, h: 16, solid: [18, 8], draw: (c) => { c.fillStyle = '#6b5d4e'; c.beginPath(); c.moveTo(1, 15); c.lineTo(3, 6); c.lineTo(9, 1); c.lineTo(17, 3); c.lineTo(21, 10); c.lineTo(20, 15); c.fill(); c.fillStyle = '#857565'; c.beginPath(); c.moveTo(5, 6); c.lineTo(9, 3); c.lineTo(15, 4); c.lineTo(12, 8); c.fill(); c.fillStyle = '#4e4338'; c.fillRect(2, 13, 18, 2); } },
  boulderDark: { w: 22, h: 16, solid: [18, 8], draw: (c) => { c.fillStyle = '#3e4244'; c.beginPath(); c.moveTo(1, 15); c.lineTo(3, 6); c.lineTo(9, 1); c.lineTo(17, 3); c.lineTo(21, 10); c.lineTo(20, 15); c.fill(); c.fillStyle = '#585e60'; c.beginPath(); c.moveTo(5, 6); c.lineTo(9, 3); c.lineTo(15, 4); c.lineTo(12, 8); c.fill(); } },
  crate: { w: 15, h: 15, solid: [14, 8], draw: (c) => { c.fillStyle = '#7c5e3c'; c.fillRect(0, 2, 15, 13); c.fillStyle = '#967448'; c.fillRect(0, 2, 15, 2); c.fillStyle = '#54401f'; c.fillRect(0, 8, 15, 1); c.fillRect(3, 4, 1, 11); c.fillRect(11, 4, 1, 11); } },
  lamp: { w: 7, h: 22, solid: [4, 3], light: { r: 58, col: '#bfe4ff' }, draw: (c) => { c.fillStyle = '#3c3430'; c.fillRect(3, 6, 1, 15); c.fillRect(1, 20, 5, 2); c.fillStyle = '#5a4c44'; c.fillRect(1, 4, 5, 1); c.fillRect(1, 0, 5, 1); c.fillStyle = '#d4f0ff'; c.fillRect(2, 1, 3, 3); } },
  lampDead: { w: 15, h: 26, solid: [10, 6], draw: (c) => { c.fillStyle = '#2c3034'; c.fillRect(4, 8, 7, 16); c.fillRect(1, 22, 13, 4); c.fillStyle = '#40464c'; c.fillRect(2, 2, 11, 7); c.fillStyle = '#20242a'; c.fillRect(5, 3, 5, 5); } },
  lampLit: { w: 15, h: 26, solid: [10, 6], light: { r: 76, col: '#9fe0ff' }, draw: (c) => { c.fillStyle = '#2c3034'; c.fillRect(4, 8, 7, 16); c.fillRect(1, 22, 13, 4); c.fillStyle = '#40464c'; c.fillRect(2, 2, 11, 7); c.fillStyle = '#d4f6ff'; c.fillRect(5, 3, 5, 5); } },
  tent: { w: 40, h: 30, solid: [34, 12], draw: (c) => { c.fillStyle = '#7f6d4e'; c.beginPath(); c.moveTo(0, 29); c.lineTo(20, 2); c.lineTo(40, 29); c.fill(); c.fillStyle = '#9b8862'; c.beginPath(); c.moveTo(20, 2); c.lineTo(40, 29); c.lineTo(28, 29); c.fill(); c.fillStyle = '#22180f'; c.beginPath(); c.moveTo(14, 29); c.lineTo(20, 14); c.lineTo(26, 29); c.fill(); } },
  fire: { w: 16, h: 12, solid: [12, 6], light: { r: 76, col: '#ffb060' }, draw: (c) => { c.fillStyle = '#4a3626'; c.fillRect(1, 9, 14, 2); c.fillRect(3, 7, 10, 2); c.fillStyle = '#6e7074'; c.fillRect(0, 10, 3, 2); c.fillRect(13, 10, 3, 2); } },
  stall: { w: 42, h: 34, solid: [38, 12], draw: (c) => { c.fillStyle = '#5a4128'; c.fillRect(2, 8, 3, 25); c.fillRect(37, 8, 3, 25); c.fillStyle = '#7c5e3c'; c.fillRect(1, 22, 40, 11); c.fillStyle = '#967448'; c.fillRect(1, 22, 40, 2); for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#3e7a6e' : '#d8c284'; c.fillRect(i * 6, 2, 6, 7); } c.fillStyle = '#c04c34'; c.fillRect(7, 19, 4, 3); c.fillStyle = '#7fc8ff'; c.fillRect(16, 20, 3, 2); c.fillStyle = '#e0c05c'; c.fillRect(25, 19, 5, 3); } },
  // Rosharan buildings face away from the storm: thick, low, curved crem-caked stone.
  house: { w: 64, h: 52, solid: [60, 26], draw: (c) => {
    c.fillStyle = '#8c7350'; c.fillRect(2, 22, 60, 30); c.fillStyle = '#7a6444'; for (let y = 26; y < 50; y += 6) c.fillRect(2, y, 60, 1);
    c.fillStyle = '#6e5a3c'; c.fillRect(2, 22, 5, 30);
    c.fillStyle = '#5c4a35'; c.beginPath(); c.moveTo(0, 26); c.quadraticCurveTo(4, 2, 42, 3); c.quadraticCurveTo(62, 4, 64, 26); c.fill();
    c.fillStyle = '#6f5b42'; c.beginPath(); c.moveTo(8, 20); c.quadraticCurveTo(12, 7, 42, 7); c.quadraticCurveTo(54, 8, 58, 20); c.fill();
    c.fillStyle = '#2e2218'; c.fillRect(26, 32, 12, 20); c.fillStyle = '#5a4128'; c.fillRect(25, 31, 14, 2); c.fillStyle = '#c9a860'; c.fillRect(35, 42, 1, 2);
    c.fillStyle = '#20314a'; c.fillRect(44, 32, 9, 7); c.fillStyle = '#ffdf9a'; c.fillRect(45, 33, 7, 5);
  } },
  inn: { w: 80, h: 58, solid: [76, 28], light: { r: 40, col: '#ffcf80', dy: -10 }, draw: (c) => {
    c.fillStyle = '#967c56'; c.fillRect(2, 24, 76, 34); c.fillStyle = '#806a48'; for (let y = 29; y < 56; y += 6) c.fillRect(2, y, 76, 1);
    c.fillStyle = '#7c4f3a'; c.beginPath(); c.moveTo(0, 28); c.quadraticCurveTo(6, 2, 54, 3); c.quadraticCurveTo(76, 4, 80, 28); c.fill();
    c.fillStyle = '#935f47'; c.beginPath(); c.moveTo(10, 22); c.quadraticCurveTo(14, 8, 54, 8); c.quadraticCurveTo(68, 9, 72, 22); c.fill();
    c.fillStyle = '#2e2218'; c.fillRect(33, 36, 14, 22); c.fillStyle = '#ffdf9a'; c.fillRect(10, 36, 12, 8); c.fillRect(58, 36, 12, 8); c.fillStyle = '#5a4128'; c.fillRect(15, 36, 2, 8); c.fillRect(63, 36, 2, 8);
    c.fillStyle = '#5a4128'; c.fillRect(30, 26, 20, 7); c.fillStyle = '#e0c05c'; c.fillRect(33, 28, 14, 3);
  } },
  hall: { w: 96, h: 66, solid: [92, 30], draw: (c) => {
    c.fillStyle = '#7f7c78'; c.fillRect(2, 26, 92, 40); c.fillStyle = '#6c6a66'; for (let y = 31; y < 64; y += 6) c.fillRect(2, y, 92, 1); for (let x = 12; x < 92; x += 20) c.fillRect(x, 26, 1, 40);
    c.fillStyle = '#44506e'; c.beginPath(); c.moveTo(0, 30); c.quadraticCurveTo(8, 2, 66, 3); c.quadraticCurveTo(92, 4, 96, 30); c.fill();
    c.fillStyle = '#53617f'; c.beginPath(); c.moveTo(12, 24); c.quadraticCurveTo(18, 8, 66, 8); c.quadraticCurveTo(82, 9, 86, 24); c.fill();
    c.fillStyle = '#20182a'; c.fillRect(38, 40, 20, 26); c.fillStyle = '#c9a860'; c.fillRect(36, 38, 24, 2); c.fillRect(47, 40, 2, 26);
    c.fillStyle = '#c04c34'; c.fillRect(14, 34, 8, 20); c.fillRect(74, 34, 8, 20); c.fillStyle = '#e0c05c'; c.fillRect(16, 38, 4, 4); c.fillRect(76, 38, 4, 4);
  } },
  workshop: { w: 64, h: 54, solid: [60, 26], light: { r: 34, col: '#9fe0ff', dy: -20 }, draw: (c) => {
    c.fillStyle = '#6e6658'; c.fillRect(2, 24, 60, 30); c.fillStyle = '#4c5e70'; c.beginPath(); c.moveTo(0, 28); c.quadraticCurveTo(4, 3, 42, 4); c.quadraticCurveTo(62, 5, 64, 28); c.fill();
    c.fillStyle = '#5e7286'; c.beginPath(); c.moveTo(8, 22); c.quadraticCurveTo(12, 9, 42, 9); c.quadraticCurveTo(54, 10, 58, 22); c.fill();
    c.fillStyle = '#2e2218'; c.fillRect(10, 34, 12, 20); c.fillStyle = '#9fe0ff'; c.fillRect(32, 34, 8, 8); c.fillRect(46, 34, 8, 8);
    c.fillStyle = '#c97c4c'; for (let i = 0; i < 4; i++) c.fillRect(30 + i * 7, 45, 4, 4);
  } },
  stormwall: { w: 16, h: 28, solid: [16, 10], draw: (c) => { c.fillStyle = '#6c5a40'; c.fillRect(0, 4, 16, 24); c.fillStyle = '#84704f'; c.fillRect(0, 2, 16, 4); for (let y = 8; y < 26; y += 5) { c.fillStyle = '#54452f'; c.fillRect(0, y, 16, 1); } } },
  gatePort: { w: 16, h: 52, solid: [16, 48], draw: (c) => { c.fillStyle = '#26343c'; c.fillRect(0, 2, 16, 50); c.fillStyle = '#3e5664'; for (let x = 1; x < 16; x += 4) c.fillRect(x, 2, 2, 50); c.fillStyle = '#1a242a'; for (let y = 6; y < 50; y += 9) c.fillRect(0, y, 16, 2); c.fillStyle = '#7fd0f0'; c.fillRect(6, 24, 4, 4); } },
  doorVault: { w: 80, h: 44, solid: [80, 40], draw: (c) => { c.fillStyle = '#20263f'; c.fillRect(0, 0, 80, 44); c.fillStyle = '#6e7ca4'; c.fillRect(4, 2, 72, 2); c.fillRect(4, 2, 2, 42); c.fillRect(74, 2, 2, 42); c.fillStyle = '#343c5e'; c.fillRect(6, 4, 33, 40); c.fillRect(41, 4, 33, 40); c.fillStyle = '#7fd0f0'; for (let i = 0; i < 5; i++) { c.fillRect(20, 8 + i * 7, 6, 2); c.fillRect(54, 8 + i * 7, 6, 2); } } },
  pillar: { w: 16, h: 36, solid: [14, 8], draw: (c) => { c.fillStyle = '#3f4866'; c.fillRect(2, 4, 12, 28); c.fillStyle = '#5a668c'; c.fillRect(3, 4, 3, 28); c.fillStyle = '#6e7ca4'; c.fillRect(0, 0, 16, 5); c.fillRect(0, 31, 16, 5); c.fillStyle = '#2d3550'; c.fillRect(11, 5, 3, 26); } },
  statue: { w: 22, h: 42, solid: [18, 10], draw: (c) => { c.fillStyle = '#4b5470'; c.fillRect(2, 34, 18, 8); c.fillStyle = '#5a668c'; c.fillRect(6, 12, 10, 22); c.fillRect(7, 3, 8, 9); c.fillRect(3, 14, 3, 14); c.fillRect(16, 14, 3, 14); c.fillStyle = '#737fa8'; c.fillRect(7, 3, 3, 9); c.fillRect(6, 12, 3, 22); c.fillStyle = '#7fd0f0'; c.fillRect(10, 18, 3, 3); c.fillRect(10, 7, 3, 1); } },
  mural: { w: 64, h: 28, solid: [64, 14], draw: (c) => { c.fillStyle = '#2b3252'; c.fillRect(0, 0, 64, 28); c.fillStyle = '#6e7ca4'; c.fillRect(0, 0, 64, 2); c.fillRect(0, 26, 64, 2); c.strokeStyle = '#7fd0f0'; c.lineWidth = 1; c.beginPath(); c.arc(32, 14, 10, 0, 7); c.stroke(); c.fillStyle = '#c9e8f4'; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; c.fillRect(32 + Math.cos(a) * 10 - 1, 14 + Math.sin(a) * 10 - 1, 2, 2); } } },
  plate: { w: 18, h: 18, flat: true, draw: (c) => { c.fillStyle = '#20263f'; c.fillRect(0, 0, 18, 18); c.fillStyle = '#6e7ca4'; c.fillRect(1, 1, 16, 16); c.fillStyle = '#2b3252'; c.fillRect(3, 3, 12, 12); } },
  oathgate: { w: 120, h: 64, flat: true, light: { r: 110, col: '#9fd8ff', dy: 28 }, draw: (c) => {
    c.fillStyle = '#20263f'; c.beginPath(); c.ellipse(60, 32, 59, 31, 0, 0, 7); c.fill(); c.fillStyle = '#566290'; c.beginPath(); c.ellipse(60, 32, 54, 27, 0, 0, 7); c.fill(); c.fillStyle = '#2b3252'; c.beginPath(); c.ellipse(60, 32, 46, 22, 0, 0, 7); c.fill();
    c.fillStyle = '#7fd0f0'; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; c.fillRect(60 + Math.cos(a) * 49 - 1, 32 + Math.sin(a) * 24, 3, 2); } c.fillStyle = '#bfefff'; c.beginPath(); c.ellipse(60, 32, 10, 5, 0, 0, 7); c.fill();
  } },
  chest: { w: 16, h: 14, solid: [15, 7], draw: (c) => { c.fillStyle = '#6e4a24'; c.fillRect(0, 3, 16, 11); c.fillStyle = '#8c6230'; c.fillRect(0, 3, 16, 3); c.fillStyle = '#e0c05c'; c.fillRect(0, 6, 16, 1); c.fillRect(7, 5, 2, 4); c.fillStyle = '#40280f'; c.fillRect(0, 12, 16, 2); } },
  chestOpen: { w: 16, h: 14, solid: [15, 7], draw: (c) => { c.fillStyle = '#6e4a24'; c.fillRect(0, 6, 16, 8); c.fillStyle = '#231406'; c.fillRect(1, 4, 14, 4); c.fillStyle = '#8c6230'; c.fillRect(0, 0, 16, 4); c.fillStyle = '#40280f'; c.fillRect(0, 12, 16, 2); } },
  spot: { w: 16, h: 10, flat: true, light: { r: 22, col: '#ffffff' }, draw: (c) => { c.fillStyle = '#d8ecff'; c.fillRect(2, 4, 12, 2); c.fillRect(6, 1, 4, 8); c.fillStyle = '#ffffff'; c.fillRect(7, 3, 2, 4); } },
  deadeye: { w: 18, h: 36, solid: [12, 7], draw: (c) => { c.fillStyle = '#9ea2b8'; c.beginPath(); c.moveTo(9, 6); c.lineTo(16, 35); c.lineTo(2, 35); c.fill(); c.fillStyle = '#c4c8dc'; c.beginPath(); c.arc(9, 7, 6, 0, 7); c.fill(); c.fillStyle = '#10101a'; c.fillRect(5, 5, 3, 4); c.fillRect(10, 5, 3, 4); c.fillStyle = '#7e8298'; c.fillRect(9, 13, 6, 22); } },
  sprenfolk: { w: 18, h: 32, solid: [12, 6], draw: (c) => { c.fillStyle = '#d4f0ff'; c.fillRect(6, 4, 7, 7); c.fillStyle = '#8fbfe0'; c.fillRect(5, 11, 9, 20); c.fillRect(3, 12, 2, 12); c.fillRect(14, 12, 2, 12); c.fillStyle = '#1a2a3a'; c.fillRect(7, 6, 2, 2); c.fillRect(10, 6, 2, 2); } },
  crystal: { w: 16, h: 24, solid: [12, 6], light: { r: 46, col: '#9fb8ff' }, draw: (c) => { c.fillStyle = '#6a7ad8'; c.beginPath(); c.moveTo(8, 0); c.lineTo(14, 8); c.lineTo(12, 23); c.lineTo(4, 23); c.lineTo(2, 8); c.fill(); c.fillStyle = '#b4c4ff'; c.beginPath(); c.moveTo(8, 0); c.lineTo(5, 8); c.lineTo(6, 20); c.lineTo(8, 22); c.fill(); } },
  rift: { w: 40, h: 58, flat: false, solid: [30, 10], light: { r: 90, col: '#ff5a44' }, draw: (c) => { c.fillStyle = '#ff5a44'; c.beginPath(); c.moveTo(20, 0); c.quadraticCurveTo(34, 30, 20, 56); c.quadraticCurveTo(6, 30, 20, 0); c.fill(); c.fillStyle = '#ffd0b0'; c.beginPath(); c.moveTo(20, 8); c.quadraticCurveTo(27, 30, 20, 48); c.quadraticCurveTo(13, 30, 20, 8); c.fill(); } }
};
const objCache = new Map();
function objSprite(kind) {
  if (objCache.has(kind)) return objCache.get(kind);
  const d = OBJ[kind];
  if (!d) throw new Error('Unknown object ' + kind);
  const s = sprite(d.w, d.h, d.draw, d.flat ? false : '#141022', !d.flat);
  objCache.set(kind, s);
  return s;
}
// Rockbuds and grass flinch back from anything that walks near them, as they do on Roshar.
const DECOR = {
  grass: (c, x, y, k, t) => { const h = Math.round(7 * k); if (h < 1) { c.fillStyle = '#3a2c20'; c.fillRect(x - 1, y, 3, 1); return; } const s = Math.round(Math.sin(t * 2 + x) * k); c.fillStyle = '#6e8f4c'; c.fillRect(x - 2 + s, y - h, 1, h); c.fillRect(x + 2 + s, y - h + 1, 1, h - 1); c.fillStyle = '#88a95e'; c.fillRect(x + s, y - h - 1, 1, h + 1); c.fillStyle = '#3a2c20'; c.fillRect(x - 2, y, 5, 1); },
  bud: (c, x, y, k, t) => { c.fillStyle = '#6a5a44'; c.fillRect(x - 3, y - 2, 7, 3); c.fillStyle = '#54472f'; c.fillRect(x - 3, y, 7, 1); const h = Math.round(6 * k); if (h > 0) { c.fillStyle = '#2f8a6c'; c.fillRect(x - 2, y - 2 - h, 1, h); c.fillRect(x + 2, y - 2 - h, 1, h); c.fillStyle = '#4fbf96'; c.fillRect(x, y - 3 - h, 1, h + 1); c.fillStyle = '#e8a050'; c.fillRect(x, y - 4 - h, 1, 1); } },
  vine: (c, x, y, k, t) => { const h = Math.round(9 * k); c.fillStyle = '#7a3e44'; c.fillRect(x - 2, y - 1, 5, 2); if (h > 0) { for (let i = 0; i < h; i++) { c.fillStyle = i % 2 ? '#a65560' : '#8f4650'; c.fillRect(x + Math.round(Math.sin(i * .9 + t * 2 + x) * 2), y - 1 - i, 1, 1); } } },
  frill: (c, x, y, k, t) => { const h = Math.round(5 * k); c.fillStyle = '#22383a'; c.fillRect(x - 2, y, 5, 1); if (h > 0) { c.fillStyle = '#3f8a7c'; c.fillRect(x - 2, y - h, 2, h); c.fillStyle = '#62c0a8'; c.fillRect(x + 1, y - h - 1, 2, h + 1); } },
  gem: (c, x, y, k, t) => { c.fillStyle = '#7fd0f0'; c.fillRect(x - 1, y - 3, 3, 3); c.fillStyle = '#d4f6ff'; c.fillRect(x, y - 3, 1, 1); c.fillStyle = '#20263f'; c.fillRect(x - 2, y, 5, 1); },
  bead: (c, x, y, k, t) => { c.fillStyle = '#8a90c0'; c.fillRect(x, y - 1, 2, 2); c.fillStyle = '#d4d8f0'; c.fillRect(x, y - 1, 1, 1); }
};

// ---------- enemies (facing left). Art functions receive (c, frame). ----------
const ENEMY_ART = {
  cremling: { w: 26, h: 18, draw: (c, f) => {
    c.fillStyle = '#4a3a2a'; for (let i = 0; i < 3; i++) { const q = f ? 1 : 0; c.fillRect(4 + i * 6, 12, 2, 5 - (i + f) % 2); c.fillRect(1 + i * 7, 10, 3, 1 + q); }
    c.fillStyle = '#8c5a3c'; c.beginPath(); c.ellipse(13, 9, 11, 7, 0, 0, 7); c.fill(); c.fillStyle = '#a97048'; c.beginPath(); c.ellipse(11, 6, 6, 3, 0, 0, 7); c.fill(); c.fillStyle = '#5a3a24'; c.fillRect(6, 8, 14, 1); c.fillRect(12, 3, 1, 12);
    c.fillStyle = '#e8e0b0'; c.fillRect(3, 6, 2, 2); c.fillStyle = '#3a2214'; c.fillRect(0, 9, 4, 1); c.fillRect(0, 11, 4, 1);
  } },
  axehound: { w: 40, h: 30, draw: (c, f) => {
    c.fillStyle = '#3e3028'; const q = f ? 2 : 0;
    c.fillRect(8, 22, 4, 8 - q); c.fillRect(14, 22, 4, 8); c.fillRect(25, 22, 4, 8); c.fillRect(31, 22, 4, 8 - q);
    c.fillStyle = '#6e5540'; c.fillRect(10, 11, 26, 13); c.fillRect(34, 8, 4, 6); c.fillStyle = '#4e3a2a'; for (let x = 13; x < 36; x += 6) c.fillRect(x, 10, 4, 3);
    c.fillStyle = '#7a6048'; c.fillRect(1, 9, 13, 11); c.fillStyle = '#d8d4b8'; c.fillRect(0, 13, 2, 2); c.fillRect(3, 17, 2, 3); c.fillRect(7, 17, 2, 3); c.fillRect(11, 17, 2, 3); c.fillStyle = '#f0e090'; c.fillRect(4, 11, 3, 2); c.fillStyle = '#3e2c20'; c.fillRect(10, 5, 3, 6); c.fillRect(5, 6, 3, 4); c.fillStyle = '#c04c34'; c.fillRect(2, 15, 9, 1);
  } },
  lurg: { w: 34, h: 26, draw: (c, f) => {
    c.fillStyle = '#3f5a4a'; c.beginPath(); c.ellipse(17, 15, 15, 10 + f, 0, 0, 7); c.fill(); c.fillStyle = '#527a60'; c.beginPath(); c.ellipse(16, 11, 11, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#d8d890'; c.fillRect(5, 5, 6, 6); c.fillRect(17, 4, 6, 6); c.fillStyle = '#141408'; c.fillRect(6, 6, 3, 4); c.fillRect(18, 5, 3, 4);
    c.fillStyle = '#1c2a22'; c.fillRect(2, 16, 22, 2); c.fillStyle = '#2c4034'; c.fillRect(2, 23, 10, 3); c.fillRect(22, 23, 11, 3);
  } },
  chull: { w: 48, h: 34, draw: (c, f) => {
    c.fillStyle = '#3e3244'; for (let i = 0; i < 5; i++) c.fillRect(8 + i * 8, 26, 3, 8 - (i + f) % 2 * 2);
    c.fillStyle = '#6e5a7c'; c.beginPath(); c.ellipse(26, 16, 21, 14, 0, 0, 7); c.fill(); c.fillStyle = '#8f78a0'; c.beginPath(); c.ellipse(24, 10, 14, 6, 0, 0, 7); c.fill(); c.fillStyle = '#4e405a'; for (let x = 12; x < 44; x += 7) c.fillRect(x, 6, 1, 22);
    c.fillStyle = '#5c4c68'; c.fillRect(1, 17, 12, 8); c.fillRect(0, 14, 6, 4); c.fillStyle = '#e0d890'; c.fillRect(4, 12, 2, 2); c.fillRect(9, 12, 2, 2);
  } },
  whitespine: { w: 58, h: 38, draw: (c, f) => {
    c.fillStyle = '#6e7078'; c.fillRect(10, 28, 6, 10 - f * 2); c.fillRect(20, 28, 6, 10); c.fillRect(36, 28, 6, 10); c.fillRect(46, 28, 6, 10 - f * 2);
    c.fillStyle = '#d8d8d4'; c.beginPath(); c.ellipse(32, 20, 24, 12, 0, 0, 7); c.fill(); c.fillStyle = '#b4b4b4'; c.fillRect(14, 26, 38, 4); c.fillStyle = '#f4f4f0'; for (let x = 16; x < 52; x += 5) { c.fillRect(x, 5, 2, 9); c.fillRect(x + 1, 3, 1, 3); }
    c.fillStyle = '#d0d0cc'; c.fillRect(1, 12, 17, 15); c.fillStyle = '#f0f0e8'; c.fillRect(0, 26, 3, 9); c.fillRect(12, 26, 3, 7); c.fillStyle = '#c03828'; c.fillRect(5, 16, 4, 3); c.fillStyle = '#7a2a20'; c.fillRect(3, 23, 12, 2);
  } },
  voidwisp: { w: 28, h: 34, draw: (c, f) => {
    c.fillStyle = '#280f30'; c.beginPath(); c.moveTo(14, 1 + f); c.quadraticCurveTo(30, 16, 22, 33); c.lineTo(17, 28); c.lineTo(13, 33); c.lineTo(9, 28); c.lineTo(4, 33); c.quadraticCurveTo(-2, 16, 14, 1 + f); c.fill();
    c.fillStyle = '#6a2340'; c.beginPath(); c.moveTo(14, 6); c.quadraticCurveTo(23, 16, 18, 26); c.lineTo(10, 26); c.quadraticCurveTo(5, 16, 14, 6); c.fill();
    c.fillStyle = '#ff5a44'; c.fillRect(8, 13, 4, 3); c.fillRect(16, 13, 4, 3);
  } },
  shade: { w: 34, h: 44, draw: (c, f) => {
    c.fillStyle = '#20204a'; c.beginPath(); c.moveTo(17, 2); c.lineTo(30, 18); c.lineTo(26, 43); c.lineTo(8, 43); c.lineTo(4, 18); c.fill(); c.fillStyle = '#464a90'; c.beginPath(); c.moveTo(17, 4); c.lineTo(12, 18); c.lineTo(15, 38); c.lineTo(21, 20); c.fill();
    c.fillStyle = '#9fa8e8'; c.fillRect(11, 13, 3, 3); c.fillRect(20, 13, 3, 3);
    c.fillStyle = '#d4d8f0'; for (let i = 0; i < 6; i++) c.fillRect(3 + (i * 5) % 28, 22 + (i * 7 + f * 3) % 20, 2, 2);
    c.fillStyle = '#20204a'; c.fillRect(0, 18, 5, 15); c.fillRect(29, 18, 5, 15);
  } },
  angerspren: { w: 30, h: 28, draw: (c, f) => {
    c.fillStyle = '#b02818'; c.beginPath(); c.ellipse(15, 19, 14, 9, 0, 0, 7); c.fill(); c.fillStyle = '#e8481e'; c.beginPath(); c.ellipse(14, 17, 10, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#ff9a3c'; for (let i = 0; i < 5; i++) { const x = 3 + i * 6, h = 4 + ((i + f) % 3) * 3; c.fillRect(x, 13 - h, 3, h); }
    c.fillStyle = '#fff0b0'; c.fillRect(8, 16, 3, 2); c.fillRect(18, 16, 3, 2);
  } }
};
function humanEnemyArt(palName, scale, pose = { dir: 2, armF: -2, armRaise: true }) {
  const w = Math.round(24 * scale), h = Math.round(32 * scale);
  return { w, h, draw: (c, f) => {
    c.save(); c.translate(w, 0); c.scale(-w / 24, h / 32);
    drawHumanoid(c, NPC_PALS[palName], Object.assign({}, pose, { bob: f ? 1 : 0 }));
    c.restore();
  } };
}
ENEMY_ART.deserter = humanEnemyArt('deserter', 1.2);
ENEMY_ART.scout = humanEnemyArt('listener', 1.25);
ENEMY_ART.warform = humanEnemyArt('listener', 1.5);
ENEMY_ART.hadrin = humanEnemyArt('hadrin', 1.9);
ENEMY_ART.regal = { w: 44, h: 60, draw: (c, f) => {
  ENEMY_ART.warform.draw(c, f);
  c.fillStyle = '#ff5a44'; for (let i = 0; i < 6; i++) { const x = 4 + i * 6, y = 4 + (i * 7 + f * 5) % 40; c.fillRect(x, y, 1, 7); c.fillRect(x + 1, y + 6, 1, 4); }
} };
ENEMY_ART.hollow = { w: 44, h: 60, draw: (c, f) => {
  ENEMY_ART.warform.draw(c, f);
  c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(30,20,70,.55)'; c.fillRect(0, 0, 44, 60); c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#9fa8e8'; c.fillRect(11, 14, 3, 2);
} };
// Fused: an elongated figure drifting above the ground in shredded robes of ash.
ENEMY_ART.cantor = { w: 62, h: 92, draw: (c, f) => {
  c.fillStyle = '#231c28'; c.beginPath(); c.moveTo(31, 18); c.quadraticCurveTo(56, 40, 50, 90 - f); c.lineTo(42, 82); c.lineTo(35, 91); c.lineTo(27, 81); c.lineTo(19, 91); c.lineTo(12, 82 + f); c.quadraticCurveTo(6, 40, 31, 18); c.fill();
  c.fillStyle = '#463a4c'; c.beginPath(); c.moveTo(31, 22); c.quadraticCurveTo(44, 44, 38, 76); c.lineTo(24, 76); c.quadraticCurveTo(18, 44, 31, 22); c.fill();
  c.fillStyle = '#c97c4c'; for (let i = 0; i < 6; i++) c.fillRect(27 + (i % 2) * 7, 32 + i * 7, 2, 4);
  c.fillStyle = '#1a141e'; c.fillRect(4, 28, 16, 5); c.fillRect(42, 28, 16, 5); c.fillRect(0, 30, 6, 22); c.fillRect(56, 30, 6, 22);
  c.fillStyle = '#c04c34'; c.fillRect(1, 50, 4, 7); c.fillRect(57, 50, 4, 7);
  c.fillStyle = '#20171f'; c.fillRect(23, 4, 16, 18); c.fillStyle = '#c04c34'; c.fillRect(23, 10, 16, 3); c.fillRect(30, 4, 2, 18); c.fillStyle = '#ff4a2a'; c.fillRect(25, 8, 4, 2); c.fillRect(33, 8, 4, 2);
  c.fillStyle = '#100c14'; c.fillRect(20, 1, 22, 4); c.fillRect(18, 4, 4, 18); c.fillRect(40, 4, 4, 18);
} };
ENEMY_ART.hunter = { w: 70, h: 96, draw: (c, f) => {
  c.fillStyle = '#20204a'; c.beginPath(); c.moveTo(35, 2); c.lineTo(58, 30); c.lineTo(48, 92); c.lineTo(22, 92); c.lineTo(12, 30); c.fill(); c.fillStyle = '#464a90'; c.beginPath(); c.moveTo(35, 6); c.lineTo(24, 32); c.lineTo(30, 80); c.lineTo(42, 32); c.fill();
  c.fillStyle = '#9fa8e8'; c.fillRect(27, 20, 5, 3); c.fillRect(39, 20, 5, 3); c.fillStyle = '#d4d8f0'; for (let i = 0; i < 12; i++) c.fillRect(14 + (i * 13) % 42, 34 + (i * 11 + f * 3) % 54, 2, 2);
  c.fillStyle = '#2b2b60'; c.fillRect(2, 30, 13, 8); c.fillRect(55, 30, 13, 8); c.fillRect(0, 36, 6, 30); c.fillRect(64, 36, 6, 30);
  c.fillStyle = '#0c0a16'; c.fillRect(1, 12, 3, 80); c.fillStyle = '#9fa8e8'; c.fillRect(0, 2, 5, 12);
} };
ENEMY_ART.chasmfiend = { w: 170, h: 138, draw: (c, f) => {
  // legs
  c.fillStyle = '#3e3244';
  for (const [x0, y0, x1, y1] of [[110, 92, 128, 136], [132, 90, 158, 136], [86, 96, 76, 136], [64, 98, 46, 136]]) { c.lineWidth = 6; c.strokeStyle = '#3e3244'; c.beginPath(); c.moveTo(x0, y0); c.lineTo((x0 + x1) / 2 + 8, y0 - 8); c.lineTo(x1, y1); c.stroke(); }
  // body plates
  c.fillStyle = '#54486a'; c.beginPath(); c.ellipse(102, 70, 58, 40, 0, 0, 7); c.fill(); c.fillStyle = '#6e5a84'; c.beginPath(); c.ellipse(96, 58, 44, 25, 0, 0, 7); c.fill();
  c.strokeStyle = '#36304a'; c.lineWidth = 2; for (let x = 60; x < 150; x += 16) { c.beginPath(); c.moveTo(x, 34); c.quadraticCurveTo(x + 6, 72, x, 106); c.stroke(); }
  // front claws
  c.strokeStyle = '#2c2436'; c.lineWidth = 7; c.beginPath(); c.moveTo(56, 72); c.quadraticCurveTo(22, 58 + f * 3, 14, 102); c.stroke(); c.beginPath(); c.moveTo(74, 86); c.quadraticCurveTo(44, 94, 34, 126); c.stroke();
  c.fillStyle = '#e4dcc0'; c.beginPath(); c.moveTo(10, 100); c.lineTo(20, 100); c.lineTo(11, 122); c.fill(); c.beginPath(); c.moveTo(30, 124); c.lineTo(40, 124); c.lineTo(31, 136); c.fill();
  // head
  c.fillStyle = '#3e3050'; c.beginPath(); c.moveTo(70, 40); c.lineTo(20, 32); c.lineTo(12, 54); c.lineTo(28, 70); c.lineTo(68, 72); c.fill(); c.fillStyle = '#6e5a84'; c.beginPath(); c.moveTo(66, 42); c.lineTo(26, 36); c.lineTo(22, 48); c.lineTo(66, 54); c.fill();
  c.fillStyle = '#ffe06a'; c.fillRect(28, 42, 7, 4); c.fillRect(44, 44, 6, 3);
  c.fillStyle = '#1a1020'; c.fillRect(16, 58, 42, 6); c.fillStyle = '#efe6c8'; for (let x = 18; x < 56; x += 6) { c.fillRect(x, 58, 3, 4); c.fillRect(x + 2, 62, 2, 3); }
  // spines
  c.fillStyle = '#88749c'; for (let i = 0; i < 7; i++) { const x = 66 + i * 13; c.beginPath(); c.moveTo(x, 34); c.lineTo(x + 7, 8 + (i % 3) * 8); c.lineTo(x + 11, 34); c.fill(); }
} };
ENEMY_ART.thunderclast = { w: 178, h: 158, draw: (c, f) => {
  c.fillStyle = '#3a3036'; c.beginPath(); c.moveTo(62, 52); c.lineTo(136, 44); c.lineTo(158, 96); c.lineTo(132, 130); c.lineTo(74, 130); c.lineTo(46, 96); c.fill();
  c.fillStyle = '#54464c'; c.beginPath(); c.moveTo(72, 58); c.lineTo(118, 52); c.lineTo(124, 100); c.lineTo(80, 106); c.fill();
  c.fillStyle = '#2c2428'; c.fillRect(66, 128, 28, 30); c.fillRect(112, 128, 32, 30); c.fillStyle = '#3e3438'; c.fillRect(68, 128, 10, 30); c.fillRect(114, 128, 10, 30);
  // arms
  c.fillStyle = '#2c2428'; c.beginPath(); c.moveTo(56, 58); c.lineTo(12, 76 + f * 2); c.lineTo(2, 124); c.lineTo(30, 130); c.lineTo(46, 92); c.fill(); c.beginPath(); c.moveTo(142, 56); c.lineTo(174, 90); c.lineTo(170, 132); c.lineTo(144, 124); c.lineTo(136, 92); c.fill();
  c.fillStyle = '#54464c'; c.fillRect(4, 118, 26, 14); c.fillRect(146, 122, 26, 14);
  // skull
  c.fillStyle = '#463a40'; c.beginPath(); c.moveTo(66, 48); c.lineTo(76, 12); c.lineTo(122, 10); c.lineTo(134, 44); c.lineTo(114, 62); c.lineTo(82, 62); c.fill();
  c.fillStyle = '#ff4a2a'; c.fillRect(82, 28, 11, 6); c.fillRect(106, 28, 11, 6); c.fillStyle = '#ffb060'; c.fillRect(85, 29, 4, 3); c.fillRect(109, 29, 4, 3);
  c.fillStyle = '#ff4a2a'; for (let i = 0; i < 6; i++) c.fillRect(84 + i * 6, 48 + (i % 2) * 2, 3, 6);
  c.fillStyle = '#ff4a2a'; c.fillRect(82, 74, 2, 28); c.fillRect(84, 86, 16, 2); c.fillRect(100, 66, 2, 40); c.fillRect(116, 80, 2, 20);
  c.fillStyle = '#6a5a60'; for (const [x, y] of [[62, 48], [136, 42], [152, 80], [44, 80]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 5, y - 18); c.lineTo(x + 11, y); c.fill(); }
} };
const enemyCache = new Map();
function enemySprite(id, frame = 0) {
  const key = id + frame;
  if (enemyCache.has(key)) return enemyCache.get(key);
  const a = ENEMY_ART[id];
  const s = sprite(a.w, a.h, c => a.draw(c, frame), undefined, true);
  enemyCache.set(key, s);
  return s;
}

// ---------- weapons drawn at runtime with rotation ----------
const weaponCache = new Map();
function weaponSprite(kind, col) {
  const key = kind + col;
  if (weaponCache.has(key)) return weaponCache.get(key);
  let s;
  if (kind === 'shard') s = sprite(46, 11, c => {
    // Living Shardblade: long, curving, and marked with glyph-like cuts that glow in the Order's colour.
    c.fillStyle = '#d8e4ec'; c.beginPath(); c.moveTo(8, 3); c.lineTo(38, 2); c.lineTo(46, 5); c.lineTo(38, 8); c.lineTo(8, 7); c.fill();
    c.fillStyle = '#ffffff'; c.fillRect(10, 3, 30, 1);
    c.fillStyle = col; for (let x = 12; x < 36; x += 6) { c.fillRect(x, 5, 3, 1); c.fillRect(x + 1, 4, 1, 3); }
    c.fillStyle = mix(col, '#000000', .3); c.fillRect(6, 0, 3, 11); c.fillRect(0, 4, 7, 3);
  }, '#10101e');
  else if (kind === 'spear') s = sprite(42, 7, c => { c.fillStyle = '#6e5238'; c.fillRect(0, 3, 32, 1); c.fillStyle = '#c0c6d0'; c.beginPath(); c.moveTo(31, 1); c.lineTo(42, 3.5); c.lineTo(31, 6); c.fill(); });
  else if (kind === 'fabrial') s = sprite(13, 13, c => { c.fillStyle = '#c9a860'; c.beginPath(); c.arc(6.5, 6.5, 6, 0, 7); c.fill(); c.fillStyle = '#20263f'; c.beginPath(); c.arc(6.5, 6.5, 4, 0, 7); c.fill(); c.fillStyle = col; c.fillRect(4, 4, 5, 5); });
  else s = sprite(24, 7, c => { c.fillStyle = '#c0c6d0'; c.fillRect(6, 2, 16, 3); c.fillRect(22, 3, 2, 1); c.fillStyle = '#ffffff'; c.fillRect(6, 2, 16, 1); c.fillStyle = '#6e5238'; c.fillRect(0, 3, 4, 1); c.fillStyle = '#c9a860'; c.fillRect(4, 0, 2, 7); });
  weaponCache.set(key, s);
  return s;
}

// ---------- painted backdrops for battle and story scenes ----------
function layerRidge(c, seed, y, amp, col, step = 6) {
  const r = mulberry(seed);
  let h = y; c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W + step; x += step) { h += (r() - .5) * amp; h = clamp(h, y - amp * 2, y + amp); if (r() < .12) h -= amp * .9; c.lineTo(x, Math.round(h / 3) * 3); }
  c.lineTo(W, H); c.fill();
}
function skyGrad(c, stops) { const gr = c.createLinearGradient(0, 0, 0, 170); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s)); c.fillStyle = gr; c.fillRect(0, 0, W, 170); }
const backCache = new Map();
function backdrop(kind) {
  if (backCache.has(kind)) return backCache.get(kind);
  const cv = hiCanvas(W, H), c = cv._c;
  const ground = (top, cols) => {
    const th = cols, r = mulberry(99);
    c.fillStyle = th[0]; c.fillRect(0, top, W, H - top);
    for (let i = 0; i < 1400; i++) { const y = top + Math.pow(r(), 1.4) * (H - top), k = (y - top) / (H - top); c.fillStyle = th[1 + Math.floor(r() * (th.length - 1))]; c.fillRect(r() * W, y, 2 + k * 11, 1); }
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, top, W, 2);
  };
  const stones = (top, col, col2, n) => { const r = mulberry(5); for (let i = 0; i < n; i++) { const y = top + r() * (H - top), k = .6 + (y - top) / (H - top), x = r() * W, w = (4 + r() * 12) * k; c.fillStyle = col; c.fillRect(x, y, w, 3 * k); c.fillStyle = col2; c.fillRect(x, y, w, 1); } };
  if (kind === 'town' || kind === 'crags') {
    const town = kind === 'town';
    skyGrad(c, town ? ['#5d8fb8', '#a6c6cf', '#f0d9a8'] : ['#4d7ca4', '#d0a97c', '#f2b26c']);
    c.fillStyle = 'rgba(255,245,215,.5)'; const r = mulberry(4); for (let i = 0; i < 9; i++) { const x = r() * W, y = 18 + r() * 60, w = 30 + r() * 80; c.fillRect(x, y, w, 2); c.fillRect(x + 12, y - 3, w * .5, 3); }
    layerRidge(c, 11, 112, 16, town ? '#8fa6b0' : '#a68a78', 8);
    layerRidge(c, 22, 132, 20, town ? '#7a7662' : '#845c48', 6);
    layerRidge(c, 33, 150, 14, town ? '#6c5c44' : '#6c4838', 5);
    ground(160, town ? ['#a58a5c', '#9b8053', '#b09669', '#94794d'] : ['#8e7a5e', '#806e53', '#9b886b', '#776549']);
    stones(166, '#5c4c38', '#a08a68', 22);
  } else if (kind === 'chasm') {
    const gr = c.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#a4c8c8'); gr.addColorStop(.18, '#3e5c60'); gr.addColorStop(1, '#141a1e'); c.fillStyle = gr; c.fillRect(0, 0, W, 170);
    c.fillStyle = '#1f2428'; c.beginPath(); c.moveTo(0, 0); c.lineTo(130, 0); c.lineTo(110, 40); c.lineTo(140, 80); c.lineTo(100, 130); c.lineTo(120, 170); c.lineTo(0, 170); c.fill(); c.beginPath(); c.moveTo(W, 0); c.lineTo(350, 0); c.lineTo(372, 46); c.lineTo(340, 92); c.lineTo(380, 140); c.lineTo(360, 170); c.lineTo(W, 170); c.fill();
    c.fillStyle = '#2d3438'; for (let y = 8; y < 170; y += 11) { c.fillRect(0, y, 100 + (y * 7 % 30), 1); c.fillRect(W - 110 - (y * 5 % 30), y + 4, 110 + (y * 5 % 30), 1); }
    c.fillStyle = '#3f8a7c'; const r = mulberry(9); for (let i = 0; i < 40; i++) c.fillRect(r() * W, 120 + r() * 46, 2, 4);
    ground(160, ['#4b514b', '#424741', '#555b53', '#3c413b']);
    stones(166, '#2c322e', '#677062', 24);
  } else if (kind === 'vault') {
    const gr = c.createLinearGradient(0, 0, 0, 170); gr.addColorStop(0, '#0b0e20'); gr.addColorStop(1, '#232a4a'); c.fillStyle = gr; c.fillRect(0, 0, W, 170);
    for (let i = 0; i < 6; i++) { const x = 16 + i * 86; c.fillStyle = '#2b3252'; c.fillRect(x, 0, 28, 170); c.fillStyle = '#3e4874'; c.fillRect(x, 0, 6, 170); c.fillStyle = '#7fd0f0'; for (let y = 30; y < 150; y += 28) c.fillRect(x + 13, y, 3, 8); }
    c.fillStyle = '#566290'; c.fillRect(0, 150, W, 10);
    ground(160, ['#3e4662', '#363d57', '#47506f', '#30374f']);
    c.fillStyle = 'rgba(127,208,240,.14)'; for (let i = -6; i < 12; i++) { c.beginPath(); c.moveTo(240 + i * 20, 160); c.lineTo(240 + i * 70, H); c.lineTo(242 + i * 70, H); c.lineTo(241 + i * 20, 160); c.fill(); }
  } else if (kind === 'shadesmar') {
    const gr = c.createLinearGradient(0, 0, 0, 170); gr.addColorStop(0, '#04040e'); gr.addColorStop(1, '#2a2450'); c.fillStyle = gr; c.fillRect(0, 0, W, 170);
    c.fillStyle = '#f4f4ff'; c.beginPath(); c.arc(360, 46, 15, 0, 7); c.fill();
    const r = mulberry(21); for (let i = 0; i < 16; i++) { const x = r() * W, y = 15 + r() * 110, l = 60 + r() * 100; c.fillStyle = 'rgba(160,170,240,.14)'; c.fillRect(x, y, l, 2); }
    layerRidge(c, 44, 142, 16, '#141228', 7);
    ground(156, ['#23203a', '#1c1a30', '#2e2a4a', '#181628']);
    for (let i = 0; i < 700; i++) { const y = 158 + r() * 110; c.fillStyle = r() < .8 ? '#5a60a0' : '#d4d8f0'; c.fillRect(r() * W, y, 1 + (y - 158) / 80, 1 + (y - 158) / 80); }
  } else if (kind === 'everstorm' || kind === 'storm') {
    const ever = kind === 'everstorm';
    skyGrad(c, ever ? ['#120610', '#3e0f14', '#8f2a20'] : ['#0a1220', '#1c2c44', '#3a4e66']);
    const r = mulberry(31); for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * 110, w = 60 + r() * 120; c.fillStyle = ever ? 'rgba(20,6,12,.65)' : 'rgba(8,14,26,.6)'; c.beginPath(); c.ellipse(x, y, w, 12 + r() * 12, 0, 0, 7); c.fill(); }
    if (ever) { c.strokeStyle = '#ff5a44'; c.lineWidth = 1; for (let i = 0; i < 5; i++) { let x = 40 + i * 100, y = 40; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - .5) * 26; y += 16; c.lineTo(x, y); } c.stroke(); } }
    layerRidge(c, 55, 136, 18, ever ? '#1c0c12' : '#141c28', 7);
    ground(158, ever ? ['#3a3048', '#322a40', '#44384f', '#2b2438'] : ['#4e5560', '#454c56', '#59606a', '#3c434c']);
    stones(164, '#1e1a26', '#6c6074', 16);
  } else if (kind === 'title') {
    skyGrad(c, ['#070b1c', '#1a2850', '#4c5c8a']);
    const r = mulberry(77);
    for (let i = 0; i < 140; i++) { c.fillStyle = r() < .2 ? '#e8e8ff' : '#7f8fb8'; c.fillRect(r() * W, r() * 110, 1, 1); }
    c.fillStyle = '#c4d8e8'; c.beginPath(); c.arc(388, 44, 12, 0, 7); c.fill(); c.fillStyle = '#d8b0e0'; c.beginPath(); c.arc(90, 30, 7, 0, 7); c.fill(); c.fillStyle = '#a8e0c0'; c.beginPath(); c.arc(428, 80, 4, 0, 7); c.fill();
    layerRidge(c, 61, 150, 18, '#0d1430', 7);
    // A vast tiered tower far away, stepped like a city built by no living hand.
    c.fillStyle = '#10183a'; for (let i = 0; i < 9; i++) { const w = 92 - i * 8; c.fillRect(240 - w / 2, 150 - i * 15, w, 15); }
    c.fillStyle = '#ffd9a0'; const q = mulberry(5); for (let i = 0; i < 90; i++) { const lvl = Math.floor(q() * 9), w = 92 - lvl * 8; c.fillRect(240 - w / 2 + q() * w, 150 - lvl * 15 - q() * 12, 1, 1); }
    layerRidge(c, 62, 180, 16, '#070b1c', 6);
    c.fillStyle = '#04060f'; c.fillRect(0, 196, W, H);
  } else if (kind === 'urithiru') {
    skyGrad(c, ['#2c4a80', '#d0a0a0', '#ffd9a0']);
    const r = mulberry(14); for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(255,240,220,.5)'; const x = r() * W; c.fillRect(x, 70 + r() * 70, 50 + r() * 90, 2); }
    layerRidge(c, 80, 140, 22, '#c4c8dc', 8); layerRidge(c, 81, 165, 16, '#9ea4c4', 6);
    for (let i = 0; i < 10; i++) { const w = 200 - i * 16, y = 170 - (i + 1) * 15; c.fillStyle = i % 2 ? '#c8bcb0' : '#b0a49c'; c.fillRect(240 - w / 2, y, w, 15); c.fillStyle = '#7a6f70'; c.fillRect(240 - w / 2, y + 13, w, 2); c.fillStyle = '#ffeec0'; for (let x = 240 - w / 2 + 3; x < 240 + w / 2 - 3; x += 7) c.fillRect(x, y + 5, 3, 5); }
    c.fillStyle = '#f4f4ff'; c.fillRect(0, 170, W, H);
    c.fillStyle = '#d0d4e8'; for (let i = 0; i < 400; i++) c.fillRect(r() * W, 172 + r() * 96, 3, 1);
    c.fillStyle = '#7e88a8'; c.beginPath(); c.ellipse(240, 222, 110, 30, 0, 0, 7); c.fill(); c.fillStyle = '#a8b0cc'; c.beginPath(); c.ellipse(240, 222, 96, 24, 0, 0, 7); c.fill();
  } else if (kind === 'worldmap') {
    c.fillStyle = '#0f1a2e'; c.fillRect(0, 0, W, H);
    const r = mulberry(8); for (let i = 0; i < 300; i++) { c.fillStyle = 'rgba(120,160,190,.12)'; c.fillRect(r() * W, r() * H, 6 + r() * 14, 1); }
    const blob = (pts, col, col2) => { c.fillStyle = col2; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y + 3) : c.moveTo(x, y + 3)); c.closePath(); c.fill(); c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
    const land = []; const q = mulberry(44); for (let i = 0; i < 44; i++) { const a = i / 44 * 6.283, R = 165 + 28 * Math.sin(a * 3) + q() * 22; land.push([240 + Math.cos(a) * R * 1.25, 136 + Math.sin(a) * R * .62]); }
    blob(land, '#a68f68', '#4c3a28');
    for (let i = 0; i < 700; i++) { const a = q() * 6.283, d = Math.sqrt(q()) * 135; c.fillStyle = q() < .5 ? '#94805c' : '#b3a079'; c.fillRect(240 + Math.cos(a) * d * 1.25, 136 + Math.sin(a) * d * .62, 3, 1); }
    // Chasm scars and mountains
    c.strokeStyle = '#3a2c22'; c.lineWidth = 1; for (let i = 0; i < 14; i++) { let x = 300 + q() * 48, y = 110 + q() * 60; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (q() - .5) * 22; y += (q() - .5) * 22; c.lineTo(x, y); } c.stroke(); }
    for (let i = 0; i < 30; i++) { const x = 90 + q() * 70, y = 70 + q() * 110; c.fillStyle = '#7a6448'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y - 9); c.lineTo(x + 12, y); c.fill(); c.fillStyle = '#c4c8c4'; c.fillRect(x + 5, y - 9, 2, 2); }
  }
  // Soft edge falloff gives the painted scenes some depth.
  if (kind !== 'worldmap') {
    const vg = c.createRadialGradient(W / 2, H / 2, H * .5, W / 2, H / 2, W * .68);
    vg.addColorStop(0, 'rgba(4,4,14,0)'); vg.addColorStop(1, 'rgba(4,4,14,.38)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  backCache.set(kind, cv);
  return cv;
}
