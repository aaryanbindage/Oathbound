// Black-box check of a built app, with no test code inside it: real key events over the Chrome debugging protocol.
// Usage: node tests/test-built-app.js <path to Oathbound.exe>
const { spawn } = require('child_process');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const exe = process.argv[2];
const port = 9300 + Math.floor(Math.random() * 500);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oathbound-built-'));
const saves = path.join(dataDir, 'saves');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open() {
  const proc = spawn(exe, [`--remote-debugging-port=${port}`, `--user-data-dir=${dataDir}`], { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 80 && !page; i++) {
    await sleep(250);
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch (e) { /* still starting */ }
  }
  assert.ok(page, 'the app window never appeared');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const waiting = new Map(), errors = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise(r => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('Runtime.enable');
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(expr + ': ' + r.result.exceptionDetails.text);
    return r.result.result.value;
  };
  const key = async (code, k = '') => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k || code, windowsVirtualKeyCode: { Enter: 13, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, KeyC: 67, KeyX: 88 }[code] });
    await sleep(70);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k || code });
    await sleep(70);
  };
  const until = async (expr, what, pressEnter) => {
    for (let i = 0; i < 400; i++) {
      if (await ev(expr)) return;
      if (pressEnter) await key('Enter'); else await sleep(100);
    }
    throw new Error('Timed out waiting for: ' + what);
  };
  const exited = new Promise(r => proc.on('exit', r));
  // systemQuit asks macOS to quit the app, the same request Cmd+Q and the Dock send.
  const close = async systemQuit => {
    if (systemQuit && process.platform === 'darwin') spawn('osascript', ['-e', 'tell application id "com.aaryanbindage.oathbound" to quit'], { stdio: 'ignore' });
    else await ev('window.desktop.quit()').catch(() => {});
    const left = await Promise.race([exited.then(() => true), sleep(15000).then(() => false)]);
    try { proc.kill(); } catch (e) { /* gone */ }
    assert.ok(left, 'the app should exit when it is closed');
    await sleep(500);
  };
  return { ev, key, until, errors, close, exited };
}

(async () => {
  let a = await open();
  await a.until('typeof Game === "object" && Game.scene === TitleScene', 'title screen');
  assert.strictEqual(await a.ev('typeof Harness'), 'undefined', 'test harness must not ship');
  assert.strictEqual(await a.ev('typeof window.desktop.shot'), 'undefined', 'test hooks must not ship');
  assert.strictEqual(await a.ev('typeof require'), 'undefined', 'the game must not have Node access');
  assert.ok(await a.ev('canvas.width === 960'), 'expected the 960x540 renderer');
  assert.ok(await a.ev('Sfx.ac === null'), 'audio should wait for a key press');
  assert.ok(await a.ev('new Set(canvas.getContext("2d").getImageData(0, 0, 960, 540).data.filter((_, i) => i % 4000 === 0)).size > 5'), 'the title screen should be drawn');
  console.log('  ok  launches to the title, with no test code or Node access');

  await a.key('Enter');
  await a.until('Game.scene === CreateScene && !Game.script', 'creation screen');
  for (let i = 0; i < 8; i++) await a.key('ArrowRight');
  assert.strictEqual(await a.ev('ORDERS[CreateScene.i].id'), 'stoneward');
  await a.key('Enter'); await a.key('Enter');
  await a.until('Game.scene === FieldScene && !Game.script', 'first playable moment', true);
  assert.strictEqual(await a.ev('S.party[0].order'), 'stoneward');
  assert.ok(await a.ev('!!Sfx.ac'), 'audio should have started');
  const heroName = await a.ev('S.party[0].name');
  console.log('  ok  key presses go from New Oath through creation into the game');

  await a.key('KeyC');
  await a.until('Game.scene === MenuScene', 'pause menu');
  await a.key('ArrowLeft');
  await a.until('Menu.tabs[Menu.tab] === "System"', 'System tab');
  await a.key('Enter');
  await a.until('Game.scene === SaveScene', 'save screen');
  await a.key('Enter');
  await a.until('SaveScene.msg.startsWith("Saved")', 'saved message');
  const onDisk = JSON.parse(fs.readFileSync(path.join(saves, 'slot-1.json'), 'utf8'));
  assert.strictEqual(onDisk.state.party[0].name, heroName);
  console.log('  ok  saving from the menu writes ' + path.join('saves', 'slot-1.json'));
  await a.key('KeyX'); await a.key('KeyX');
  await a.until('Game.scene === FieldScene', 'back to the game');
  await a.close(true);
  assert.ok(fs.existsSync(path.join(saves, 'autosave.json')), 'closing while free to move should autosave');
  assert.ok(fs.existsSync(path.join(dataDir, 'window.json')), 'window size should be remembered');
  console.log('  ok  closing the window autosaves and remembers the window size');

  a = await open();
  await a.until('typeof Game === "object" && Game.scene === TitleScene', 'title after restart');
  assert.strictEqual(await a.ev('TitleScene.opts[0]'), 'Continue');
  await a.key('Enter');
  await a.until('Game.scene === FieldScene && !Game.script && Game.fade === 0', 'loaded game');
  assert.strictEqual(await a.ev('S.party[0].name'), heroName);
  assert.deepStrictEqual(a.errors, [], 'no script errors');
  await a.close();
  console.log('  ok  after a restart, Continue brings the character back');
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('All built app checks passed.');
  process.exit(0);
})().catch(err => { console.error('FAILED: ' + err.message); console.error('Data kept in ' + dataDir); process.exit(1); });
