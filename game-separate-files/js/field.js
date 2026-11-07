'use strict';
// Exploration: movement, collisions, foes on the map, triggers, dynamic lighting, and spren.
const Field = {
  player: { x: 0, y: 0, dir: 0, frame: 0, ft: 0, moving: false, name: 'hero' }, trail: [], foes: [], t: 0, shake: 0, safeT: 0, toastMsg: null, toastT: 0, areaT: 0, npcs: [], locked: false, onPlate: -1, hop: null,
  enter(m, x, y) {
    this.map = m;
    this.player.x = x * TS + 8; this.player.y = y * TS + 12;
    this.npcs = m.npcs.map(n => Object.assign({}, n, { sx: n.x, sy: n.y, wt: rand(2), wdx: 0, wdy: 0, frame: 0 }));
    this.rebuildFoes();
    this.trail = []; for (let i = 0; i < 60; i++) this.trail.push({ x: this.player.x, y: this.player.y, dir: 0, moving: false });
    this.areaT = 3; this.locked = false; this.onPlate = -1; this.safeT = 1;
    Weather.set(S.flags.prologue ? 'storm' : m.weather);
    this.fixPlayer();
    Music.play(S.flags.prologue ? 'deep' : m.music);
  },
  // Lit lamps survive a reload because they are stored in flags, not on the object.
  syncObjects() { for (const o of this.map.objs) if (o.lamp) o.kind = S.flags[o.lamp] ? 'lampLit' : 'lampDead'; },
  rebuildFoes() {
    const cl = S.cleared[this.map.id] || [];
    this.foes = this.map.foes.filter(f => !cl.includes(f.id)).map(f => Object.assign({}, f, { wt: rand(2), dx: 0, dy: 0, frame: 0, ftt: 0 }));
    this.syncObjects();
  },
  visible(o) {
    const fl = S.flags;
    if (o.hideIf && fl[o.hideIf]) return false;
    if (o.hideIf2 && fl[o.hideIf2]) return false;
    if (o.showIf && !fl[o.showIf]) return false;
    return true;
  },
  npcBy(id) { return this.npcs.find(n => n.id === id); },
  lock() { this.locked = true; },
  toast(m) { this.toastMsg = m; this.toastT = 2.6; },
  objOpened(o) { return o.chest && S.chests[o.chest]; },
  blockedTile(px, py) { const t = this.map.get(Math.floor(px / TS), Math.floor(py / TS)); return t === 0 || t === 3 || t === 4; },
  blocked(x, y) {
    const hw = 5, hh = 3;
    if (this.blockedTile(x - hw, y - hh) || this.blockedTile(x + hw, y - hh) || this.blockedTile(x - hw, y + hh) || this.blockedTile(x + hw, y + hh)) return true;
    for (const o of this.map.objs) {
      const d = OBJ[o.kind]; if (!d.solid || !this.visible(o)) continue;
      const [w, h] = d.solid;
      if (x + hw > o.x - w / 2 && x - hw < o.x + w / 2 && y + hh > o.y - h && y - hh < o.y) return true;
    }
    for (const n of this.npcs) { if (!this.visible(n)) continue; if (Math.abs(n.x - x) < 10 && Math.abs(n.y - y) < 7) return true; }
    return false;
  },
  // Nudge out of solids, in case an object now occupies the arrival point.
  fixPlayer() {
    const p = this.player;
    if (!this.blocked(p.x, p.y)) return;
    for (let r = 4; r < 80; r += 4) for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0], [r, r], [-r, r], [r, -r], [-r, -r]]) if (!this.blocked(p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; return; }
  },
  frontPoint() { const p = this.player, d = [[0, 1], [0, -1], [1, 0], [-1, 0]][p.dir]; return { x: p.x + d[0] * 13, y: p.y + d[1] * 13 }; },
  findInteract() {
    const f = this.frontPoint(), p = this.player;
    for (const n of this.npcs) { if (!this.visible(n) || !n.act) continue; if (Math.hypot(n.x - f.x, n.y - f.y) < 15) return { t: 'npc', o: n }; }
    let best = null, bd = 1e9;
    for (const o of this.map.objs) {
      if (!this.visible(o)) continue;
      if (!(o.act || o.chest || o.lamp) || (o.chest && S.chests[o.chest])) continue;
      const d = OBJ[o.kind], hw = (d.solid ? d.solid[0] / 2 : 8) + 10, dist = Math.abs(o.x - f.x) < hw ? Math.abs(o.y - 4 - f.y) : 1e9, pd = Math.hypot(o.x - p.x, o.y - p.y);
      if ((dist < 16 || pd < 16) && pd < bd) { bd = pd; best = { t: 'obj', o }; }
    }
    return best;
  },
  interact(hit) {
    if (hit.t === 'npc') {
      const n = hit.o; if (!n.small) { const dx = this.player.x - n.x, dy = this.player.y - n.y; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1); }
      Game.run(Story[n.act]()); return;
    }
    const o = hit.o;
    if (o.chest) { Game.run(this.openChest(o)); return; }
    if (o.lamp) { Game.run(Story.lamp(o)); return; }
    if (o.act === 'gap') { Game.run(this.crossGap(o)); return; }
    if (Story[o.act]) Game.run(Story[o.act]());
  },
  *openChest(o) {
    S.chests[o.chest] = 1; Sfx.play('chest');
    const L = o.loot, parts = [];
    if (L.gold) { S.gold += L.gold; parts.push(L.gold + ' marks'); }
    if (L.item) { give(L.item, L.n || 1); parts.push(ITEMS[L.item].name + (L.n > 1 ? ' x' + L.n : '')); }
    Particles.burst(o.x, o.y - 8, 18, '#ffe08a', { s1: 70, up: -40 });
    yield* announce('Found ' + parts.join(' and ') + '!');
  },
  *crossGap(o) {
    const p = this.player, oc = ORDER(S.party[0].order), sx = p.x, sy = p.y, tx = o.tx, ty = o.ty;
    Sfx.play('surge');
    if (!S.flags.crossed) { S.flags.crossed = 1; yield* narr(oc.traverse); }
    p.dir = tx > sx ? 2 : 3;
    this.hop = { h: 0 };
    yield* tween(.6, k => {
      p.x = lerp(sx, tx, k); p.y = lerp(sy, ty, k); this.hop.h = Math.sin(k * Math.PI) * 26;
      Particles.add({ x: p.x + rand(-5, 5), y: p.y - 10 + rand(-6, 6) - this.hop.h, vy: -8, life: .6, col: oc.color, add: true, size: 2 });
    }, easeIO);
    this.hop = null;
    this.fixPlayer();
    for (const q of this.trail) { q.x = p.x; q.y = p.y; }
    Sfx.play('stairs');
  },
  *fight(f) {
    const r = yield* Battle.run(f.form);
    if (r === 'win') { (S.cleared[this.map.id] = S.cleared[this.map.id] || []).push(f.id); this.foes = this.foes.filter(q => q !== f); }
    this.safeT = 2;
    if (r === 'win') Game.save();
  },
  update() {
    this.t += DT; this.shake = Math.max(0, this.shake - DT); this.safeT = Math.max(0, this.safeT - DT); this.areaT = Math.max(0, this.areaT - DT); this.toastT = Math.max(0, this.toastT - DT);
    const p = this.player;
    p.moving = false;
    if (!Game.script && !Game.overlay) {
      this.locked = false;
      let dx = 0, dy = 0;
      if (Input.held.left) dx--; if (Input.held.right) dx++; if (Input.held.up) dy--; if (Input.held.down) dy++;
      if (dx || dy) {
        const sp = (S.flags.fast ? 150 : 94) * DT, n = Math.hypot(dx, dy), vx = dx / n * sp, vy = dy / n * sp;
        p.dir = Math.abs(dx) >= Math.abs(dy) && dx ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1);
        let moved = false;
        if (vx && !this.blocked(p.x + vx, p.y)) { p.x += vx; moved = true; }
        if (vy && !this.blocked(p.x, p.y + vy)) { p.y += vy; moved = true; }
        if (moved) {
          p.moving = true; p.ft += DT;
          if (p.ft > .13) { p.ft = 0; p.frame++; if (p.frame % 2) Sfx.play('step'); }
          this.trail.unshift({ x: p.x, y: p.y, dir: p.dir, moving: true }); this.trail.pop();
        }
      }
      if (Input.pressed.ok) { const hit = this.findInteract(); if (hit) { Sfx.play('ok'); this.interact(hit); return; } }
      if (Input.pressed.menu) { Sfx.play('ok'); Menu.open(); return; }
      this.checkTriggers();
      this.checkPlates();
    }
    this.updateNpcs();
    if (!Game.script && !Game.overlay) this.updateFoes();
    this.ambience();
    Particles.update(); Ribbons.update();
  },
  updateNpcs() {
    for (const n of this.npcs) {
      if (!n.wander || !this.visible(n)) continue;
      n.wt -= DT;
      if (n.wt <= 0) { n.wt = rand(1, 3); const a = Math.random() < .4 ? 0 : 1; n.wdx = a * pick([-1, 0, 1]); n.wdy = a * pick([-1, 0, 1]); }
      const nx = n.x + n.wdx * 22 * DT, ny = n.y + n.wdy * 22 * DT;
      if ((n.wdx || n.wdy) && Math.hypot(nx - n.sx, ny - n.sy) < 34 && !this.blockedTile(nx, ny) && Math.hypot(nx - this.player.x, ny - this.player.y) > 14) { n.x = nx; n.y = ny; n.moving = true; n.frame = Math.floor(this.t * 7); n.dir = n.wdx > 0 ? 2 : n.wdx < 0 ? 3 : n.wdy > 0 ? 0 : 1; } else n.moving = false;
    }
  },
  updateFoes() {
    const p = this.player;
    for (const f of this.foes) {
      if (!this.visible(f)) continue;
      const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
      f.ftt += DT; f.frame = Math.floor(f.ftt * 4) % 2;
      let vx = 0, vy = 0;
      if (d < 78 && this.safeT <= 0) { vx = dx / d * 62; vy = dy / d * 62; f.alert = true; }
      else {
        f.alert = false; f.wt -= DT;
        if (f.wt <= 0) { f.wt = rand(1, 3); const a = rand(6.28); f.dx = Math.random() < .35 ? 0 : Math.cos(a) * 26; f.dy = Math.random() < .35 ? 0 : Math.sin(a) * 26; }
        vx = f.dx; vy = f.dy;
        if (Math.hypot(f.x - f.sx, f.y - f.sy) > 44) { vx = (f.sx - f.x) * .9; vy = (f.sy - f.y) * .9; }
      }
      const nx = f.x + vx * DT, ny = f.y + vy * DT;
      if (!this.blockedTile(nx, f.y)) f.x = nx;
      if (!this.blockedTile(f.x, ny)) f.y = ny;
      if (vx) f.face = vx > 0 ? 1 : -1;
      if (d < 16 && this.safeT <= 0) { Game.run(this.fight(f)); return; }
    }
  },
  checkTriggers() {
    const p = this.player, tx = p.x / TS, ty = p.y / TS;
    for (const t of this.map.trigs) {
      if (t.once && S.flags[t.once]) continue;
      if (t.ifFlag && !S.flags[t.ifFlag]) continue;
      if (t.hideIf && S.flags[t.hideIf]) continue;
      if (tx >= t.x && tx < t.x + t.w && ty >= t.y && ty < t.y + t.h) {
        if (t.once) S.flags[t.once] = 1;
        Game.run(Story[t.fn]());
        return;
      }
    }
  },
  checkPlates() {
    if (this.map.id !== 'vault') return;
    const p = this.player; let on = -1;
    for (const o of this.map.objs) if (o.plate !== undefined && Math.abs(o.x - p.x) < 9 && p.y > o.y - 18 && p.y < o.y) on = o.plate;
    if (on !== this.onPlate) { this.onPlate = on; if (on >= 0) Story.plateStep(on); }
  },
  ambience() {
    const p = this.player, cam = this.cam(), th = this.map.theme, col = ORDER(S.party[0].order).color;
    if (S.ideal >= 1 && Math.random() < .25) Particles.add({ x: p.x + rand(-6, 6), y: p.y - rand(2, 24), vy: -rand(8, 22), life: rand(.4, .9), col: mix(col, '#ffffff', .4), add: true });
    if ((th === 'town' || th === 'crags') && Math.random() < .012) Ribbons.spawn(cam.x - 20, cam.y + rand(H * .7));
    // Lifespren around plants.
    if ((th === 'town' || th === 'crags' || th === 'chasm') && Math.random() < .06) Particles.add({ x: cam.x + rand(W), y: cam.y + rand(H), vy: -8, vx: rand(-4, 4), life: rand(1, 2.4), col: '#a8f09c', add: true });
    for (const o of this.map.objs) if (o.kind === 'fire' && Math.random() < .35) Particles.add({ x: o.x + rand(-4, 4), y: o.y - 8, vy: -rand(14, 38), vx: rand(-5, 5), life: rand(.3, .8), col: pick(['#ffb040', '#ff7030', '#ffe080']), add: true });
    if (th === 'dais' && Math.random() < .2) Particles.add({ x: cam.x + rand(W), y: cam.y + rand(H), vy: rand(-30, -8), vx: rand(20, 60), life: 1, col: '#ff5a44', add: true });
  },
  cam() { const p = this.player, m = this.map; return { x: clamp(Math.round(p.x - W / 2), 0, Math.max(0, m.w * TS - W)), y: clamp(Math.round(p.y - 14 - H / 2), 0, Math.max(0, m.h * TS - H)) }; },

  // ---------- rendering ----------
  draw() {
    const m = this.map, c = this.cam(), t = this.t;
    let sx = c.x, sy = c.y;
    if (this.shake > 0) { sx += Math.round(rand(-1, 1) * this.shake * 5); sy += Math.round(rand(-1, 1) * this.shake * 4); }
    g.fillStyle = '#05050a'; g.fillRect(0, 0, W, H);
    g.drawImage(m.canvas, -sx, -sy);
    this.drawWater(sx, sy);
    for (const o of m.objs) {
      if (OBJ[o.kind].flat && this.visible(o)) this.drawFlat(o, sx, sy);
    }
    this.drawDecor(sx, sy);
    const draws = [];
    for (const o of m.objs) if (!OBJ[o.kind].flat && this.visible(o)) draws.push({ y: o.y, f: () => this.drawObj(o, sx, sy) });
    for (const n of this.npcs) if (this.visible(n)) draws.push({ y: n.y, f: () => this.drawNpc(n, sx, sy) });
    for (const f of this.foes) if (this.visible(f)) draws.push({ y: f.y, f: () => this.drawFoe(f, sx, sy) });
    const P = this.player;
    if (S.party.length > 1) for (let i = S.party.length - 1; i >= 1; i--) { const q = this.trail[i * 20]; draws.push({ y: q.y - .1, f: () => this.drawComp(S.party[i], q, sx, sy) }); }
    draws.push({ y: P.y, f: () => this.drawPlayer(sx, sy) });
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.f();
    Ribbons.draw(sx, sy);
    Particles.draw(sx, sy);
    this.applyLight(sx, sy);
    Weather.draw();
    this.drawHud(sx, sy);
  },
  drawWater(sx, sy) {
    const m = this.map, th = THEMES[m.theme], x0 = Math.max(0, Math.floor(sx / TS)), y0 = Math.max(0, Math.floor(sy / TS)), bead = m.theme === 'shadesmar', t = this.t;
    for (let y = y0; y < Math.min(m.h, y0 + 19); y++) for (let x = x0; x < Math.min(m.w, x0 + 32); x++) {
      if (m.get(x, y) !== 3) continue;
      const px = x * TS - sx, py = y * TS - sy, s = x * 31 + y * 17;
      if (bead) {
        for (let i = 0; i < 4; i++) {
          const q = s * (i + 3), ox = (q * 7 + Math.floor(t * (2 + i)) * ((q % 3) - 1)) % 16, oy = (q * 13) % 16;
          g.fillStyle = i === 0 ? '#d4d8f0' : '#6a70a8'; g.fillRect(px + ((ox + 16) % 16), py + oy, i === 0 ? 2 : 1, i === 0 ? 2 : 1);
        }
      } else if ((s + Math.floor(t * 3)) % 5 === 0) { g.fillStyle = th.w2; g.fillRect(px + (s % 11), py + (s % 13), 4, 1); }
    }
  },
  drawDecor(sx, sy) {
    const P = this.player, t = this.t;
    for (const d of this.map.decor) {
      const x = d.x - sx, y = d.y - sy;
      if (x < -12 || y < -12 || x > W + 12 || y > H + 12) continue;
      // Plants pull in as anyone nears. The nearer the feet, the tighter the shell.
      const dist = Math.hypot(d.x - P.x, d.y - P.y), k = clamp((dist - 12) / 26, 0, 1);
      DECOR[d.kind](g, Math.round(x), Math.round(y), k, t);
    }
  },
  drawFlat(o, sx, sy) {
    const s = objSprite(o.kind), x = Math.round(o.x - s.width / 2 - sx), y = Math.round(o.y - s.height - sy);
    if (o.kind === 'oathgate') { g.drawImage(s, x, y); const pu = .3 + Math.sin(this.t * 2) * .15; glow(o.x - sx, o.y - 32 - sy, 44, S.flags.finalDown ? '#ffe08a' : '#ff5a44', pu); return; }
    if (o.kind === 'spot') { g.drawImage(s, x, y + Math.round(Math.sin(this.t * 3) * 1)); glow(o.x - sx, o.y - 5 - sy, 14, ORDER(S.party[0].order).color, .6 + Math.sin(this.t * 4) * .2); return; }
    g.drawImage(s, x, y);
    if (o.plate !== undefined) {
      const L = Story.plateLayout()[o.plate], done = S.flags.vaultDoor;
      g.drawImage(orderGlyph(L.id, 12, done ? L.color : '#9fb4d8'), x + 3, y + 3);
    }
  },
  drawObj(o, sx, sy) {
    let kind = o.kind;
    if (o.chest && S.chests[o.chest]) kind = 'chestOpen';
    const s = objSprite(kind), x = Math.round(o.x - s.width / 2 - sx), y = Math.round(o.y - s.height - sy);
    if (x < -s.width || x > W || y < -s.height || y > H) return;
    g.drawImage(s, x, y);
    if (o.kind === 'fire') {
      for (let i = 0; i < 3; i++) { const h = 6 + Math.sin(this.t * (8 + i) + i * 2) * 2.5; g.fillStyle = ['#ff7030', '#ffb040', '#fff0a0'][i]; g.fillRect(x + 8 - (2 - i) * 2, y + 8 - h + i * 2, 5 - i, h - i); }
    }
    if (o.statue) g.drawImage(orderGlyph(o.statue, 12, ORDER(o.statue).color), x + 5, y + 28);
  },
  palOf(n) { return typeof n.pal === 'string' ? NPC_PALS[n.pal] : n.pal; },
  drawNpc(n, sx, sy) {
    const pal = this.palOf(n), key = n.comp ? n.id : 'n' + n.id;
    const pose = walkPose(n.dir === 3 ? 2 : n.dir, n.frame || 0, n.moving);
    let s = humanSprite(pal, key, pose);
    if (n.dir === 3) s = flipped(s);
    const w = n.small ? 19 : s.width, h = n.small ? 26 : s.height, x = Math.round(n.x - w / 2 - sx), y = Math.round(n.y - h + 4 - sy);
    if (x < -30 || x > W + 10 || y < -40 || y > H + 10) return;
    this.shadow(n.x - sx, n.y + 4 - sy, 7);
    if (n.ghost) g.globalAlpha = .82;
    g.drawImage(s, x, y, w, h);
    g.globalAlpha = 1;
    if (n.act) { const q = Math.hypot(this.player.x - n.x, this.player.y - n.y); if (q < 26 && !Game.script) this.bubble(n.x - sx, y - 4); }
  },
  shadow(x, y, r) { g.fillStyle = 'rgba(5,4,14,.34)'; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), r, 2.5, 0, 0, 7); g.fill(); },
  bubble(x, y) { const b = Math.round(Math.sin(this.t * 5)); g.fillStyle = '#141022'; g.fillRect(x - 3, y + b - 8, 7, 9); g.fillStyle = '#ffe08a'; g.fillRect(x - 2, y + b - 7, 5, 7); g.fillStyle = '#141022'; g.fillRect(x, y + b - 6, 1, 3); g.fillRect(x, y + b - 2, 1, 1); },
  drawFoe(f, sx, sy) {
    const id = ENEMIES[f.form[0]].art || f.form[0], s = enemySprite(id, f.frame), scale = s.height > 34 ? 34 / s.height : 1, w = s.width * scale, h = s.height * scale;
    const x = Math.round(f.x - w / 2 - sx), y = Math.round(f.y - h + 4 - sy);
    if (x < -60 || x > W + 10 || y < -60 || y > H + 10) return;
    this.shadow(f.x - sx, f.y + 4 - sy, Math.min(12, w * .35));
    g.imageSmoothingEnabled = scale < 1; // Big foes shrink to map size, and shrink cleaner when filtered.
    if (f.face === 1) g.drawImage(flipped(s), x, y, w, h); else g.drawImage(s, x, y, w, h);
    g.imageSmoothingEnabled = false;
    if (f.alert) { g.fillStyle = '#141022'; g.fillRect(x + w / 2 - 2, y - 11, 5, 11); g.fillStyle = '#ff6a50'; g.fillRect(x + w / 2 - 1, y - 10, 3, 6); g.fillRect(x + w / 2 - 1, y - 3, 3, 2); }
    // Fearspren: small violet globs around a stalked target when foes are alert.
    if (f.alert && Math.random() < .08) Particles.add({ x: this.player.x + rand(-10, 10), y: this.player.y - rand(0, 16), vy: 16, life: .5, col: '#9a5ae0', add: false });
  },
  drawComp(h, q, sx, sy) {
    const pal = COMPANIONS[h.id].pal, dir = q.dir === 3 ? 2 : q.dir, f = Math.floor(this.t * 7), lead = this.player.moving;
    let s = humanSprite(pal, h.id, walkPose(dir, f, lead));
    if (q.dir === 3) s = flipped(s);
    this.shadow(q.x - sx, q.y + 4 - sy, 7);
    g.drawImage(s, Math.round(q.x - s.width / 2 - sx), Math.round(q.y - s.height + 4 - sy));
  },
  drawPlayer(sx, sy) {
    const p = this.player, h = S.party[0], o = ORDER(h.order), dir = p.dir === 3 ? 2 : p.dir, hop = this.hop ? this.hop.h : 0;
    let s = humanSprite(heroPal(S), 'h' + h.order + h.look + S.ideal, walkPose(dir, p.frame, p.moving));
    if (p.dir === 3) s = flipped(s);
    this.shadow(p.x - sx, p.y + 4 - sy, 7);
    const x = Math.round(p.x - s.width / 2 - sx), y = Math.round(p.y - s.height + 4 - sy - hop);
    if (S.ideal >= 1) glow(x + s.width / 2, y + 16, 22, o.color, .16);
    g.drawImage(s, x, y);
    if (S.ideal >= 1) {
      const sp = sprenSprite(o, false, Math.floor(this.t * 3) % 2);
      g.drawImage(sp, Math.round(p.x - sx + Math.cos(this.t * 1.6) * 16 - 8), Math.round(p.y - sy - 28 + Math.sin(this.t * 2.3) * 6 - hop));
    }
  },
  ambientNow() {
    if (S.flags.prologue) return '#46567e';
    const m = this.map;
    if (m.id === 'stonereach' && S.flags.hadrinDown) return '#ffe0c0';
    if (m.id === 'stonereach' && S.nodes.chasm) return '#f8c8a0';
    return m.ambient;
  },
  applyLight(sx, sy) {
    Lighting.begin(this.ambientNow());
    const fl = 1 + Math.sin(this.t * 9) * .05, list = [];
    for (const o of this.map.objs) {
      const d = OBJ[o.kind];
      let L = d.light;
      if (!L || !this.visible(o)) continue;
      const x = o.x - sx, y = o.y - sy + (L.dy || 0) - (d.h > 12 && !d.flat ? d.h - 6 : 0);
      if (x < -L.r || x > W + L.r || y < -L.r || y > H + L.r) continue;
      Lighting.add(x, y, L.r * fl, L.col, .9);
      if (!d.flat || o.kind === 'oathgate') list.push([x, y, L]);
    }
    const P = this.player;
    if (S.ideal >= 1) Lighting.add(P.x - sx, P.y - 12 - sy, 62, ORDER(S.party[0].order).color, .85);
    else Lighting.add(P.x - sx, P.y - 12 - sy, 50, '#c0c8e0', .5);
    Lighting.end();
    const lum = hex2(this.ambientNow()).reduce((a, b) => a + b, 0) / 765, gl = lum > .8 ? .16 : .55;
    for (const [x, y, L] of list) glow(x, y, L.r * .28, L.col, gl);
    // Everything on Roshar leans a little golden in the distance: a soft top-down gradient.
    if (this.map.theme === 'crags') { const gr = g.createLinearGradient(0, 0, 0, H * .6); gr.addColorStop(0, 'rgba(255,180,100,.14)'); gr.addColorStop(1, 'rgba(255,180,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    // Soft vignette keeps the eye near the party.
    g.drawImage(vignette(), 0, 0);
  },
  drawHud(sx, sy) {
    if (this.areaT > 0) {
      const a = clamp(this.areaT, 0, 1), w = textW(this.map.name, 2) + 28;
      g.globalAlpha = a;
      panel(W / 2 - w / 2, 18, w, 26, '#c9a860', 'rgba(8,10,24,.8)');
      text(this.map.name, W / 2, 23, '#ffe8b0', { align: 'center', scale: 2 });
      g.globalAlpha = 1;
    }
    const tq = S.quest;
    if (tq && !Game.script) {
      const lines = wrapText(tq, 188), h = lines.length * 10 + 5;
      g.fillStyle = 'rgba(6,8,20,.6)'; g.fillRect(4, 4, 198, h);
      g.fillStyle = '#ffe08a'; g.fillRect(4, 4, 1, h);
      lines.forEach((l, i) => text(l, 9, 6 + i * 10, '#f2ead6'));
    }
    // Objective pointer: a small gold arrow at the screen edge or a beacon on the spot itself.
    const M = S.marker;
    if (M && M[0] === this.map.id && !Game.script) {
      const mx = M[1] * TS + 8 - sx, my = M[2] * TS + 8 - sy, on = mx > 8 && mx < W - 8 && my > 8 && my < H - 8;
      if (on) { const b = Math.round(Math.sin(this.t * 5) * 2); g.fillStyle = '#141022'; g.fillRect(mx - 4, my - 18 + b, 9, 4); g.fillStyle = '#ffe08a'; g.fillRect(mx - 3, my - 17 + b, 7, 1); g.fillRect(mx - 2, my - 16 + b, 5, 1); g.fillRect(mx - 1, my - 15 + b, 3, 1); g.fillRect(mx, my - 14 + b, 1, 1); glow(mx, my - 15 + b, 8, '#ffe08a', .5); }
      else {
        const a = Math.atan2(my - H / 2, mx - W / 2), ex = clamp(W / 2 + Math.cos(a) * 400, 12, W - 12), ey = clamp(H / 2 + Math.sin(a) * 400, 12, H - 12);
        g.save(); g.translate(ex, ey); g.rotate(a); g.fillStyle = '#141022'; g.fillRect(-6, -4, 11, 9); g.fillStyle = '#ffe08a'; for (let i = 0; i < 5; i++) g.fillRect(-4 + i, -3 + i, 2, 7 - i * 2); g.restore();
      }
    } else if (M && !Game.script && M[0] !== this.map.id) {
      text('Exit this area for the world map', 9, 6 + (wrapText(tq || '', 188).length) * 10 + 4, '#a8987a');
    }
    if (this.toastT > 0) {
      const w = textW(this.toastMsg) + 16;
      g.globalAlpha = clamp(this.toastT, 0, 1);
      panel(W / 2 - w / 2, H - 42, w, 16); text(this.toastMsg, W / 2, H - 38, '#ffe8b0', { align: 'center' });
      g.globalAlpha = 1;
    }
    const near = !Game.script && !Game.overlay && this.findInteract();
    if (near) {
      const o = near.o, label = near.t === 'npc' ? 'Talk' : o.chest ? 'Open' : o.lamp ? 'Breathe out Stormlight' : o.act === 'camp' ? 'Camp' : o.act === 'gap' ? 'Use Surge' : o.act === 'mural' ? 'Read' : 'Examine';
      const lab = 'OK: ' + label, w = textW(lab) + 12;
      panel(W - w - 6, H - 22, w, 16); text(lab, W - 12, H - 18, '#ffe8b0', { align: 'right' });
    }
    if (!Game.script && S.party.length) this.drawMiniParty();
  },
  drawMiniParty() {
    S.party.forEach((h, i) => {
      const st = stats(h, S.ideal), x = W - 60, y = 5 + i * 13;
      text(h.name.slice(0, 7), x - 4, y, '#d6d0c0', { align: 'right' });
      bar(x, y + 1, 54, 3, h.hp === undefined ? st.hp : h.hp, st.hp, '#58d078');
      bar(x, y + 6, 54, 2, h.sl === undefined ? st.sl : h.sl, st.sl, h.id === 'hero' ? ORDER(h.order).color : '#7fc8ff');
    });
  }
};
let _vig;
function vignette() {
  if (_vig) return _vig;
  _vig = hiCanvas(W, H); const c = _vig._c, gr = c.createRadialGradient(W / 2, H / 2, H * .46, W / 2, H / 2, W * .66);
  gr.addColorStop(0, 'rgba(6,5,16,0)'); gr.addColorStop(1, 'rgba(6,5,16,.5)'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
  return _vig;
}
const FieldScene = { update() { Field.update(); }, draw() { Field.draw(); } };
