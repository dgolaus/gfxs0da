// compare walkvars rows: baseline A vs baseline B (A/A) vs combined, per stop, numeric
const R = require('./out/' + (process.argv[2] || 'walkvars') + '.json'); const out = [];
for (const vpn of ['desk', 'mob']) { const rows = R.filter((x) => x.vpn === vpn); const [A, B, ...Vs] = rows;
  const cmpRun = (X) => { const d = { syDiff: 0, fpDiff: 0, fpElsDiff: 0, leaveNumDiff: 0, leaveVisualDiff: 0, thumbDiff: 0, firstDiffs: [] };
    const n = Math.min(A.rows.length, X.rows.length);
    for (let i = 0; i < n; i++) { const a = A.rows[i], x = X.rows[i];
      const note = (k) => { d[k]++; if (d.firstDiffs.length < 8) d.firstDiffs.push({ i, k, sy: [a.sy, x.sy], a: k.startsWith('leave') ? a.leave : k === 'thumbDiff' ? a.thumb : a.fp, x: k.startsWith('leave') ? x.leave : k === 'thumbDiff' ? x.thumb : x.fp }); };
      if (a.sy !== x.sy) note('syDiff');
      if (Math.abs(+a.fp - +x.fp) > 1e-9) note('fpDiff');
      if (a.fpEls.join() !== x.fpEls.join()) note('fpElsDiff');
      if (a.leave.some((l, j) => Math.abs(+l[0] - +x.leave[j][0]) > 1e-9)) note('leaveNumDiff');
      if (a.leave.some((l, j) => l.slice(2).join() !== x.leave[j].slice(2).join())) note('leaveVisualDiff');
      if (a.thumb !== x.thumb) note('thumbDiff'); }
    return { n, lenA: A.rows.length, lenX: X.rows.length, ...d, bottom: X.bottom, wheel: X.wheel, env: X.env, errs: X.pageErrors };
  };
  // monotonic --fp vs scroll and leave formula check on each run
  const curve = (X) => { const half = X.rows.length / 2; const down = X.rows.slice(0, half); let nonMono = 0; for (let i = 1; i < down.length; i++) if (+down[i].fp < +down[i - 1].fp - 1e-9) nonMono++;
    const fpAt = down.filter((r, i) => i % 10 === 0 || +r.fp > 0 && +r.fp < 1).map((r) => [r.sy, r.fp]);
    // leave formula: leave = clamp((0.3vh - bottom)/0.3vh) where bottom read at rest
    let leaveBad = 0; const ih = X.env.ih; X.rows.forEach((r) => r.leave.forEach((l) => { if (!l) return; const fs = ih * 0.3; const exp = l[5] < fs ? Math.min(1, Math.max(0, (fs - l[5]) / fs)) : 0; if (Math.abs(exp - +l[0]) > 0.01) leaveBad++; }));
    // up-walk returns to same values as down-walk at same y
    let upDown = 0; for (let i = 0; i < half; i++) { const d = X.rows[i], u = X.rows[X.rows.length - 1 - i]; if (d.sy === u.sy && (d.fp !== u.fp || d.leave.map((l) => l[0]).join() !== u.leave.map((l) => l[0]).join())) upDown++; }
    return { fpNonMonotonicSteps: nonMono, leaveFormulaViolations: leaveBad, upVsDownMismatch: upDown, fpCurveSample: fpAt.slice(0, 40), inline: { fpInlineEmptyRows: X.rows.filter((r) => r.fpInline === '').length, leaveInlineEmptyRows: X.rows.filter((r) => r.leave.some((l) => l[1] === '')).length } }; };
  out.push({ vpn, AA: cmpRun(B), ...Object.fromEntries(Vs.map((x) => [x.v, cmpRun(x)])), curves: Object.fromEntries(rows.map((x, i) => [i === 0 ? 'A' : i === 1 ? 'B' : x.v, curve(x)])), bottomA: A.bottom, wheelA: A.wheel });
}
require('fs').writeFileSync(__dirname + '/out/' + (process.argv[2] || 'walkvars') + '_analysis.json', JSON.stringify(out, null, 1));
for (const o of out) { console.log('==', o.vpn); for (const k of ['AA', 'combined']) { const c = o[k]; if (!c) continue; const { firstDiffs, bottom, wheel, ...rest } = c; console.log(k, JSON.stringify(rest)); console.log('  bottom', JSON.stringify(bottom), 'wheel', JSON.stringify(wheel)); if (firstDiffs.length) console.log('  diffs', JSON.stringify(firstDiffs).slice(0, 1500)); }
  console.log('bottomA', JSON.stringify(o.bottomA), 'wheelA', JSON.stringify(o.wheelA)); for (const k in o.curves) { const { fpCurveSample, ...r } = o.curves[k]; console.log('curve', k, JSON.stringify(r)); } }
