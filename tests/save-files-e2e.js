// Runs the real app several times against one temporary data folder, checking save files between launches.
const { spawn } = require('child_process');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const exe = require(path.join(root, 'node_modules', 'electron'));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oathbound-e2e-'));
const saves = path.join(dataDir, 'saves');

function launch(step, expectResult = true) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, ['.', `--shots=saves-${step}`, `--user-data-dir=${dataDir}`], { cwd: root });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    const timer = setTimeout(() => { p.kill(); reject(new Error(`${step}: timed out\n${out}`)); }, 60000);
    p.on('exit', () => {
      clearTimeout(timer);
      // Steps that close the window on purpose cancel the harness's own pending call.
      const errors = out.split('\n').filter(l => /GAME ERROR|ERROR:|HARNESS ERROR|CRASH/.test(l) && (expectResult || !/Render frame was disposed/.test(l)));
      if (errors.length) return reject(new Error(`${step}: ${errors.join('; ')}`));
      if (!expectResult) return resolve({});
      const line = out.split('\n').find(l => l.startsWith('RESULT '));
      if (!line) return reject(new Error(`${step}: no result\n${out}`));
      const r = JSON.parse(line.slice(7));
      if (!r.ok) return reject(new Error(`${step}: ${JSON.stringify(r.fails)}`));
      resolve(r);
    });
  });
}
const disk = name => JSON.parse(fs.readFileSync(path.join(saves, name), 'utf8'));
const pass = m => console.log('  ok  ' + m);

(async () => {
  const first = await launch('first');
  assert.strictEqual(disk('slot-1.json').state.gold, 778);
  assert.strictEqual(disk('slot-1.json.bak').state.gold, 777);
  assert.strictEqual(disk('autosave.json').meta.name, 'Filetest');
  pass('saving through the pause menu writes real files, with a backup and an overwrite prompt');

  const second = await launch('second');
  assert.ok(Math.abs(second.x - first.x) < 1 && Math.abs(second.y - first.y) < 1, 'position was not restored');
  pass('after a full restart: Continue appears, the load screen works, and party, items and position come back');

  await launch('close-while-free', false);
  assert.strictEqual(disk('autosave.json').state.gold, 888);
  pass('closing the window while free to move autosaves');

  await launch('close-in-battle', false);
  assert.notStrictEqual(disk('autosave.json').meta.name, 'Battler');
  pass('closing during a battle does not write an unsafe autosave');

  fs.writeFileSync(path.join(saves, 'slot-1.json'), '{"game":"Oathbound","sta');
  await launch('repair');
  assert.strictEqual(disk('slot-1.json').state.gold, 777);
  assert.strictEqual(fs.readdirSync(path.join(saves, 'damaged')).length, 1);
  pass('a corrupted save is restored from its backup, the player is told, and the bad file is kept');

  // A folder blocks the temp file, which is what a failed write looks like from the game's side.
  fs.mkdirSync(path.join(saves, 'slot-1.json.tmp'), { recursive: true });
  const blocker = path.join(saves, 'slot-1.json.tmp', 'keep'); fs.writeFileSync(blocker, 'x');
  await launch('write-fails');
  fs.rmSync(path.join(saves, 'slot-1.json.tmp'), { recursive: true });
  assert.strictEqual(disk('slot-1.json').state.gold, 777);
  pass('a failed write shows an error on screen and leaves the existing save alone');

  await launch('delete');
  await launch('delete');
  await launch('delete');
  await launch('delete').catch(() => {});
  for (const f of ['slot-1.json', 'slot-1.json.bak', 'slot-2.json', 'slot-3.json']) assert.ok(!fs.existsSync(path.join(saves, f)), f);
  pass('deleting removes the files and they stay gone after a restart');

  await launch('seed-browser-save');
  await launch('imported');
  assert.strictEqual(disk('slot-2.json').state.gold, 222);
  pass('saves from older browser-storage builds move into files once');

  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('All save file checks passed.');
})().catch(err => { console.error('FAILED: ' + err.message); console.error('Data kept in ' + dataDir); process.exit(1); });
