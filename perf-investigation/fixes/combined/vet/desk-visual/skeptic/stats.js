// node stats.js <dir> <N> <left,top,width,height|full> <variant...> -- pairwise within/cross diffs of <v>_<k>.png in dir
const path = require('path'); const L = require('../../lib');
const [dir, nS, regS, ...vars] = process.argv.slice(2); const N = +nS;
const reg = regS === 'full' ? null : (([left, top, width, height]) => ({ left, top, width, height }))(regS.split(',').map(Number));
(async () => {
  const shots = []; for (let k = 0; k < N; k++) for (const v of vars) shots.push({ v, k, f: path.join(dir, `${v}_${k}.png`) });
  const within = {}, cross = {};
  for (let i = 0; i < shots.length; i++) for (let j = i + 1; j < shots.length; j++) {
    const a = shots[i], b = shots[j]; const d = await L.diff(a.f, b.f, null, reg);
    if (a.v === b.v) (within[a.v] = within[a.v] || []).push(d.pct); else { const kk = [a.v, b.v].sort().join('|'); (cross[kk] = cross[kk] || []).push(d.pct); }
  }
  const st = (xs) => ({ n: xs.length, min: Math.min(...xs), max: Math.max(...xs), mean: +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(3), all: xs });
  console.log('REGION', JSON.stringify(reg));
  for (const [k, x] of Object.entries(within)) console.log('WITHIN', k, JSON.stringify(st(x)));
  for (const [k, x] of Object.entries(cross)) console.log('CROSS', k, JSON.stringify(st(x)));
})();
