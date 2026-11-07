'use strict';
// Core: fixed-step loop support, input, bitmap font, sprites, particles, lighting, coroutines.
const W = 480, H = 270, TS = 16, DT = 1 / 60;
// Game code keeps working in W x H layout units; pixels are stored RES times finer.
const RES = 2;
const canvas = document.getElementById('game');
canvas.width = W * RES; canvas.height = H * RES;
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;
g.setTransform(RES, 0, 0, RES, 0, 0);
hiDraw(g);

// A canvas whose width/height are layout units, with its pixels in a finer twin (cv._hi, drawn through cv._c).
function hiCanvas(w, h) {
  const cv = canvasOf(w, h), hi = canvasOf(Math.ceil(w * RES), Math.ceil(h * RES)), c = hi.getContext('2d');
  c.setTransform(RES, 0, 0, RES, 0, 0); c.imageSmoothingEnabled = false;
  cv._hi = hi; cv._c = c;
  return cv;
}
// Lets a context draw hiCanvas images using layout-unit coordinates.
function hiDraw(ctx) {
  const raw = ctx.drawImage.bind(ctx);
  ctx.drawImage = (im, ...a) => {
    const hi = im._hi;
    if (!hi) return raw(im, ...a);
    if (a.length === 2) return raw(hi, a[0], a[1], im.width, im.height);
    if (a.length === 4) return raw(hi, a[0], a[1], a[2], a[3]);
    return raw(hi, a[0] * RES, a[1] * RES, a[2] * RES, a[3] * RES, a[4], a[5], a[6], a[7]);
  };
}

function fitCanvas() {
  const sw = window.innerWidth, sh = window.innerHeight;
  let s = Math.min(sw / W, sh / H);
  if (s >= 1) s = Math.max(1, Math.floor(s * 2) / 2);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
  // Nearest-neighbour only stays even at whole-number zooms; other sizes scale smoothly.
  canvas.style.imageRendering = Number.isInteger(s * (window.devicePixelRatio || 1) / RES) ? 'pixelated' : 'auto';
}
window.addEventListener('resize', fitCanvas); fitCanvas();

// ---------- math ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIn = t => t * t;
const easeIO = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
function hex2(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { const A = hex2(a), B = hex2(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], t)).toString(16).padStart(2, '0')).join(''); }
function rgba(c, a) { const A = hex2(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }

// ---------- coroutines: every yield waits exactly one fixed step ----------
function* wait(t) { while (t > 0) { t -= DT; yield; } }
function* tween(dur, fn, ease = easeIO) { let t = 0; while (t < dur) { fn(ease(t / dur)); t += DT; yield; } fn(1); }
function* parallel(...gens) { let live = gens; while (live.length) { live = live.filter(q => !q.next().done); if (live.length) yield; } }

// ---------- input ----------
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'ok', KeyZ: 'ok', Enter: 'ok', KeyX: 'back', Escape: 'back', Backspace: 'back', KeyC: 'menu', Tab: 'menu', KeyM: 'menu' };
const Input = {
  held: {}, latch: {}, pressed: {}, rep: {}, repT: {}, anyKey: false,
  set(a, on) { if (on && !this.held[a]) this.latch[a] = true; this.held[a] = on; if (on) { this.anyKey = true; Sfx.unlock(); } },
  update() {
    this.readPad();
    for (const a of ['up', 'down', 'left', 'right', 'ok', 'back', 'menu']) {
      this.pressed[a] = !!this.latch[a]; this.latch[a] = false;
      this.rep[a] = this.pressed[a];
      if (this.held[a]) { this.repT[a] = (this.repT[a] || 0) + DT; if (this.repT[a] > .34) { this.rep[a] = true; this.repT[a] = .25; } } else this.repT[a] = 0;
    }
  },
  padPrev: {},
  readPad() {
    let pad = null;
    try { pad = navigator.getGamepads && Array.from(navigator.getGamepads()).find(p => p); } catch (e) { pad = null; } // blocked in some sandboxed browsers
    if (!pad) return;
    const m = { up: pad.buttons[12]?.pressed || pad.axes[1] < -.5, down: pad.buttons[13]?.pressed || pad.axes[1] > .5, left: pad.buttons[14]?.pressed || pad.axes[0] < -.5, right: pad.buttons[15]?.pressed || pad.axes[0] > .5, ok: pad.buttons[0]?.pressed, back: pad.buttons[1]?.pressed, menu: pad.buttons[9]?.pressed || pad.buttons[3]?.pressed };
    for (const a in m) { if (!!m[a] !== !!this.padPrev[a]) this.set(a, !!m[a]); this.padPrev[a] = m[a]; }
  },
  clear() { this.held = {}; this.latch = {}; }
};
const TEXT_MODE_KEYS = ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'];
window.addEventListener('keydown', e => { if (Input.textMode && !TEXT_MODE_KEYS.includes(e.code)) return; const a = KEYMAP[e.code]; if (a) { if (!e.repeat) Input.set(a, true); e.preventDefault(); } });
window.addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) Input.set(a, false); });
window.addEventListener('blur', () => Input.clear());
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
document.querySelectorAll('.tb').forEach(b => {
  const a = b.dataset.a;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('on'); Input.set(a, true); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { b.classList.remove('on'); Input.set(a, false); });
});
canvas.addEventListener('pointerdown', () => { Sfx.unlock(); canvas.focus(); });

// ---------- bitmap font (5x8 columns, LSB on top), proportionally trimmed ----------
const FONT_HEX = '0000000000 00005F0000 0007000700 147F147F14 242A7F2A12 2313086462 3649562050 0008070300 001C224100 0041221C00 2A1C7F1C2A 08083E0808 0080703000 0808080808 0000606000 2010080402 3E5149453E 00427F4000 7249494946 2141494D33 1814127F10 2745454539 3C4A494931 4121110907 3649494936 464949291E 0000140000 0040340000 0008142241 1414141414 0041221408 0201590906 3E415D594E 7C1211127C 7F49494936 3E41414122 7F4141413E 7F49494941 7F09090901 3E41415173 7F0808087F 00417F4100 2040413F01 7F08142241 7F40404040 7F021C027F 7F0408107F 3E4141413E 7F09090906 3E4151215E 7F09192946 2649494932 03017F0103 3F4040403F 1F2040201F 3F4038403F 6314081463 0304780403 6159494D43 007F414141 0204081020 004141417F 0402010204 4040404040 0003070800 2054547840 7F28444438 3844444428 384444287F 3854545418 00087E0902 18A4A49C78 7F08040478 00447D4000 2040403D00 7F10284400 00417F4000 7C04780478 7C08040478 3844444438 FC18242418 18242418FC 7C08040408 4854545424 04043F4424 3C4040207C 1C2040201C 3C4030403C 4428102844 4C9090907C 4464544C44 0008364100 0000770000 0041360800 0201020402'.replace(/\s+/g, '');
const glyphs = {};
for (let i = 0; i < 95; i++) {
  const cols = [];
  for (let c = 0; c < 5; c++) cols.push(parseInt(FONT_HEX.substr((i * 5 + c) * 2, 2), 16));
  let a = 0, b = 4;
  while (a < 4 && cols[a] === 0) a++;
  while (b > a && cols[b] === 0) b--;
  glyphs[String.fromCharCode(32 + i)] = i === 0 ? { cols: [], w: 3 } : { cols: cols.slice(a, b + 1), w: b - a + 1 };
}
const glyphCache = new Map();
function glyphAtlas(col) {
  if (glyphCache.has(col)) return glyphCache.get(col);
  const cv = document.createElement('canvas'); cv.width = 95 * 6; cv.height = 8;
  const c = cv.getContext('2d'); c.fillStyle = col;
  for (let i = 0; i < 95; i++) {
    const gl = glyphs[String.fromCharCode(32 + i)];
    gl.cols.forEach((bits, x) => { for (let y = 0; y < 8; y++) if (bits >> y & 1) c.fillRect(i * 6 + x, y, 1, 1); });
  }
  glyphCache.set(col, cv);
  return cv;
}
function textW(s, scale = 1) { let w = 0; for (const ch of s) { const gl = glyphs[ch] || glyphs['?']; w += gl.w + 1; } return Math.max(0, w - 1) * scale; }
function rawText(c, s, x, y, col, scale) {
  const at = glyphAtlas(col);
  for (const ch of s) {
    const code = ch.charCodeAt(0) - 32, gl = glyphs[ch] || glyphs['?'];
    if (code >= 0 && code < 95 && gl.w) c.drawImage(at, code * 6, 0, gl.w, 8, x, y, gl.w * scale, 8 * scale);
    x += (gl.w + 1) * scale;
  }
}
// opts: { shadow:color|false, align:'left'|'center'|'right', scale, ctx }
function text(s, x, y, col = '#f2ead6', o = {}) {
  s = String(s);
  const scale = o.scale || 1, c = o.ctx || g;
  x = Math.round(x); y = Math.round(y);
  if (o.align === 'center') x -= Math.round(textW(s, scale) / 2);
  if (o.align === 'right') x -= textW(s, scale);
  if (o.shadow !== false) rawText(c, s, x + scale, y + scale, o.shadow || '#0a0d1c', scale);
  rawText(c, s, x, y, col, scale);
}
function wrapText(s, maxW) {
  const out = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (textW(t) > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

// ---------- sprites: draw freely, then threshold alpha and add a dark outline ----------
function canvasOf(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
function sprite(w, h, fn, outline = '#141022', bevel = false) {
  const pad = outline ? 1 : 0, cv = hiCanvas(w + pad * 2, h + pad * 2), hi = cv._hi, c = cv._c;
  c.translate(pad, pad); fn(c); c.setTransform(1, 0, 0, 1, 0, 0);
  const img = c.getImageData(0, 0, hi.width, hi.height), d = img.data, cw = hi.width, ch = hi.height;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  // Thin rim shading: light catches upper edges, lower and right edges fall into shade.
  if (bevel) {
    const a = new Uint8ClampedArray(d);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      if (!a[i + 3]) continue;
      const up = y > 0 && !a[i - cw * 4 + 3], dn = y < ch - 1 && !a[i + cw * 4 + 3], rt = x < cw - 1 && !a[i + 7];
      if (!up && !dn && !rt) continue;
      const to = up ? 255 : 0, k = up ? .2 : dn ? .24 : .14;
      for (let q = 0; q < 3; q++) d[i + q] = d[i + q] + (to - d[i + q]) * k;
    }
  }
  if (outline) {
    const o = hex2(outline), copy = new Uint8ClampedArray(d);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      if (copy[i + 3]) continue;
      const near = (x > 0 && copy[i - 1]) || (x < cw - 1 && copy[i + 7]) || (y > 0 && copy[i - cw * 4 + 3]) || (y < ch - 1 && copy[i + cw * 4 + 3]);
      if (near) { d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255; }
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}
function flipped(cv) {
  if (cv._flip) return cv._flip;
  const out = hiCanvas(cv.width, cv.height), c = out._c;
  c.translate(cv.width, 0); c.scale(-1, 1); c.drawImage(cv._hi, 0, 0, cv.width, cv.height);
  cv._flip = out;
  return out;
}
function tintedCopy(cv, col, alpha = 1) {
  const out = hiCanvas(cv.width, cv.height), c = out._c;
  c.drawImage(cv._hi, 0, 0, cv.width, cv.height); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = alpha; c.fillStyle = col; c.fillRect(0, 0, cv.width, cv.height);
  return out;
}

// ---------- additive glow sprites and lighting ----------
const glowCache = new Map();
function glowSprite(col, r) {
  r = Math.max(2, Math.round(r));
  const key = col + r;
  if (glowCache.has(key)) return glowCache.get(key);
  const cv = hiCanvas(r * 2, r * 2), c = cv._c, gr = c.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(col, .95)); gr.addColorStop(.35, rgba(col, .4)); gr.addColorStop(1, rgba(col, 0));
  c.fillStyle = gr; c.fillRect(0, 0, r * 2, r * 2);
  glowCache.set(key, cv);
  return cv;
}
function glow(x, y, r, col, a = 1, ctx = g) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  ctx.drawImage(glowSprite(col, r), Math.round(x - r), Math.round(y - r)); ctx.restore();
}
const lightCv = hiCanvas(W, H), lightC = lightCv._c;
hiDraw(lightC);
const Lighting = {
  begin(ambient) { lightC.globalCompositeOperation = 'source-over'; lightC.fillStyle = ambient; lightC.fillRect(0, 0, W, H); lightC.globalCompositeOperation = 'lighter'; },
  add(x, y, r, col, a = 1) { lightC.globalAlpha = a; lightC.drawImage(glowSprite(col, r), Math.round(x - r), Math.round(y - r)); lightC.globalAlpha = 1; },
  end() { g.save(); g.globalCompositeOperation = 'multiply'; g.drawImage(lightCv, 0, 0); g.restore(); }
};

// ---------- particles (positions are in the space of whichever layer draws them) ----------
const Particles = {
  list: [],
  add(p) { p.life = p.max = p.life || .6; p.vx = p.vx || 0; p.vy = p.vy || 0; p.size = p.size || 1; p.col = p.col || '#fff'; if (this.list.length < 500) this.list.push(p); return p; },
  burst(x, y, n, col, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 2), s = rand(o.s0 || 15, o.s1 || 80);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + (o.up || 0), life: rand(o.l0 || .25, o.l1 || .7), col: Array.isArray(col) ? pick(col) : col, size: o.size || (Math.random() < .3 ? 2 : 1), grav: o.grav || 0, add: o.add !== false });
    }
  },
  update() {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= DT;
      if (p.life <= 0) { l[i] = l[l.length - 1]; l.pop(); continue; }
      p.vy += (p.grav || 0) * DT;
      if (p.drag) { p.vx *= 1 - p.drag * DT; p.vy *= 1 - p.drag * DT; }
      p.x += p.vx * DT; p.y += p.vy * DT;
    }
  },
  draw(ox = 0, oy = 0) {
    for (const p of this.list) {
      const t = p.life / p.max, x = Math.round((p.x - ox) * RES) / RES, y = Math.round((p.y - oy) * RES) / RES;
      if (p.add) {
        g.globalCompositeOperation = 'lighter';
        if (p.size >= 2) { g.globalAlpha = t * .5; const r = p.size * 2; g.drawImage(glowSprite(p.col, r), Math.round(x + p.size / 2 - r), Math.round(y + p.size / 2 - r)); }
      }
      g.globalAlpha = p.fade === false ? 1 : Math.min(1, t * 1.6);
      g.fillStyle = p.col;
      g.fillRect(x, y, p.size, p.size);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  },
  clear() { this.list.length = 0; }
};

// Windspren: thin ribbons of light that loop along the wind.
const Ribbons = {
  list: [],
  spawn(x, y, col = '#dff4ff') { if (this.list.length < 8) this.list.push({ x, y, t: 0, life: rand(1.8, 3.2), col, seed: rand(10), trail: [], vx: rand(55, 95) }); },
  update() {
    this.list = this.list.filter(r => {
      r.t += DT;
      r.x += r.vx * DT;
      r.y += Math.sin(r.t * 4 + r.seed) * 40 * DT;
      if (r.t > 1 && r.t < 1.35) { r.y += Math.sin((r.t - 1) * 18) * 2.5; r.x -= r.vx * 1.4 * DT; }
      r.trail.unshift([r.x, r.y]); if (r.trail.length > 22) r.trail.pop();
      return r.t < r.life;
    });
  },
  draw(ox, oy) {
    g.globalCompositeOperation = 'lighter';
    for (const r of this.list) r.trail.forEach((q, i) => { if (i % 1 === 0) { g.globalAlpha = (1 - i / r.trail.length) * .6 * Math.min(1, (r.life - r.t)); g.fillStyle = r.col; g.fillRect(Math.round((q[0] - ox) * RES) / RES, Math.round((q[1] - oy) * RES) / RES, 1, 1); } });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
  clear() { this.list = []; }
};

// ---------- weather overlay shared by field and battle ----------
const Weather = {
  kind: 'none', drops: [], flash: 0, ash: [], t: 0,
  set(kind) { if (this.kind !== kind) { this.kind = kind; this.drops = []; } },
  update() {
    this.t += DT;
    const k = this.kind;
    if (k === 'storm' || k === 'everstorm') {
      while (this.drops.length < 170) this.drops.push({ x: rand(-60, W + 60), y: rand(-20, H), s: rand(330, 520) });
      for (const d of this.drops) { d.y += d.s * DT; d.x += (k === 'storm' ? -d.s * .55 : d.s * .4) * DT; if (d.y > H) { d.y = -8; d.x = rand(-20, W + 160); } if (d.x < -30) d.x = W + 20; if (d.x > W + 60) d.x = -20; }
      if (Math.random() < (k === 'storm' ? .006 : .012)) { this.flash = 1; Sfx.play('thunder'); }
    } else if (k === 'ash' || k === 'motes') {
      while (this.drops.length < 40) this.drops.push({ x: rand(W), y: rand(H), s: rand(5, 16), p: rand(7) });
      for (const d of this.drops) { d.y += (k === 'ash' ? d.s : -d.s) * DT; d.x += Math.sin(this.t + d.p) * 8 * DT; if (d.y > H) d.y = 0; if (d.y < 0) d.y = H; }
    }
    this.flash = Math.max(0, this.flash - DT * 2.4);
  },
  draw() {
    const k = this.kind;
    if (k === 'storm' || k === 'everstorm') {
      g.strokeStyle = k === 'storm' ? 'rgba(170,200,255,.5)' : 'rgba(255,90,70,.55)'; g.lineWidth = .75;
      const dx = k === 'storm' ? -4.4 : 4.4;
      g.beginPath();
      for (const d of this.drops) { g.moveTo(d.x, d.y); g.lineTo(d.x + dx, d.y + 5); }
      g.stroke();
      if (this.flash > 0) { g.fillStyle = k === 'storm' ? `rgba(220,235,255,${this.flash * .45})` : `rgba(255,70,50,${this.flash * .4})`; g.fillRect(0, 0, W, H); }
    } else if (k === 'ash' || k === 'motes') {
      g.fillStyle = k === 'ash' ? 'rgba(200,190,190,.6)' : 'rgba(180,220,255,.6)';
      for (const d of this.drops) g.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
    }
  }
};

// ---------- UI primitives ----------
function panel(x, y, w, h, accent = '#c9a860', fill = 'rgba(11,15,34,.93)') {
  g.fillStyle = fill; g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = accent; g.fillRect(x + 2, y, w - 4, 1); g.fillRect(x + 2, y + h - 1, w - 4, 1); g.fillRect(x, y + 2, 1, h - 4); g.fillRect(x + w - 1, y + 2, 1, h - 4);
  g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + w - 2, y + 1, 1, 1); g.fillRect(x + 1, y + h - 2, 1, 1); g.fillRect(x + w - 2, y + h - 2, 1, 1);
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 2, y + 1.5, w - 4, .5);
}
function bar(x, y, w, h, v, max, col, back = '#1a1c30') {
  g.fillStyle = '#05060f'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = back; g.fillRect(x, y, w, h);
  const f = Math.round(clamp(v / Math.max(1, max), 0, 1) * w);
  g.fillStyle = col; g.fillRect(x, y, f, h);
  g.fillStyle = 'rgba(255,255,255,.32)'; g.fillRect(x, y, f, .5);
  if (h > 2) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x, y + h - .5, f, .5); }
}
