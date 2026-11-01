// In-page contain:paint toggle across fine scroll-fade --leave steps. node leavesweep.js <width...>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const OUT = path.join(__dirname, 'out', 'leavesweep'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  for (const W of process.argv.slice(2).map(Number)) {
    const H = 900; const b = await L.launch(); const { p } = await L.open(b, 'baseline', { w: W, h: H });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    const g = await p.evaluate(() => { const r = document.getElementById('pricing').getBoundingClientRect(); return { top: r.top + scrollY, bot: r.bottom + scrollY }; });
    for (let y = g.top - H; y < g.bot; y += H / 2) { await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(300); }
    const res = []; let tot = 0, maxd = 0, nz = 0;
    for (let lv = 0.02; lv < 1; lv += 0.04) {
      await p.evaluate((y) => window.scrollTo(0, y), Math.round(g.bot - H * 0.3 * (1 - lv))); await L.w8(700); await L.freeze(p, 2000);
      const f = (s) => path.join(OUT, `${W}_${lv.toFixed(2)}_${s}.png`);
      await p.screenshot({ path: f('N') }); await p.evaluate(() => { document.getElementById('pricing').style.contain = 'paint'; }); await L.w8(200);
      await p.screenshot({ path: f('C') }); await p.evaluate(() => { document.getElementById('pricing').style.contain = ''; }); await L.w8(200); await p.screenshot({ path: f('N2') });
      const n = await L.xdiff(f('N'), f('N2')), d = await L.xdiff(f('N2'), f('C'));
      const leave = await p.evaluate(() => document.getElementById('pricing').style.getPropertyValue('--leave'));
      res.push(`${leave}:${d.px}/${d.max}${n.px ? '(n' + n.px + ')' : ''}`); if (d.px) { nz++; tot = Math.max(tot, d.px); maxd = Math.max(maxd, d.max); } else for (const s of ['N', 'C', 'N2']) fs.unlinkSync(f(s));
      await L.unfreeze(p);
    }
    console.log(`W=${W} statesWithDiff=${nz}/${res.length} maxPx=${tot} maxLevel=${maxd} :: ${res.join(' ')}`);
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
