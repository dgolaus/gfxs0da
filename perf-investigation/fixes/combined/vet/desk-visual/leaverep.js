// node leaverep.js <tag> <WxH> <N> <leavesCsv> <variant...>
// #pricing fade-out states: scroll so #pricing.bottom = 0.30*vh*(1-l), freeze, full-viewport shot. N interleaved fresh
// loads per variant; per state: pairwise pct(>8) within-variant vs cross-variant, plus computed filter/--leave.
const fs = require('fs'); const path = require('path');
const { L, withPage, out } = require('./dv');
const [tag, vp, nS, lS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number); const N = +nS; const LV = lS.split(',').map(Number);
const OUT = out(`leaverep_${tag}`);
(async () => {
  const runs = [];
  for (let k = 0; k < N; k++) for (const v of vars) {
    const { r } = await withPage(v, { w: W, h: H }, async (p) => {
      await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
      await p.mouse.move(W - 3, 3);
      const g = await p.evaluate(() => { const r = document.getElementById('pricing').getBoundingClientRect(); return { bottom: r.bottom + scrollY, max: document.documentElement.scrollHeight - innerHeight }; });
      const shots = {}; const meta = {};
      for (const l of LV) {
        const y = Math.min(g.max, Math.round(g.bottom - H * 0.30 * (1 - l)));
        await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
        await L.w8(1300); await L.freeze(p);
        const f = path.join(OUT, `${v}_${k}_${l}.png`); await p.screenshot({ path: f }); shots[l] = f;
        meta[l] = await p.evaluate(() => { const s = document.getElementById('pricing'); const cs = getComputedStyle(s); return { sy: scrollY, leave: parseFloat(cs.getPropertyValue('--leave')), filter: cs.filter, contain: cs.contain }; });
        await L.unfreeze(p);
      }
      return { shots, meta };
    });
    runs.push({ v, k, ...r }); console.log(v, k, JSON.stringify(r.meta));
  }
  const res = {};
  for (const l of LV) {
    const stat = {};
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const d = await L.diff(runs[i].shots[l], runs[j].shots[l]);
      const key = runs[i].v === runs[j].v ? `within:${runs[i].v}` : `cross:${[runs[i].v, runs[j].v].sort().join('|')}`;
      (stat[key] = stat[key] || []).push(d.pct);
    }
    res[l] = Object.fromEntries(Object.entries(stat).map(([k, a]) => [k, { n: a.length, min: Math.min(...a), max: Math.max(...a), mean: +(a.reduce((x, z) => x + z, 0) / a.length).toFixed(3) }]));
    console.log(`leave=${l}`, Object.entries(res[l]).map(([k, s]) => `${k} ${s.min}..${s.max} (n=${s.n})`).join(' | '));
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ tag, vp, N, LV, res, meta: runs.map((r) => ({ v: r.v, k: r.k, meta: r.meta })) }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
