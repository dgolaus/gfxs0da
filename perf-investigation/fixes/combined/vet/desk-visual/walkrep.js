// node walkrep.js <tag> <WxH> <N> <stopsCsv|all> <variant...>   (DPR env)
// Repeats the walk.js SEQUENCE (same stops, same order, same waits) N times per variant, interleaved, fresh browser each,
// then per stop: distribution of pct(>8) over within-variant pairs vs cross-variant pairs. Tests history-dependent states.
const fs = require('fs'); const path = require('path');
const { L, withPage, out } = require('./dv');
const [tag, vp, nS, stopsS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number); const N = +nS; const DPR = +(process.env.DPR || 1);
const OUT = out(`walkrep_${tag}`);
(async () => {
  const runs = []; let stops = null; const keep = stopsS === 'all' ? null : new Set(stopsS.split(',').map(Number));
  for (let k = 0; k < N; k++) for (const v of vars) {
    const { r } = await withPage(v, { w: W, h: H, dpr: DPR }, async (p) => {
      await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
      if (!stops) { const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); stops = []; for (let y = 0; y < maxY; y += Math.round(H * 0.5)) stops.push(y); stops.push(maxY); }
      const shots = {};
      for (const y of stops) {
        await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
        await L.w8(1300); await L.freeze(p);
        if (!keep || keep.has(y)) { const f = path.join(OUT, `${v}_${k}_${y}.png`); await p.screenshot({ path: f }); shots[y] = f; }
        await L.unfreeze(p);
      }
      return { shots, lenis: await p.evaluate(() => !!window.lenis) };
    });
    runs.push({ v, k, ...r }); console.log(v, k, 'lenis=' + r.lenis);
  }
  const res = {};
  for (const y of Object.keys(runs[0].shots)) {
    const stat = {};
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const d = await L.diff(runs[i].shots[y], runs[j].shots[y]);
      const key = runs[i].v === runs[j].v ? `within:${runs[i].v}` : `cross:${[runs[i].v, runs[j].v].sort().join('|')}`;
      (stat[key] = stat[key] || []).push(d.pct);
    }
    res[y] = Object.fromEntries(Object.entries(stat).map(([k, a]) => [k, { n: a.length, min: Math.min(...a), max: Math.max(...a), mean: +(a.reduce((x, z) => x + z, 0) / a.length).toFixed(3) }]));
    console.log(`y=${y}`, Object.entries(res[y]).map(([k, s]) => `${k} ${s.min}..${s.max} (mean ${s.mean}, n=${s.n})`).join(' | '));
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ tag, vp, N, DPR, stops, res }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
