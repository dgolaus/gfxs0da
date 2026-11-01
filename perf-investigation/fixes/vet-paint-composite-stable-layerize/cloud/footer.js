// Repeated-load test of the footer title rendering after a scroll history (raster-scale/history effects).
// node footer.js <tag> <WxH> <reps> <variant...>   (baseline must be listed; runs are interleaved)
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, vp, repsS, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number);
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
async function run(v, label, mode) {
  const b = await L.launch(); const { p } = await L.open(b, v, { w: W, h: H });
  await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
  const g = await p.evaluate(() => { const r = document.getElementById('pricing').getBoundingClientRect(); return { prBot: r.bottom + scrollY, max: document.documentElement.scrollHeight - innerHeight }; });
  const stops = [0.1, 0.5, 0.9].map((lv) => Math.round(g.prBot - H * 0.30 * (1 - lv))).concat([g.max]);
  let y = await p.evaluate(() => scrollY); const shots = [];
  const go = async (target) => { const step = target > y ? 120 : -120; while (Math.abs(target - y) > 120) { y += step; await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(mode === 'fast' ? 16 : 50); } y = target; await p.evaluate((y) => window.scrollTo(0, y), y); };
  for (const [i, s] of stops.entries()) {
    await go(s); await L.w8(1500);
    const st = await p.evaluate(() => ({ sy: scrollY, fp: document.querySelector('.cfooter').style.getPropertyValue('--fp'), leave: document.getElementById('pricing').style.getPropertyValue('--leave') }));
    // freeze only CSS animations (pulse dots, marquee) at a fixed time so they do not add noise; --fp is JS and static here
    await L.freeze(p, 2000);
    const f = path.join(OUT, `${label}_${i}.png`); await p.screenshot({ path: f }); shots.push({ f, ...st });
    await L.unfreeze(p);
  }
  // scroll back up past pricing and down again to stop 0
  await go(Math.round(g.prBot - 2 * H)); await L.w8(600); await go(stops[0]); await L.w8(1500);
  await L.freeze(p, 2000); const f = path.join(OUT, `${label}_back.png`); await p.screenshot({ path: f });
  shots.push({ f, ...(await p.evaluate(() => ({ sy: scrollY, fp: document.querySelector('.cfooter').style.getPropertyValue('--fp') }))) });
  await b.close(); return shots;
}
(async () => {
  const reps = +repsS; const R = {};
  for (let r = 0; r < reps; r++) for (const v of vars) { (R[v] = R[v] || []).push(await run(v, `${v}_r${r}`, r % 2 ? 'fast' : 'slow')); }
  const keys = []; for (const v of vars) for (let r = 0; r < reps; r++) keys.push([v, r]);
  const n = R[vars[0]][0].length; const out = [];
  for (let i = 0; i < n; i++) {
    console.log(`-- stop ${i} state`, vars.map((v) => v + ':' + R[v].map((s) => s[i].sy + '/' + s[i].fp + '/' + (s[i].leave || '')).join(',')).join('  '));
    // compare all runs against baseline r0 (same mode index parity matters: r even = slow, odd = fast)
    for (const [v, r] of keys) {
      const ref = R[vars[0]][r % 2]; if (v === vars[0] && r === r % 2) continue;
      const d = await L.xdiff(ref[i].f, R[v][r][i].f, path.join(OUT, `heat_${v}_r${r}_${i}.png`));
      out.push({ stop: i, v, r, ref: `${vars[0]}_r${r % 2}`, d }); console.log(`stop ${i} ${v}_r${r} vs ${vars[0]}_r${r % 2}: ${d.px}/${d.max} ${JSON.stringify(d.bbox)}`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
