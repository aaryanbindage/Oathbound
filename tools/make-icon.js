// Draws the app icon (a ring of ten lights around a blade): build/icon.png (512px) and build/icon.ico.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const N = 256, px = Buffer.alloc(N * N * 4);
const put = (x, y, r, g, b, a = 255) => {
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = (Math.floor(y) * N + Math.floor(x)) * 4, k = a / 255;
  px[i] = px[i] * (1 - k) + r * k; px[i + 1] = px[i + 1] * (1 - k) + g * k; px[i + 2] = px[i + 2] * (1 - k) + b * k; px[i + 3] = Math.max(px[i + 3], a);
};
const cell = 4; // chunky pixels, to match the game
const block = (x, y, r, g, b, a) => { const X = Math.floor(x / cell) * cell, Y = Math.floor(y / cell) * cell; for (let j = 0; j < cell; j++) for (let i = 0; i < cell; i++) put(X + i, Y + j, r, g, b, a); };
const c = N / 2;
for (let y = 0; y < N; y += cell) for (let x = 0; x < N; x += cell) {
  const d = Math.hypot(x - c, y - c);
  if (d > 124) continue;
  const t = d / 124;
  block(x, y, 12 + 30 * (1 - t), 18 + 40 * (1 - t), 48 + 70 * (1 - t), 255);
}
for (let a = 0; a < 6.283; a += .01) block(c + Math.cos(a) * 118, c + Math.sin(a) * 118, 232, 200, 119, 255);
for (let i = 0; i < 10; i++) {
  const a = i / 10 * 6.283 - 1.5708, x = c + Math.cos(a) * 92, y = c + Math.sin(a) * 92;
  for (let q = -10; q <= 10; q += cell) for (let w = -10; w <= 10; w += cell) if (Math.abs(q) + Math.abs(w) <= 10) block(x + q, y + w, 190, 232, 255, 255);
}
for (let y = 44; y < 196; y += cell) { const w = y < 60 ? (y - 44) / 3 : 7; for (let x = -w; x <= w; x += cell) block(c + x, y, x < 0 ? 255 : 200, x < 0 ? 250 : 225, x < 0 ? 235 : 245, 255); }
for (let x = -28; x <= 28; x += cell) for (let y = 0; y < 8; y += cell) block(c + x, 168 + y, 232, 200, 119, 255);

const crcTable = []; for (let n = 0; n < 256; n++) { let k = n; for (let i = 0; i < 8; i++) k = k & 1 ? 0xEDB88320 ^ (k >>> 1) : k >>> 1; crcTable[n] = k >>> 0; }
const crc = b => { let v = 0xFFFFFFFF; for (const q of b) v = crcTable[(v ^ q) & 255] ^ (v >>> 8); return (v ^ 0xFFFFFFFF) >>> 0; };
const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
function encodePng(scale) {
  const S = N * scale, raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px.copy(raw, y * (S * 4 + 1) + 1 + x * 4, (Math.floor(y / scale) * N + Math.floor(x / scale)) * 4, (Math.floor(y / scale) * N + Math.floor(x / scale)) * 4 + 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const png256 = encodePng(1);
const head = Buffer.alloc(22); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png256.length, 14); head.writeUInt32LE(22, 18);
const out = path.join(__dirname, '..', 'build'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([head, png256]));
fs.writeFileSync(path.join(out, 'icon.png'), encodePng(2));
console.log('icon written');
