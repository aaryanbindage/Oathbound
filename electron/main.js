'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SaveStore } = require('./saves');

// Developer-only test switches. They do nothing in a packaged build.
const argv = process.argv;
const botMode = !app.isPackaged && argv.includes('--bot');
const shotArg = !app.isPackaged && argv.find(a => a.startsWith('--shots='));
const testMode = botMode || !!shotArg;
const outDir = path.join(__dirname, '..', 'test-output');

// Tests must never read or write the player's real saves.
if (testMode && !argv.some(a => a.startsWith('--user-data-dir='))) {
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'oathbound-test-')));
}

let win = null;
let store = null;

// ---------- log file ----------
function logLine(msg) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs'), file = path.join(dir, 'oathbound.log');
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > 1024 * 1024) fs.renameSync(file, file + '.old');
    fs.appendFileSync(file, `${new Date().toISOString()} ${msg}\n`);
  } catch (err) { /* logging must never take the game down */ }
}

// ---------- window size and position ----------
const windowFile = () => path.join(app.getPath('userData'), 'window.json');
function loadWindowState() {
  const fallback = { width: 1280, height: 720 };
  try {
    const s = JSON.parse(fs.readFileSync(windowFile(), 'utf8'));
    if (!(s.width >= 640 && s.height >= 360)) return fallback;
    // A monitor may have been unplugged since last time: only reuse a position that is still on screen.
    if (typeof s.x === 'number' && typeof s.y === 'number') {
      const a = screen.getDisplayMatching({ x: s.x, y: s.y, width: s.width, height: s.height }).workArea;
      const visible = s.x < a.x + a.width - 80 && s.x + s.width > a.x + 80 && s.y >= a.y - 8 && s.y < a.y + a.height - 80;
      if (!visible) { delete s.x; delete s.y; }
    }
    return s;
  } catch (err) { return fallback; }
}
function saveWindowState() {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(windowFile(), JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized(), fullscreen: win.isFullScreen() }));
  } catch (err) { logLine('Could not store window state: ' + err.message); }
}

// ---------- calls from the game ----------
// Saves are synchronous on purpose: "Saved" on screen means the file is already on disk.
function registerIpc() {
  ipcMain.on('saves:readAll', e => { try { e.returnValue = store.readAll(); } catch (err) { logLine('Save read failed: ' + err.message); e.returnValue = { slots: {}, notices: [], error: err.message }; } });
  ipcMain.on('saves:write', (e, id, rec) => { const r = store.write(id, rec); if (!r.ok) logLine(`Save to ${id} failed: ${r.error}`); e.returnValue = r; });
  ipcMain.on('saves:remove', (e, id) => { const r = store.remove(id); if (!r.ok) logLine(`Delete of ${id} failed: ${r.error}`); e.returnValue = r; });
  ipcMain.on('saves:openFolder', () => { shell.openPath(store.dir); });
  ipcMain.on('window:toggleFullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });
  ipcMain.on('app:quit', () => { if (win) win.close(); });
  ipcMain.on('game:fatal', (_e, msg) => { logLine('Game error: ' + msg); offerRestart('Oathbound hit an unexpected error.'); });
  ipcMain.handle('test:shot', async (_e, name) => {
    if (!testMode) return;
    win.webContents.invalidate();
    await new Promise(r => setTimeout(r, 120));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, name + '.png'), img.toPNG());
  });
}

let restartOpen = false;
async function offerRestart(message) {
  if (testMode) { console.log('GAME ERROR ' + message); return; }
  if (restartOpen || !win || win.isDestroyed()) return;
  restartOpen = true;
  const { response } = await dialog.showMessageBox(win, {
    type: 'error', title: 'Oathbound', message,
    detail: 'Your save files are safe. Anything since your last save or autosave was lost.\n\nDetails are in: ' + path.join(app.getPath('userData'), 'logs'),
    buttons: ['Restart game', 'Quit'], defaultId: 0, cancelId: 1, noLink: true
  });
  restartOpen = false;
  if (!win || win.isDestroyed()) return;
  if (response === 0) win.reload(); else win.close();
}

// ---------- window ----------
function createWindow() {
  // A Mac app gets Cmd+Q, Cmd+H and Ctrl+Cmd+F from its menu bar, so it keeps a small one.
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { label: 'View', submenu: [{ role: 'togglefullscreen' }] }, { role: 'windowMenu' }]) : null);
  const state = testMode ? { width: 1280, height: 720 } : loadWindowState();
  win = new BrowserWindow({
    x: state.x, y: state.y, width: state.width, height: state.height, minWidth: 640, minHeight: 360,
    backgroundColor: '#05070f', title: 'Oathbound', icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false, useContentSize: true, fullscreen: !!state.fullscreen,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: testMode ? ['--oathbound-test'] : [],
      offscreen: testMode
    }
  });
  if (state.maximized) win.maximize();
  if (!testMode) win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'game-separate-files', 'index.html'));

  // The game is entirely local: it never navigates away or opens other windows.
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F11' || (input.key === 'Enter' && input.alt))) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  win.webContents.on('render-process-gone', (_e, d) => {
    logLine('Renderer stopped: ' + d.reason);
    if (testMode) { console.log('CRASH ' + d.reason); app.exit(2); return; }
    if (d.reason !== 'clean-exit') offerRestart('Oathbound stopped unexpectedly.');
  });
  win.on('close', saveWindowState);
  win.on('closed', () => { win = null; });
  if (testMode) runHarness(win);
}

// ---------- developer test harness ----------
async function runHarness(w) {
  fs.mkdirSync(outDir, { recursive: true });
  w.webContents.on('console-message', (_e, _l, msg) => { if (!/Security Warning/.test(msg)) console.log('[game] ' + msg); });
  await new Promise(r => w.webContents.once('did-finish-load', r));
  const scenario = botMode ? 'bot' : shotArg.split('=')[1];
  try {
    await w.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, '..', 'tests', 'harness.js'), 'utf8'));
    const res = await w.webContents.executeJavaScript(`Harness.run(${JSON.stringify(scenario)})`);
    console.log('RESULT ' + JSON.stringify(res));
    app.exit(res && res.ok === false ? 1 : 0);
  } catch (err) {
    console.log('HARNESS ERROR ' + err);
    app.exit(1);
  }
}

// ---------- app lifecycle ----------
// Two running copies could overwrite each other's saves, so a second launch just focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  process.on('uncaughtException', err => { logLine('Main process error: ' + (err && err.stack || err)); });
  app.whenReady().then(() => {
    store = new SaveStore(path.join(app.getPath('userData'), 'saves'));
    registerIpc();
    createWindow();
  });
  // The game is its one window, so closing it quits on every system, including macOS.
  app.on('window-all-closed', () => app.quit());
}
