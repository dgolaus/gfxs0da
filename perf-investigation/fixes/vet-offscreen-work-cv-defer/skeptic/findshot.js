// window.find jump at load+1.5s, screenshot (animations frozen) at 1.2s after the find (before warm-up flips) and at 4s.
const L = require('../cloud/lib.js'); const fs = require('fs');
const [SZ, TEXT, VS] = process.argv.slice(2); const mobile = SZ.endsWith('m'); const [W, H] = SZ.replace('m', '').split('x').map(Number);
(async () => {
  const out = {};
  for (const [i, v] of (VS || 'baseline,baseline,cvw_stay').split(',').entries()) {
    const b = await L.launch(); const { p } = await L.open(b, v, { w: W, h: H, mobile });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await L.w8(1500);
    await p.evaluate((t) => window.find(t, false, false, true), TEXT);
    await L.w8(1200); await L.freeze(p); const a = `shot_${SZ}_${i}_${v}_t1200.png`; await p.screenshot({ path: a }); await L.unfreeze(p);
    await L.w8(2800); await L.freeze(p); const c = `shot_${SZ}_${i}_${v}_t4000.png`; await p.screenshot({ path: c });
    out[i] = { v, a, c, sy: await p.evaluate(() => scrollY) }; await b.close();
  }
  const r = {};
  for (const k of ['a', 'c']) { r[k] = { AA: await L.diff(out[0][k], out[1][k]), AV: await L.diff(out[0][k], out[2][k], `heat_${SZ}_${k}.png`), BV: await L.diff(out[1][k], out[2][k]) }; }
  console.log(SZ, JSON.stringify(out), JSON.stringify(r)); fs.writeFileSync(`findshot_${SZ}.json`, JSON.stringify({ out, r }, null, 1));
})();
