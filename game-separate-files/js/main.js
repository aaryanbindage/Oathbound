'use strict';
// Game state, scene transitions, save/load, and the fixed-step main loop.
let S = null;
const SAVE_KEY = 'oathbound.save.v1'; // The old single save; moved into a slot on first run.
const SLOT_IDS = ['auto', '1', '2', '3'];
const AREA_NAMES = { stonereach: 'Stonereach', crags: 'Windbreak Crags', chasm: 'The Sundered Deep', vault: 'The Vault of Oaths', shadesmar: 'Shadesmar', dais: 'The Oathgate Dais' };
// Each slot is kept in this browser and, when the viewer has a Claude account here, in their private
// per-person storage. On load the newer copy of each slot wins; deleting leaves a marker so an old copy can't return.
const Saves = {
  slots: {}, col: null, dirty: new Set(), writing: false, timer: null,
  lsKey(id) { return 'oathbound.slot.' + id; },
  docId(id) { return 'oathbound-slot-' + id; },
  valid(r) {
    if (!r || typeof r.savedAt !== 'number') return false;
    if (r.deleted) return true;
    return !!(r.meta && typeof r.json === 'string' && ORDER(r.meta.order) && LOOKS[r.meta.look]);
  },
  makeRec(st, at = Date.now()) {
    const h = st.party[0];
    return { savedAt: at, json: JSON.stringify(st), meta: { name: h.name, order: h.order, look: h.look, lvl: h.lvl, ideal: st.ideal, area: st.atWorld ? 'World map' : AREA_NAMES[st.map] || '', quest: st.quest || '', playT: st.playT || 0, gameId: st.gameId || null } };
  },
  init() {
    for (const id of SLOT_IDS) {
      try { const r = JSON.parse(localStorage.getItem(this.lsKey(id))); if (this.valid(r)) this.slots[id] = r; } catch (e) { /* storage blocked or unreadable */ }
    }
    this.migrate();
    this.connect();
  },
  migrate() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;
      const st = JSON.parse(raw), rec = this.makeRec(st), id = ['1', '2', '3'].find(k => !this.get(k));
      if (id && this.valid(rec) && this.storeLocal(id, rec)) { this.slots[id] = rec; localStorage.removeItem(SAVE_KEY); }
    } catch (e) { /* leave the old save where it is */ }
  },
  storeLocal(id, rec) { try { localStorage.setItem(this.lsKey(id), JSON.stringify(rec)); return true; } catch (e) { return false; } },
  get(id) { const r = this.slots[id]; return r && !r.deleted ? r : null; },
  latest() { let best = null; for (const id of SLOT_IDS) { const r = this.get(id); if (r && (!best || r.savedAt > this.get(best).savedAt)) best = id; } return best; },
  any() { return this.latest() !== null; },
  // Puts a record in a slot. False means it would not outlast this page: no browser storage and no account.
  put(id, rec, soon) {
    this.slots[id] = rec;
    const local = this.storeLocal(id, rec);
    if (this.col) this.queue(id, soon);
    return local || !!this.col;
  },
  write(id, rec, soon) {
    // A new character's first autosave moves the previous character's autosave to a free slot rather than erasing it.
    const old = id === 'auto' && this.get('auto');
    if (old && old.meta.gameId !== rec.meta.gameId) { const free = ['1', '2', '3'].find(k => !this.get(k)); if (free) this.put(free, old, true); }
    return this.put(id, rec, soon);
  },
  remove(id) { this.put(id, { savedAt: Date.now(), deleted: true }, true); },
  queue(id, soon) {
    this.dirty.add(id);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), soon ? 0 : 2000);
  },
  // One write at a time; bursts of autosaves collapse into the newest state of each slot.
  async flush() {
    if (this.writing || !this.col) return;
    this.writing = true;
    while (this.dirty.size && this.col) {
      const id = this.dirty.values().next().value;
      this.dirty.delete(id);
      const rec = this.slots[id];
      try { await this.col.doc(this.docId(id)).set(rec); }
      catch (e) {
        if (['invalid_argument', 'quota_exceeded', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed', 'transform_error'].includes(e && e.code)) { this.col = null; this.dirty.clear(); break; }
        this.dirty.add(id); clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 15000 + Math.random() * 5000); break;
      }
    }
    this.writing = false;
  },
  async connect() {
    const use = window.claude && window.claude.use;
    if (!use) return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      const uid = db && user && await user.id();
      if (!uid) return;
      const col = db.collection('data/users/' + uid), snap = await col.get(), remote = {};
      for (const d of snap.docs) remote[d.id] = d.data();
      for (const id of SLOT_IDS) {
        const c = remote[this.docId(id)], l = this.slots[id];
        if (this.valid(c) && (!l || c.savedAt > l.savedAt)) { this.slots[id] = c; this.storeLocal(id, c); }
        else if (l && (!this.valid(c) || l.savedAt > c.savedAt)) this.dirty.add(id);
      }
      this.col = col;
      this.flush();
      if (Game.scene === TitleScene) TitleScene.refresh();
    } catch (e) { this.col = null; /* carry on with browser storage */ }
  },
  status() { return this.col ? 'Saves are kept in your Claude account and this browser.' : 'Saves are kept in this browser only.'; }
};
window.addEventListener('pagehide', () => Saves.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) Saves.flush(); });
const Game = {
  scene: null, script: null, fade: 1, flashCol: '#fff', flashA: 0, wipe: 0, mapDef: null, ended: false, overlay: null, speed: 1,
  run(gen) { this.script = gen; },
  step() { if (!this.script) return; const r = this.script.next(); if (r.done) this.script = null; },
  newGame(name, order, look) {
    S = { party: [newHero(name, order, look)], ideal: 0, gold: 40, items: { chouta: 2 }, flags: {}, cleared: {}, chests: {}, nodes: { stonereach: 1 }, quest: '', marker: null, map: 'stonereach', x: 12, y: 17, plateN: 0, playT: 0, gameId: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36) };
    const st = stats(S.party[0], 0); S.party[0].hp = st.hp; S.party[0].sl = st.sl;
    Game.ended = false;
  },
  enterMap(id, x, y) {
    const m = getMap(id);
    this.mapDef = m; S.map = id;
    Field.enter(m, x, y);
  },
  *toWorld(focus) {
    yield* this.fadeOut(.35);
    Weather.set('none'); Music.play('title');
    WorldScene.enter(focus || S.map);
    this.scene = WorldScene;
    yield* this.fadeIn(.35);
  },
  *shop(tier) { yield* ShopScene.run(tier); },
  *fadeOut(d = .35) { const a = this.fade; yield* tween(d, k => { this.fade = lerp(a, 1, k); }); this.fade = 1; },
  *fadeIn(d = .35) { const a = this.fade; yield* tween(d, k => { this.fade = lerp(a, 0, k); }); this.fade = 0; },
  // Battle transition: dark bars slam in from both sides like the wall of a storm.
  *stormWipe() {
    Sfx.play('swing');
    yield* tween(.28, k => { this.wipe = k; });
    this.fade = 1; this.wipe = 0;
  },
  hasSave() { return Saves.any(); },
  // Records where the party is, looking through the save screen and pause menu to the scene underneath.
  capturePos() {
    let under = this.scene;
    if (under === SaveScene) under = SaveScene.prev;
    if (under === MenuScene) under = Menu.prev;
    if (under === WorldScene) { const n = WorldScene.nodes()[WorldScene.i]; if (n) S.atWorld = n.id; }
    else if (under === FieldScene && Field.map) { S.x = Field.player.x / TS; S.y = Field.player.y / TS; S.map = Field.map.id; delete S.atWorld; }
  },
  save(slot = 'auto') {
    if (!S) return false;
    this.capturePos();
    return Saves.write(slot, Saves.makeRec(S), slot !== 'auto');
  },
  *loadGame(slot = Saves.latest()) {
    const rec = Saves.get(slot);
    let data = null;
    try { data = rec && JSON.parse(rec.json); } catch (e) { data = null; }
    if (!data) return false;
    yield* this.fadeOut(.4);
    S = data; this.ended = false;
    if (!S.gameId) S.gameId = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    Particles.clear(); Ribbons.clear();
    if (S.atWorld) { Weather.set('none'); Music.play('title'); WorldScene.enter(S.atWorld); this.scene = WorldScene; }
    else { this.enterMap(S.map, S.x - .5, S.y - .75); this.scene = FieldScene; }
    yield* this.fadeIn(.4);
    return true;
  },
  toTitle() { Input.textMode = false; this.script = null; Weather.set('none'); Particles.clear(); Ribbons.clear(); Music.play('title'); TitleScene.enter(); this.scene = TitleScene; this.fade = 0; },
  tick() {
    Input.update();
    this.step();
    if (S && this.scene && this.scene !== TitleScene && this.scene !== CreateScene && this.scene !== EndScene && this.scene !== SaveScene) S.playT = (S.playT || 0) + DT;
    if (this.scene && this.scene.update) this.scene.update();
    if (this.scene === BattleScene) { Particles.update(); }
    Weather.update();
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - DT * 1.4);
  },
  render() {
    g.setTransform(RES, 0, 0, RES, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (this.scene) this.scene.draw();
    Dialog.draw();
    if (this.wipe > 0) {
      const k = this.wipe, w = W / 2 * k;
      g.fillStyle = '#04060f'; g.fillRect(0, 0, w, H); g.fillRect(W - w, 0, w, H);
      g.fillStyle = '#7fc8ff'; g.fillRect(w, 0, 2, H); g.fillRect(W - w - 2, 0, 2, H);
    }
    if (this.fade > 0) { g.fillStyle = `rgba(3,4,10,${this.fade})`; g.fillRect(0, 0, W, H); }
    if (this.flashA > 0) { g.fillStyle = rgba(this.flashCol, Math.min(1, this.flashA)); g.fillRect(0, 0, W, H); }
  }
};

// Fixed step: game logic always advances in 1/60 s increments so timed presses feel the same at any refresh rate.
let lastT = performance.now(), acc = 0;
function frame(now) {
  if (Game.paused) return;
  acc += Math.min(.1, (now - lastT) / 1000); lastT = now;
  let steps = 0;
  while (acc >= DT && steps < 5) { Game.tick(); acc -= DT; steps++; }
  if (steps) Game.render();
  requestAnimationFrame(frame);
}
window.addEventListener('error', e => { console.log('ERROR: ' + e.message + ' @' + e.filename + ':' + e.lineno); });
function boot() {
  Saves.init();
  Game.toTitle();
  Music.play('title');
  canvas.focus();
  requestAnimationFrame(frame);
}
boot();
