// node pairs.js <outdir> : pairwise diff pct of crops per element from iahash result; groups by variant.
const L = require('./lib'); const path = require('path'); const dir = process.argv[2]; const R = require(path.resolve(dir, 'result.json'));
(async () => { const els = Object.keys(R.log[0]).filter((k) => /^e\d+$/.test(k)); const vs = [...new Set(R.log.map((x) => x.v))];
  for (const e of els) { const items = R.log.map((x) => ({ v: x.v, r: x.r, f: path.join(dir, `${e}_${x[e]}.png`), rc: x['r' + e.slice(1)] }));
    const M = {}; const dd = {};
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j]; if (a.v !== 'baseline' && b.v !== 'baseline') continue;
      const d = await L.diff(a.f, b.f); const k = a.v === 'baseline' && b.v === 'baseline' ? 'baseline~baseline' : (a.v === 'baseline' ? b.v : a.v) + '~baseline'; (M[k] = M[k] || []).push(d.error ? 'size' : d.pct); }
    const out = Object.entries(M).map(([k, a]) => `${k}: min ${Math.min(...a.filter(Number.isFinite))} max ${Math.max(...a.filter(Number.isFinite))} n=${a.length}`);
    console.log(e, 'rects:', [...new Set(items.map((x) => x.rc))].length, 'distinct'); out.forEach((s) => console.log('   ', s)); }
})();
