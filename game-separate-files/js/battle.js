'use strict';
// Turn-based battle driven as a coroutine. Party members act in any order each round, then foes.
// Timed presses boost strikes and blocks; foes charging big moves can be interrupted by breaking seals.
const FOE_ATK = 1.25, FOE_ATK_BOSS = 1.45; // Tuned so blocks and Perfect hits decide boss fights.
const Battle = {
  units: [], party: [], foes: [], fx: [], floats: [], ring: null, banner: null, shake: 0, res: 0, motes: 0, infuse: 0, back: 'crags', menu: null, t: 0, flashCol: null, flashA: 0, dim: 0, cutin: null, cue: null, hint: null, stats: null,

  // ---------- setup ----------
  makeParty() {
    this.party = S.party.map((h, i) => {
      const st = stats(h, S.ideal);
      h.hp = clamp(h.hp === undefined ? st.hp : h.hp, 0, st.hp); h.sl = clamp(h.sl === undefined ? st.sl : h.sl, 0, st.sl);
      return { side: 'party', ref: h, name: h.name, idx: i, hp: h.hp, maxhp: st.hp, sl: h.sl, maxsl: st.sl, atk: st.atk, def: st.def, homeX: [128, 92, 136][i], homeY: [176, 200, 224][i], status: [], pose: 'idle', ox: 0, oy: 0, flash: 0, acted: false, ang: 0, showWeapon: false };
    });
  },
  makeFoe(id, slot, total) {
    const d = ENEMIES[id], art = d.art || id, a = ENEMY_ART[art];
    const pos = total === 1 ? [[352, 216]] : total === 2 ? [[318, 186], [392, 224]] : total === 3 ? [[316, 180], [396, 200], [326, 226]] : [[300, 176], [386, 186], [310, 226], [404, 228]];
    let [x, y] = pos[slot % pos.length];
    if (d.boss) { x = 372; y = 224; }
    return { side: 'foe', id, def0: d, name: d.name, art, boss: d.boss, hp: d.hp, maxhp: d.hp, atk: Math.round(d.atk * (d.boss ? FOE_ATK_BOSS : FOE_ATK)), def: d.def, homeX: x, homeY: y, status: [], ox: 0, oy: 0, flash: 0, charging: null, turnCount: 0, summoned: false, w: a.w, h: a.h, frameT: rand(2), scaleY: 1, alpha: 1, bobby: art === 'voidwisp' || art === 'cantor' || art === 'hunter' || art === 'shade' };
  },
  setup(form, o) {
    this.back = o.back; this.fx = []; this.floats = []; this.ring = null; this.banner = null; this.res = o.keepRes ? this.res : 0; this.motes = 0; this.infuse = 0; this.menu = null; this.cutin = null; this.dim = 0; this.cue = null;
    this.stats = { perfect: 0, hits: 0, blocks: 0 };
    this.makeParty();
    this.foes = form.map((id, i) => this.makeFoe(id, i, form.length));
    Particles.clear(); Ribbons.clear();
  },
  alive(list) { return list.filter(u => u.hp > 0); },
  has(u, k) { return u.status.some(s => s.key === k); },
  addStatus(u, key, turns) {
    if (key === 'stun' && u.side === 'party' && u.ref.id === 'hero' && ORDER(u.ref.order).passive.key === 'freedom') return;
    if (key === 'stun' && u.boss && (u.bossStunGuard || 0) > 0) return;
    if (key === 'stun' && u.boss) u.bossStunGuard = 3;
    const s = u.status.find(q => q.key === key);
    if (s) s.turns = Math.max(s.turns, turns); else u.status.push({ key, turns });
    const lab = { burn: 'BURN', stun: 'STUN', atkUp: 'ATK UP', atkDown: 'ATK DOWN', defUp: 'DEF UP', defDown: 'DEF DOWN', blind: 'BLIND', decoy: 'DOUBLE', shield: 'WALL', regen: 'REGEN' }[key];
    if (lab) this.float(u, lab, key.endsWith('Up') || key === 'regen' || key === 'decoy' || key === 'shield' ? '#a8f0c0' : '#ffb080', -14);
  },
  float(u, txt, col, dy = 0, big) { this.floats.push({ x: u.homeX + u.ox + rand(-6, 6), y: u.homeY + u.oy - this.heightOf(u) - 2 + dy, txt, col, t: 0, big }); },
  heightOf(u) { return u.side === 'party' ? 30 : u.h; },
  center(u) { return { x: u.homeX + u.ox, y: u.homeY + u.oy - this.heightOf(u) / 2 }; },
  isHero(u) { return u.side === 'party' && u.ref.id === 'hero'; },
  passive(key) { return S.party[0] && ORDER(S.party[0].order).passive.key === key; },

  addRes(n) {
    if (S.ideal < 3) return;
    const prev = this.res; this.res = clamp(this.res + n * (this.passive('unity') ? 1.5 : 1), 0, 100);
    if (prev < 100 && this.res >= 100) { Sfx.play('oath'); this.showBanner('Resonance full: your Radiance is ready!', ORDER(S.party[0].order).color); }
  },
  showBanner(t, col = '#f2ead6', dur = 1.2) { this.banner = { t: dur, txt: t, col }; },

  // ---------- damage ----------
  mult(u, up, down, a = 1.3, b = .7) { return this.has(u, up) ? a : this.has(u, down) ? b : 1; },
  calcDamage(a, d, pow, type, perfect, infused) {
    let base = a.atk * pow * this.mult(a, 'atkUp', 'atkDown', 1.3, .72);
    const dv = d.def * this.mult(d, 'defUp', 'defDown', 1.45, .6);
    let v = base - dv * .5;
    v = Math.max(base * .18, v);
    if (perfect) v *= 1.4;
    if (infused) v *= 1 + .3 * infused;
    if (d.side === 'foe') {
      if (d.def0.weak && d.def0.weak.includes(type)) v *= 1.4;
      if (d.def0.resist && d.def0.resist.includes(type)) v *= .65;
      if (d.charging && this.passive('verdict')) v *= 1.25;
    }
    return Math.max(1, Math.round(v * rand(.94, 1.06)));
  },
  hurt(u, dmg, col = '#ffffff', big) {
    if (u.side === 'foe' && S.debugPower) dmg *= S.debugPower;
    u.hp = Math.max(0, u.hp - dmg); u.flash = .16;
    this.float(u, String(dmg), col, 0, big);
    const c = this.center(u);
    // Painspren: small crawling hands of orange around the wounded.
    Particles.burst(c.x, c.y, Math.min(14, 5 + dmg / 8), u.side === 'foe' ? ['#ffd070', '#ffffff'] : ['#ff7050', '#ffa060'], { s1: 90 });
    if (u.hp <= 0) this.onDown(u);
  },
  onDown(u) {
    if (u.side === 'foe') { u.charging = null; Sfx.play('hurt'); }
    u.status = []; if (u.side === 'party') { u.pose = 'ko'; this.float(u, 'DOWN', '#ff8070', -12); }
  },
  breakSeal(f, type, infused) {
    if (!f.charging) return;
    const list = f.charging.sigils;
    let s = list.find(q => !q.broken && q.type === type);
    if (!s && infused) s = list.find(q => !q.broken && q.type === 'light');
    if (!s) return;
    s.broken = true; s.bt = 0; Sfx.play('seal');
    const c = this.center(f);
    Particles.burst(c.x, f.homeY - f.h - 10, 16, TYPES[s.type].col, { s1: 110 });
    this.addRes(5); this.motes = Math.min(5, this.motes + 1);
    if (list.every(q => q.broken)) {
      f.charging = null; this.shake = .3; this.showBanner(f.name + ': cast INTERRUPTED!', '#ffe08a');
      this.float(f, 'INTERRUPTED', '#ffe08a', -22, true); this.addStatus(f, 'stun', 1); this.addRes(10);
      Sfx.play('stun'); f.turnCount = 0;
    }
  },
  // Apply one strike. `opts`: perfect, infused, status.
  strike(a, t, pow, type, opts = {}) {
    if (t.hp <= 0) return;
    if (t.side === 'party' && this.has(t, 'shield')) { t.status = t.status.filter(s => s.key !== 'shield'); this.float(t, 'ABSORBED', '#ffe08a'); Sfx.play('block'); return; }
    const d = this.calcDamage(a, t, pow, type, opts.perfect, opts.infused);
    this.stats.hits++;
    this.hurt(t, d, opts.perfect ? '#ffe08a' : t.def0 && t.def0.weak && t.def0.weak.includes(type) ? '#ffc080' : '#ffffff', opts.perfect);
    if (t.side === 'foe' && t.hp > 0) this.breakSeal(t, type, opts.infused);
    if (t.def0 && t.def0.weak && t.def0.weak.includes(type) && !t.weakShown) { t.weakShown = true; this.float(t, 'WEAK', '#ffc080', -10); }
    if (opts.perfect) { this.stats.perfect++; this.motes = Math.min(5, this.motes + 1); this.addRes(8); this.shake = Math.max(this.shake, .1); const c = this.center(t); Particles.burst(c.x, c.y, 10, ['#ffe08a', '#fff4c8'], { s1: 100, l1: .9 }); }
    else this.addRes(2);
    if (opts.status && t.hp > 0 && Math.random() < (opts.status.chance || 1)) this.addStatus(t, opts.status.key, opts.status.turns);
  },

  // ---------- timed input ----------
  // Ring closes on the target; press as it meets the inner circle.
  *timed(x, y, dur, col = '#ffffff', window = .085) {
    const r = { x, y, t: 0, dur, col, result: null };
    this.ring = r;
    let pressedAt = null, burned = false;
    while (r.t < dur + window) {
      r.t += DT;
      if (Input.pressed.ok && pressedAt === null && !burned) {
        if (Math.abs(r.t - dur) <= window) pressedAt = r.t; else burned = true;
      }
      if (pressedAt !== null) break;
      yield;
    }
    this.ring = null;
    const good = pressedAt !== null;
    if (good) { Sfx.play('perfect'); this.fx.push(fxRingFlash(x, y, col)); this.floats.push({ x, y: y - 22, txt: 'PERFECT', col: '#ffe08a', t: 0 }); }
    return good;
  },
  // Enemy impact arrives at `dur`; a press in the last moment blocks it.
  *blockWindow(unit, dur) {
    const win = this.passive('foresight') ? .24 : .16;
    let t = 0, blocked = false, burned = false;
    while (t < dur) {
      t += DT;
      const open = t >= dur - win;
      if (unit.side === 'party') this.cue = open ? { u: unit, t: dur - t } : null;
      if (Input.pressed.ok && !blocked) { if (open && !burned) blocked = true; else if (!open) burned = true; }
      yield;
    }
    this.cue = null;
    return blocked;
  },
  applyFoeHit(f, t, pow, blocked, guardBonus, status) {
    if (t.hp <= 0) return;
    if (this.has(t, 'decoy')) { t.status = t.status.filter(s => s.key !== 'decoy'); this.float(t, 'ILLUSION', '#e8a6ff'); Particles.burst(t.homeX, t.homeY - 16, 16, '#e8a6ff'); return; }
    if (this.isHero(t) && this.passive('mirage') && Math.random() < .15) { this.float(t, 'ILLUSION', '#e8a6ff'); Particles.burst(t.homeX, t.homeY - 16, 12, '#e8a6ff'); return; }
    if (this.has(f, 'blind') && Math.random() < .45) { this.float(t, 'MISS', '#c0c8e0'); return; }
    if (this.has(t, 'shield')) { t.status = t.status.filter(s => s.key !== 'shield'); this.float(t, 'ABSORBED', '#ffe08a'); Sfx.play('block'); return; }
    let d = this.calcDamage(f, t, pow, 'none', false, 0);
    if (blocked) d = Math.round(d * .45);
    if (t.guarding) d = Math.round(d * .6);
    if (this.isHero(t) && this.passive('bulwark')) d = Math.round(d * .8);
    Sfx.play(blocked ? 'block' : 'hurt');
    if (blocked) {
      this.stats.blocks++; this.float(t, 'BLOCK', '#a8e4ff', -12); this.motes = Math.min(5, this.motes + 1); this.addRes(6);
      if (this.passive('guardian')) { this.addRes(2); this.gainSl(this.party[0], 1); }
      Particles.burst(t.homeX + 8, t.homeY - 16, 10, '#a8e4ff', { s1: 90 });
    } else this.shake = Math.max(this.shake, .16);
    this.hurt(t, Math.max(1, d), blocked ? '#a8e4ff' : '#ff9080');
    t.ox = -8;
    if (status && !blocked && t.hp > 0 && Math.random() < (status.chance || 1)) this.addStatus(t, status.key, status.turns);
  },
  gainSl(u, n) { if (u.hp > 0) u.sl = Math.min(u.maxsl, u.sl + n); },

  // ---------- moves ----------
  *moveTo(u, x, y, dur = .22) {
    const ax = u.ox, ay = u.oy, bx = x - u.homeX, by = y - u.homeY;
    yield* tween(dur, k => { u.ox = lerp(ax, bx, k); u.oy = lerp(ay, by, k) - Math.sin(k * Math.PI) * 6; }, easeIO);
    u.oy = by;
  },
  *comeHome(u, dur = .22) { yield* this.moveTo(u, u.homeX, u.homeY, dur); u.ox = 0; u.oy = 0; if (u.hp > 0) u.pose = 'idle'; },
  *swing(u, t, col, type) {
    u.pose = 'strike'; u.showWeapon = true;
    Sfx.play('swing');
    yield* tween(.09, k => { u.ang = lerp(-1.5, .9, k); }, easeOut);
    const c = this.center(t);
    this.fx.push(fxArc(c.x, c.y, col));
    Sfx.play('hit');
  },
  // Melee strike sequence; a Radiant dashes on Stormlight, others run.
  *meleeSeq(u, t, hits, pow, type, opts) {
    const col = this.unitColor(u);
    const offs = t.boss ? 74 : t.w / 2 + 14;
    u.pose = 'ready'; u.showWeapon = true; u.ang = -1.4;
    if (this.isHero(u) && S.ideal >= 1) yield* this.dashTrail(u, t.homeX - offs, t.homeY + 2, col);
    else yield* this.moveTo(u, t.homeX - offs, t.homeY + 2);
    const c = this.center(t);
    for (let i = 0; i < hits; i++) {
      if (t.hp <= 0) break;
      u.pose = 'ready'; u.ang = -1.5;
      const perf = yield* this.timed(c.x, c.y, i === 0 ? .42 : .3, col);
      yield* this.swing(u, t, col, type);
      this.strike(u, t, pow, type, Object.assign({}, opts, { perfect: perf }));
      yield* wait(.09);
    }
    u.showWeapon = false; u.pose = 'ready';
    yield* this.comeHome(u);
  },
  *dashTrail(u, x, y, col) {
    Sfx.play('surge');
    const sx = u.homeX + u.ox, sy = u.homeY + u.oy;
    yield* this.moveTo(u, x, y, .16);
    for (let i = 0; i < 16; i++) { const k = i / 16; Particles.add({ x: lerp(sx, x, k), y: lerp(sy, y, k) - 14 + rand(-9, 9), life: rand(.2, .55), col, add: true, size: 2 }); }
  },
  *boltSeq(u, t, pow, type, opts, col) {
    u.pose = 'cast'; u.showWeapon = false;
    const s = { x: u.homeX + 18, y: u.homeY - 20 }, c = this.center(t), dur = .46;
    Sfx.play('surge');
    const bolt = { x: s.x, y: s.y, done: false, col };
    this.fx.push(fxBolt(bolt));
    const ring = this.timed(c.x, c.y, dur, col);
    let t0 = 0, res;
    while (true) {
      const st = ring.next();
      t0 += DT; const k = Math.min(1, t0 / dur);
      bolt.x = lerp(s.x, c.x, k); bolt.y = lerp(s.y, c.y, k) - Math.sin(k * Math.PI) * 14;
      if (st.done) { res = st.value; break; }
      yield;
    }
    bolt.done = true;
    Sfx.play('hit');
    this.fx.push(fxArc(c.x, c.y, col));
    this.strike(u, t, pow, type, Object.assign({}, opts, { perfect: res }));
    yield* wait(.15);
    u.pose = 'idle';
  },
  *novaSeq(u, pow, type, opts, col, targets) {
    const T = targets || this.alive(this.foes);
    u.pose = 'cast';
    Sfx.play('surge');
    const cx = T.reduce((a, f) => a + f.homeX, 0) / T.length, cy = T.reduce((a, f) => a + f.homeY - f.h / 2, 0) / T.length;
    const perf = yield* this.timed(cx, cy, .5, col);
    this.fx.push(fxNova(cx, cy, col)); this.shake = Math.max(this.shake, .22); Sfx.play('bigfx');
    for (const f of T) { this.strike(u, f, pow, type, Object.assign({}, opts, { perfect: perf })); }
    yield* wait(.3);
    u.pose = 'idle';
  },
  *liftSeq(u, t, pow, type, opts, col) {
    u.pose = 'cast';
    Sfx.play('surge');
    const c = this.center(t), fall = t.boss ? 22 : 70;
    this.fx.push(fxColumn(t.homeX, t.homeY, col));
    yield* tween(.3, k => { t.oy = -fall * k; }, easeOut);
    const perf = yield* this.timed(c.x, c.y, .32, col);
    yield* tween(.1, k => { t.oy = -fall * (1 - k); }, easeIn);
    t.oy = 0; this.shake = .25; Sfx.play('hit');
    Particles.burst(t.homeX, t.homeY - 2, 24, ['#b09a78', '#d0bc98'], { s1: 90, up: -30, grav: 160, add: false });
    this.strike(u, t, pow, type, Object.assign({}, opts, { perfect: perf }));
    yield* wait(.15);
    u.pose = 'idle';
  },
  unitColor(u) {
    if (this.isHero(u) && S.ideal >= 1) return ORDER(u.ref.order).color;
    if (u.ref && u.ref.id === 'torvan') return '#f0d890';
    if (u.ref && u.ref.id === 'issa') return '#9fe8ff';
    return '#ffffff';
  },
  healAmt(u, heal) { return Math.round(heal * (u.atk * 1.6 + 10)); },
  doHeal(t, amt) {
    if (t.hp <= 0 && !t.canRevive) return;
    t.hp = Math.min(t.maxhp, t.hp + amt); if (t.pose === 'ko') t.pose = 'idle';
    this.float(t, '+' + amt, '#8ef0a0');
    Particles.burst(t.homeX, t.homeY - 15, 12, ['#8ef0a0', '#d4ffd4'], { s0: 10, s1: 40, up: -36, l1: 1 });
    // Lifespren drift up from anything healed.
  },
  *basicAttack(u, t) {
    const inf = this.infuse; this.motes -= inf; this.infuse = 0;
    if (inf) Sfx.play('surge');
    const type = u.ref.id === 'hero' ? (S.ideal >= 3 && this.ringType ? 'slash' : 'slash') : COMPANIONS[u.ref.id].attackType;
    const opts = { infused: inf };
    if (this.isHero(u) && this.passive('kindling')) opts.status = { key: 'burn', turns: 2, chance: .3 };
    if (u.ref.id === 'issa') yield* this.boltSeq(u, t, 1, type, opts, '#9fe8ff');
    else yield* this.meleeSeq(u, t, 2, .62, type, opts);
    if (this.isHero(u) || S.flags.ampleLight) this.gainSl(u, 1);
  },
  *useSkill(u, sk, tgt) {
    u.sl -= sk.cost;
    this.showBanner(sk.name, this.unitColor(u), 1);
    const col = this.unitColor(u), opts = { status: sk.status };
    const targets = tgt === 'foes' ? this.alive(this.foes) : tgt === 'allies' ? this.party : [tgt];
    if (sk.target === 'foes' || sk.target === 'foe') {
      if (sk.pow) {
        if (sk.target === 'foes') yield* this.novaSeq(u, sk.pow, sk.type, opts, col);
        else if (sk.fx === 'bolt') yield* this.boltSeq(u, targets[0], sk.pow, sk.type, opts, col);
        else if (sk.fx === 'lift') yield* this.liftSeq(u, targets[0], sk.pow, sk.type, opts, col);
        else yield* this.meleeSeq(u, targets[0], sk.hits || 1, sk.pow, sk.type, opts);
      } else { for (const f of targets) this.addStatus(f, sk.status.key, sk.status.turns); yield* wait(.3); }
    } else {
      u.pose = 'cast'; Sfx.play('heal');
      for (const t of (sk.target === 'self' ? [u] : targets)) {
        if (sk.heal) { t.canRevive = true; this.doHeal(t, this.healAmt(u, sk.heal)); t.canRevive = false; }
        if (sk.status && t.hp > 0) this.addStatus(t, sk.status.key, sk.status.turns);
        this.fx.push(fxAura(t.homeX, t.homeY, col));
      }
      yield* wait(.45);
      u.pose = 'idle';
    }
  },
  *useItem(u, id, tgt) {
    const it = ITEMS[id];
    S.items[id]--; if (S.items[id] <= 0) delete S.items[id];
    this.showBanner(it.name, '#f2ead6', 1); u.pose = 'cast';
    const boost = this.passive('freedom') ? 1.3 : 1;
    if (it.dmg) {
      Sfx.play('bigfx');
      const T = this.alive(this.foes), cx = T.reduce((a, f) => a + f.homeX, 0) / T.length, cy = T.reduce((a, f) => a + f.homeY - f.h / 2, 0) / T.length;
      this.fx.push(fxNova(cx, cy, '#ffb060'));
      for (const f of T) this.hurt(f, Math.round(it.dmg * boost), '#ffc080');
    } else {
      Sfx.play('heal');
      for (const t of (it.target === 'allies' ? this.party : [tgt])) {
        if (it.revive) { if (t.hp <= 0) { t.canRevive = true; this.doHeal(t, Math.round(t.maxhp * it.revive * boost)); t.canRevive = false; } }
        if (t.hp > 0) {
          if (it.heal) this.doHeal(t, Math.round(it.heal * boost));
          if (it.sl) { const n = Math.round(it.sl * boost); this.gainSl(t, n); this.float(t, '+' + n + ' SL', '#a8e4ff', -10); }
        }
      }
    }
    yield* wait(.45); u.pose = 'idle';
  },
  *ultimate(u) {
    const o = ORDER(u.ref.order), ul = o.ult, col = o.color, T = this.alive(this.foes);
    this.res = 0;
    Sfx.play('oath'); yield* tween(.3, k => { this.dim = k * .7; });
    this.cutin = { t: 0, name: ul.name, col, pal: heroPal(S), key: 'hero' + S.ideal };
    yield* wait(.9); this.cutin = null;
    const cx = T.reduce((a, f) => a + f.homeX, 0) / T.length, cy = T.reduce((a, f) => a + f.homeY - f.h / 2, 0) / T.length;
    let hits = 0;
    for (let i = 0; i < 3; i++) { if (yield* this.timed(cx, cy, i ? .36 : .5, col)) hits++; this.fx.push(fxArc(cx, cy, col)); Sfx.play('hit'); }
    this.fx.push(fxNova(cx, cy, col)); this.fx.push(fxColumn(cx, 230, col)); Sfx.play('bigfx'); this.shake = .6;
    this.flashCol = col; this.flashA = .8;
    const pow = ul.pow * (1 + hits * .15);
    for (const f of T) this.strike(u, f, pow, ul.type, { perfect: hits === 3, status: ul.status });
    if (ul.heal) for (const p of this.alive(this.party)) this.doHeal(p, this.healAmt(u, ul.heal));
    if (ul.partyStatus) for (const p of this.alive(this.party)) this.addStatus(p, ul.partyStatus.key, ul.partyStatus.turns);
    if (ul.shield) for (const p of this.alive(this.party)) this.addStatus(p, 'shield', 2);
    if (ul.cleanse) for (const p of this.party) p.status = p.status.filter(s => !['burn', 'stun', 'atkDown', 'defDown', 'blind'].includes(s.key));
    yield* tween(.3, k => { this.dim = (1 - k) * .7; });
    this.dim = 0;
    yield* wait(.3);
  },

  // ---------- foes ----------
  foeTarget() {
    const living = this.alive(this.party);
    if (this.passive('bulwark') && this.party[0].hp > 0 && Math.random() < .55) return this.party[0];
    return pick(living);
  },
  pickMove(f) {
    const ms = f.def0.moves; let tot = 0; for (const m of ms) tot += m.w === undefined ? 1 : m.w;
    let r = rand(tot); for (const m of ms) { r -= m.w === undefined ? 1 : m.w; if (r <= 0) return m; }
    return ms[0];
  },
  *foeTurn(f) {
    if (this.has(f, 'stun')) { this.float(f, 'STUNNED', '#ffe08a'); yield* wait(.35); f.status = f.status.filter(s => s.key !== 'stun'); return; }
    if (f.bossStunGuard) f.bossStunGuard--;
    const d = f.def0;
    if (d.summon && !f.summoned && f.hp < f.maxhp * d.summon.at) { yield* this.summon(f); return; }
    if (f.charging) {
      f.charging.turns--;
      if (f.charging.turns > 0) { this.float(f, 'Charging...', '#ff8070', -10); Sfx.play('charge'); yield* wait(.4); return; }
      const m = f.charging.move, broken = f.charging.sigils.filter(s => s.broken).length, pow = m.pow * (1 - broken * .14);
      f.charging = null; f.turnCount++;
      yield* this.foeExecute(f, Object.assign({}, m, { pow }), true); return;
    }
    if (d.charged && f.turnCount % d.charged.every === d.charged.every - 1) {
      f.turnCount++;
      f.charging = { move: d.charged, turns: d.charged.turns, sigils: d.charged.sigils.map(type => ({ type, broken: false })) };
      this.showBanner(f.name + ' begins ' + d.charged.name + '! Break the seals!', '#ff9080', 1.5);
      Sfx.play('charge');
      if (!S.flags.sealTut) { S.flags.sealTut = 1; yield* Battle.tutorial('Void Seals', 'A foe is charging. Hit it with the attack types shown above its head to break the seals. Break them all to interrupt the cast and stun it. Every seal you break also weakens the blow.'); }
      yield* wait(.6);
      return;
    }
    f.turnCount++;
    yield* this.foeExecute(f, this.pickMove(f), false);
  },
  *foeExecute(f, m, heavy) {
    this.showBanner(m.name, heavy ? '#ff9080' : '#e0e0f0', .9);
    if (m.kind === 'aoe') {
      const T = this.alive(this.party);
      if (!T.length) return;
      f.oy = 0;
      this.fx.push(fxNova(f.homeX - 30, f.homeY - f.h / 2, heavy ? '#ff4a2a' : '#ff9060', true));
      Sfx.play('charge');
      const blocks = yield* this.blockWindow(T[0], heavy ? .85 : .65);
      this.shake = heavy ? .5 : .25;
      this.flashCol = '#ff5040'; this.flashA = heavy ? .5 : .2;
      for (const t of T) this.applyFoeHit(f, t, m.pow, blocks, false, m.status);
      yield* wait(.28);
      for (const t of T) t.ox = 0;
    } else if (m.kind === 'ranged') {
      const t = this.foeTarget(); if (!t) return;
      const s = { x: f.homeX - f.w / 2, y: f.homeY - f.h * .6 }, e = { x: t.homeX + 4, y: t.homeY - 16 }, bolt = { x: s.x, y: s.y, done: false, col: '#ff7050' };
      this.fx.push(fxBolt(bolt));
      const dur = .55, win = this.blockWindow(t, dur);
      let t0 = 0, blocked;
      while (true) {
        const st = win.next(); t0 += DT; const k = Math.min(1, t0 / dur);
        bolt.x = lerp(s.x, e.x, k); bolt.y = lerp(s.y, e.y, k);
        if (st.done) { blocked = st.value; break; }
        yield;
      }
      bolt.done = true;
      this.applyFoeHit(f, t, m.pow, blocked, false, m.status);
      yield* wait(.25); t.ox = 0;
    } else {
      const t = this.foeTarget(); if (!t) return;
      const reach = f.boss ? (f.w * .3) : f.w / 2 + 10;
      yield* this.moveTo(f, t.homeX + 24 + reach, t.homeY, f.boss ? .3 : .24);
      f.scaleY = .92;
      const blocked = yield* this.blockWindow(t, .4);
      f.scaleY = 1; f.ox -= 12; Sfx.play('swing');
      this.fx.push(fxArc(t.homeX + 4, t.homeY - 16, '#ff9060'));
      this.applyFoeHit(f, t, m.pow, blocked, false, m.status);
      yield* wait(.18); t.ox = 0;
      yield* this.moveTo(f, f.homeX, f.homeY, .24); f.ox = 0; f.oy = 0;
    }
  },
  *summon(f) {
    f.summoned = true;
    const d = f.def0.summon;
    this.showBanner(f.name + ' calls for aid!', '#ff9080'); Sfx.play('charge');
    const spots = [[284, 180], [290, 232]];
    for (let i = 0; i < d.n; i++) {
      const n = this.makeFoe(d.id, 0, 1); [n.homeX, n.homeY] = spots[i % 2]; n.alpha = 0; this.foes.push(n);
      yield* tween(.3, k => { n.alpha = k; });
      Particles.burst(n.homeX, n.homeY - n.h / 2, 18, '#ff5a44', { s1: 80 });
    }
    yield* wait(.25);
  },

  // ---------- end of round ----------
  *endRound() {
    for (const u of [...this.party, ...this.foes]) {
      if (u.hp <= 0) continue;
      const burn = u.status.find(s => s.key === 'burn');
      if (burn) { const d = Math.max(3, Math.round(Math.min(u.maxhp * .06, u.boss ? 35 : 60))); this.hurt(u, d, '#ff9050'); }
      if (this.has(u, 'regen')) this.doHeal(u, Math.round(u.maxhp * .08));
      for (const s of u.status) if (s.key !== 'stun') s.turns--;
      u.status = u.status.filter(s => s.turns > 0);
      u.guarding = false;
    }
    yield* wait(.2);
  },
  *startRound() {
    for (const u of this.party) u.acted = u.hp <= 0;
    const hero = this.party[0];
    if (hero.hp > 0 && S.ideal >= 1) {
      this.gainSl(hero, 1 + (this.passive('scholar') ? 1 : 0));
      // Stormlight knits a Radiant's wounds on its own when they are badly hurt.
      if (hero.hp < hero.maxhp * .5 && hero.sl >= 1) { hero.sl -= 1; this.doHeal(hero, Math.round(hero.maxhp * .1)); }
    }
    if (this.passive('remember')) {
      const low = this.alive(this.party).sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0];
      if (low) this.doHeal(low, Math.round(low.maxhp * .06));
    }
    for (const u of this.party) {
      if (u.hp > 0 && this.has(u, 'stun')) { u.acted = true; this.float(u, 'STUNNED', '#ffe08a'); u.status = u.status.filter(s => s.key !== 'stun'); }
    }
  },

  // ---------- command menus ----------
  commands(u) {
    const list = [{ id: 'attack', label: u.ref.id === 'hero' ? 'Strike' : COMPANIONS[u.ref.id].attackName, desc: 'Press OK as the ring closes for a Perfect hit.' }];
    const sks = heroSkills(u.ref, S.ideal);
    if (sks.length) list.push({ id: 'skill', label: u.ref.id === 'hero' ? 'Surges' : (u.ref.id === 'torvan' ? 'Tactics' : 'Fabrials'), desc: 'Spend ' + (u.ref.id === 'hero' ? 'Stormlight' : COMPANIONS[u.ref.id].res) + ' on a special ability.' });
    if (this.isHero(u) && S.ideal >= 3 && this.res >= 100) list.push({ id: 'ult', label: ORDER(u.ref.order).ult.name, desc: ORDER(u.ref.order).ult.desc, hot: true });
    list.push({ id: 'item', label: 'Items', desc: 'Use something from the pack.' });
    list.push({ id: 'guard', label: u.ref.id === 'hero' && S.ideal >= 1 ? 'Breathe In' : 'Guard', desc: 'Take 40% less damage until next round. Recover 25% of your maximum ' + (u.ref.id === 'hero' ? 'Stormlight' : COMPANIONS[u.ref.id].res) + '.' });
    if (!this.noFlee) list.push({ id: 'flee', label: 'Withdraw', desc: 'Break off the fight. Foes stay on the map.' });
    return list;
  },
  // Generic vertical list. Returns the chosen entry or null when cancelled. Left/right callback for switching actors.
  *listMenu(items, o = {}) {
    let i = o.start || 0;
    const m = { items, get i() { return i; }, x: o.x, y: o.y, w: o.w || 120, title: o.title, u: o.u, per: o.per || 6 };
    this.menu = m;
    yield;
    while (true) {
      if (Input.rep.up) { i = (i + items.length - 1) % items.length; Sfx.play('move'); }
      if (Input.rep.down) { i = (i + 1) % items.length; Sfx.play('move'); }
      if (o.onSide) {
        if (Input.pressed.left) { if (o.onSide(-1)) { this.menu = null; return { sw: true }; } }
        if (Input.pressed.right) { if (o.onSide(1)) { this.menu = null; return { sw: true }; } }
      }
      if (Input.pressed.ok) {
        if (items[i].disabled) Sfx.play('denied');
        else { Sfx.play('ok'); this.menu = null; return items[i]; }
      }
      if (Input.pressed.back && o.cancel !== false) { Sfx.play('back'); this.menu = null; return null; }
      yield;
    }
  },
  *selectTarget(kind, allowDead) {
    let list;
    if (kind === 'foe') list = this.alive(this.foes);
    else if (kind === 'ally') list = this.party.filter(p => p.hp > 0 || allowDead);
    else if (kind === 'self') return this.curActor;
    else return kind;
    if (!list.length) return null;
    list = list.slice().sort((a, b) => a.homeY - b.homeY);
    let i = 0;
    if (kind === 'ally' && allowDead) { const lo = list.slice().sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0]; i = list.indexOf(lo); }
    this.tgt = list[i];
    yield;
    while (true) {
      if (Input.rep.up || Input.rep.left) { i = (i + list.length - 1) % list.length; Sfx.play('move'); }
      if (Input.rep.down || Input.rep.right) { i = (i + 1) % list.length; Sfx.play('move'); }
      this.tgt = list[i];
      if (this.allowInfuse && Input.pressed.menu && this.motes > 0) { this.infuse = (this.infuse + 1) % (Math.min(3, this.motes) + 1); Sfx.play('move'); }
      if (Input.pressed.ok) { Sfx.play('ok'); const t = this.tgt; this.tgt = null; return t; }
      if (Input.pressed.back) { Sfx.play('back'); this.tgt = null; this.infuse = 0; return null; }
      yield;
    }
  },
  *playerPhase() {
    let saved = 0;
    while (true) {
      if (this.alive(this.foes).length === 0) return;
      const avail = this.party.filter(p => !p.acted && p.hp > 0);
      if (!avail.length) return;
      let u = avail.includes(this.curActor) ? this.curActor : avail[0];
      this.curActor = u;
      let switched = false;
      const side = dir => { const k = avail.indexOf(u), nu = avail[(k + dir + avail.length) % avail.length]; if (nu !== u) { Sfx.play('move'); this.curActor = nu; switched = true; return true; } return false; };
      const cmds = this.commands(u);
      const cmd = yield* this.listMenu(cmds, { title: u.name, x: 8, y: 86, w: 112, u, onSide: side, cancel: false, start: saved });
      if (cmd.sw) { saved = 0; continue; }
      saved = cmds.indexOf(cmd);
      const done = yield* this.doCommand(u, cmd);
      if (!done) continue;
      saved = 0;
      u.acted = true;
      if (this.fled) return;
      if (this.alive(this.foes).length === 0 || this.alive(this.party).length === 0) return;
      const left = this.party.filter(p => !p.acted && p.hp > 0);
      if (left.length) this.curActor = left[0];
    }
  },
  *doCommand(u, cmd) {
    if (cmd.id === 'attack') {
      this.allowInfuse = u.ref.id === 'hero' || true;
      const t = yield* this.selectTarget('foe');
      this.allowInfuse = false;
      if (!t) return false;
      yield* this.basicAttack(u, t);
      return true;
    }
    if (cmd.id === 'skill') {
      const res = heroSkills(u.ref, S.ideal).map(id => { const s = SKILLS[id]; return { id, label: s.name, right: String(s.cost), desc: s.desc, disabled: s.cost > u.sl, sk: s, type: s.type }; });
      const pick = yield* this.listMenu(res, { title: 'Surges', x: 8, y: 86, w: 158, u });
      if (!pick) return false;
      const target = yield* this.resolveTarget(pick.sk.target, !!pick.sk.heal);
      if (target === null) return false;
      yield* this.useSkill(u, pick.sk, target);
      return true;
    }
    if (cmd.id === 'ult') { yield* this.ultimate(u); return true; }
    if (cmd.id === 'item') {
      const list = Object.keys(S.items).filter(id => ITEMS[id].kind === 'use').map(id => ({ id, label: ITEMS[id].name, right: 'x' + S.items[id], desc: ITEMS[id].desc, it: ITEMS[id] }));
      if (!list.length) { Sfx.play('denied'); this.showBanner('Your pack is empty.', '#c0c8e0'); return false; }
      const pick = yield* this.listMenu(list, { title: 'Items', x: 8, y: 86, w: 158, u });
      if (!pick) return false;
      const target = yield* this.resolveTarget(pick.it.target, !!pick.it.revive);
      if (target === null) return false;
      yield* this.useItem(u, pick.id, target);
      return true;
    }
    if (cmd.id === 'guard') {
      u.guarding = true; u.pose = 'guard';
      this.gainSl(u, Math.ceil(u.maxsl * .25));
      this.float(u, '+' + Math.ceil(u.maxsl * .25), '#a8e4ff');
      Sfx.play('heal');
      this.fx.push(fxAura(u.homeX, u.homeY, this.unitColor(u)));
      yield* wait(.3);
      return true;
    }
    if (cmd.id === 'flee') { this.fled = true; Sfx.play('back'); return true; }
    return false;
  },
  *resolveTarget(kind, allowDead) {
    if (kind === 'foes' || kind === 'allies') return kind;
    const t = yield* this.selectTarget(kind, allowDead);
    return t;
  },
  // A modal in-battle hint shown only once per game.
  *tutorial(title, body) {
    this.hint = { title, body };
    yield* wait(.2);
    while (!Input.pressed.ok) yield;
    Sfx.play('ok');
    this.hint = null;
    yield;
  },

  // ---------- main coroutine ----------
  *run(form, o = {}) {
    const snap = () => JSON.parse(JSON.stringify(S.party.map(h => [h.hp, h.sl])));
    const before = snap(), itemsBefore = JSON.stringify(S.items);
    const prevScene = Game.scene, prevWeather = Weather.kind, prevMusic = Music.cur;
    while (true) {
      this.noFlee = !!o.noFlee;
      this.fled = false;
      this.setup(form, { back: o.back || (Game.mapDef ? THEMES[Game.mapDef.theme].battle : 'crags') });
      if (o.res) this.res = o.res;
      Music.play(o.music || (this.foes.some(f => f.boss) ? 'boss' : 'battle'));
      yield* Game.stormWipe();
      Game.scene = BattleScene;
      Weather.set(this.back === 'everstorm' ? 'everstorm' : this.back === 'shadesmar' ? 'motes' : 'none');
      yield* Game.fadeIn(.25);
      if (o.intro) yield* o.intro();
      if (!S.flags.battleTut) {
        S.flags.battleTut = 1;
        yield* this.tutorial('Timed Strikes', 'When you attack, a ring closes on your target. Press OK as it meets the inner circle for a Perfect hit: more damage, and a Stormlight mote.');
        yield* this.tutorial('Timed Blocks', 'When a shield icon flashes on an ally, press OK to block most of the blow. Press too early and you will miss your chance.');
        yield* this.tutorial('Motes', 'Motes come from Perfect hits and blocks. While choosing a target for a basic attack, press MENU (C) to infuse it with up to 3 motes. Infused strikes hit harder and can break Light seals.');
      }
      let outcome = null, round = 0;
      while (!outcome) {
        round++;
        yield* this.startRound();
        yield* this.playerPhase();
        if (this.fled) { outcome = 'fled'; break; }
        if (!this.alive(this.foes).length) { outcome = 'win'; break; }
        if (!this.alive(this.party).length) { outcome = 'lose'; break; }
        this.curActor = null;
        for (const f of this.foes.slice()) {
          if (f.hp <= 0) continue;
          yield* this.foeTurn(f);
          yield* wait(.1);
          if (!this.alive(this.party).length) break;
          if (o.hook) { const hk = o.hook(this, f); if (hk) yield* hk; }
        }
        if (!this.alive(this.party).length) { outcome = 'lose'; break; }
        yield* this.endRound();
        if (!this.alive(this.foes).length) { outcome = 'win'; break; }
        if (!this.alive(this.party).length) { outcome = 'lose'; break; }
        if (o.scriptEnd && o.scriptEnd(this)) { outcome = 'win'; break; }
      }
      if (outcome === 'lose') {
        const again = yield* this.loseScreen();
        S.party.forEach((h, i) => { h.hp = before[i][0]; h.sl = before[i][1]; });
        if (again === 'retry') {
          S.items = JSON.parse(itemsBefore);
          for (const h of S.party) { const st = stats(h, S.ideal); h.hp = st.hp; h.sl = st.sl; }
          yield* Game.fadeOut(.3);
          continue;
        }
        yield* Game.fadeOut(.4);
        Game.toTitle();
        return 'lose';
      }
      // write HP back
      for (const p of this.party) { p.ref.hp = Math.max(p.hp, 1); p.ref.sl = p.sl; }
      if (outcome === 'win') yield* this.victory(o);
      Music.play(prevMusic);
      yield* Game.fadeOut(.25);
      Game.scene = prevScene; Weather.set(prevWeather);
      Particles.clear();
      yield* Game.fadeIn(.25);
      return outcome;
    }
  },
  *victory(o) {
    this.showBanner('', '#fff', 0);
    Sfx.play('win');
    let xp = 0, gold = 0;
    for (const f of this.foes) { xp += f.def0.xp; gold += f.def0.gold; }
    S.gold += gold;
    // Gloryspren: gold spheres spinning up from the victors.
    for (const p of this.alive(this.party)) { p.pose = 'cast'; Particles.burst(p.homeX, p.homeY - 28, 16, '#ffe08a', { s0: 8, s1: 30, up: -30, l0: .6, l1: 1.2, size: 2 }); }
    const ups = [];
    for (const p of this.party) {
      const h = p.ref;
      h.xp += p.hp > 0 ? xp : Math.round(xp / 2);
      const skillsBefore = heroSkills(h, S.ideal);
      while (h.xp >= xpNeed(h.lvl)) {
        h.xp -= xpNeed(h.lvl); h.lvl++;
        const st = stats(h, S.ideal); h.hp = st.hp; h.sl = st.sl;
        ups.push(h.name + ' reached level ' + h.lvl + '!');
      }
      for (const id of heroSkills(h, S.ideal)) if (!skillsBefore.includes(id)) ups.push(h.name + ' learned ' + SKILLS[id].name + '!');
    }
    // Light mends after a fight, a little for everyone.
    for (const p of this.party) { const st = stats(p.ref, S.ideal); p.ref.hp = Math.min(st.hp, p.ref.hp + Math.round(st.hp * (p.ref.id === 'hero' && S.ideal >= 1 ? .3 : .18))); p.ref.sl = Math.min(st.sl, p.ref.sl + Math.round(st.sl * .25)); }
    const lines = [`${xp} experience   ${gold} marks`, `Perfect hits ${this.stats.perfect}   Blocks ${this.stats.blocks}`, ...ups];
    this.spoils = { lines, t: 0 };
    yield* wait(.4);
    while (!Input.pressed.ok) yield;
    Sfx.play('ok');
    this.spoils = null;
  },
  *loseScreen() {
    Music.play('none');
    this.loseMenu = { i: 0 };
    yield* wait(.5);
    while (true) {
      if (Input.pressed.up || Input.pressed.down) { this.loseMenu.i ^= 1; Sfx.play('move'); }
      if (Input.pressed.ok) { const r = this.loseMenu.i === 0 ? 'retry' : 'title'; this.loseMenu = null; Sfx.play('ok'); return r; }
      yield;
    }
  }
};

// ---------- transient effects: each has update(dt)->alive and draw() ----------
function fxArc(x, y, col) { let t = 0; const flip = Math.random() < .5 ? 1 : -1; return { up() { t += DT; return t < .18; }, draw() { const k = t / .18; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k; g.strokeStyle = col; g.lineWidth = 3 - 2 * k; g.beginPath(); g.arc(x - 8 * flip, y, 12 + 14 * k, -1.1 * flip, 1.1 * flip, flip < 0); g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.arc(x - 8 * flip, y, 11 + 14 * k, -.7 * flip, .7 * flip, flip < 0); g.stroke(); g.restore(); } }; }
function fxRingFlash(x, y, col) { let t = 0; return { up() { t += DT; return t < .22; }, draw() { const k = t / .22; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k; g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 12 + 24 * k, 0, 7); g.stroke(); g.restore(); glow(x, y, 24, col, (1 - k) * .7); } }; }
function fxBolt(b) { return { up() { Particles.add({ x: b.x, y: b.y, life: .28, col: b.col, add: true, size: 2 }); return !b.done; }, draw() { glow(b.x, b.y, 11, b.col, .9); g.fillStyle = '#fff'; g.fillRect(b.x - 1, b.y - 1, 3, 3); } }; }
function fxNova(x, y, col, soft) { let t = 0; if (!soft) Particles.burst(x, y, 40, [col, '#ffffff'], { s0: 40, s1: 200, l1: .8 }); return { up() { t += DT; return t < .55; }, draw() { const k = easeOut(t / .55); g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - t / .55) * .8; g.strokeStyle = col; g.lineWidth = 4 * (1 - k) + 1; g.beginPath(); g.ellipse(x, y, 16 + 120 * k, 9 + 60 * k, 0, 0, 7); g.stroke(); g.restore(); glow(x, y, 40 + 30 * k, col, (1 - t / .55) * .6); } }; }
function fxColumn(x, y, col) { let t = 0; return { up() { t += DT; return t < .6; }, draw() { const k = t / .6; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - k) * .7; g.fillStyle = col; const w = 36 * (1 - k * .6); g.fillRect(x - w / 2, 0, w, y); g.fillStyle = '#ffffff'; g.fillRect(x - w / 5, 0, w / 2.5, y); g.restore(); } }; }
function fxAura(x, y, col) { let t = 0; for (let i = 0; i < 20; i++) Particles.add({ x: x + rand(-13, 13), y: y - rand(0, 12), vy: -rand(20, 60), life: rand(.4, .9), col, add: true, size: Math.random() < .4 ? 2 : 1 }); return { up() { t += DT; return t < .5; }, draw() { glow(x, y - 14, 32, col, (1 - t / .5) * .6); } }; }

// ---------- rendering ----------
const BattleScene = {
  update() {
    const B = Battle;
    B.t += DT;
    B.fx = B.fx.filter(f => f.up());
    for (const f of B.floats) f.t += DT;
    B.floats = B.floats.filter(f => f.t < .9);
    B.shake = Math.max(0, B.shake - DT);
    if (B.flashA > 0) B.flashA = Math.max(0, B.flashA - DT * 2.5);
    if (B.banner) { B.banner.t -= DT; if (B.banner.t <= 0) B.banner = null; }
    if (B.cutin) B.cutin.t += DT;
    for (const u of [...B.party, ...B.foes]) if (u.flash > 0) u.flash -= DT;
    const hero = B.party[0];
    if (hero && hero.hp > 0 && S.ideal >= 1 && hero.sl > 0 && Math.random() < .5) {
      Particles.add({ x: hero.homeX + hero.ox + rand(-8, 8), y: hero.homeY + hero.oy - rand(4, 28), vy: -rand(8, 26), life: rand(.5, 1), col: mix(ORDER(hero.ref.order).color, '#ffffff', .4), add: true });
    }
    // Anticipationspren: red streamers around a foe winding up.
    for (const f of B.foes) if (f.charging && f.hp > 0 && Math.random() < .5) Particles.add({ x: f.homeX + rand(-f.w / 2, f.w / 2), y: f.homeY - rand(0, f.h), vy: -rand(20, 60), life: .5, col: '#ff5a44', add: true });
    if (B.res >= 100 && Math.random() < .4 && hero) Particles.add({ x: hero.homeX + rand(-14, 14), y: hero.homeY - rand(0, 34), vy: -40, life: .5, col: '#ffe08a', add: true, size: 2 });
  },
  draw() {
    const B = Battle, sx = B.shake > 0 ? rand(-1, 1) * B.shake * 14 : 0, sy = B.shake > 0 ? rand(-1, 1) * B.shake * 9 : 0;
    g.save(); g.translate(Math.round(sx), Math.round(sy));
    g.drawImage(backdrop(B.back), 0, 0);
    if (B.back === 'shadesmar') { for (let i = 0; i < 40; i++) { const q = (i * 53 + B.t * 9) % W; g.fillStyle = 'rgba(180,190,240,.4)'; g.fillRect(q, 170 + (i * 37) % 90, 1, 1); } }
    if (B.dim > 0) { g.fillStyle = `rgba(4,6,16,${B.dim})`; g.fillRect(0, 0, W, H); }
    // Sort by depth so a nearer unit overlaps a farther one.
    const list = [...B.party, ...B.foes].sort((a, b) => (a.homeY + a.oy) - (b.homeY + b.oy));
    for (const u of list) this.drawShadow(u);
    for (const u of list) u.side === 'party' ? this.drawHero(u) : this.drawFoe(u);
    for (const f of B.fx) f.draw();
    Particles.draw();
    this.drawRing();
    Weather.draw();
    for (const f of B.floats) {
      const k = f.t / .9, y = f.y - easeOut(k) * 16;
      g.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
      text(f.txt, f.x, y, f.col, { align: 'center', scale: f.big ? 2 : 1 });
      g.globalAlpha = 1;
    }
    g.restore();
    if (B.flashA > 0) { g.fillStyle = rgba(B.flashCol || '#ffffff', B.flashA); g.fillRect(0, 0, W, H); }
    this.drawCue();
    this.drawHud();
    if (B.cutin) this.drawCutin();
    if (B.hint) this.drawHint();
    if (B.spoils) this.drawSpoils();
    if (B.loseMenu) this.drawLose();
  },
  drawShadow(u) {
    if (u.hp <= 0 && u.side === 'foe') return;
    const w = u.side === 'party' ? 11 : Math.min(60, u.w * .42), lift = Math.max(0, -u.oy) / 60;
    g.fillStyle = `rgba(0,0,0,${.32 - lift * .1})`;
    g.beginPath(); g.ellipse(u.homeX + u.ox, u.homeY + (u.side === 'party' ? 0 : u.oy * .1), w, 3.5, 0, 0, 7); g.fill();
  },
  drawHero(u) {
    const B = Battle, id = u.ref.id, pal = id === 'hero' ? heroPal(S) : COMPANIONS[id].pal, key = id === 'hero' ? 'h' + u.ref.order + u.ref.look + S.ideal : id;
    let pose;
    const idleBob = Math.sin(B.t * 3 + u.idx) > 0 ? 0 : 1;
    switch (u.pose) {
      case 'ready': pose = { dir: 2, armRaise: true, lean: 1, armF: 2 }; break;
      case 'strike': pose = { dir: 2, armF: 3, lean: 2, legA: 3, legB: -3 }; break;
      case 'cast': pose = { dir: 2, armsUp: true }; break;
      case 'guard': pose = { dir: 2, kneel: true, armF: 1 }; break;
      case 'ko': pose = { dir: 2, kneel: true }; break;
      default: pose = { dir: 2, bob: idleBob, armF: 0 };
    }
    let spr = humanSprite(pal, key, pose);
    const x = Math.round(u.homeX + u.ox - spr.width / 2), y = Math.round(u.homeY + u.oy - spr.height);
    if (u.pose === 'ko') {
      g.save(); g.imageSmoothingEnabled = true; g.translate(u.homeX, u.homeY - 6); g.rotate(-Math.PI / 2); g.globalAlpha = .9; g.drawImage(spr, -spr.width / 2, -spr.height / 2); g.restore();
    } else {
      // Weapons sit behind the hand when idle, in front during a strike.
      if (u.pose !== 'cast' && u.pose !== 'guard') this.drawWeapon(u, x, y);
      if (u.flash > 0) spr = tintedCopy(spr, '#ffffff', .85);
      if (B.has(u, 'decoy')) { g.globalAlpha = .4; g.drawImage(spr, x - 8, y); g.globalAlpha = 1; }
      if (id === 'hero' && S.ideal >= 1 && u.hp > 0) glow(x + 13, y + 17, 28, ORDER(u.ref.order).color, u.sl > 0 ? .3 : .08);
      g.drawImage(spr, x, y);
      if (B.has(u, 'shield')) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#ffe08a'; g.globalAlpha = .5 + Math.sin(B.t * 6) * .2; g.beginPath(); g.ellipse(x + 13, y + 17, 16, 19, 0, 0, 7); g.stroke(); g.restore(); }
      if (B.curActor === u && B.menu) { const bx = u.homeX + u.ox, by = y - 6 + Math.round(Math.sin(B.t * 6)); g.fillStyle = '#ffe08a'; g.fillRect(bx - 3, by, 7, 1); g.fillRect(bx - 2, by + 1, 5, 1); g.fillRect(bx - 1, by + 2, 3, 1); g.fillRect(bx, by + 3, 1, 1); }
    }
    if (id === 'hero' && S.ideal >= 1 && u.hp > 0) {
      const o = ORDER(u.ref.order), f = Math.floor(B.t * 3) % 2, s = sprenSprite(o, false, f);
      g.drawImage(s, Math.round(u.homeX + u.ox - 22 + Math.sin(B.t * 2) * 3), Math.round(u.homeY + u.oy - 42 + Math.cos(B.t * 3) * 3));
    }
    if (B.tgt === u) this.drawArrow(u);
  },
  drawWeapon(u, x, y) {
    const id = u.ref.id;
    let kind = id === 'torvan' ? 'spear' : id === 'issa' ? 'fabrial' : (S.ideal >= 3 ? 'shard' : 'sword');
    const col = Battle.unitColor(u);
    const spr = weaponSprite(kind, col);
    if (kind === 'fabrial') { g.drawImage(spr, x + 20, y + 15 + Math.round(Math.sin(Battle.t * 4))); if (u.showWeapon) glow(x + 26, y + 21, 12, col, .6); return; }
    g.save(); g.imageSmoothingEnabled = true;
    const ang = u.showWeapon ? u.ang : (kind === 'spear' ? -1.35 : .75);
    g.translate(x + 17, y + 23); g.rotate(ang);
    g.drawImage(spr, kind === 'spear' ? -18 : -4, -Math.floor(spr.height / 2));
    g.restore();
    if (kind === 'shard') { const dx = Math.cos(ang) * 30, dy = Math.sin(ang) * 30; glow(x + 17 + dx, y + 23 + dy, 15, col, .4); }
  },
  drawFoe(u) {
    const B = Battle;
    if (u.hp <= 0) {
      u.deadT = (u.deadT || 0) + DT;
      if (u.deadT > .4) return;
      const s0 = enemySprite(u.art, 0); g.globalAlpha = 1 - u.deadT / .4;
      g.drawImage(tintedCopy(s0, '#ff8070', .6), Math.round(u.homeX + u.ox - s0.width / 2), Math.round(u.homeY + u.oy - s0.height));
      g.globalAlpha = 1;
      return;
    }
    const frame = Math.floor((B.t + u.frameT) * 2.2) % 2;
    let s = enemySprite(u.art, frame);
    const hover = u.bobby ? Math.round(Math.sin(B.t * 2 + u.frameT) * 3) - 4 : 0;
    const x = Math.round(u.homeX + u.ox - s.width / 2), y = Math.round(u.homeY + u.oy - s.height + hover);
    if (u.flash > 0) s = tintedCopy(s, '#ffffff', .85);
    else if (B.has(u, 'burn')) { g.globalAlpha = u.alpha; g.drawImage(s, x, y); g.globalAlpha = 1; s = null; Particles.add({ x: x + rand(s === null ? u.w : 0), y: y + rand(u.h), vy: -40, life: .3, col: '#ff8040', add: true }); }
    if (s) { g.globalAlpha = u.alpha; g.drawImage(s, x, y); g.globalAlpha = 1; }
    if (u.charging) glow(u.homeX, u.homeY - u.h / 2, u.h * .7 + 10, '#ff4a2a', .3 + Math.sin(B.t * 8) * .1);
    // HP sliver under the foe
    const bw = u.boss ? 0 : clamp(u.w, 24, 46);
    if (bw) bar(u.homeX - bw / 2, u.homeY + 4, bw, 2, u.hp, u.maxhp, '#e8583c');
    if (B.tgt === u) { this.drawArrow(u); this.drawTargetInfo(u); }
    if (u.charging) this.drawSeals(u, x, y);
  },
  drawSeals(u, x, y) {
    const list = u.charging.sigils, cx = u.homeX + u.ox, w = list.length * 13, y0 = Math.max(6, y - 16);
    panel(cx - w / 2 - 12, y0 - 2, w + 26, 15, '#a03828', 'rgba(24,6,10,.86)');
    list.forEach((s, i) => {
      const sp = sigilSprite(s.type);
      if (s.broken) { g.globalAlpha = .22; }
      g.drawImage(sp, Math.round(cx - w / 2 + i * 13), y0);
      g.globalAlpha = 1;
    });
    text(String(u.charging.turns), cx + w / 2 + 3, y0 + 2, '#ffb080');
  },
  drawArrow(u) {
    const B = Battle, cx = u.homeX + u.ox, top = u.homeY + u.oy - B.heightOf(u) - 7 + Math.round(Math.sin(B.t * 8) * 1.5);
    const col = '#ffe08a';
    g.fillStyle = '#141022'; g.fillRect(cx - 5, top - 1, 11, 3);
    g.fillStyle = col; g.fillRect(cx - 4, top, 9, 1); g.fillRect(cx - 3, top + 1, 7, 1); g.fillRect(cx - 2, top + 2, 5, 1); g.fillRect(cx - 1, top + 3, 3, 1); g.fillRect(cx, top + 4, 1, 1);
  },
  drawTargetInfo(u) {
    const B = Battle, w = 168, x = W - w - 6;
    panel(x, 6, w, 34);
    text(u.name, x + 6, 10, '#ffe0a0');
    text(`${u.hp}/${u.maxhp}`, x + w - 6, 10, '#f2ead6', { align: 'right' });
    bar(x + 6, 20, w - 12, 3, u.hp, u.maxhp, '#e8583c');
    let ix = x + 6;
    if (u.def0.weak) {
      text('Weak', ix, 27, '#c8b080'); ix += 24;
      for (const t of u.def0.weak) { g.drawImage(sigilSprite(t), ix, 26); ix += 12; }
    }
    if (B.allowInfuse && B.motes > 0) text(`[C] Infuse x${B.infuse}`, x + w - 6, 27, '#a8e4ff', { align: 'right' });
    else if (B.passive('foresight') && u.def0) { text(u.charging ? 'next: ' + u.charging.move.name.slice(0, 16) : 'next: ' + u.def0.moves[0].name.slice(0, 16), x + w - 6, 27, '#7fe8df', { align: 'right' }); }
  },
  drawRing() {
    const r = Battle.ring;
    if (!r) return;
    const k = 1 - clamp(r.t / r.dur, 0, 1), rad = 8 + k * 40;
    g.save();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.arc(r.x, r.y, 8, 0, 7); g.stroke();
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = r.col; g.lineWidth = 2; g.beginPath(); g.arc(r.x, r.y, rad, 0, 7); g.stroke();
    g.restore();
    if (k < .12) glow(r.x, r.y, 16, r.col, .8);
  },
  drawCue() {
    const c = Battle.cue;
    if (!c) return;
    const x = c.u.homeX, y = c.u.homeY - 44;
    g.fillStyle = '#ffffff'; g.fillRect(x - 6, y, 13, 9); g.fillRect(x - 4, y + 9, 9, 3); g.fillRect(x - 2, y + 12, 5, 2);
    g.fillStyle = '#3f8fd8'; g.fillRect(x - 4, y + 2, 9, 6); g.fillRect(x - 2, y + 8, 5, 3);
    glow(x, y + 6, 20, '#a8e4ff', .9);
  },
  drawHud() {
    const B = Battle, y0 = H - 40;
    g.fillStyle = 'rgba(5,7,16,.72)'; g.fillRect(0, y0 - 2, W, 42); g.fillStyle = '#c9a860'; g.fillRect(0, y0 - 2, W, 1);
    const pw = Math.floor((W - 148) / Math.max(1, B.party.length));
    B.party.forEach((u, i) => {
      const x = 4 + i * pw, active = B.curActor === u && !!B.menu;
      if (active) { g.fillStyle = 'rgba(232,200,119,.16)'; g.fillRect(x - 2, y0, pw - 2, 38); }
      const id = u.ref.id, pal = id === 'hero' ? heroPal(S) : COMPANIONS[id].pal, key = id === 'hero' ? 'p' + u.ref.order + u.ref.look + S.ideal : id;
      g.drawImage(portrait(pal, key), 44 / 4, 6, 26, 28, x, y0 + 4, 26, 30);
      if (u.acted && u.hp > 0) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, y0 + 4, 26, 30); }
      text(u.name.slice(0, 11), x + 30, y0 + 2, u.hp <= 0 ? '#ff8070' : active ? '#ffe08a' : '#f2ead6');
      text(u.hp + '', x + pw - 8, y0 + 2, '#f2ead6', { align: 'right' });
      bar(x + 30, y0 + 13, pw - 38, 4, u.hp, u.maxhp, u.hp / u.maxhp < .3 ? '#ff6050' : '#58d078');
      const slCol = id === 'hero' ? ORDER(u.ref.order).color : '#7fc8ff';
      bar(x + 30, y0 + 20, pw - 38, 3, u.sl, u.maxsl, slCol);
      text(u.sl + '', x + 30, y0 + 25, slCol);
      let sx = x + 48;
      for (const s of u.status) { g.fillStyle = { burn: '#ff8040', stun: '#ffe08a', atkUp: '#ff90a0', atkDown: '#804050', defUp: '#80b0ff', defDown: '#505080', blind: '#b0b0c0', decoy: '#e8a6ff', shield: '#ffe08a', regen: '#80f0a0' }[s.key] || '#fff'; g.fillRect(sx, y0 + 28, 5, 5); sx += 7; }
    });
    // Motes and Resonance on the right.
    const mx = W - 142;
    text('MOTES', mx, y0 + 3, '#a8e4ff');
    for (let i = 0; i < 5; i++) {
      const on = i < B.motes, ix = mx + 36 + i * 10;
      g.fillStyle = on ? '#a8e4ff' : '#20263f'; g.fillRect(ix, y0 + 3, 7, 7);
      if (on) { g.fillStyle = '#ffffff'; g.fillRect(ix + 1, y0 + 4, 2, 2); }
    }
    if (S.ideal >= 3) {
      text('RESONANCE', mx, y0 + 16, '#ffe08a');
      bar(mx, y0 + 26, 134, 5, B.res, 100, B.res >= 100 ? '#ffffff' : ORDER(S.party[0].order).color);
    } else text('Swear more Ideals...', mx, y0 + 20, '#6e7ca4');
    // Boss bar along the top
    const boss = B.foes.find(f => f.boss && f.hp > 0);
    if (boss && B.tgt !== boss) {
      panel(58, 4, W - 116, 18, '#a03828');
      text(boss.name, 64, 6, '#ffb080');
      bar(64, 15, W - 128, 4, boss.hp, boss.maxhp, '#e8583c');
    }
    if (B.banner && B.banner.txt) {
      const w = textW(B.banner.txt) + 18, y = boss && B.tgt !== boss ? 26 : 8;
      panel(W / 2 - w / 2, y, w, 15, B.banner.col);
      text(B.banner.txt, W / 2, y + 3, B.banner.col, { align: 'center' });
    }
    if (B.menu) this.drawMenu(B.menu);
    if (B.tgt && B.tgt.side === 'party') {
      const t = B.tgt;
      panel(8, 8, 150, 16); text(`${t.name}  ${t.hp}/${t.maxhp}`, 14, 12);
    }
    if (B.ring && !S.flags.ringKnown) text('Press OK as the ring closes!', W / 2, 44, '#ffe08a', { align: 'center' });
    if (B.cue && !S.flags.blockKnown) text('Press OK to BLOCK!', W / 2, 44, '#a8e4ff', { align: 'center' });
  },
  drawMenu(m) {
    const per = m.per, top = Math.max(0, Math.min(m.i - per + 1, m.items.length - per)), n = Math.min(per, m.items.length), h = n * 13 + 18, y = m.y;
    const x = m.x;
    panel(x, y, m.w, h);
    text(m.title, x + 6, y + 4, '#ffe08a');
    if (m.u && m.u.idx !== undefined && Battle.party.filter(p => !p.acted && p.hp > 0).length > 1 && m.title === m.u.name) text('< >', x + m.w - 6, y + 4, '#8a7038', { align: 'right' });
    for (let k = 0; k < n; k++) {
      const it = m.items[top + k], ry = y + 15 + k * 13, sel = top + k === m.i;
      if (sel) { g.fillStyle = 'rgba(232,200,119,.2)'; g.fillRect(x + 3, ry - 1, m.w - 6, 12); g.fillStyle = '#ffe08a'; g.fillRect(x + 4, ry + 3, 3, 3); }
      text(it.label, x + 11, ry + 1, it.disabled ? '#6a6a78' : it.hot ? '#ffe08a' : sel ? '#ffffff' : '#d6d0c0');
      if (it.right) text(it.right, x + m.w - 7, ry + 1, it.disabled ? '#6a6a78' : '#a8e4ff', { align: 'right' });
      if (it.type && TYPES[it.type]) g.drawImage(sigilSprite(it.type), x + m.w - 32, ry - 1);
    }
    const cur = m.items[m.i];
    if (cur && cur.desc) {
      const lines = wrapText(cur.desc, 214);
      panel(x, y - 6 - lines.length * 10 - 6, 226, lines.length * 10 + 8);
      lines.forEach((l, i) => text(l, x + 6, y - 6 - lines.length * 10 - 2 + i * 10, '#d6d0c0'));
    }
  },
  drawCutin() {
    const c = Battle.cutin, k = clamp(c.t / .2, 0, 1), out = clamp((c.t - .72) / .18, 0, 1), y = 96;
    g.fillStyle = rgba(c.col, .25); g.fillRect(0, y, W, 74);
    g.fillStyle = rgba(c.col, .9); g.fillRect(0, y, W, 1); g.fillRect(0, y + 73, W, 1);
    const x = lerp(-90, 60, easeOut(k)) + out * 500;
    g.drawImage(portrait(c.pal, c.key), x, y + 3, 67, 67);
    text(c.name.toUpperCase(), lerp(W + 20, 148, easeOut(k)) - out * 500, y + 26, '#ffffff', { scale: 2 });
  },
  drawHint() {
    const h = Battle.hint, lines = wrapText(h.body, 318), bh = lines.length * 10 + 34, y = 70;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, W, H);
    panel(72, y, 336, bh);
    text(h.title, 82, y + 7, '#ffe08a');
    lines.forEach((l, i) => text(l, 82, y + 20 + i * 10));
    text('OK', 398, y + bh - 12, '#a8e4ff', { align: 'right' });
  },
  drawSpoils() {
    const s = Battle.spoils, h = s.lines.length * 11 + 30;
    panel(130, 44, 220, h, '#ffe08a');
    text('VICTORY', 240, 50, '#ffe08a', { align: 'center' });
    s.lines.forEach((l, i) => text(l, 240, 66 + i * 11, i < 2 ? '#f2ead6' : '#a8f0c0', { align: 'center' }));
  },
  drawLose() {
    g.fillStyle = 'rgba(6,4,10,.76)'; g.fillRect(0, 0, W, H);
    text('The Light fades...', W / 2, 74, '#ff9080', { align: 'center', scale: 2 });
    text('"Journey before destination."', W / 2, 100, '#c8c0b0', { align: 'center' });
    const m = Battle.loseMenu;
    ['Try this battle again', 'Return to title'].forEach((t, i) => text((m.i === i ? '> ' : '  ') + t, W / 2, 128 + i * 14, m.i === i ? '#ffe08a' : '#b0a890', { align: 'center' }));
  }
};
