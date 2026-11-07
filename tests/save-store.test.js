// Unit tests for the save file store. Run with: node --test tests/save-store.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SaveStore } = require('../electron/saves');

const fresh = () => new SaveStore(fs.mkdtempSync(path.join(os.tmpdir(), 'oath-store-')));
const rec = (gold, at = 1000) => ({ savedAt: at, meta: { name: 'A', order: 'windrunner', look: 0 }, json: JSON.stringify({ gold, party: [{ id: 'hero' }] }) });
const goldOf = r => JSON.parse(r.json).gold;

test('a save reads back identically, as readable JSON on disk', () => {
  const s = fresh();
  assert.deepStrictEqual(s.write('1', rec(5)), { ok: true });
  const r = s.readAll();
  assert.strictEqual(goldOf(r.slots['1']), 5);
  assert.strictEqual(r.slots['1'].savedAt, 1000);
  assert.deepStrictEqual(r.notices, []);
  const onDisk = JSON.parse(fs.readFileSync(path.join(s.dir, 'slot-1.json'), 'utf8'));
  assert.strictEqual(onDisk.state.gold, 5);
  assert.strictEqual(onDisk.format, 1);
});

test('every slot uses its own file', () => {
  const s = fresh();
  for (const id of ['auto', '1', '2', '3']) assert.ok(s.write(id, rec(id.length)).ok);
  assert.deepStrictEqual(fs.readdirSync(s.dir).sort(), ['autosave.json', 'slot-1.json', 'slot-2.json', 'slot-3.json']);
});

test('slot ids cannot escape the save folder', () => {
  const s = fresh();
  for (const bad of ['../evil', '..\\evil', 'constructor', '__proto__', '4', '']) {
    assert.strictEqual(s.write(bad, rec(1)).ok, false, bad);
    assert.strictEqual(s.remove(bad).ok, false, bad);
  }
  assert.deepStrictEqual(fs.readdirSync(s.dir), []);
});

test('overwriting keeps the previous version as a backup', () => {
  const s = fresh();
  s.write('1', rec(1)); s.write('1', rec(2));
  assert.strictEqual(goldOf(s.readAll().slots['1']), 2);
  assert.strictEqual(goldOf(s.readRecord(path.join(s.dir, 'slot-1.json.bak'))), 1);
});

for (const [name, junk] of [['truncated', '{"game":"Oathbound","for'], ['empty', ''], ['the wrong shape', '{"hello":1}'], ['missing its party', JSON.stringify({ format: 1, savedAt: 1, meta: {}, state: { party: [] } })]]) {
  test(`a ${name} file is replaced by its backup and kept for inspection`, () => {
    const s = fresh();
    s.write('2', rec(1)); s.write('2', rec(2));
    fs.writeFileSync(path.join(s.dir, 'slot-2.json'), junk);
    const r = s.readAll();
    assert.strictEqual(goldOf(r.slots['2']), 1);
    assert.deepStrictEqual(r.notices, [{ id: '2', kind: 'restored' }]);
    assert.strictEqual(fs.readdirSync(path.join(s.dir, 'damaged')).length, 1);
    assert.deepStrictEqual(s.readAll().notices, [], 'repair should only be reported once');
  });
}

test('a damaged file with no backup is reported and kept, not deleted', () => {
  const s = fresh();
  fs.mkdirSync(s.dir, { recursive: true });
  fs.writeFileSync(path.join(s.dir, 'autosave.json'), 'garbage');
  const r = s.readAll();
  assert.strictEqual(r.slots.auto, undefined);
  assert.deepStrictEqual(r.notices, [{ id: 'auto', kind: 'damaged' }]);
  assert.strictEqual(fs.readFileSync(path.join(s.dir, 'damaged', fs.readdirSync(path.join(s.dir, 'damaged'))[0]), 'utf8'), 'garbage');
});

test('saving over a damaged file does not ruin the good backup', () => {
  const s = fresh();
  s.write('1', rec(1)); s.write('1', rec(2));
  fs.writeFileSync(path.join(s.dir, 'slot-1.json'), 'garbage');
  assert.ok(s.write('1', rec(3)).ok);
  assert.strictEqual(goldOf(s.readRecord(path.join(s.dir, 'slot-1.json.bak'))), 1);
  assert.strictEqual(goldOf(s.readAll().slots['1']), 3);
});

test('a crash mid-save leaves the last good save untouched', () => {
  const s = fresh();
  s.write('1', rec(1));
  fs.writeFileSync(path.join(s.dir, 'slot-1.json.tmp'), '{"half":"writ');
  const r = s.readAll();
  assert.strictEqual(goldOf(r.slots['1']), 1);
  assert.deepStrictEqual(r.notices, []);
  assert.ok(!fs.existsSync(path.join(s.dir, 'slot-1.json.tmp')), 'leftover temp file should be cleaned up');
});

test('a bad record is refused and the existing save survives', () => {
  const s = fresh();
  s.write('1', rec(1));
  for (const bad of [null, {}, { savedAt: 1, meta: {}, json: 'not json' }, { savedAt: 1, meta: {}, json: '{"party":[]}' }, { savedAt: 'x', meta: {}, json: '{}' }]) assert.strictEqual(s.write('1', bad).ok, false);
  assert.strictEqual(goldOf(s.readAll().slots['1']), 1);
});

test('an oversized save is refused', () => {
  const s = fresh();
  const big = rec(1); big.json = JSON.stringify({ party: [{}], pad: 'x'.repeat(6 * 1024 * 1024) });
  assert.strictEqual(s.write('1', big).ok, false);
});

test('a write that cannot complete reports failure and leaves the save readable', () => {
  const s = fresh();
  s.write('1', rec(1));
  fs.mkdirSync(path.join(s.dir, 'slot-1.json.tmp')); // A folder in the way makes opening the temp file fail.
  const res = s.write('1', rec(2));
  assert.strictEqual(res.ok, false);
  assert.ok(res.error);
  assert.strictEqual(goldOf(s.readRecord(path.join(s.dir, 'slot-1.json'))), 1);
});

test('deleting removes the save and its backup', () => {
  const s = fresh();
  s.write('3', rec(1)); s.write('3', rec(2));
  assert.ok(s.remove('3').ok);
  assert.deepStrictEqual(fs.readdirSync(s.dir), []);
  assert.strictEqual(s.readAll().slots['3'], undefined);
  assert.ok(s.remove('3').ok, 'deleting an empty slot is fine');
});

test('a save folder that does not exist yet is created', () => {
  const s = new SaveStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'oath-store-')), 'a', 'b'));
  assert.deepStrictEqual(s.readAll(), { slots: {}, notices: [] });
  assert.ok(s.write('auto', rec(1)).ok);
});
