// nav var lag (frames) distribution + accent LERP residual distribution, per variant (numeric compare)
const R = require('./out/navclicks.json');
const clamp = (v) => Math.max(0, Math.min(1, v)), ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const f = (sy) => { const p = ease(clamp(sy / 360)); return [p, clamp(1 - p * 1.5), clamp((p - 0.30) / 0.50)]; };
const eq = (a, b) => a.every((x, i) => Math.abs(+x - b[i]) < 0.0006);
const out = {};
for (const run of R) { const k = run.v; out[k] = out[k] || { lag: {}, looksBySy: {} };
  for (const c of run.clicks) c.rec.forEach((r, i) => { let lag = 'none'; for (let j = 0; j <= 4 && i - j >= 0; j++) if (eq(r.nav, f(c.rec[i - j].sy))) { lag = j; break; }
    out[k].lag[lag] = (out[k].lag[lag] || 0) + 1;
    // look of the nav must be a pure function of the nav vars: group by numeric nav vars
    const key = r.nav.map((x) => (+x).toFixed(3)).join(','); (out[k].looksBySy[key] = out[k].looksBySy[key] || new Set()).add(JSON.stringify(r.navLook)); }); }
const looks = {};
for (const k in out) { looks[k] = {}; for (const key in out[k].looksBySy) looks[k][key] = [...out[k].looksBySy[key]]; delete out[k].looksBySy; }
// nav look per numeric nav state: same state -> same look across variants?
let shared = 0, same = 0, diffs = [];
for (const key in looks.baseline) if (looks.combined[key]) { shared++; const a = looks.baseline[key].sort().join(), b = looks.combined[key].sort().join(); if (a === b) same++; else diffs.push({ key, b: looks.baseline[key], c: looks.combined[key] }); }
const res = { lagFramesHistogram: out, navStatesShared: shared, navStatesIdenticalLook: same, lookDiffs: diffs.slice(0, 10) };
require('fs').writeFileSync(__dirname + '/out/navclicks_lag.json', JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1).slice(0, 3000));
