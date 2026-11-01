// Width sweep, in-page contain:paint toggle on the baseline page: bottom edge (2 float phases), bottom-row hover,
// scroll-fade leave 0.2/0.5. Reports whether any pixel changes. node sweep.js <width...>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const OUT = path.join(__dirname, 'out', 'sweep'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  for (const W of process.argv.slice(2).map(Number)) {
    const H = 900; const b = await L.launch(); const { p } = await L.open(b, 'baseline', { w: W, h: H });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    const g = await p.evaluate(() => { const q = document.getElementById('pricing'); const r = q.getBoundingClientRect(); return { top: r.top + scrollY, bot: r.bottom + scrollY, pb: getComputedStyle(q).paddingBottom }; });
    for (let y = g.top - H; y < g.bot; y += H / 2) { await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(300); }
    const res = [];
    const ab = async (name) => {
      const f = (s) => path.join(OUT, `${W}_${name}_${s}.png`);
      await p.screenshot({ path: f('N') }); await p.evaluate(() => { document.getElementById('pricing').style.contain = 'paint'; }); await L.w8(200);
      await p.screenshot({ path: f('C') }); await p.evaluate(() => { document.getElementById('pricing').style.contain = ''; }); await L.w8(200); await p.screenshot({ path: f('N2') });
      const n = await L.xdiff(f('N'), f('N2')), d = await L.xdiff(f('N2'), f('C'));
      res.push(`${name}:${d.px}/${d.max}(noise ${n.px})`); if (!d.px) for (const s of ['N', 'C', 'N2']) fs.unlinkSync(f(s));
    };
    await p.evaluate((y) => window.scrollTo(0, y), Math.round(g.bot - H * 0.75)); await L.w8(1200);
    for (const T of [0, 1500, 3000, 4500]) { await L.freeze(p, T); await ab(`bot${T}`); await L.unfreeze(p); }
    const n = await p.evaluate(() => document.querySelectorAll('#pricing .price-card').length);
    for (const k of [n - 1, n]) { const box = await p.evaluate((k) => { const r = document.querySelector(`#pricing .price-card:nth-child(${k})`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.min(r.bottom - 40, innerHeight - 20) }; }, k); await p.mouse.move(box.x, box.y); await L.w8(1100); await L.freeze(p, 2000); await ab(`hover${k}`); await L.unfreeze(p); await p.mouse.move(2, 2); await L.w8(800); }
    for (const lv of [0.2, 0.5]) { await p.evaluate((y) => window.scrollTo(0, y), Math.round(g.bot - H * 0.3 * (1 - lv))); await L.w8(900); await L.freeze(p, 2000); await ab(`leave${lv}`); await L.unfreeze(p); }
    console.log(`W=${W} padBottom=${g.pb} ${res.join(' ')}`);
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
