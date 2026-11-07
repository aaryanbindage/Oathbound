// Plays the full game once per Order, a few at a time, each with its own temporary data folder.
// Usage: node tests/bot-all.js [skill 0-1] [comma-separated Orders]
const { spawn } = require('child_process');
const path = require('path'), os = require('os'), fs = require('fs');
const root = path.join(__dirname, '..'), exe = require(path.join(root, 'node_modules', 'electron'));
const orders = process.argv[3] ? process.argv[3].split(',') : ['windrunner', 'skybreaker', 'dustbringer', 'edgedancer', 'truthwatcher', 'lightweaver', 'elsecaller', 'willshaper', 'stoneward', 'bondsmith'];
const skill = process.argv[2] || '.3';
const results = [];
function one(order) {
  return new Promise(res => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oathbound-bot-'));
    const p = spawn(exe, ['.', `--shots=bot:${order}:${skill}`, `--user-data-dir=${dir}`], { cwd: root });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    const kill = setTimeout(() => p.kill(), 400000);
    p.on('exit', () => {
      clearTimeout(kill);
      const line = out.split('\n').find(l => l.startsWith('RESULT ')) || '';
      const errs = out.split('\n').filter(l => /ERROR|CRASH/.test(l));
      let r; try { r = JSON.parse(line.slice(7)); } catch (e) { r = { order, ok: false, log: ['no result'] }; }
      const b = (r.battles || []).map(x => `${x.name.split('+')[0]}:${Math.round(x.ticks / 60)}s`).join(' ');
      const saved = r.saves ? `saves=${r.saves.count} avg=${r.saves.avgMs}ms max=${r.saves.maxMs}ms` : '';
      console.log(`${order.padEnd(13)} ok=${r.ok} losses=${r.losses} lvl=${r.level} fights=${r.fights} ${saved} | ${b} ${(r.log || []).join(' ; ')} ${errs.join(' ; ')}`);
      results.push(r);
      fs.rm(dir, { recursive: true, force: true }, () => res());
    });
  });
}
(async () => {
  const q = orders.slice();
  await Promise.all([0, 1, 2, 3].map(async () => { while (q.length) await one(q.shift()); }));
  const good = results.filter(r => r.ok).length;
  console.log(`DONE ${good}/${orders.length} finished`);
  process.exit(good === orders.length ? 0 : 1);
})();
