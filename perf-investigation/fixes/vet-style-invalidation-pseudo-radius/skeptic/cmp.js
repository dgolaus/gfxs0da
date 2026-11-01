// node cmp.js <prefix e.g. index_1440>  -> compares A vs B (noise), A vs prad, A vs pradf, B vs prad/pradf
// A diff (state,key,prop) is "real" if it differs from BOTH A and B and A==B for it.
const fs = require('fs'); const path = require('path');
const D = path.join(__dirname, 'comp');
const pre = process.argv[2];
const load = (l) => {
  const j = JSON.parse(fs.readFileSync(path.join(D, `comp_${pre}_${l}.json`), 'utf8'));
  const { pv, el } = j.__tbl; const st = {};
  for (const s of Object.keys(j)) { if (s.startsWith('__')) continue; st[s] = {}; for (const [k, id] of Object.entries(j[s])) st[s][k] = id; }
  const expand = (id) => { const m = {}; for (const x of el[id].split(',')) { const s = pv[+x]; const i = s.indexOf('='); m[s.slice(0, i)] = s.slice(i + 1); } return m; };
  const val = (s, k) => { const id = st[s] && st[s][k]; if (id === undefined) return undefined; return expand(id); };
  const str = (s, k) => { const id = st[s] && st[s][k]; return id === undefined ? undefined : el[id]; };
  return { st, val, str, tabs: j.__tabs, errs: j.__errs, raw: (s, k) => { const id = st[s][k]; return id === undefined ? undefined : el[id].split(',').map((x) => pv[+x]).join('\n'); } };
};
const A = load('A'), B = load('B');
const out = { pre, tabs: {}, errs: {}, summary: {} };
function pairDiff(X, Y, s) {
  const res = []; const keys = new Set([...Object.keys(X.st[s] || {}), ...Object.keys(Y.st[s] || {})]);
  for (const k of keys) {
    const x = X.raw(s, k), y = Y.raw(s, k);
    if (x === y) continue;
    if (x === undefined || y === undefined) { res.push({ k, prop: '<presence>', x: x === undefined ? 'absent' : 'present', y: y === undefined ? 'absent' : 'present' }); continue; }
    const mx = X.val(s, k), my = Y.val(s, k);
    for (const p of new Set([...Object.keys(mx), ...Object.keys(my)])) if (mx[p] !== my[p]) res.push({ k, prop: p, x: mx[p], y: my[p] });
  }
  return res;
}
for (const vn of ['pradf']) {
  const V = load(vn); out.tabs[vn] = V.tabs; out.errs[vn] = V.errs;
  out.summary[vn] = {};
  for (const s of Object.keys(A.st)) {
    const noise = new Set(pairDiff(A, B, s).map((d) => d.k + '|' + d.prop));
    const dA = pairDiff(A, V, s), dB = new Map(pairDiff(B, V, s).map((d) => [d.k + '|' + d.prop, d]));
    const real = dA.filter((d) => dB.has(d.k + '|' + d.prop) && !noise.has(d.k + '|' + d.prop));
    const radius = dA.filter((d) => /radius/.test(d.prop));
    out.summary[vn][s] = { noiseN: noise.size, vsA: dA.length, real: real.slice(0, 60).map((d) => `${d.k.split('/').slice(-2).join('/')} ${d.prop}: ${d.x} -> ${d.y}`), realN: real.length, realProps: real.reduce((h, d) => { h[d.prop] = (h[d.prop] || 0) + 1; return h; }, {}), realHosts: [...new Set(real.map((d) => d.k.split('/').slice(-1)[0]))].slice(0, 40), radiusAny: radius.slice(0, 20).map((d) => `${d.k.split('/').slice(-1)} ${d.prop}: ${d.x} -> ${d.y}`) };
  }
}
out.tabs.A = A.tabs; out.errs.A = A.errs; out.errs.B = B.errs;
fs.writeFileSync(path.join(D, `cmp_${pre}.json`), JSON.stringify(out, null, 1));
for (const vn of ['pradf']) {
  const rows = Object.entries(out.summary[vn]).map(([s, r]) => `${s}:${r.realN}${r.radiusAny.length ? '(R' + r.radiusAny.length + ')' : ''}`);
  console.log(pre, vn, 'real diffs per state:', rows.join(' '));
}
