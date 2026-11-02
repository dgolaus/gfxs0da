const R = require('./out/anchors.json'); const out = {};
for (const vpn of ['desk', 'mob']) { out[vpn] = {};
  const hashes = R[0].rows.map((r) => r.h);
  for (const h of hashes) { const g = {}; for (const v of ['baseline', 'combined']) { const runs = R.filter((x) => x.vpn === vpn && x.v === v).map((x) => x.rows.find((r) => r.h === h));
      g[v] = { finSy: runs.map((r) => Math.round(r.fin.sy * 10) / 10), finTop: runs.map((r) => Math.round(r.fin.top * 10) / 10), max: runs.map((r) => r.fin.max), lenis: runs.map((r) => r.fin.lenis), limit: runs.map((r) => r.fin.limit),
        samplesSy: runs.map((r) => (r.samples || []).map((s) => s[0])), samplesTop: runs.map((r) => (r.samples || []).map((s) => s[1])) }; }
    // per-sample max abs diff: baseline rep i vs combined rep i, and baseline A/A (rep0 vs rep1, rep1 vs rep2)
    const md = (a, b) => { let m = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
    const B = g.baseline.samplesSy, C = g.combined.samplesSy;
    g.maxSampleDiff = { AA: Math.max(md(B[0], B[1]), md(B[1], B[2]), md(B[0], B[2])), BC: Math.max(...[0, 1, 2].map((i) => md(B[i], C[i]))), CC: Math.max(md(C[0], C[1]), md(C[1], C[2]), md(C[0], C[2])) };
    // first sample index where sy reaches final (settled), per run
    const settle = (s, fin) => s.findIndex((y, i) => s.slice(i).every((z) => Math.abs(z - fin) < 1));
    g.settleIdx = { baseline: B.map((s, i) => settle(s, g.baseline.finSy[i])), combined: C.map((s, i) => settle(s, g.combined.finSy[i])) };
    g.verdict = { finalSyEqual: JSON.stringify(g.baseline.finSy) === JSON.stringify(g.combined.finSy), finalTopEqual: JSON.stringify(g.baseline.finTop) === JSON.stringify(g.combined.finTop) };
    out[vpn][h] = g; }
  out[vpn].errs = R.filter((x) => x.vpn === vpn).map((x) => [x.v, x.rep, x.pageErrors.length, x.consoleErrors.length]); }
require('fs').writeFileSync(__dirname + '/out/anchors_analysis.json', JSON.stringify(out, null, 1));
for (const vpn in out) { console.log('==', vpn, 'errs', JSON.stringify(out[vpn].errs)); for (const h in out[vpn]) { if (h === 'errs') continue; const g = out[vpn][h];
  console.log(h.padEnd(13), 'B sy', g.baseline.finSy.join(','), 'top', g.baseline.finTop.join(','), '| C sy', g.combined.finSy.join(','), 'top', g.combined.finTop.join(','), '| lenis', g.baseline.lenis.join(''), g.combined.lenis.join(''), '| maxSampleDiff', JSON.stringify(g.maxSampleDiff), 'settle', JSON.stringify(g.settleIdx), JSON.stringify(g.verdict)); } }
