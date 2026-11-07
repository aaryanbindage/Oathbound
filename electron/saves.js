'use strict';
// Save files on disk. Plain Node so it can be unit tested without Electron.
//
// Each slot is one readable JSON file, written to a temp file, flushed, then renamed into place, so a
// crash or power cut mid-save leaves the previous save whole. The previous version is kept as <file>.bak.
// A file that can't be read is moved to damaged/ (never deleted) and its backup takes over.
const fs = require('fs');
const path = require('path');

const FORMAT = 1;
const MAX_BYTES = 5 * 1024 * 1024;
const SLOT_FILES = { auto: 'autosave.json', 1: 'slot-1.json', 2: 'slot-2.json', 3: 'slot-3.json' };

function sleepSync(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// Antivirus and search indexers briefly lock new files on Windows, so renames get a few quick retries.
function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(from, to); return; } catch (err) {
      if (attempt >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      sleepSync(25 * (attempt + 1));
    }
  }
}

function writeDurably(file, text) {
  const fd = fs.openSync(file, 'w');
  try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function isObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

class SaveStore {
  constructor(dir) { this.dir = dir; }

  fileFor(id) {
    if (!Object.prototype.hasOwnProperty.call(SLOT_FILES, id)) throw new Error('Unknown save slot: ' + id);
    return path.join(this.dir, SLOT_FILES[id]);
  }

  // Turns file text into the record the game uses. Throws if the file isn't a usable save.
  parse(text) {
    const d = JSON.parse(text);
    if (!isObject(d) || typeof d.format !== 'number' || typeof d.savedAt !== 'number' || !isObject(d.meta) || !isObject(d.state)) throw new Error('Not a save file');
    if (!Array.isArray(d.state.party) || !d.state.party.length) throw new Error('Save has no party');
    return { savedAt: d.savedAt, meta: d.meta, json: JSON.stringify(d.state) };
  }

  readRecord(file) { return this.parse(fs.readFileSync(file, 'utf8')); }

  quarantine(id, file) {
    try {
      const dir = path.join(this.dir, 'damaged');
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      renameWithRetry(file, path.join(dir, `${path.basename(file, '.json')}-${stamp}.json`));
    } catch (err) { /* If it can't be moved it stays in place, and the next read reports it again. */ }
  }

  // Returns { slots, notices }. Notices tell the player about any save that needed repair.
  readAll() {
    const slots = {}, notices = [];
    fs.mkdirSync(this.dir, { recursive: true });
    for (const id of Object.keys(SLOT_FILES)) {
      const file = this.fileFor(id), bak = file + '.bak', hadFile = fs.existsSync(file);
      try { fs.rmSync(file + '.tmp', { force: true }); } catch (err) { /* harmless leftover */ }
      if (hadFile) {
        try { slots[id] = this.readRecord(file); continue; } catch (err) { this.quarantine(id, file); }
      }
      if (fs.existsSync(bak)) {
        try {
          slots[id] = this.readRecord(bak);
          fs.copyFileSync(bak, file);
          notices.push({ id, kind: 'restored' });
          continue;
        } catch (err) { /* backup unusable too: reported below when a save was expected */ }
      }
      if (hadFile) notices.push({ id, kind: 'damaged' });
    }
    return { slots, notices };
  }

  write(id, rec) {
    try {
      const file = this.fileFor(id);
      if (!isObject(rec) || typeof rec.savedAt !== 'number' || !isObject(rec.meta) || typeof rec.json !== 'string') throw new Error('Bad save record');
      const state = JSON.parse(rec.json);
      const text = JSON.stringify({ game: 'Oathbound', format: FORMAT, savedAt: rec.savedAt, savedAtText: new Date(rec.savedAt).toISOString(), meta: rec.meta, state }, null, 1);
      if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('Save is too large');
      this.parse(text); // Never replace a good save with something this code couldn't read back.
      fs.mkdirSync(this.dir, { recursive: true });
      const tmp = file + '.tmp';
      writeDurably(tmp, text);
      if (fs.existsSync(file)) {
        // Only a readable save becomes the backup, so a damaged file can't overwrite a good backup.
        let good = false;
        try { this.readRecord(file); good = true; } catch (err) { this.quarantine(id, file); }
        if (good) { fs.copyFileSync(file, tmp + '.bak'); renameWithRetry(tmp + '.bak', file + '.bak'); }
      }
      renameWithRetry(tmp, file);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) };
    }
  }

  remove(id) {
    try {
      const file = this.fileFor(id);
      for (const f of [file, file + '.bak', file + '.tmp']) fs.rmSync(f, { force: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) };
    }
  }
}

module.exports = { SaveStore, SLOT_FILES, FORMAT };
