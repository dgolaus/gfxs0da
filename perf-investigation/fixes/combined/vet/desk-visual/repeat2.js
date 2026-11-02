// node repeat2.js <tag> <WxH> <y> <N> <variant...>    (DPR env for device scale)
// N interleaved fresh loads per variant, walk-style scroll+freeze, full-viewport shot. Then ALL pairwise diffs:
// within-variant pairs (A/A style noise distribution) vs cross-variant pairs. Also logs #pricing / footer rects.
const fs = require('fs'); const path = require('path');
const { L, withPage, out } = require('./dv');
const [tag, vp, yS, nS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number); const Y = +yS; const N = +nS; const DPR = +(process.env.DPR || 1);
const OUT = out(`repeat2_${tag}`);
(async () => {
  const shots = []; const geo = {};
  for (let k = 0; k < N; k++) for (const v of vars) {
    const f = path.join(OUT, `${v}_${k}.png`);
    const { r } = await withPage(v, { w: W, h: H, dpr: DPR }, async (p) => {
      await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, Y);
      await L.w8(1300); await L.freeze(p);
      await p.screenshot({ path: f });
      return p.evaluate(() => { const g = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top * 10) / 10, Math.round(r.bottom * 10) / 10]; };
        return { lenis: !!window.lenis, sy: scrollY, pricing: g('#pricing'), grid: g('#pricing .pricing-grid'), contact: g('#contact'), main: g('main'), contain: getComputedStyle(document.getElementById('pricing')).contain }; });
    });
    shots.push({ v, k, f }); geo[`${v}_${k}`] = r; console.log(v, k, JSON.stringify(r));
  }
  const pairs = [];
  for (let i = 0; i < shots.length; i++) for (let j = i + 1; j < shots.length; j++) {
    const d = await L.diff(shots[i].f, shots[j].f);
    pairs.push({ a: `${shots[i].v}_${shots[i].k}`, b: `${shots[j].v}_${shots[j].k}`, same: shots[i].v === shots[j].v ? shots[i].v : null, ...d });
  }
  const stat = {};
  for (const p of pairs) { const key = p.same ? `within:${p.same}` : `cross:${[p.a.split('_')[0], p.b.split('_')[0]].sort().join('|')}`; (stat[key] = stat[key] || []).push(p.pct); }
  const summ = Object.fromEntries(Object.entries(stat).map(([k, a]) => [k, { n: a.length, min: Math.min(...a), max: Math.max(...a), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) }]));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ tag, vp, Y, N, DPR, summ, geo, pairs }, null, 1));
  console.log('SUMMARY pct>8 per pair class', JSON.stringify(summ, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
