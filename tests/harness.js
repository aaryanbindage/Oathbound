'use strict';
// Test harness injected only by `electron . --bot` and `--shots=` in development. It plays the game through real inputs.
const Harness = {
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
  async shot(name) { Game.render(); await this.sleep(30); await window.desktop.shot(name); },
  tap(a) { Input.latch[a] = true; },
  ticks(n) { for (let i = 0; i < n; i++) Game.tick(); },
  async run(scenario) {
    Game.paused = true;
    await this.sleep(50);
    Sfx.muted = true;
    if (scenario === 'bot') return this.fullBot('windrunner');
    if (scenario.startsWith('bot:')) { const q = scenario.split(':'); return this.fullBot(q[1], q[2] ? +q[2] : undefined); }
    if (scenario === 'ui') return this.uiTest();
    if (scenario.startsWith('saves-')) return this.savesStep(scenario.slice(6));
    if (scenario === 'gallery') return this.gallery();
    return { ok: false, err: 'unknown scenario' };
  },
  // ---------- static checks ----------
  checkMaps() {
    const problems = [];
    for (const id of Object.keys(MAP_BUILD)) {
      const m = getMap(id);
      const savedFlags = S ? S.flags : null;
      if (!S) Game.newGame('T', 'windrunner', 0);
      // With gates open, every interactable must be reachable from spawn (gaps count as links).
      Object.assign(S.flags, { chasmGate: 1, vaultDoor: 1, hadrinDown: 1, cantorDown: 1, finalDown: 1 });
      Field.map = m; Field.npcs = [];
      const reach = new Set(), key = (x, y) => x + y * 1000, q = [];
      const start = m.spawn;
      q.push(start); reach.add(key(...start));
      const links = {}; for (const o of m.objs) if (o.act === 'gap') links[key(Math.floor(o.x / TS), Math.floor((o.y - 1) / TS))] = [Math.floor(o.tx / TS), Math.floor(o.ty / TS)];
      while (q.length) {
        const [x, y] = q.pop();
        const k = key(x, y);
        const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        if (links[k]) nb.push(links[k]);
        for (const [a, b] of nb) {
          if (a < 0 || b < 0 || a >= m.w || b >= m.h || reach.has(key(a, b))) continue;
          if (Field.blocked(a * TS + 8, b * TS + 8)) continue;
          reach.add(key(a, b)); q.push([a, b]);
        }
      }
      const near = (px, py) => { const cx = Math.floor(px / TS), cy = Math.floor(py / TS); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (reach.has(key(cx + i, cy + j))) return true; return false; };
      for (const o of m.objs) if ((o.chest || o.act || o.lamp) && !near(o.x, o.y - 1)) problems.push(`${id}: unreachable ${o.kind} at ${Math.floor(o.x / TS)},${Math.floor(o.y / TS)}`);
      for (const n of m.npcs) if (n.act && !near(n.x, n.y)) problems.push(`${id}: unreachable npc ${n.id}`);
      for (const f of m.foes) if (!near(f.x, f.y)) problems.push(`${id}: unreachable foe ${f.id}`);
      for (const t of m.trigs) if (!Story[t.fn]) problems.push(`${id}: missing script ${t.fn}`);
      for (const n of m.npcs) if (n.act && !Story[n.act]) problems.push(`${id}: missing script ${n.act}`);
      for (const o of m.objs) if (o.act && o.act !== 'gap' && !Story[o.act]) problems.push(`${id}: missing script ${o.act}`);
      for (const t of m.trigs) { let ok = false; for (let j = 0; j < t.h; j++) for (let i = 0; i < t.w; i++) if (reach.has(key(t.x + i, t.y + j))) ok = true; if (!ok) problems.push(`${id}: unreachable trigger ${t.fn}`); }
      if (savedFlags) S.flags = savedFlags;
    }
    return problems;
  },
  // ---------- bot ----------
  bfs(tx, ty) {
    const m = Field.map, p = Field.player, sx = Math.floor(p.x / TS), sy = Math.floor(p.y / TS), key = (x, y) => x + y * 1000;
    const prev = new Map([[key(sx, sy), null]]), q = [[sx, sy]];
    let found = null;
    let head = 0;
    const links = {}; for (const o of m.objs) if (o.act === 'gap') links[key(Math.floor(o.x / TS), Math.floor((o.y - 1) / TS))] = [Math.floor(o.tx / TS), Math.floor(o.ty / TS), o];
    // Stepping on the wrong floor plate resets the puzzle, so route around every plate but the goal.
    const avoid = new Set();
    if (m.id === 'vault' && !S.flags.vaultDoor) for (const o of m.objs) if (o.plate !== undefined) for (let j = -1; j <= 0; j++) for (let i = -1; i <= 1; i++) { const ax = Math.floor(o.x / TS) + i, ay = Math.floor((o.y - 8) / TS) + j; if (!(Math.abs(ax - tx) <= 1 && Math.abs(ay - ty) <= 1)) avoid.add(key(ax, ay)); }
    while (head < q.length) {
      const [x, y] = q[head++];
      if (Math.abs(x - tx) + Math.abs(y - ty) <= 1) { found = [x, y]; break; }
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      const lk = links[key(x, y)]; if (lk) nb.push([lk[0], lk[1]]);
      for (const [a, b] of nb) {
        if (a < 0 || b < 0 || a >= m.w || b >= m.h || prev.has(key(a, b)) || avoid.has(key(a, b))) continue;
        if (!(lk && a === lk[0] && b === lk[1]) && (Field.blocked(a * TS + 8, b * TS + 8) || Field.blocked((a + x) * 8 + 8, (b + y) * 8 + 8))) continue;
        prev.set(key(a, b), [x, y]); q.push([a, b]);
      }
    }
    if (!found) return null;
    const path = []; let c = found;
    while (c) { path.unshift(c); c = prev.get(key(c[0], c[1])); }
    return path;
  },
  walkToward(tx, ty) {
    const path = this.bfs(tx, ty), p = Field.player;
    Input.held = {};
    if (!path) return 'nopath';
    if (path.length < 2) { const dx = tx * TS + 8 - p.x, dy = ty * TS + 8 - p.y; p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1); return 'there'; }
    const [nx, ny] = path[1];
    const gapHere = Field.map.objs.find(o => o.act === 'gap' && Math.floor(o.tx / TS) === nx && Math.floor(o.ty / TS) === ny && Math.hypot(o.x - p.x, o.y - p.y) < 22);
    if (gapHere) { this.tap('ok'); return 'gap'; }
    const gx = nx * TS + 8, gy = ny * TS + 8, cx = path[0][0] * TS + 8, cy = path[0][1] * TS + 8;
    const horiz = ny === path[0][1];
    if (horiz && Math.abs(p.y - cy) > 3) { if (p.y < cy) Input.held.down = true; else Input.held.up = true; return 'moving'; }
    if (!horiz && Math.abs(p.x - cx) > 3) { if (p.x < cx) Input.held.right = true; else Input.held.left = true; return 'moving'; }
    if (gx > p.x + 2) Input.held.right = true; if (gx < p.x - 2) Input.held.left = true;
    if (gy > p.y + 2) Input.held.down = true; if (gy < p.y - 2) Input.held.up = true;
    return 'moving';
  },
  // Pick a menu entry with real up/down presses, as a player would.
  chooseIndex(m, idx) {
    if (m.i === idx) { this.tap('ok'); return; }
    this.tap('down');
  },
  botBattleInput() {
    const B = Battle, r = B.ring;
    if (B.hint || B.spoils || B.loseMenu) { if (Math.random() < .1) this.tap('ok'); return; }
    if (r && r.t >= r.dur - .03 && r.t <= r.dur + .03 && !r.dec) { r.dec = true; if (Math.random() < this.skill) this.tap('ok'); return; }
    if (B.cue && !B.cue.dec) { B.cue.dec = true; if (Math.random() < this.skill) this.tap('ok'); return; }
    if (B.tgt) { if (Math.random() < .2) this.tap('ok'); return; }
    if (!B.menu || !B.menu.items) return;
    if (Math.random() > .3) return;
    const m = B.menu, u = B.curActor;
    if (m.items.some(i => i.id === 'attack')) {
      const pal = B.party.filter(p => p.hp > 0), low = B.party.filter(p => p.hp < p.maxhp * .4);
      const sks = heroSkills(u.ref, S.ideal).map(q => SKILLS[q]);
      let want = 'attack';
      if (m.items.some(i => i.id === 'ult')) want = 'ult';
      else if (low.length && sks.some(s => s.heal && s.cost <= u.sl)) want = 'skill';
      else if (low.length && Object.keys(S.items).some(id => ITEMS[id].heal && ITEMS[id].kind === 'use')) want = 'item';
      else if (u.sl < 3 && sks.length && Math.random() < .5) want = 'guard';
      else if (sks.some(s => s.pow && s.cost <= u.sl) && Math.random() < .6) want = 'skill';
      this.chooseIndex(m, m.items.findIndex(i => i.id === want));
      this.want = want;
    } else {
      let idx = 0;
      if (this.want === 'skill') {
        const low = B.party.filter(p => p.hp < p.maxhp * .4);
        const opts = m.items.map((it, i) => ({ it, i })).filter(q => !q.it.disabled);
        const heal = opts.find(q => q.it.sk && q.it.sk.heal && low.length), dmg = opts.filter(q => q.it.sk && q.it.sk.pow);
        idx = heal ? heal.i : dmg.length ? dmg[dmg.length - 1].i : opts.length ? opts[0].i : -1;
      } else if (this.want === 'item') {
        idx = m.items.findIndex(i => i.it && i.it.heal); if (idx < 0) idx = -1;
      }
      if (idx < 0) { this.tap('back'); return; }
      this.chooseIndex(m, idx);
    }
  },
  equipBest() {
    for (const h of S.party) for (const slot of ['weapon', 'armor', 'charm']) {
      let best = h.equip[slot], score = id => { if (!id) return -1; const q = ITEMS[id]; return (q.atk || 0) * 2 + (q.def || 0) * 2 + (q.hp || 0) * .3 + (q.sl || 0); };
      for (const id of Object.keys(S.items)) { const q = ITEMS[id]; if (q.kind === 'gear' && q.slot === slot && (!q.who || q.who === h.id) && score(id) > score(best)) best = id; }
      if (best !== h.equip[slot]) { if (h.equip[slot]) give(h.equip[slot]); S.items[best]--; if (S.items[best] <= 0) delete S.items[best]; h.equip[slot] = best; }
    }
  },
  // Stocks up as a reasonable player would at each merchant call.
  botTarget() {
    const m = Field.map, flags = S.flags;
    if (flags.prologue) return S.marker && S.marker[0] === m.id ? { x: S.marker[1], y: S.marker[2], kind: 'marker' } : null;
    if (m.id === 'vault' && flags.muralRead && !flags.vaultDoor) {
      const want = Story.puzzleOrder()[S.plateN || 0], L = Story.plateLayout().findIndex(o => o.id === want.id), pl = m.objs.find(o => o.plate === L);
      return { x: Math.floor(pl.x / TS), y: Math.floor((pl.y - 8) / TS), kind: 'plate' };
    }
    // Clear reachable foes first, as a thorough player would, and open chests.
    const foes = Field.foes.filter(f => Field.visible(f)).map(f => ({ x: Math.floor(f.x / TS), y: Math.floor(f.y / TS), kind: 'foe' }));
    const chests = m.objs.filter(o => o.chest && !S.chests[o.chest]).map(o => ({ x: Math.floor(o.x / TS), y: Math.floor((o.y - 1) / TS), kind: 'chest' }));
    const p = Field.player;
    const dist = a => Math.abs(a.x - p.x / TS) + Math.abs(a.y - p.y / TS);
    for (const list of [foes, chests]) {
      const r = list.filter(q => this.bfs(q.x, q.y)).sort((a, b) => dist(a) - dist(b));
      if (r.length) return r[0];
    }
    if (S.marker && S.marker[0] === m.id) return { x: S.marker[1], y: S.marker[2], kind: 'marker' };
    return null;
  },
  async fullBot(order, skill = .55) {
    this.skill = skill;
    const realPut = Saves.put.bind(Saves), saveMs = []; Saves.put = (id, rec, soon) => { const t0 = performance.now(), r = realPut(id, rec, soon); saveMs.push(performance.now() - t0); return r; };
    const report = { order, battles: [], losses: 0, problems: this.checkMaps(), finished: false, level: 0, ticks: 0, log: [] };
    if (report.problems.length) console.log('MAP PROBLEMS ' + JSON.stringify(report.problems));
    Game.newGame('Botley', order, 0);
    Game.run(Story.newGame());
    const origRun = Battle.run.bind(Battle);
    const bossLog = [];
    Battle.run = function* (form, o) {
      const before = Harness.tickCount;
      const name = form.join('+');
      const inner = origRun(form, o);
      let r;
      while (true) { const st = inner.next(); if (st.done) { r = st.value; break; } yield; }
      bossLog.push({ name, ticks: Harness.tickCount - before, r, lvl: S.party[0].lvl, ideal: S.ideal });
      return r;
    };
    this.tickCount = 0;
    const origLose = Battle.loseScreen.bind(Battle);
    Battle.loseScreen = function* () { report.losses++; report.log.push('LOSS vs ' + Battle.foes.map(f => f.id).join('+') + ' lvl ' + S.party[0].lvl); return yield* origLose(); };
    let lastBatch = Date.now(), lastKey = '', stuck = 0, shots = {}, equipT = 0;
    const MAX = 60 * 60 * 200;
    while (this.tickCount < MAX && !Game.ended) {
      for (let b = 0; b < 240 && !Game.ended; b++) {
        this.tickCount++;
        this.botInput();
        Game.tick();
        if (!S) break;
      }
      equipT++; if (S && equipT % 8 === 0) { this.equipBest(); this.botShop(); }
      const key = S ? `${S.map}:${Game.scene === FieldScene ? Math.round(Field.player.x / 32) + ',' + Math.round(Field.player.y / 32) : 'x'}:${S.quest}:${Battle.foes.map(f => f.hp).join()}:${Dialog.cur ? Dialog.cur.full : ''}:${Game.scene === WorldScene}` : 'none';
      if (key === lastKey) stuck++; else stuck = 0;
      lastKey = key;
      // Oscillation guard: no quest or battle progress for ten game minutes means the bot is lost.
      const prog = S ? S.quest + '|' + bossLog.length + '|' + (S.plateN || 0) + '|' + Object.keys(S.chests).length : '';
      if (prog !== this.lastProg) { this.lastProg = prog; this.progT = this.tickCount; }
      if (this.tickCount - this.progT > 36000) {
        const t = Game.scene === FieldScene ? this.botTarget() : null;
        report.log.push(`NO PROGRESS map=${S.map} tile=${Math.floor(Field.player.x / TS)},${Math.floor(Field.player.y / TS)} quest=${S.quest} marker=${S.marker} target=${JSON.stringify(t)} scene=${this.sceneName()} script=${!!Game.script} dlg=${Dialog.cur ? Dialog.cur.full : ''} walk=${t ? this.walkToward(t.x, t.y) : ''} near=${Field.findInteract() ? 'yes' : 'no'} BATTLE party=${Battle.party.map(p => p.hp + '/' + p.maxhp + ' sl' + p.sl + (p.acted ? ' acted' : '')).join(', ')} foes=${Battle.foes.map(f => f.id + ' ' + f.hp + '/' + f.maxhp + (f.charging ? ' chg' + f.charging.turns : '')).join(', ')} menu=${Battle.menu ? Battle.menu.title + ':' + Battle.menu.i + '/' + Battle.menu.items.map(q => q.id + (q.disabled ? '!' : '')).join(',') : 'none'} tgt=${Battle.tgt ? Battle.tgt.name : ''} ring=${!!Battle.ring} hint=${!!Battle.hint} spoils=${!!Battle.spoils} lose=${!!Battle.loseMenu} want=${this.want} actor=${Battle.curActor ? Battle.curActor.name : ''} wipe=${Game.wipe} fade=${Game.fade} items=${JSON.stringify(S.items)}`);
        break;
      }
      if (stuck > 60) {
        const t = Game.scene === FieldScene ? this.botTarget() : null; const w = t ? this.walkToward(t.x, t.y) : ''; report.log.push(`STUCK at ${key} scene=${this.sceneName()} script=${!!Game.script} pos=${Field.player.x.toFixed(1)},${Field.player.y.toFixed(1)} target=${JSON.stringify(t)} walk=${w} plateN=${S.plateN} onPlate=${Field.onPlate} held=${JSON.stringify(Input.held)} path=${t ? JSON.stringify((this.bfs(t.x, t.y) || []).slice(0, 4)) : ''}`);
        break;
      }
      if (this.tickCount % 4800 < 240) await this.sleep(0);
      for (const n of Object.keys(this.shotPoints())) if (!shots[n] && this.shotPoints()[n]()) { shots[n] = 1; await this.shot(`${order}-${n}`); }
    }
    report.finished = !!Game.ended;
    report.level = S && S.party[0].lvl; report.ticks = this.tickCount; report.minutes = Math.round(this.tickCount / 3600);
    report.battles = bossLog.filter(b => ENEMIES[b.name.split('+')[0]].boss || b.r === 'lose');
    report.fights = bossLog.length;
    report.saves = { count: saveMs.length, avgMs: +(saveMs.reduce((a, b) => a + b, 0) / Math.max(1, saveMs.length)).toFixed(1), maxMs: +Math.max(0, ...saveMs).toFixed(1) };
    report.ok = report.finished && !report.problems.length;
    await this.shot(`${order}-end`);
    Battle.run = origRun;
    return report;
  },
  shotPoints() {
    return {
      field: () => Game.scene === FieldScene && S.party.length === 3,
      storm: () => Game.scene === FieldScene && S.flags.prologue,
      oath: () => Game.scene === OathScene,
      battle: () => Game.scene === BattleScene && Battle.menu,
      boss: () => Game.scene === BattleScene && Battle.foes.some(f => f.id === 'chasmfiend') && Battle.foes[0].hp < Battle.foes[0].maxhp,
      seal: () => Game.scene === BattleScene && Battle.foes.some(f => f.charging),
      vault: () => Game.scene === FieldScene && Field.map.id === 'vault',
      shadesmar: () => Game.scene === FieldScene && Field.map.id === 'shadesmar',
      thunder: () => Game.scene === BattleScene && Battle.foes.some(f => f.id === 'thunderclast'),
      dais: () => Game.scene === FieldScene && Field.map.id === 'dais',
      ending: () => Game.scene === CineScene && CineScene.back === 'urithiru'
    };
  },
  sceneName() { const all = { TitleScene, CreateScene, FieldScene, BattleScene, WorldScene, MenuScene, SaveScene, ShopScene, CineScene, VoidScene, OathScene, EndScene }; for (const n in all) if (Game.scene === all[n]) return n; return '?'; },
  botShop() {
    const tier = S.flags.cantorDown ? 3 : S.flags.fiendSeen ? 2 : S.flags.hadrinDown ? 2 : 1;
    for (const id of SHOP_STOCK[tier]) {
      const q = ITEMS[id];
      if (q.kind === 'use' && (S.items[id] || 0) < 3 && (q.heal || q.sl) && S.gold > q.price * 2) { S.gold -= q.price; give(id); }
    }
    for (const id of SHOP_STOCK[tier]) {
      const q = ITEMS[id];
      if (q.kind !== 'gear') continue;
      const owner = q.who ? S.party.find(h => h.id === q.who) : S.party[0];
      if (!owner) continue;
      const cur = owner.equip[q.slot], sc = x => x ? ((ITEMS[x].atk || 0) + (ITEMS[x].def || 0)) : 0;
      if (sc(id) > sc(cur) && S.gold >= q.price && !S.items[id]) { S.gold -= q.price; give(id); }
    }
  },
  botInput() {
    Input.held = {};
    const sc = Game.scene;
    if (sc === BattleScene) { if (Game.fade > .5) return; this.botBattleInput(); return; }
    if (sc === WorldScene) {
      if (Game.script) return;
      const want = S.marker ? WORLD_NODES.find(n => n.map === S.marker[0]) : null, list = WorldScene.nodes(), i = list.indexOf(want);
      if (i >= 0 && WorldScene.i !== i) { if (Math.random() < .2) this.tap('right'); return; }
      if (Math.random() < .2) this.tap('ok');
      return;
    }
    if (Dialog.choiceBox) { if (Math.random() < .3) this.tap('ok'); return; }
    if (Dialog.cur) { if (Math.random() < .3) this.tap('ok'); return; }
    if (sc === CineScene || sc === OathScene || sc === EndScene) { if (Math.random() < .1) this.tap('ok'); return; }
    if (sc === VoidScene) return;
    if (Game.script) { return; }
    if (sc === FieldScene) {
      const t = this.botTarget();
      if (!t) {
        if (S.marker && S.marker[0] !== Field.map.id) {
          // Walk to the nearest world-map exit.
          const ex = Field.map.trigs.find(q => q.fn === 'toWorld' || q.fn === 'cragsExit' || q.fn === 'chasmExit');
          if (ex) this.walkToward(ex.x + (ex.w >> 1), ex.y + (ex.h >> 1));
        }
        return;
      }
      const res = this.walkToward(t.x, t.y);
      if (res === 'there' && (t.kind !== 'foe' && t.kind !== 'plate')) { if (Math.random() < .2) this.tap('ok'); }
      if (res === 'there' && t.kind === 'marker' && Field.findInteract() === null) {
        // Marker on an open tile: step onto it so triggers fire.
        const p = Field.player, gx = t.x * TS + 8, gy = t.y * TS + 8;
        if (gx > p.x + 2) Input.held.right = true; if (gx < p.x - 2) Input.held.left = true;
        if (gy > p.y + 2) Input.held.down = true; if (gy < p.y - 2) Input.held.up = true;
      }
      if (t.kind === 'plate' && res === 'there') { const p = Field.player, gx = t.x * TS + 8, gy = t.y * TS + 8; if (gx > p.x + 2) Input.held.right = true; if (gx < p.x - 2) Input.held.left = true; if (gy > p.y + 2) Input.held.down = true; if (gy < p.y - 2) Input.held.up = true; }
    }
  },
  // ---------- UI flow the story bot skips: real key presses through title, creation, menu, shop, save, load ----------
  async uiTest() {
    const press = (a, wait = 3) => { this.tap(a); this.ticks(wait); };
    const fails = [], check = (c, m) => { if (!c) fails.push(m); };
    Game.toTitle(); this.ticks(5);
    check(!TitleScene.opts.includes('Continue'), 'Continue shown without a save');
    press('ok'); this.ticks(60);
    check(Game.scene === CreateScene, 'New Oath did not open creation');
    for (let i = 0; i < 4; i++) press('right');
    check(CreateScene.i === 4, 'ring did not rotate');
    press('ok'); press('right'); check(CreateScene.look === 1, 'look did not change'); press('back'); check(CreateScene.step === 0, 'back failed'); press('ok'); press('ok');
    check(CreateScene.step === 2 && Input.textMode, 'name step not reached');
    CreateScene.name = '';
    for (const k of ['KeyS', 'KeyE', 'KeyV', 'KeyA']) window.dispatchEvent(new KeyboardEvent('keydown', { code: k, key: k[3].toLowerCase(), bubbles: true }));
    check(CreateScene.name === 'seva', 'typing a name failed: ' + CreateScene.name);
    check(!Input.held.down && !Input.held.left, 'typing leaked into movement');
    press('ok'); await this.shot('ui-name');
    for (let i = 0; i < 2000 && !(Game.scene === FieldScene && !Game.script); i++) { if (i % 20 === 0) this.tap('ok'); Game.tick(); }
    check(Game.scene === FieldScene && S.party[0].name === 'seva' && S.party[0].order === ORDERS[4].id, 'game did not start with the chosen Order');
    delete S.flags.prologue; S.flags.elderDone = 1;
    S.party.push(newComp('torvan', 1), newComp('issa', 1)); for (const h of S.party) { const st = stats(h, S.ideal); h.hp = st.hp; h.sl = st.sl; }
    S.gold = 500; S.party[0].hp = 10;
    press('menu'); check(Game.scene === MenuScene, 'menu did not open'); await this.shot('ui-party');
    press('right'); await this.shot('ui-items');
    const hpBefore = S.party[0].hp; Menu.i = MenuScene.useItems().indexOf('chouta'); press('ok'); press('ok'); check(S.party[0].hp > hpBefore, 'chouta did not heal'); press('back'); press('back');
    check(Game.scene === FieldScene, 'menu did not close');
    Game.run(Story.shop()); this.ticks(3); check(Game.scene === ShopScene, 'shop did not open'); await this.shot('ui-shop');
    ShopScene.i = ShopScene.list.indexOf('sword1'); this.ticks(1); press('ok'); check(S.items.sword1 === 1 && S.gold < 500, 'buy failed'); press('back'); this.ticks(3); check(Game.scene === FieldScene && !Game.script, 'shop did not close');
    press('menu'); Menu.tab = 2; Menu.i = 0; press('ok'); press('down'); press('ok');
    check(S.party[0].equip.weapon === 'sword1' && !S.items.sword1, 'equip failed'); await this.shot('ui-equip');
    Menu.tab = 3; this.ticks(2); await this.shot('ui-oaths');
    press('back');
    check(Game.save(), 'save failed');
    check(Saves.get('auto').meta.name === 'seva', 'autosave record is wrong');
    const saved = JSON.stringify(S.party[0].equip), px = Field.player.x, py = Field.player.y;
    Game.toTitle(); this.ticks(3); check(TitleScene.opts[0] === 'Continue', 'Continue missing after save');
    press('ok'); for (let i = 0; i < 90; i++) Game.tick();
    check(Game.scene === FieldScene && JSON.stringify(S.party[0].equip) === saved, 'load failed');
    check(Math.abs(Field.player.x - px) < 1 && Math.abs(Field.player.y - py) < 1, 'position not restored');
    // Withdraw from a battle, then lose one and retry it: both paths return to play.
    Game.run(Battle.run(['cremling'])); for (let i = 0; i < 120; i++) { if (Battle.hint) this.tap('ok'); Game.tick(); }
    check(Game.scene === BattleScene, 'battle did not start'); await this.shot('ui-battle');
    Battle.menu.items.forEach((q, i) => { if (q.id === 'flee') this.fleeIdx = i; });
    for (let i = 0; i < this.fleeIdx; i++) press('down'); press('ok'); for (let i = 0; i < 90; i++) Game.tick();
    check(Game.scene === FieldScene && !Game.script, 'withdraw failed');
    Game.run(Battle.run(['cremling'])); for (let i = 0; i < 60; i++) Game.tick();
    Battle.party.forEach(p => { p.hp = 0; p.pose = 'ko'; });
    for (let i = 0; i < 600 && !Battle.loseMenu; i++) { if (Battle.menu || Battle.tgt) this.tap('ok'); Game.tick(); }
    check(!!Battle.loseMenu, 'lose screen not shown'); await this.shot('ui-lose');
    for (let i = 0; i < 40; i++) Game.tick();
    press('ok'); for (let i = 0; i < 120; i++) Game.tick();
    check(Game.scene === BattleScene && Battle.party[0].hp === Battle.party[0].maxhp && !Battle.loseMenu, 'retry failed');
    return { ok: fails.length === 0, fails };
  },
  // ---------- save files across real restarts: each step is one launch of the app, driven by tests/save-files-e2e.js ----------
  async savesStep(step) {
    const fails = [], check = (c, m) => { if (!c) fails.push(m); };
    const press = (a, n = 3) => { this.tap(a); this.ticks(n); };
    const out = {};
    if (step === 'first') {
      check(!Game.hasSave(), 'a fresh install should have no saves');
      check(!TitleScene.opts.includes('Continue'), 'Continue shown with no saves');
      check(Saves.status().includes('files'), 'save screen should mention files');
      Game.newGame('Filetest', 'stoneward', 2);
      S.flags.cragsIntroDone = 1; S.gold = 777; S.items.mark = 4; S.nodes.crags = 1;
      Game.enterMap('crags', 16, 16); Game.scene = FieldScene; Game.fade = 0; Field.foes = []; this.ticks(5);
      // Through the real pause menu and save screen.
      press('menu'); Menu.tab = Menu.tabs.indexOf('System'); Menu.i = 0; press('ok');
      check(Game.scene === SaveScene && SaveScene.mode === 'save', 'save screen did not open');
      press('ok'); check(SaveScene.msg.startsWith('Saved to slot 1'), 'bad message: ' + SaveScene.msg);
      await this.shot('save-screen');
      S.gold = 778; press('ok'); check(!!SaveScene.confirm, 'overwrite should ask first'); press('ok');
      check(Saves.get('1') && JSON.parse(Saves.get('1').json).gold === 778, 'overwrite failed');
      press('back'); press('back');
      check(Game.scene === FieldScene, 'menus did not close');
      check(Game.save(), 'autosave failed');
      out.x = Field.player.x; out.y = Field.player.y;
    } else if (step === 'second') {
      check(TitleScene.opts[0] === 'Continue', 'Continue missing after restart');
      const r = Saves.get('1');
      check(r && r.meta.name === 'Filetest' && r.meta.order === 'stoneward', 'slot 1 not read from disk');
      this.tap('down'); this.ticks(1); this.tap('ok'); this.ticks(3);
      check(Game.scene === SaveScene && SaveScene.mode === 'load', 'load screen did not open');
      await this.shot('load-screen');
      SaveScene.i = SaveScene.ids().indexOf('1'); press('ok'); this.ticks(80);
      check(Game.scene === FieldScene && S.gold === 778 && S.items.mark === 4 && S.map === 'crags', 'slot 1 did not load: gold=' + (S && S.gold));
      out.x = Field.player.x; out.y = Field.player.y;
    } else if (step === 'close-while-free') {
      Game.newGame('Closer', 'bondsmith', 1);
      Game.enterMap('crags', 16, 16); Game.scene = FieldScene; Game.fade = 0; Field.foes = []; S.flags.cragsIntroDone = 1; S.gold = 888; this.ticks(5);
      Game.paused = true; setTimeout(() => window.desktop.quit(), 20);
      return new Promise(() => {});
    } else if (step === 'close-in-battle') {
      Game.newGame('Battler', 'bondsmith', 1);
      Game.enterMap('crags', 16, 16); Game.scene = FieldScene; Game.fade = 0; S.flags.battleTut = 1; S.gold = 999; this.ticks(2);
      Game.run(Battle.run(['cremling'])); this.ticks(60);
      check(Game.scene === BattleScene, 'battle did not start');
      setTimeout(() => window.desktop.quit(), 20);
      return new Promise(() => {});
    } else if (step === 'repair') {
      check(/backup was restored/.test(Saves.notice), 'no repair notice: ' + Saves.notice);
      check(Saves.get('1') && JSON.parse(Saves.get('1').json).gold === 777, 'backup not used');
      this.ticks(2); await this.shot('repair-notice');
    } else if (step === 'seed-browser-save') {
      Game.newGame('Oldsave', 'lightweaver', 3); S.gold = 111;
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
      localStorage.setItem('oathbound.slot.2', JSON.stringify(Saves.makeRec(Object.assign(JSON.parse(JSON.stringify(S)), { gold: 222 }))));
    } else if (step === 'imported') {
      check(localStorage.getItem(SAVE_KEY) === null && localStorage.getItem('oathbound.slot.2') === null, 'browser copies were not removed');
      check(Saves.get('2') && JSON.parse(Saves.get('2').json).gold === 222, 'browser slot not imported');
      const legacy = ['1', '3'].map(id => Saves.get(id)).find(r => r && r.meta.name === 'Oldsave');
      check(legacy && JSON.parse(legacy.json).gold === 111, 'old single save not imported');
    } else if (step === 'write-fails') {
      Game.newGame('Blocked', 'windrunner', 0); S.gold = 1;
      const before = Saves.get('1') && Saves.get('1').savedAt;
      SaveScene.open('save'); SaveScene.doSave('1');
      check(/Could not write/.test(SaveScene.msg), 'failure not shown: ' + SaveScene.msg);
      check((Saves.get('1') && Saves.get('1').savedAt) === before, 'failed save should not replace the slot in memory');
      Game.scene = TitleScene;
    } else if (step === 'delete') {
      const id = SLOT_IDS.find(k => Saves.get(k));
      check(!!id, 'nothing to delete');
      check(Saves.remove(id) && !Saves.get(id), 'delete failed');
      out.deleted = id;
    } else if (step === 'report') {
      out.slots = SLOT_IDS.filter(id => Saves.get(id)).map(id => { const m = Saves.get(id).meta; return { id, name: m.name, order: m.order, lvl: m.lvl, area: m.area }; });
      out.notice = Saves.notice;
    } else return { ok: false, fails: ['unknown step ' + step] };
    return Object.assign({ ok: fails.length === 0, fails }, out);
  },
  // ---------- gallery ----------
  async gallery() {
    const out = { ok: true };
    await this.shot('title');
    Game.newGame('Kaelan', 'windrunner', 0);
    CreateScene.enter(); Game.scene = CreateScene; this.ticks(60);
    await this.shot('create');
    for (let i = 0; i < 10; i++) {
      CreateScene.i = i; this.ticks(30);
      if (i === 3 || i === 5 || i === 9) await this.shot('create' + i);
    }
    Game.newGame('Kaelan', 'stoneward', 2);
    S.ideal = 3; S.party.push(newComp('torvan', 8), newComp('issa', 8)); S.party[0].lvl = 8;
    for (const h of S.party) { const st = stats(h, S.ideal); h.hp = st.hp; h.sl = st.sl; }
    S.nodes = { stonereach: 1, crags: 1, chasm: 1, vault: 1 }; S.flags = { battleTut: 1, sealTut: 1 };
    for (const [id, x, y] of [['stonereach', 24, 18], ['crags', 16, 16], ['chasm', 10, 25], ['vault', 23, 30], ['shadesmar', 20, 15], ['dais', 15, 18]]) {
      Game.enterMap(id, x, y); Game.scene = FieldScene; Game.script = null; Game.wipe = 0; Game.fade = 0; Field.foes = Field.foes.filter(f => Math.hypot(f.x - Field.player.x, f.y - Field.player.y) > 120); Object.assign(S.flags, { cragsIntroDone: 1, chasmIntroDone: 1, vaultIntroDone: 1, shadeIntroDone: 1 }); this.ticks(90); Game.script = null; await this.shot('map-' + id);
    }
    Game.enterMap('crags', 14, 16); Game.scene = FieldScene;
    Game.scene = WorldScene; WorldScene.enter('crags'); this.ticks(20); await this.shot('world');
    Game.scene = MenuScene; Menu.tab = 0; this.ticks(2); await this.shot('menu-party');
    Menu.tab = 3; this.ticks(2); await this.shot('menu-oaths');
    Game.mapDef = getMap('crags');
    for (const f of [['cremling', 'axehound', 'deserter'], ['chull', 'whitespine'], ['warform', 'regal', 'voidwisp'], ['shade', 'angerspren', 'hollow'], ['hadrin'], ['chasmfiend'], ['cantor'], ['hunter'], ['thunderclast']]) {
      Battle.setup(f, { back: ['chasmfiend', 'chull'].includes(f[0]) ? 'chasm' : f[0] === 'warform' || f[0] === 'cantor' ? 'vault' : f[0] === 'shade' || f[0] === 'hunter' ? 'shadesmar' : f[0] === 'thunderclast' ? 'everstorm' : 'crags' });
      Game.scene = BattleScene; Game.fade = 0;
      Battle.foes[0].charging = { move: ENEMIES.hadrin.charged, turns: 2, sigils: [{ type: 'slash' }, { type: 'crush', broken: true }, { type: 'light' }] };
      this.ticks(30);
      await this.shot('battle-' + f[0]);
    }
    return out;
  }
};
