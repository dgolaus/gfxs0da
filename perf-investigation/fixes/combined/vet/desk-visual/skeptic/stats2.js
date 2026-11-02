// node stats2.js <dir> <N> <suffix> <variant...> -- pairwise diffs of <v>_<k>_<suffix>.png (whole clip), reports within/cross pct and mad
const path = require('path'); const L = require('../../lib');
const [dir, nS, suf, ...vars] = process.argv.slice(2); const N = +nS;
(async () => {
  const s = []; for (let k = 0; k < N; k++) for (const v of vars) s.push({ v, k, f: path.join(dir, `${v}_${k}_${suf}.png`) });
  const W = {}, C = {};
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { const d = await L.diff(s[i].f, s[j].f); const x = `${d.pct}/${d.big}`;
    if (s[i].v === s[j].v) (W[s[i].v] = W[s[i].v] || []).push(x); else (C[[s[i].v, s[j].v].sort().join('|')] = C[[s[i].v, s[j].v].sort().join('|')] || []).push(x); }
  console.log(suf, 'WITHIN', JSON.stringify(W)); console.log(suf, 'CROSS', JSON.stringify(C));
})();
