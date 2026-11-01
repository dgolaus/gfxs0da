// Cross-load confirmation with the real candidate file: band just below #pricing's bottom edge (footer top),
// final state, frozen. node xload.js <tag> <WxH> <flags> <reps> <variant...>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, vp, flagsS, repsS, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number);
const flags = new Set((flagsS || '').split(',').filter(Boolean));
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const shots = {};
  for (let r = 0; r < +repsS; r++) for (const v of vars) {
    const b = await L.launch(); const { p } = await L.open(b, v, { w: W, h: H, mobile: flags.has('mobile') });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    const g = await p.evaluate(() => { const q = document.getElementById('pricing').getBoundingClientRect(); return { top: q.top + scrollY, bot: q.bottom + scrollY }; });
    for (let y = g.top - H; y < g.bot; y += H / 2) { await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(300); }
    const y = Math.round(g.bot - H * 0.75); await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(1500);
    for (const T of [0, 2000]) {
      await L.freeze(p, T);
      const edge = await p.evaluate(() => Math.round(document.getElementById('pricing').getBoundingClientRect().bottom));
      const f = path.join(OUT, `${v}_r${r}_T${T}.png`); await p.screenshot({ path: f }); (shots[`T${T}`] = shots[`T${T}`] || []).push({ v, r, f, edge });
      await L.unfreeze(p);
    }
    await b.close();
  }
  for (const [k, arr] of Object.entries(shots)) {
    const edge = arr[0].edge; const region = { left: 0, top: edge, width: W, height: 60 };
    const ref = arr.find((s) => s.v === vars[0] && s.r === 0);
    for (const s of arr) { if (s === ref) continue; const d = await L.xdiff(ref.f, s.f, null, region); const full = await L.xdiff(ref.f, s.f); console.log(`${tag} ${k} edge=${s.edge} ${s.v}_r${s.r} vs ${vars[0]}_r0: band(below edge, 60px) ${d.px}/${d.max} ${JSON.stringify(d.bbox)} | full ${full.px}/${full.max}`); }
  }
})().catch((e) => { console.error(e); process.exit(1); });
