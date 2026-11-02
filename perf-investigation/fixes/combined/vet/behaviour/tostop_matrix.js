const L = require('./lib'); const R = require('./out/tostop/result.json'); const fs = require('fs');
(async () => { const S = R.shots; const M = {}; const reg = { left: 700, top: 620, width: 740, height: 460 };
  for (const a of S) for (const b of S) if (a.v + a.i < b.v + b.i) M[a.v + a.i + '|' + b.v + b.i] = await L.diff(a.f, b.f, null, reg);
  const minTo = (s, pred) => Math.min(...S.filter((t) => t !== s && pred(t)).map((t) => { const k = [s.v + s.i, t.v + t.i].sort().join('|'); return M[k].pct; }));
  const rows = S.map((s) => ({ s: s.v + s.i, h: s.h, minToBaseline: minTo(s, (t) => t.v === 'baseline'), minToSame: minTo(s, (t) => t.v === s.v) }));
  rows.forEach((r) => console.log(JSON.stringify(r)));
  fs.writeFileSync(__dirname + '/out/tostop/matrix.json', JSON.stringify({ region: reg, M, rows }, null, 1));
  await L.diff(S.find((s) => s.v === 'baseline').f, S.find((s) => s.v === 'combined' && s.i === 1).f, __dirname + '/out/tostop/heat_b0_c1.png', reg);
})();
