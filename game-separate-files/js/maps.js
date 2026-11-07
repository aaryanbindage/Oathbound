'use strict';
// Area layouts, built with carve operations so the corridors always connect.
class MapB {
  constructor(id, w, h, theme, o = {}) {
    Object.assign(this, { id, w, h, theme, objs: [], npcs: [], trigs: [], foes: [], decor: [], ambient: o.ambient || '#ffffff', weather: o.weather || 'none', music: o.music || 'field', name: o.name || id, fill: o.fill || 0, spawn: o.spawn || [2, 2] });
    this.t = new Uint8Array(w * h).fill(this.fill);
  }
  set(x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.t[y * this.w + x] = v; }
  get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.t[y * this.w + x]; }
  room(x, y, w, h, v = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v); return this; }
  line(x0, y0, x1, y1, r = 1, v = 2) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) { const cx = Math.round(lerp(x0, x1, n ? k / n : 0)), cy = Math.round(lerp(y0, y1, n ? k / n : 0)); for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) this.set(cx + i, cy + j, v); }
    return this;
  }
  obj(kind, x, y, extra = {}) { const o = Object.assign({ kind, x: x * TS + 8, y: y * TS + 16 }, extra); this.objs.push(o); return o; }
  npc(id, pal, x, y, act, extra = {}) { this.npcs.push(Object.assign({ id, pal, x: x * TS + 8, y: y * TS + 14, dir: 0, act }, extra)); return this; }
  trig(x, y, w, h, fn, extra = {}) { this.trigs.push(Object.assign({ x, y, w, h, fn }, extra)); return this; }
  foe(x, y, form, extra = {}) { this.foes.push(Object.assign({ x: x * TS + 8, y: y * TS + 12, form, id: this.foes.length, sx: x * TS + 8, sy: y * TS + 12 }, extra)); return this; }
  chest(x, y, loot) { return this.obj('chest', x, y, { chest: this.id + ':' + x + ':' + y, loot }); }
  gap(x, y, tx, ty) { return this.obj('spot', x, y, { act: 'gap', tx: tx * TS + 8, ty: ty * TS + 12 }); }
  // Non-solid plant and mineral dressing on open ground.
  dress(kinds, n, seed) {
    const r = mulberry(seed); let tries = 0, done = 0;
    while (done < n && tries++ < n * 30) {
      const x = Math.floor(r() * this.w), y = Math.floor(r() * this.h);
      if (this.get(x, y) !== 1) continue;
      this.decor.push({ kind: kinds[Math.floor(r() * kinds.length)], x: x * TS + 3 + Math.floor(r() * 10), y: y * TS + 6 + Math.floor(r() * 9) }); done++;
    }
    return this;
  }
  // Solid scenery placed only where a wide 5x5 tile area stays open, keeping corridors walkable.
  scenery(kinds, n, seed) {
    const r = mulberry(seed); let tries = 0, done = 0;
    while (done < n && tries++ < n * 40) {
      const x = 2 + Math.floor(r() * (this.w - 4)), y = 2 + Math.floor(r() * (this.h - 4));
      let ok = true;
      for (let j = -2; j <= 2 && ok; j++) for (let i = -2; i <= 2; i++) if (this.get(x + i, y + j) !== 1) { ok = false; break; }
      if (!ok || this.objs.some(o => Math.abs(o.x - x * TS) < 56 && Math.abs(o.y - y * TS) < 56) || this.npcs.some(o => Math.abs(o.x - x * TS) < 32 && Math.abs(o.y - y * TS) < 32) || this.foes.some(o => Math.abs(o.x - x * TS) < 32 && Math.abs(o.y - y * TS) < 32)) continue;
      this.obj(kinds[Math.floor(r() * kinds.length)], x, y); done++;
    }
    return this;
  }
}

const MAP_BUILD = {
  stonereach() {
    const m = new MapB('stonereach', 48, 34, 'town', { ambient: '#f8f4ec', music: 'town', name: 'Stonereach', spawn: [5, 17] });
    m.room(2, 4, 45, 27).line(0, 17, 47, 17, 1).line(24, 9, 24, 26, 1).line(9, 17, 9, 15, 0).line(30, 17, 30, 15, 0);
    m.obj('inn', 9, 14); m.obj('stall', 18, 14); m.obj('hall', 30, 14); m.obj('workshop', 39, 14);
    m.obj('house', 7, 26); m.obj('house', 14, 26); m.obj('house', 31, 26); m.obj('house', 38, 26);
    m.obj('fire', 24, 22, { act: 'camp' }); m.obj('crate', 21, 22); m.obj('crate', 22, 23); m.obj('tent', 27, 22, { hideIf: 'nope' });
    for (const [x, y] of [[4, 15], [15, 15], [21, 15], [27, 15], [35, 15], [42, 15], [4, 19], [15, 19], [33, 19], [20, 26], [28, 26]]) m.obj('lamp', x, y);
    // The storm wall on the eastern face, with a gate gap at the road.
    for (let y = 4; y < 31; y++) if (y < 16 || y > 18) m.obj('stormwall', 43, y);
    m.scenery(['tree', 'boulder'], 7, 3).dress(['grass', 'bud', 'grass', 'vine'], 70, 7);
    m.npc('elder', 'elder', 30, 16, 'elderTalk', { name: 'Highmarshal Dorvan', hideIf: 'prologue' });
    m.npc('merchant', 'merchant', 21, 14, 'shop', { name: 'Azim the Trader', hideIf: 'prologue', dir: 0 });
    m.npc('inn', 'inn', 13, 15, 'innTalk', { name: 'Big Rolo', hideIf: 'prologue' });
    m.npc('mother', 'mother', 5, 16, 'motherTalk', { name: 'Ralna', hideIf: 'prologue' });
    m.npc('child', 'child', 6, 18, 'childTalk', { name: 'Pell', hideIf: 'prologue', small: true });
    m.npc('child2', 'child', 45, 17, null, { name: 'Pell', showIf: 'prologue', small: true });
    m.npc('torvan', COMPANIONS.torvan.pal, 26, 16, 'torvanTalk', { name: 'Torvan', hideIf: 'prologue', hideIf2: 'torvanJoined', comp: true });
    m.npc('issa', COMPANIONS.issa.pal, 36, 16, 'issaTalk', { name: 'Issa', hideIf: 'prologue', hideIf2: 'issaJoined', comp: true });
    m.npc('v1', 'villager', 18, 20, 'villagerA', { name: 'Refugee', hideIf: 'prologue', wander: true });
    m.npc('v2', 'villager2', 34, 22, 'villagerB', { name: 'Stormwatcher', hideIf: 'prologue', wander: true });
    m.npc('v3', 'villager', 11, 22, 'villagerC', { name: 'Old Farmer', hideIf: 'prologue' });
    m.trig(0, 15, 1, 5, 'toWorld');
    m.trig(43, 15, 3, 5, 'prologueStorm', { ifFlag: 'prologue' });
    return m;
  },
  crags() {
    const m = new MapB('crags', 72, 34, 'crags', { ambient: '#f8d8b0', music: 'field', name: 'Windbreak Crags', spawn: [3, 16] });
    m.line(0, 16, 14, 16, 2).room(12, 9, 15, 15).line(25, 16, 38, 16, 2).line(20, 10, 20, 5, 1).room(15, 2, 12, 6);
    m.line(42, 16, 50, 16, 2).room(44, 8, 13, 13).line(47, 9, 47, 5, 1).room(42, 1, 11, 6).line(55, 14, 62, 14, 2).room(60, 5, 11, 19).line(60, 14, 71, 14, 2);
    m.line(20, 22, 20, 28, 1).room(14, 26, 14, 6);
    // The road runs on through the open areas, joining up the corridors.
    m.line(12, 16, 26, 16, 1).line(20, 16, 20, 8, 0).line(20, 16, 20, 25, 0).line(42, 16, 50, 16, 1).line(50, 16, 56, 14, 1).line(47, 16, 47, 7, 0).line(60, 14, 70, 14, 1);
    m.room(38, 14, 4, 5, 4); // the gap
    m.gap(37, 16, 42, 16); m.gap(42, 16, 37, 16);
    m.chest(21, 3, { item: 'chouta', n: 3 }); m.chest(47, 2, { item: 'sword1', n: 1, gold: 60 }); m.chest(25, 28, { item: 'mark', n: 2 }); m.chest(16, 30, { gold: 90 });
    m.obj('fire', 50, 11, { act: 'camp' }); m.obj('tent', 53, 11); m.obj('lamp', 45, 12); m.obj('crate', 45, 10);
    m.foe(18, 16, FORMS.crags[0]); m.foe(22, 12, FORMS.crags[1]); m.foe(30, 16, FORMS.crags[2]); m.foe(19, 4, FORMS.crags[3]); m.foe(20, 28, FORMS.crags[3]); m.foe(47, 3, FORMS.crags[4]); m.foe(50, 17, FORMS.crags[1]); m.foe(57, 14, FORMS.crags[4]);
    m.npc('hadrin', 'hadrin', 66, 14, null, { name: 'Captain Hadrin', hideIf: 'hadrinDown' });
    m.npc('dx1', 'deserter', 64, 11, null, { name: 'Deserter', hideIf: 'hadrinDown' }); m.npc('dx2', 'deserter', 64, 17, null, { name: 'Deserter', hideIf: 'hadrinDown' });
    m.trig(60, 11, 2, 7, 'hadrinScene', { once: 'hadrinSeen', hideIf: 'hadrinDown' });
    m.trig(0, 13, 1, 7, 'toWorld'); m.trig(71, 11, 1, 7, 'cragsExit');
    m.scenery(['boulder', 'tree', 'boulder'], 12, 5).dress(['bud', 'grass', 'vine', 'bud'], 110, 9);
    m.trig(14, 13, 2, 7, 'cragsIntro', { once: 'cragsIntroDone' });
    return m;
  },
  chasm() {
    const m = new MapB('chasm', 58, 48, 'chasm', { ambient: '#8e9cac', music: 'deep', name: 'The Sundered Deep', spawn: [7, 4] });
    m.room(2, 2, 11, 7).line(7, 8, 7, 22, 1).room(4, 20, 20, 10).line(7, 0, 7, 3, 1);
    m.room(9, 23, 4, 3, 3); m.room(17, 26, 4, 2, 3);
    m.line(22, 24, 36, 24, 1).room(34, 17, 12, 11);
    m.line(12, 29, 12, 38, 1).room(6, 36, 15, 9).room(14, 41, 4, 2, 3);
    m.line(42, 27, 42, 38, 1).room(36, 36, 15, 9);
    m.line(45, 23, 52, 23, 1).line(52, 23, 52, 11, 1).room(42, 2, 14, 10).line(49, 2, 49, 0, 1);
    m.obj('lampDead', 40, 19, { lamp: 'L1' }); m.obj('lampDead', 13, 39, { lamp: 'L2' }); m.obj('lampDead', 44, 40, { lamp: 'L3' });
    m.obj('gatePort', 48, 24, { hideIf: 'chasmGate' });
    m.obj('fire', 37, 25, { act: 'camp' }); m.obj('crate', 35, 26);
    m.npc('chasmTrader', 'merchant', 39, 26, 'shop2', { name: 'Azim the Trader' });
    m.chest(8, 41, { item: 'sword2', n: 1 }); m.chest(48, 42, { item: 'stew', n: 3 }); m.chest(5, 27, { item: 'coat2', n: 1 }); m.chest(44, 3, { item: 'charm3', n: 1, hideIf: 'x' });
    m.foe(7, 15, FORMS.chasm[0]); m.foe(14, 23, FORMS.chasm[1]); m.foe(28, 24, FORMS.chasm[2]); m.foe(12, 33, FORMS.chasm[3]); m.foe(16, 38, FORMS.chasm[4]); m.foe(42, 32, FORMS.chasm[3]); m.foe(40, 38, FORMS.chasm[4]); m.foe(52, 18, FORMS.chasm[1]);
    m.npc('fiendTorvan', COMPANIONS.torvan.pal, 49, 8, null, { name: 'Torvan', showIf: 'fiendScene' });
    m.trig(51, 13, 3, 2, 'fiendSceneStart', { once: 'fiendSeen' });
    m.trig(47, 0, 5, 1, 'chasmExit');
    m.trig(6, 0, 3, 1, 'toWorld');
    m.trig(5, 3, 5, 3, 'chasmIntro', { once: 'chasmIntroDone' });
    m.scenery(['boulderDark'], 12, 11).dress(['frill', 'frill', 'gem', 'frill'], 130, 13);
    return m;
  },
  vault() {
    const m = new MapB('vault', 46, 44, 'vault', { ambient: '#5c6898', music: 'vault', name: 'The Vault of Oaths', spawn: [23, 41] });
    m.line(23, 43, 23, 34, 2).room(14, 27, 19, 8).line(14, 30, 6, 30, 1).room(2, 24, 8, 12).line(32, 30, 40, 30, 1).room(37, 24, 8, 12);
    m.line(23, 26, 23, 16, 2, 2).room(10, 3, 27, 14, 2);
    m.obj('doorVault', 23, 25, { hideIf: 'vaultDoor' });
    m.obj('mural', 17, 27, { act: 'mural' });
    [[16, 31], [20, 31], [26, 31], [30, 31]].forEach(([x, y], i) => m.obj('plate', x, y, { plate: i }));
    for (const x of [15, 31]) for (const y of [29, 33]) if (y !== 29 || x !== 15) m.obj('pillar', x, y);
    for (let i = 0; i < 5; i++) { m.obj('statue', 11 + i * 2, 4, { statue: ORDERS[i].id }); m.obj('statue', 27 + i * 2, 4, { statue: ORDERS[5 + i].id }); }
    for (const [x, y] of [[12, 10], [34, 10], [12, 14], [34, 14], [20, 19], [26, 19], [20, 23], [26, 23]]) m.obj('pillar', x, y);
    for (const [x, y] of [[4, 26], [7, 33], [39, 26], [42, 33]]) m.obj('crystal', x, y);
    m.obj('fire', 41, 30, { act: 'camp' }); m.npc('vaultTrader', 'merchant', 39, 33, 'shop3', { name: 'Azim the Trader' });
    m.chest(3, 34, { item: 'sword3', n: 1 }); m.chest(5, 25, { item: 'charm4', n: 1 }); m.chest(43, 25, { item: 'broam', n: 2 });
    m.foe(23, 38, FORMS.vault[0]); m.foe(10, 30, FORMS.vault[1]); m.foe(5, 28, FORMS.vault[2]); m.foe(23, 20, FORMS.vault[3]); m.foe(36, 30, FORMS.vault[0]);
    m.npc('cantor', 'cantor', 23, 7, null, { name: 'The Ashen Cantor', hideIf: 'cantorDown' });
    m.trig(21, 16, 5, 1, 'cantorScene', { once: 'cantorSeen' });
    m.trig(21, 43, 5, 1, 'toWorld');
    m.trig(21, 36, 5, 1, 'vaultIntro', { once: 'vaultIntroDone' });
    m.dress(['gem', 'gem'], 40, 21);
    return m;
  },
  shadesmar() {
    const m = new MapB('shadesmar', 66, 36, 'shadesmar', { ambient: '#8884c0', music: 'shadesmar', name: 'Shadesmar', spawn: [3, 18], fill: 3, weather: 'motes' });
    m.line(0, 18, 15, 18, 1).room(14, 9, 15, 17).line(28, 14, 36, 10, 1).room(34, 4, 13, 12).line(46, 10, 52, 17, 1).room(50, 10, 14, 15).line(22, 25, 22, 31, 1).room(16, 29, 13, 6);
    m.obj('fire', 18, 12, { act: 'camp' });
    m.npc('honor1', { skin: '#d4f0ff', skin2: '#8fbfe0', hair: '#c4e8ff', style: 1, eye: '#2a4a7a', coat: '#8fbfe0', coat2: '#5f8fb8', trim: '#ffffff', pants: '#7fa8c8', boots: '#5f8fb8' }, 24, 13, 'sprenElder', { name: 'Elder Honorspren', ghost: true });
    m.npc('shadeTrader', { skin: '#e8e0f8', skin2: '#b0a8d0', hair: '#242040', style: 0, eye: '#000000', coat: '#242040', coat2: '#141228', trim: '#d4d8f0', pants: '#141228', boots: '#0c0a16' }, 26, 20, 'shop3', { name: 'An Inkspren Merchant' });
    m.obj('crystal', 15, 10); m.obj('crystal', 27, 24); m.obj('sprenfolk', 21, 20); m.obj('sprenfolk', 16, 22);
    for (const [x, y] of [[36, 6], [39, 8], [43, 6], [37, 12], [42, 13], [45, 9], [40, 5]]) m.obj('deadeye', x, y);
    m.chest(18, 33, { item: 'coat3', n: 1 }); m.chest(26, 32, { item: 'broam', n: 1, gold: 200 });
    m.foe(8, 18, FORMS.shadesmar[0]); m.foe(22, 28, FORMS.shadesmar[3]); m.foe(31, 12, FORMS.shadesmar[1]); m.foe(49, 14, FORMS.shadesmar[2]); m.foe(58, 14, FORMS.shadesmar[3]);
    m.trig(39, 4, 2, 12, 'deadeyeScene', { once: 'deadeyeSeen' });
    m.trig(52, 10, 2, 15, 'hunterScene', { once: 'hunterSeen' });
    m.obj('rift', 60, 18, { act: 'rift' });
    m.dress(['bead'], 90, 33);
    m.trig(3, 16, 3, 5, 'shadesmarIntro', { once: 'shadeIntroDone' });
    return m;
  },
  dais() {
    const m = new MapB('dais', 30, 24, 'dais', { ambient: '#c07878', music: 'boss', name: 'The Oathgate Dais', spawn: [15, 20], weather: 'everstorm' });
    m.room(3, 3, 24, 19);
    m.obj('oathgate', 15, 11); for (const [x, y] of [[5, 5], [24, 5], [5, 18], [24, 18]]) m.obj('pillar', x, y);
    m.npc('cantorF', 'cantor', 15, 7, null, { name: 'The Ashen Cantor', hideIf: 'finalDown' });
    m.trig(11, 15, 9, 2, 'finale', { once: 'finaleSeen' });
    m.dress(['gem'], 20, 44);
    return m;
  }
};
const MAP_CACHE = {};
function getMap(id) {
  if (MAP_CACHE[id]) return MAP_CACHE[id];
  const m = MAP_BUILD[id]();
  m.canvas = renderMapTiles(m);
  MAP_CACHE[id] = m;
  return m;
}
const WORLD_NODES = [
  { id: 'stonereach', name: 'Stonereach', x: 126, y: 150, map: 'stonereach', sub: 'A storm town in the Frostlands', spawn: [4, 17] },
  { id: 'crags', name: 'Windbreak Crags', x: 192, y: 118, map: 'crags', sub: 'Deserters hold the pass', spawn: [3, 16] },
  { id: 'chasm', name: 'The Sundered Deep', x: 272, y: 148, map: 'chasm', sub: 'Chasms that remember the sea', spawn: [7, 4] },
  { id: 'vault', name: 'The Vault of Oaths', x: 352, y: 106, map: 'vault', sub: 'Lost since the Recreance', spawn: [23, 41] }
];
