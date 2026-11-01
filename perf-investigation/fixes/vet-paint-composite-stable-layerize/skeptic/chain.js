// Replicates resize.js's chain (load 1600 -> 1440 -> 1024 -> 390 -> 1920, scroll walk + freeze/shot at each width)
// with alternating variant order, and at the final width logs the scrollY timeline after the last window.scrollTo,
// plus docH and section tops, to see whether/when the 2px short landing happens. node chain.js <tag> <reps>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, repsS] = process.argv.slice(2); const H = 900; const Ws = [1440, 1024, 390, 1920];
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const res = [];
  for (let r = 0; r < +repsS; r++) for (const v of (r % 2 ? ['c1440', 'baseline'] : ['baseline', 'c1440'])) {
    const b = await L.launch(); const { p } = await L.open(b, v, { w: 1600, h: H });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    await p.evaluate(() => { window.__sc = []; addEventListener('scroll', () => window.__sc.push([Math.round(performance.now()), scrollY, document.documentElement.scrollHeight])); });
    let tl = null;
    for (const W of Ws) {
      await p.setViewport({ width: W, height: H }); await L.w8(500);
      const g = await p.evaluate(() => { const q = document.getElementById('pricing').getBoundingClientRect(); return { top: q.top + scrollY, bot: q.bottom + scrollY }; });
      for (let y = g.top - H; y < g.bot; y += H / 2) { await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(250); }
      const tgt = Math.round(g.bot - H * 0.75);
      await p.evaluate(() => { window.__sc = []; window.__t0 = performance.now(); });
      await p.evaluate((y) => window.scrollTo(0, y), tgt);
      const s = []; let last = 0;
      for (const t of [0, 100, 300, 600, 1000, 1300]) { await L.w8(t - last); last = t; s.push(await p.evaluate(() => scrollY)); }
      const sc = await p.evaluate(() => window.__sc.map(([t, y, d]) => `${Math.round(t - window.__t0)}ms:${y}/${d}`));
      tl = { W, tgt, s, sc };
      await L.freeze(p, 2000); await p.screenshot({ path: path.join(OUT, 'tmp.png') }); await L.unfreeze(p);
      if (W === 1920 || s.some((y) => y !== tgt)) console.log(`${tag} ${v} r${r} W=${W} tgt=${tgt} sy: ${s.join(' ')} scrollEvents: ${sc.join(' ')}`);
    }
    res.push({ v, r, tl }); await b.close();
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
