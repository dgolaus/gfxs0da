// node reststates.js <outdir> : for each element, compare every non-baseline REST crop (before/cleared/rescrolled) with the pool of ALL baseline rest crops; report min pct.
const L = require('./lib'); const path = require('path'); const dir = process.argv[2]; const R = require(path.resolve(dir, 'result.json'));
(async () => { const els = [...new Set(Object.keys(R.log[0]).filter((k) => /^e\d+_before$/.test(k)).map((k) => k.split('_')[0]))];
  for (const e of els) { const phases = ['before', 'cleared', 'rescrolled'].filter((ph) => (e + '_' + ph) in R.log[0]);
    const pool = new Set(); for (const x of R.log) if (x.v === 'baseline' || x.v === 'commentonly' || x.v === 'nopcss') for (const ph of phases) pool.add(`${e}_${ph}_${x[e + '_' + ph]}.png`);
    for (const x of R.log) { if (x.v === 'baseline') continue; for (const ph of phases) { const f = `${e}_${ph}_${x[e + '_' + ph]}.png`; let best = 1e9, bf = null;
      for (const q of pool) { const d = await L.diff(path.join(dir, q), path.join(dir, f)); if (!d.error && d.pct < best) { best = d.pct; bf = q; } }
      console.log(`${e} ${x.v}#${x.r} ${ph}: min pct vs baseline rest pool = ${best} (${bf})`); } } }
})();
