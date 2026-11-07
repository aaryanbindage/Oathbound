'use strict';
// Dialogue, title, character creation, world map, party menu, shop, and cinematic scenes.
const Dialog = {
  cur: null,
  who(w) {
    if (w === null || w === 'sys') return { name: null, port: null };
    const h = S.party[0], o = ORDER(h.order);
    if (w === 'hero') return { name: h.name, port: portrait(heroPal(S), 'p' + h.order + h.look + S.ideal) };
    if (w === 'spren') return { name: o.spren, port: sprenPortrait(o) };
    const sp = SPEAK[w];
    return { name: sp.name, port: portrait(sp.pal, 'sp' + sp.key) };
  },
  *show(w, txt) {
    const info = this.who(w), maxW = info.port ? 346 : 400, lines = wrapText(txt, maxW);
    const pages = []; for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3));
    for (const page of pages) {
      const full = page.join('\n'), d = { info, page, full, shown: 0, sys: w === 'sys', center: w === null };
      this.cur = d;
      yield;
      let acc = 0;
      while (d.shown < full.length) {
        acc += DT * 62;
        const n = Math.floor(acc); acc -= n; d.shown = Math.min(full.length, d.shown + n);
        if (n && full[d.shown] !== ' ' && d.shown % 2 === 0) Sfx.play('blip');
        if (Input.pressed.ok) { d.shown = full.length; }
        yield;
      }
      yield;
      while (!Input.pressed.ok) { d.ready = true; yield; }
      Sfx.play('move');
    }
    this.cur = null;
    yield;
  },
  *choice(q, opts) {
    const c = { q, opts, i: 0 };
    this.choiceBox = c;
    yield;
    while (true) {
      if (Input.rep.up) { c.i = (c.i + opts.length - 1) % opts.length; Sfx.play('move'); }
      if (Input.rep.down) { c.i = (c.i + 1) % opts.length; Sfx.play('move'); }
      if (Input.pressed.ok) { Sfx.play('ok'); this.choiceBox = null; yield; return c.i; }
      yield;
    }
  },
  draw() {
    const d = this.cur;
    if (d) {
      const h = 52, y = H - h - 5;
      panel(5, y, W - 10, h, d.sys ? '#7fc8ff' : '#c9a860');
      let tx = 14;
      if (d.info.port) { g.drawImage(d.info.port, 10, y + 4); tx = 60; }
      if (d.info.name) { const w = textW(d.info.name) + 14; panel(tx - 4, y - 11, w, 14, '#c9a860', 'rgba(30,24,50,.98)'); text(d.info.name, tx + 3, y - 8, '#ffe08a'); }
      let n = d.shown, ly = y + 8;
      for (const l of d.page) { const part = l.slice(0, Math.max(0, n)); n -= l.length + 1; text(part, tx, ly, d.center ? '#d8e4f4' : '#f2ead6'); ly += 12; }
      if (d.ready && Math.floor(Date.now() / 300) % 2) { g.fillStyle = '#ffe08a'; g.fillRect(W - 18, y + h - 9, 7, 2); g.fillRect(W - 17, y + h - 7, 5, 1); g.fillRect(W - 16, y + h - 6, 3, 1); }
    }
    const c = this.choiceBox;
    if (c) {
      const w = Math.max(textW(c.q), ...c.opts.map(o => textW(o) + 14)) + 20, h = c.opts.length * 13 + 22, x = W / 2 - w / 2, y = H - h - 6;
      panel(x, y, w, h, '#ffe08a');
      text(c.q, x + 10, y + 5, '#ffe08a');
      c.opts.forEach((o, i) => { const sel = i === c.i; if (sel) { g.fillStyle = 'rgba(232,200,119,.2)'; g.fillRect(x + 4, y + 17 + i * 13, w - 8, 12); } text((sel ? '> ' : '  ') + o, x + 8, y + 19 + i * 13, sel ? '#ffffff' : '#d6d0c0'); });
    }
  }
};

// ---------- cinematic scenes ----------
const CineScene = {
  back: 'storm', caps: null, t: 0,
  *caption(lines) {
    const all = []; for (const l of lines) { all.push(...wrapText(fmt0(l), 380), ''); } all.pop();
    this.caps = { lines: all, a: 0 };
    yield* tween(.5, k => { this.caps.a = k; });
    const pad = Math.min(1.2, all.length * .3); yield* wait(pad * 0.4);
    while (!Input.pressed.ok) yield;
    Sfx.play('move');
    yield* tween(.3, k => { this.caps.a = 1 - k; });
    this.caps = null;
  },
  update() { this.t += DT; Weather.update(); Particles.update(); },
  draw() {
    g.drawImage(backdrop(this.back), 0, 0);
    Weather.draw();
    if (this.back === 'urithiru') for (let i = 0; i < 18; i++) { const x = (i * 41 + this.t * 5) % W, y = 30 + (i * 53) % 130; g.fillStyle = 'rgba(255,245,210,.5)'; g.fillRect(x, y, 1, 1); }
    const c = this.caps;
    if (c) {
      const h = c.lines.length * 11 + 16, y = (H - h) / 2 - 10;
      g.fillStyle = `rgba(4,6,14,${.68 * c.a})`; g.fillRect(0, y - 6, W, h + 12);
      g.globalAlpha = c.a;
      c.lines.forEach((l, i) => text(l, W / 2, y + 4 + i * 11, '#f2ead6', { align: 'center' }));
      g.globalAlpha = 1;
    }
  }
};
function fmt0(s) { return S && S.party && S.party[0] ? fmt(s) : s; }
const VoidScene = {
  o: null, t: 0, showSpren: true,
  update() { this.t += DT; Particles.update(); if (Math.random() < .4) Particles.add({ x: W / 2 + rand(-60, 60), y: 90 + rand(-40, 40), vy: -rand(4, 18), life: rand(.8, 1.6), col: this.o.color, add: true }); },
  draw() {
    g.fillStyle = '#03040a'; g.fillRect(0, 0, W, H);
    const o = this.o, y = 88 + Math.sin(this.t * 1.5) * 4;
    glow(W / 2, y, 64, o.color, .55);
    g.drawImage(sprenSprite(o, true, Math.floor(this.t * 2) % 2), W / 2 - 20, y - 20);
    Particles.draw();
  }
};
const OathScene = {
  o: null, title: '', words: [], shown: 0, stage: 0, t: 0, gains: [], a: 0, burst: 0,
  begin(o, title, words) { this.o = o; this.title = title; this.words = words; this.shown = 0; this.stage = 0; this.t = 0; this.gains = []; this.a = 0; this.burst = 0; this.lines = []; for (const w of words) this.lines.push(...wrapText(w, 200)); },
  *play() {
    yield* tween(.6, k => { this.a = k; });
    for (let i = 0; i < this.lines.length; i++) {
      yield* tween(.55, k => { this.shown = i + k; });
      Sfx.play('seal'); Particles.burst(W / 2, 96 + i * 24, 26, this.o.color, { s1: 140, l1: 1 });
      yield* wait(.25);
    }
    yield* wait(.25);
    yield* Dialog.show('sys', 'These words are accepted.');
    Sfx.play('bigfx'); Game.flashCol = '#ffffff'; Game.flashA = 1;
    this.burst = 1; this.stage = 1;
    for (let i = 0; i < 90; i++) Particles.add({ x: W / 2, y: H / 2, vx: rand(-260, 260), vy: rand(-200, 200), life: rand(.6, 1.8), col: pick([this.o.color, '#ffffff', mix(this.o.color, '#ffffff', .5)]), add: true, size: 2 });
  },
  *afterglow() { yield* wait(.7); while (!Input.pressed.ok) yield; Sfx.play('ok'); yield* Game.fadeOut(.4); Game.after = () => {}; yield* Game.fadeIn(.1); },
  update() { this.t += DT; Particles.update(); this.burst = Math.max(0, this.burst - DT * .4); if (Math.random() < .5) Particles.add({ x: rand(W), y: H, vy: -rand(40, 110), life: rand(1, 2.4), col: this.o.color, add: true }); },
  draw() {
    const o = this.o;
    const gr = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 280);
    gr.addColorStop(0, mix(o.dark, '#000000', .35)); gr.addColorStop(1, '#03040a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // A slowly turning ring of the ten glyphs, all dim but this Order's.
    const n = ORDERS.indexOf(o);
    for (let i = 0; i < 10; i++) {
      const a = (i - n) / 10 * Math.PI * 2 - Math.PI / 2 + this.t * .08, x = W / 2 + Math.cos(a) * 118, y = H / 2 + Math.sin(a) * 96, on = i === n;
      g.globalAlpha = on ? 1 : .25; g.drawImage(orderGlyph(ORDERS[i].id, 20, on ? o.color : '#9fb4d8'), Math.round(x - 11), Math.round(y - 11)); g.globalAlpha = 1;
    }
    glow(W / 2, H / 2, 90 + this.burst * 80, o.color, .3 + this.burst * .4);
    text(this.title, W / 2, 62, '#ffe8b0', { align: 'center' });
    if (this.stage === 0) {
      const L = this.lines, y0 = 96 - (L.length > 3 ? 12 : 0);
      L.forEach((l, i) => {
        const k = clamp(this.shown - i, 0, 1), n = Math.ceil(l.length * k);
        if (n) text(l.slice(0, n), W / 2 - textW(l, l.length > 26 ? 1 : 2) / 2, y0 + i * 24, '#ffffff', { scale: l.length > 26 ? 1 : 2 });
      });
    } else {
      text(`Knight Radiant of the ${o.name}`, W / 2, 86, o.color, { align: 'center', scale: 1 });
      this.gains.forEach((l, i) => text(l, W / 2, 110 + i * 14, '#f2ead6', { align: 'center' }));
      text('Press OK', W / 2, 206, '#a8e4ff', { align: 'center' });
    }
    Particles.draw();
  }
};
const EndScene = {
  t: 0,
  update() { this.t += DT; },
  draw() {
    g.drawImage(backdrop('title'), 0, 0);
    const lines = [['OATHBOUND', '#ffe8b0', 3], ['', '', 1], ['Thank you for playing.', '#f2ead6', 1], ['', '', 1], [`${S.party[0].name}, Level ${S.party[0].lvl}, ${ORDER(S.party[0].order).name}`, ORDER(S.party[0].order).color, 1], ['', '', 1], ['Try another Order: each has its own Surges, oaths, and spren.', '#d6d0c0', 1], ['An unofficial fan work, set in the world created by Brandon Sanderson.', '#8a8ea8', 1], ['Press OK', '#a8e4ff', 1]];
    let y = 44;
    for (const [l, c, s] of lines) { if (l) text(l, W / 2, y, c, { align: 'center', scale: s }); y += s === 3 ? 30 : 12; }
  }
};

// ---------- title ----------
const TitleScene = {
  t: 0, i: 0, opts: [],
  enter() { this.t = 0; this.i = 0; this.opts = []; this.refresh(); },
  // Saves can arrive after the title appears, so the list is rebuilt keeping the same item selected.
  refresh() {
    const was = this.opts[this.i], had = this.opts.includes('Continue'), has = Game.hasSave();
    this.opts = [...(has ? ['Continue', 'Load Game'] : []), 'New Oath', 'Fullscreen', 'Sound: ' + (Sfx.muted ? 'off' : 'on'), ...(window.desktop ? ['Quit'] : [])];
    const k = this.opts.indexOf(was);
    this.i = has && !had ? 0 : k >= 0 ? k : 0;
  },
  update() {
    this.t += DT; Particles.update(); Weather.update(); Ribbons.update();
    if (Math.random() < .035) Ribbons.spawn(-10, rand(30, 170), '#c8e0ff');
    if (Math.random() < .3) Particles.add({ x: 240 + rand(-44, 44), y: rand(30, 150), vy: -rand(2, 7), life: rand(.5, 1.6), col: '#ffe0a0', add: true });
    if (Game.script) return;
    if (Input.rep.up) { this.i = (this.i + this.opts.length - 1) % this.opts.length; Sfx.play('move'); }
    if (Input.rep.down) { this.i = (this.i + 1) % this.opts.length; Sfx.play('move'); }
    if (Input.pressed.ok) {
      Sfx.play('ok');
      Saves.notice = '';
      const o = this.opts[this.i];
      if (o === 'Continue') Game.run(Game.loadGame());
      else if (o === 'Load Game') SaveScene.open('load');
      else if (o === 'New Oath') Game.run((function* () { yield* Game.fadeOut(.4); CreateScene.enter(); Game.scene = CreateScene; yield* Game.fadeIn(.4); })());
      else if (o === 'Fullscreen') Game.toggleFullscreen();
      else if (o.startsWith('Sound')) { Game.toggleSound(); this.opts[this.i] = 'Sound: ' + (Sfx.muted ? 'off' : 'on'); }
      else if (o === 'Quit') window.desktop && window.desktop.quit();
    }
  },
  draw() {
    g.drawImage(backdrop('title'), 0, 0);
    Ribbons.draw(0, 0); Particles.draw();
    const y = 34 + Math.round(Math.sin(this.t) * 1.5);
    text('OATHBOUND', W / 2, y, '#fff0c8', { align: 'center', scale: 4, shadow: '#3a2c60' });
    glow(W / 2, y + 16, 90, '#ffe08a', .18 + Math.sin(this.t * 2) * .05);
    text('A TALE OF THE KNIGHTS RADIANT', W / 2, y + 38, '#c8d4f0', { align: 'center' });
    this.opts.forEach((o, i) => { const sel = i === this.i, yy = Math.min(180, 238 - this.opts.length * 13) + i * 13; if (sel) { g.fillStyle = 'rgba(232,200,119,.2)'; g.fillRect(W / 2 - 54, yy - 2, 108, 12); } text(o, W / 2, yy, sel ? '#ffe08a' : '#b0b8d0', { align: 'center' }); });
    text('Unofficial fan work. The world of Roshar was created by Brandon Sanderson.', W / 2, H - 11, '#6a7094', { align: 'center' });
    if (Saves.notice) { const w = textW(Saves.notice) + 16; panel(W / 2 - w / 2, 4, w, 15, '#ffe08a'); text(Saves.notice, W / 2, 8, '#ffe8b0', { align: 'center' }); }
    text('Move: arrows/WASD   OK: Space/Z   Back: X   Menu: C', W / 2, H - 22, '#6a7094', { align: 'center' });
  }
};

// ---------- character creation: pick an Order from the ring ----------
const NAME_PRESETS = ['Kaelan', 'Teshra', 'Avren', 'Ilana', 'Dorrin', 'Sevi', 'Maro', 'Nahel'];
const CreateScene = {
  step: 0, i: 0, look: 0, name: 'Kaelan', ni: 0, t: 0, rot: 0,
  enter() { this.step = 0; this.t = 0; this.rot = 0; this.name = NAME_PRESETS[Math.floor(Math.random() * NAME_PRESETS.length)]; this.look = 0; this.i = 0; },
  update() {
    this.t += DT; Particles.update();
    const o = ORDERS[this.i];
    if (Math.random() < .3) Particles.add({ x: 120 + rand(-60, 60), y: 135 + rand(-50, 50), vy: -rand(5, 18), life: rand(.5, 1.2), col: o.color, add: true });
    const target = -this.i / 10 * Math.PI * 2;
    let d = target - this.rot; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; this.rot += d * .16;
    if (Game.script) return;
    if (this.step === 0) {
      if (Input.rep.left || Input.rep.up) { this.i = (this.i + 9) % 10; Sfx.play('move'); }
      if (Input.rep.right || Input.rep.down) { this.i = (this.i + 1) % 10; Sfx.play('move'); }
      if (Input.pressed.ok) { Sfx.play('ok'); this.step = 1; }
      if (Input.pressed.back) { Sfx.play('back'); Game.toTitle(); }
    } else if (this.step === 1) {
      if (Input.rep.left || Input.rep.up) { this.look = (this.look + LOOKS.length - 1) % LOOKS.length; Sfx.play('move'); }
      if (Input.rep.right || Input.rep.down) { this.look = (this.look + 1) % LOOKS.length; Sfx.play('move'); }
      if (Input.pressed.ok) { Sfx.play('ok'); this.step = 2; Input.textMode = true; }
      if (Input.pressed.back) { Sfx.play('back'); this.step = 0; }
    } else {
      if (Input.rep.up) { this.ni = (this.ni + 1) % NAME_PRESETS.length; this.name = NAME_PRESETS[this.ni]; Sfx.play('move'); }
      if (Input.rep.down) { this.ni = (this.ni + NAME_PRESETS.length - 1) % NAME_PRESETS.length; this.name = NAME_PRESETS[this.ni]; Sfx.play('move'); }
      if (Input.pressed.ok && this.name) {
        Input.textMode = false; Sfx.play('ok');
        Game.run((function* () { yield* Game.fadeOut(.6); Game.newGame(CreateScene.name, ORDERS[CreateScene.i].id, CreateScene.look); yield* Story.newGame(); })());
      }
      if (Input.pressed.back) { Input.textMode = false; Sfx.play('back'); this.step = 1; }
    }
  },
  previewPal() { const o = ORDERS[this.i], L = LOOKS[this.look]; return { skin: L.skin, skin2: L.skin2, hair: L.hair, style: L.style, eye: L.eye, eyeGlow: mix(o.color, '#ffffff', .4), coat: o.dark, coat2: mix(o.dark, '#000000', .3), trim: mix(o.color, '#ffffff', .25), pants: '#2c2a3a', boots: '#1e1a24' }; },
  draw() {
    const o = ORDERS[this.i];
    const gr = g.createRadialGradient(120, 135, 10, 120, 135, 340);
    gr.addColorStop(0, mix(o.dark, '#02030a', .35)); gr.addColorStop(1, '#03040c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // Connecting lines of the ring.
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(o.color, .25); g.lineWidth = 1;
    const pos = i => { const a = this.rot + i / 10 * Math.PI * 2 - Math.PI / 2; return [120 + Math.cos(a) * 92, 135 + Math.sin(a) * 92]; };
    for (let i = 0; i < 10; i++) { const [a, b] = pos(i), [q, r] = pos((i + 1) % 10); g.beginPath(); g.moveTo(a, b); g.lineTo(q, r); g.stroke(); g.beginPath(); g.moveTo(a, b); const [u, v] = pos((i + 3) % 10); g.strokeStyle = rgba(o.color, .08); g.lineTo(u, v); g.stroke(); g.strokeStyle = rgba(o.color, .25); }
    g.restore();
    ORDERS.forEach((q, i) => {
      const [x, y] = pos(i), sel = i === this.i, sz = sel ? 28 : 18;
      if (sel) glow(x, y, 26, q.color, .7);
      g.globalAlpha = sel ? 1 : .55;
      g.drawImage(orderGlyph(q.id, sz, sel ? '#ffffff' : q.color), Math.round(x - sz / 2 - 1), Math.round(y - sz / 2 - 1));
      g.globalAlpha = 1;
    });
    glow(120, 135, 46, o.color, .4);
    const s = humanSprite(this.previewPal(), 'pv' + this.i + this.look, walkPose(0, Math.floor(this.t * 2), false));
    g.drawImage(s, 120 - 26, 135 - 32, 52, 68);
    const sp = sprenSprite(o, false, Math.floor(this.t * 3) % 2);
    g.drawImage(sp, Math.round(120 + 24 + Math.cos(this.t * 1.7) * 7), Math.round(112 + Math.sin(this.t * 2.2) * 6));
    Particles.draw();
    // Info panel on the right.
    const px = 228, pw = W - px - 8;
    panel(px, 8, pw, H - 16, o.color, 'rgba(8,11,26,.9)');
    text(o.name.toUpperCase(), px + 10, 14, o.color, { scale: 2 });
    text(`Spren: ${o.sprenKind} (${o.spren})`, px + 10, 35, '#c8c0ae');
    let y = 48;
    wrapText(o.creed, pw - 20).forEach(l => { text(l, px + 10, y, '#ffe8b0'); y += 10; });
    y += 3;
    wrapText(o.desc, pw - 20).forEach(l => { text(l, px + 10, y, '#d6d0c0'); y += 10; });
    y += 4;
    for (const id of o.surges) {
      const su = SURGES[id];
      text(su.name, px + 10, y, o.color); y += 10;
      text(su.desc, px + 10, y, '#a8a498'); y += 11;
    }
    y += 2;
    text('Passive: ' + o.passive.name, px + 10, y, '#a8e4ff'); y += 10;
    wrapText(o.passive.desc, pw - 20).forEach(l => { text(l, px + 10, y, '#a8a498'); y += 10; });
    text(`Radiance: ${o.ult.name}`, px + 10, y + 2, '#ffe08a');
    // Step controls at bottom-left.
    panel(6, H - 38, 216, 32, '#c9a860', 'rgba(8,11,26,.85)');
    if (this.step === 0) { text('Choose your Order', 14, H - 33, '#ffe08a'); text('< > browse the ring   OK choose', 14, H - 21, '#b0b8d0'); }
    else if (this.step === 1) { text(`Your people: ${LOOKS[this.look].name}`, 14, H - 33, '#ffe08a'); text('< > change   OK confirm   X back', 14, H - 21, '#b0b8d0'); }
    else {
      const cur = Math.floor(this.t * 2) % 2 ? '_' : ' ';
      text(`Your name: ${this.name}${cur}`, 14, H - 33, '#ffe08a'); text('Type a name, or up/down   OK begin', 14, H - 21, '#b0b8d0');
    }
    text('Choose carefully. Oaths are hard to take back.', 8, 8, '#8a8ea8');
  }
};
// While entering a name, letters go to the name and not to movement bindings.
window.addEventListener('keydown', e => {
  if (!Input.textMode) return;
  if (TEXT_MODE_KEYS.includes(e.code)) return;
  e.preventDefault();
  if (e.code === 'Backspace') CreateScene.name = CreateScene.name.slice(0, -1);
  else if (e.key.length === 1 && /[a-zA-Z' -]/.test(e.key) && CreateScene.name.length < 11) CreateScene.name += e.key;
}, true);

// ---------- world map ----------
const WorldScene = {
  i: 0, t: 0, walkT: 0, px: 0, py: 0, focus: null,
  enter(focus) { const list = this.nodes(); this.i = Math.max(0, list.findIndex(n => n.id === focus)); this.t = 0; const n = list[this.i] || list[0]; this.px = n.x; this.py = n.y; },
  nodes() { return WORLD_NODES.filter(n => S.nodes[n.id]); },
  update() {
    this.t += DT; Particles.update();
    const list = this.nodes(), n = list[this.i];
    this.px = lerp(this.px, n.x, .1); this.py = lerp(this.py, n.y, .1);
    if (Game.script) return;
    if (Input.rep.left || Input.rep.up) { this.i = (this.i + list.length - 1) % list.length; Sfx.play('move'); }
    if (Input.rep.right || Input.rep.down) { this.i = (this.i + 1) % list.length; Sfx.play('move'); }
    if (Input.pressed.menu) { Sfx.play('ok'); Menu.open(); return; }
    if (Input.pressed.ok) {
      Sfx.play('ok');
      Game.run((function* () { yield* Game.fadeOut(.35); Game.enterMap(n.map, n.spawn[0], n.spawn[1]); Game.scene = FieldScene; Game.save(); yield* Game.fadeIn(.4); })());
    }
  },
  draw() {
    g.drawImage(backdrop('worldmap'), 0, 0);
    const list = this.nodes(), cur = list[this.i];
    // The storm front creeps across the map from the west as the chapters advance.
    const prog = Object.keys(S.nodes).length, sw = 16 + prog * 14;
    g.fillStyle = 'rgba(120,20,16,.36)'; g.fillRect(0, 0, sw, H);
    for (let y = 0; y < H; y += 7) { g.fillStyle = 'rgba(255,90,60,.5)'; g.fillRect(sw + Math.sin(y * .7 + this.t * 2) * 5, y, 2, 4); }
    g.setLineDash && g.setLineDash([3, 3]); g.strokeStyle = 'rgba(40,28,20,.8)'; g.lineWidth = 1; g.beginPath(); list.forEach((n, i) => i ? g.lineTo(n.x, n.y) : g.moveTo(n.x, n.y)); g.stroke(); g.setLineDash && g.setLineDash([]);
    for (const n of WORLD_NODES) {
      const on = S.nodes[n.id], sel = cur === n;
      g.fillStyle = '#141022'; g.fillRect(n.x - 4, n.y - 4, 9, 9);
      g.fillStyle = on ? (sel ? '#ffe08a' : '#c9a860') : '#4c4034'; g.fillRect(n.x - 3, n.y - 3, 7, 7);
      if (on) text(n.name, n.x, n.y + 7, sel ? '#ffe8b0' : '#e0d4b4', { align: 'center' });
    }
    if (cur) glow(cur.x, cur.y, 18, '#ffe08a', .5);
    const h = S.party[0], o = ORDER(h.order), s = humanSprite(heroPal(S), 'h' + h.order + h.look + S.ideal, walkPose(0, 0, false));
    g.drawImage(s, Math.round(this.px - 13), Math.round(this.py - 33 + Math.sin(this.t * 3) * 1));
    panel(8, 8, 208, 30);
    text(cur.name, 14, 12, '#ffe08a'); text(cur.sub, 14, 24, '#c8c0ae');
    if (S.quest) { const ls = wrapText(S.quest, 420); panel(8, H - 14 - ls.length * 10, W - 16, ls.length * 10 + 8); ls.forEach((l, i) => text(l, 14, H - 10 - ls.length * 10 + i * 10, '#f2ead6')); }
  }
};

// ---------- pause menu ----------
const Menu = {
  tabs: ['Party', 'Items', 'Equip', 'Oaths', 'System'], tab: 0, i: 0, sub: null, msg: '', prev: null,
  open() { this.tab = 0; this.i = 0; this.sub = null; this.msg = ''; this.prev = Game.scene; Game.scene = MenuScene; },
  close() { Sfx.play('back'); Game.scene = this.prev; }
};
const MenuScene = {
  update() {
    const M = Menu;
    if (M.sub) { this.updateSub(); return; }
    if (Input.pressed.back || Input.pressed.menu) { M.close(); return; }
    if (Input.rep.left) { M.tab = (M.tab + M.tabs.length - 1) % M.tabs.length; M.i = 0; M.msg = ''; Sfx.play('move'); }
    if (Input.rep.right) { M.tab = (M.tab + 1) % M.tabs.length; M.i = 0; M.msg = ''; Sfx.play('move'); }
    const n = this.rowCount();
    if (n) {
      if (Input.rep.up) { M.i = (M.i + n - 1) % n; Sfx.play('move'); }
      if (Input.rep.down) { M.i = (M.i + 1) % n; Sfx.play('move'); }
      if (M.i >= n) M.i = n - 1;
    }
    if (Input.pressed.ok) this.confirm();
  },
  useItems() { return Object.keys(S.items).sort(); },
  rowCount() { const t = Menu.tabs[Menu.tab]; return t === 'Party' ? S.party.length : t === 'Items' ? this.useItems().length : t === 'Equip' ? S.party.length * 3 : t === 'System' ? this.sysOpts().length : 0; },
  confirm() {
    const M = Menu, t = M.tabs[M.tab];
    if (t === 'Items') {
      const id = this.useItems()[M.i]; if (!id) return;
      const it = ITEMS[id];
      if (it.kind !== 'use' || it.dmg) { Sfx.play('denied'); M.msg = it.kind === 'use' ? 'That is only useful in battle.' : 'Gear goes on through the Equip tab.'; return; }
      M.sub = { kind: 'itemTarget', id, i: 0 }; Sfx.play('ok');
    } else if (t === 'Equip') {
      const hi = Math.floor(M.i / 3), slot = ['weapon', 'armor', 'charm'][M.i % 3], h = S.party[hi];
      const list = Object.keys(S.items).filter(id => { const q = ITEMS[id]; return q.kind === 'gear' && q.slot === slot && (!q.who || q.who === h.id); });
      M.sub = { kind: 'equip', h, slot, list: ['(none)', ...list], i: 0 }; Sfx.play('ok');
    } else if (t === 'System') {
      const opts = this.sysOpts(), o = opts[M.i];
      if (o === 'Save game') { Sfx.play('ok'); SaveScene.open('save'); }
      else if (o === 'Load game') { Sfx.play('ok'); SaveScene.open('load'); }
      else if (o.startsWith('Sound')) { Game.toggleSound(); Sfx.play('ok'); }
      else if (o === 'Open save folder') { window.desktop.saves.openFolder(); Sfx.play('ok'); }
      else if (o === 'Return to title') { Sfx.play('back'); Game.toTitle(); }
      else if (o === 'Quit to desktop') { window.desktop && window.desktop.quit(); }
    }
  },
  sysOpts() { const a = ['Save game', 'Load game', 'Sound: ' + (Sfx.muted ? 'off' : 'on'), 'Return to title']; if (window.desktop) a.push('Open save folder', 'Quit to desktop'); return a; },
  updateSub() {
    const M = Menu, s = M.sub;
    if (Input.pressed.back) { Sfx.play('back'); M.sub = null; return; }
    if (s.kind === 'itemTarget') {
      if (Input.rep.up) { s.i = (s.i + S.party.length - 1) % S.party.length; Sfx.play('move'); }
      if (Input.rep.down) { s.i = (s.i + 1) % S.party.length; Sfx.play('move'); }
      if (Input.pressed.ok) {
        const it = ITEMS[s.id];
        for (const h of (it.target === 'allies' ? S.party : [S.party[s.i]])) {
          const st = stats(h, S.ideal);
          if (it.heal) h.hp = Math.min(st.hp, h.hp + it.heal);
          if (it.sl) h.sl = Math.min(st.sl, h.sl + it.sl);
          if (it.revive) h.hp = Math.max(h.hp, Math.round(st.hp * it.revive));
        }
        S.items[s.id]--; if (S.items[s.id] <= 0) { delete S.items[s.id]; M.sub = null; }
        Sfx.play('heal');
      }
    } else {
      const n = s.list.length;
      if (Input.rep.up) { s.i = (s.i + n - 1) % n; Sfx.play('move'); }
      if (Input.rep.down) { s.i = (s.i + 1) % n; Sfx.play('move'); }
      if (Input.pressed.ok) {
        const pickId = s.i === 0 ? null : s.list[s.i], old = s.h.equip[s.slot];
        if (old) give(old);
        if (pickId) { S.items[pickId]--; if (S.items[pickId] <= 0) delete S.items[pickId]; }
        s.h.equip[s.slot] = pickId;
        const st = stats(s.h, S.ideal); s.h.hp = Math.min(s.h.hp, st.hp); s.h.sl = Math.min(s.h.sl, st.sl);
        Sfx.play('ok'); M.sub = null;
      }
    }
  },
  draw() {
    const M = Menu, t = M.tabs[M.tab];
    g.drawImage(canvasOf(1, 1), 0, 0);
    g.fillStyle = '#080b1a'; g.fillRect(0, 0, W, H);
    const o = ORDER(S.party[0].order);
    glow(70, 40, 110, o.color, .14);
    M.tabs.forEach((n, i) => { const x = 8 + i * 74, sel = i === M.tab; panel(x, 6, 70, 16, sel ? '#ffe08a' : '#4e4a5e', sel ? 'rgba(50,42,28,.98)' : 'rgba(14,16,32,.9)'); text(n, x + 35, 10, sel ? '#ffe08a' : '#a8a8b8', { align: 'center' }); });
    text(`${S.gold} marks`, W - 8, 10, '#ffe08a', { align: 'right' });
    panel(8, 26, W - 16, H - 50);
    this['draw' + t]();
    panel(8, H - 20, W - 16, 15, '#4e4a5e');
    text(M.msg || this.helpFor(t), 14, H - 17, M.msg ? '#a8f0c0' : '#a8a8b8');
    if (M.sub) this.drawSub();
  },
  helpFor(t) { return { Party: '< > tabs   X close   Level up by battling. Ideals are sworn through the story.', Items: 'OK use   < > tabs', Equip: 'OK change gear', Oaths: 'The ring of Orders and your sworn words.', System: 'OK select' }[t]; },
  drawParty() {
    S.party.forEach((h, i) => {
      const y = 31 + i * 64, st = stats(h, S.ideal), sel = Menu.i === i, id = h.id, pal = id === 'hero' ? heroPal(S) : COMPANIONS[id].pal, key = id === 'hero' ? 'p' + h.order + h.look + S.ideal : id;
      g.drawImage(portrait(pal, key), 14, y);
      text(h.name, 66, y, sel ? '#ffe08a' : '#ffffff');
      text(id === 'hero' ? `${ORDER(h.order).name.slice(0, -1)}, ${['no', 'First', 'Second', 'Third', 'Fourth'][S.ideal]} Ideal` : COMPANIONS[id].role, 66, y + 10, '#a8a498');
      text(`LV ${h.lvl}`, 210, y, '#ffe8b0');
      text(`XP ${h.xp}/${xpNeed(h.lvl)}`, 210, y + 10, '#a8a498');
      text('HP', 66, y + 22, '#a8f0c0'); bar(84, y + 24, 92, 3, h.hp ?? st.hp, st.hp, '#58d078'); text(`${h.hp ?? st.hp}/${st.hp}`, 180, y + 22, '#d6d0c0');
      const lab = id === 'hero' ? 'SL' : 'FP'; text(lab, 66, y + 32, '#a8e4ff'); bar(84, y + 34, 92, 3, h.sl ?? st.sl, st.sl, id === 'hero' ? ORDER(h.order).color : '#7fc8ff'); text(`${h.sl ?? st.sl}/${st.sl}`, 180, y + 32, '#d6d0c0');
      text(`ATK ${st.atk}`, 260, y + 22, '#ffc0a0'); text(`DEF ${st.def}`, 310, y + 22, '#a8c8ff');
      const sks = heroSkills(h, S.ideal).map(q => SKILLS[q].name).join(', ');
      wrapText(sks || 'No abilities yet.', 200).slice(0, 2).forEach((l, k) => text(l, 260, y + k * 10, '#c8c0ae'));
    });
  },
  drawItems() {
    const ids = this.useItems(), M = Menu;
    if (!ids.length) { text('Nothing in the pack.', 16, 34, '#a8a498'); return; }
    const per = 15, top = Math.max(0, Math.min(M.i - per + 1, ids.length - per));
    ids.slice(top, top + per).forEach((id, k) => {
      const it = ITEMS[id], y = 31 + k * 12, sel = top + k === M.i;
      if (sel) { g.fillStyle = 'rgba(232,200,119,.2)'; g.fillRect(12, y - 1, 180, 11); }
      text(it.name, 16, y, sel ? '#ffffff' : '#d6d0c0'); text('x' + S.items[id], 188, y, '#a8e4ff', { align: 'right' });
    });
    const cur = ITEMS[ids[M.i]];
    if (cur) wrapText(cur.desc, 240).forEach((l, i) => text(l, 208, 34 + i * 11, '#d6d0c0'));
  },
  drawEquip() {
    S.party.forEach((h, i) => {
      const y = 31 + i * 64, st = stats(h, S.ideal);
      const id = h.id, pal = id === 'hero' ? heroPal(S) : COMPANIONS[id].pal, key = id === 'hero' ? 'p' + h.order + h.look + S.ideal : id;
      g.drawImage(portrait(pal, key), 14, y);
      text(`${h.name}  ATK ${st.atk}  DEF ${st.def}  HP ${st.hp}  SL ${st.sl}`, 66, y, '#ffe8b0');
      ['weapon', 'armor', 'charm'].forEach((sl, k) => {
        const yy = y + 13 + k * 12, sel = Menu.i === i * 3 + k, cur = h.equip[sl];
        if (sel) { g.fillStyle = 'rgba(232,200,119,.2)'; g.fillRect(64, yy - 1, 300, 11); }
        text({ weapon: 'Weapon', armor: 'Armor', charm: 'Charm' }[sl], 68, yy, '#a8a498');
        text(cur ? ITEMS[cur].name : '-', 116, yy, sel ? '#ffffff' : '#d6d0c0');
      });
      if (id === 'hero' && S.ideal >= 3) text(`+ Living Shardblade${S.ideal >= 4 ? ' and Shardplate' : ''}`, 300, y + 13, ORDER(h.order).color);
    });
  },
  drawOaths() {
    const o = ORDER(S.party[0].order), cx = 96, cy = 128, n = ORDERS.indexOf(o);
    ORDERS.forEach((q, i) => {
      const a = (i - n) / 10 * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * 72, y = cy + Math.sin(a) * 72, on = i === n;
      if (on) glow(x, y, 16, q.color, .7);
      g.globalAlpha = on ? 1 : .6; g.drawImage(orderGlyph(q.id, 18, q.color), Math.round(x - 10), Math.round(y - 10)); g.globalAlpha = 1;
    });
    g.drawImage(sprenSprite(o, true, 0), cx - 20, cy - 24);
    text(o.spren, cx, cy + 18, o.color, { align: 'center' });
    let y = 32;
    const px = 186, w = 276;
    text('Words sworn', px, y, '#ffe08a'); y += 12;
    const lines = [['First', 'Life before death. Strength before weakness. Journey before destination.'], ['Second', o.ideals[0]], ['Third', o.ideals[1]], ['Fourth', o.ideals[2]]];
    lines.forEach(([lab, tx], i) => {
      const on = S.ideal > i;
      text(lab, px, y, on ? o.color : '#54546a');
      y += 10;
      wrapText(on ? tx : 'Not yet spoken.', w).forEach(l => { text(l, px, y, on ? '#f2ead6' : '#54546a'); y += 10; });
      y += 2;
    });
    y += 2;
    text('Surges', px, y, '#ffe08a'); y += 11;
    for (const id of o.surges) { const s = SURGES[id]; text(`${s.name}: ${s.desc}`, px, y, '#c8c0ae'); y += 10; }
    y += 2;
    text(`${o.passive.name}:`, px, y, '#a8e4ff'); y += 10;
    wrapText(o.passive.desc, w).forEach(l => { text(l, px, y, '#c8c0ae'); y += 10; });
  },
  drawSystem() {
    this.sysOpts().forEach((op, i) => { const sel = Menu.i === i, y = 40 + i * 14; if (sel) { g.fillStyle = 'rgba(232,200,119,.2)'; g.fillRect(16, y - 2, 150, 12); } text(op, 22, y, sel ? '#ffffff' : '#d6d0c0'); });
    text('Keyboard', 200, 40, '#ffe08a');
    ['Move: arrows or WASD', 'OK and timed presses: Space, Z, Enter', 'Back: X or Esc', 'Menu and infuse: C, Tab, or M', /Mac/.test(navigator.platform) ? 'Fullscreen: Ctrl+Cmd+F (desktop app)' : 'Fullscreen: F11 (desktop app)', 'Gamepads work too.'].forEach((l, i) => text(l, 200, 52 + i * 11, '#c8c0ae'));
  },
  drawSub() {
    const s = Menu.sub;
    if (s.kind === 'itemTarget') {
      const h = S.party.length * 14 + 18;
      panel(150, 70, 180, h, '#ffe08a'); text(ITEMS[s.id].name + ' x' + S.items[s.id], 158, 75, '#ffe08a');
      S.party.forEach((q, i) => { const st = stats(q, S.ideal), sel = s.i === i, y = 88 + i * 14; if (sel) { g.fillStyle = 'rgba(232,200,119,.2)'; g.fillRect(154, y - 2, 172, 13); } text(`${q.name}  ${q.hp ?? st.hp}/${st.hp}  SL ${q.sl ?? st.sl}`, 158, y, sel ? '#ffffff' : '#d6d0c0'); });
    } else {
      const shown = s.list.slice(0, 12), h = shown.length * 12 + 34;
      panel(112, 40, 260, h, '#ffe08a'); text(`${s.h.name}: ${s.slot}`, 120, 45, '#ffe08a');
      shown.forEach((id, i) => { const sel = s.i === i, y = 58 + i * 12; if (sel) { g.fillStyle = 'rgba(232,200,119,.2)'; g.fillRect(116, y - 2, 252, 11); } text(id === '(none)' ? '(none)' : `${ITEMS[id].name} x${S.items[id]}`, 120, y, sel ? '#ffffff' : '#d6d0c0'); });
      const cur = s.list[s.i]; if (cur && cur !== '(none)') text(ITEMS[cur].desc, 120, 40 + h - 13, '#a8e4ff');
    }
  }
};

// ---------- save and load screen ----------
function fmtClock(sec) { const m = Math.floor((sec || 0) / 60); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }
function fmtDate(ms) { const d = new Date(ms), h = d.getHours(); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate() + ', ' + (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); }
const SaveScene = {
  mode: 'load', i: 0, prev: null, confirm: null, msg: '',
  ids() { return this.mode === 'save' ? ['1', '2', '3'] : SLOT_IDS; },
  open(mode) {
    this.mode = mode; this.confirm = null; this.msg = ''; this.prev = Game.scene;
    const ids = this.ids(), last = Saves.latest();
    this.i = mode === 'load' ? Math.max(0, ids.indexOf(last)) : Math.max(0, ids.findIndex(id => !Saves.get(id)));
    Game.scene = this;
  },
  close() { Game.scene = this.prev; if (this.prev === TitleScene) TitleScene.refresh(); },
  doSave(id) {
    if (Game.save.call(Game, id)) { this.msg = 'Saved to slot ' + id + '.'; Sfx.play('heal'); }
    else { this.msg = Saves.failText(); Sfx.play('denied'); }
  },
  update() {
    if (Game.script) return;
    const ids = this.ids(), id = ids[this.i], rec = Saves.get(id);
    if (this.confirm) {
      if (Input.pressed.back) { Sfx.play('back'); this.confirm = null; return; }
      if (Input.pressed.ok) {
        const c = this.confirm; this.confirm = null;
        if (c.kind === 'overwrite') this.doSave(c.id);
        else if (Saves.remove(c.id)) { Sfx.play('back'); this.msg = 'Save deleted.'; if (this.prev === TitleScene && !Saves.any()) this.close(); }
        else { Sfx.play('denied'); this.msg = 'Could not delete that save file. Close anything using it, then try again.'; }
      }
      return;
    }
    if (Input.rep.up) { this.i = (this.i + ids.length - 1) % ids.length; this.msg = ''; Sfx.play('move'); }
    if (Input.rep.down) { this.i = (this.i + 1) % ids.length; this.msg = ''; Sfx.play('move'); }
    if (Input.pressed.back) { Sfx.play('back'); this.close(); return; }
    if (Input.pressed.menu && rec) { Sfx.play('move'); this.msg = ''; this.confirm = { kind: 'delete', id }; return; }
    if (Input.pressed.ok) {
      if (this.mode === 'save') { if (rec) { Sfx.play('move'); this.msg = ''; this.confirm = { kind: 'overwrite', id }; } else this.doSave(id); }
      else if (rec) { Sfx.play('ok'); const self = this; Game.run((function* () { const ok = yield* Game.loadGame(id); if (!ok) { self.msg = 'That save could not be read.'; Sfx.play('denied'); } })()); }
      else Sfx.play('denied');
    }
  },
  draw() {
    g.fillStyle = '#080b1a'; g.fillRect(0, 0, W, H);
    glow(70, 40, 110, '#7fc8ff', .12);
    text(this.mode === 'save' ? 'SAVE GAME' : 'LOAD GAME', 10, 7, '#ffe8b0', { scale: 2 });
    text(Saves.status(), W - 10, 11, '#8a8ea8', { align: 'right' });
    const ids = this.ids(), rowH = 50;
    ids.forEach((id, k) => {
      const y = 28 + k * (rowH + 2), sel = k === this.i, r = Saves.get(id);
      panel(8, y, W - 16, rowH, sel ? '#ffe08a' : '#4e4a5e', sel ? 'rgba(50,42,28,.95)' : 'rgba(14,16,32,.9)');
      const label = id === 'auto' ? 'Autosave' : 'Slot ' + id;
      if (!r) { text(label, 62, y + 7, sel ? '#ffe08a' : '#a8a8b8'); text('Empty', 62, y + 20, '#6a6a78'); return; }
      const m = r.meta, o = ORDER(m.order);
      g.drawImage(portrait(heroPal({ party: [{ order: m.order, look: m.look }], ideal: m.ideal }), 'p' + m.order + m.look + m.ideal), 13, y + 4, 42, 42);
      text(label, 62, y + 5, sel ? '#ffe08a' : '#a8a8b8');
      text(fmtDate(r.savedAt), W - 16, y + 5, '#c8c0ae', { align: 'right' });
      text(`${m.name}, ${o.name.slice(0, -1)}   Level ${m.lvl}`, 62, y + 17, o.color);
      text('Played ' + fmtClock(m.playT), W - 16, y + 17, '#c8c0ae', { align: 'right' });
      text(m.area, 62, y + 28, '#f2ead6');
      if (m.quest) text(wrapText(m.quest, W - 90)[0], 62, y + 38, '#a8a498');
    });
    panel(8, H - 20, W - 16, 15, '#4e4a5e');
    const cur = Saves.get(ids[this.i]);
    text(this.msg || (this.mode === 'save' ? 'OK save' : 'OK load') + (cur ? '   C delete' : '') + '   X back', 14, H - 17, this.msg ? '#a8f0c0' : '#a8a8b8');
    if (this.confirm) {
      const label = this.confirm.id === 'auto' ? 'the autosave' : 'slot ' + this.confirm.id, q = this.confirm.kind === 'delete' ? `Delete ${label}? This can't be undone.` : `Overwrite ${label}?`, w = textW(q) + 28;
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W, H);
      panel(W / 2 - w / 2, 104, w, 42, '#ffe08a');
      text(q, W / 2, 112, '#ffe8b0', { align: 'center' });
      text('OK yes   X no', W / 2, 128, '#a8e4ff', { align: 'center' });
    }
  }
};

// ---------- shop ----------
const ShopScene = {
  list: [], i: 0, mode: 0, tier: 1, msg: '',
  *run(tier) {
    this.tier = tier; this.list = SHOP_STOCK[tier]; this.i = 0; this.msg = 'What will it be?';
    const prev = Game.scene; Game.scene = this;
    yield;
    while (true) {
      const n = this.list.length;
      if (Input.rep.up) { this.i = (this.i + n - 1) % n; Sfx.play('move'); }
      if (Input.rep.down) { this.i = (this.i + 1) % n; Sfx.play('move'); }
      if (Input.pressed.ok) {
        const id = this.list[this.i], it = ITEMS[id];
        if (S.gold >= it.price) { S.gold -= it.price; give(id); Sfx.play('chest'); this.msg = `Bought ${it.name}. ${it.kind === 'gear' ? 'Equip it from the menu.' : ''}`; }
        else { Sfx.play('denied'); this.msg = 'You do not have enough marks.'; }
      }
      if (Input.pressed.back) { Sfx.play('back'); break; }
      yield;
    }
    Game.scene = prev;
    yield;
  },
  update() { },
  draw() {
    g.fillStyle = '#0a0d1e'; g.fillRect(0, 0, W, H);
    glow(70, 50, 100, '#3e7a6e', .25);
    g.drawImage(portrait(NPC_PALS.merchant, 'spmerchant'), 12, 10);
    text('Azim the Trader', 64, 12, '#ffe08a'); text(this.msg, 64, 24, '#d6d0c0');
    text(`${S.gold} marks`, W - 10, 12, '#ffe08a', { align: 'right' });
    panel(8, 60, 250, H - 68);
    this.list.forEach((id, k) => {
      const it = ITEMS[id], y = 66 + k * 13, sel = k === this.i;
      if (sel) { g.fillStyle = 'rgba(232,200,119,.2)'; g.fillRect(12, y - 1, 242, 12); }
      text(it.name, 16, y, sel ? '#ffffff' : '#d6d0c0');
      text(String(it.price), 250, y, S.gold >= it.price ? '#ffe08a' : '#7e7468', { align: 'right' });
    });
    panel(264, 60, W - 272, H - 68);
    const cur = ITEMS[this.list[this.i]];
    text(cur.name, 272, 66, '#ffe8b0');
    wrapText(cur.desc, W - 290).forEach((l, i) => text(l, 272, 80 + i * 11, '#d6d0c0'));
    text(`In pack: ${S.items[this.list[this.i]] || 0}`, 272, 120, '#a8a498');
    if (cur.who) text(`For: ${cur.who === 'hero' ? S.party[0].name : COMPANIONS[cur.who].name}`, 272, 132, '#a8e4ff');
    text('OK buy   X leave', 272, H - 22, '#a8a498');
  }
};
