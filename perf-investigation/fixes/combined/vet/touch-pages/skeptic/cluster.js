// node cluster.js <outdir> <elemKey> [thr=0.1] : single-link cluster all crops of one element by diff pct; print membership per variant
const L = require('./lib'); const path = require('path'); const [dir, e, thrS] = process.argv.slice(2); const thr = +(thrS || 0.1); const R = require(path.resolve(dir, 'result.json'));
(async () => { const items = R.log.map((x) => ({ v: x.v, r: x.r, f: path.join(dir, `${e}_${x[e]}.png`) })); const n = items.length; const par = items.map((_, i) => i);
  const find = (i) => (par[i] === i ? i : (par[i] = find(par[i]))); const D = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = await L.diff(items[i].f, items[j].f); D.push([i, j, d.pct]); if (!d.error && d.pct <= thr) par[find(i)] = find(j); }
  const cl = {}; items.forEach((it, i) => { const c = find(i); (cl[c] = cl[c] || []).push(it.v + '#' + it.r); });
  let k = 0; for (const c of Object.values(cl)) console.log(`${e} cluster${k++} (${c.length}): ${c.join(' ')}`);
})();
