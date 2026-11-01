// Deterministic step walk (STEP px, WAIT ms per stop): at each stop record which .reveal elements are revealed,
// the footer --fp, testimonials is-paused, doc height, rail thumb. Then: first stop at which each reveal turned on,
// and --fp per stop, compared to the first variant. node precise.js <out.json> <WxH[m]> <step> <wait> ; VARS env
const fs = require('fs');
const L = require('./lib.js');
const [OUT, SZ, STEP, WAIT] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,base_i,cvd_gh3,cvw_gh3').split(',');
const mobile = SZ.endsWith('m'); const [W, H] = SZ.replace('m', '').split('x').map(Number);
(async () => {
  const R = {};
  for (const v of VARS) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: W, h: H, mobile });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const rows = [];
    for (let y = 0; y <= maxY + +STEP; y += +STEP) {
      const yy = Math.min(y, maxY);
      await p.evaluate((y) => { window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); }, yy);
      await L.w8(+WAIT);
      rows.push(await p.evaluate(() => {
        const rv = [...document.querySelectorAll('.reveal')].map((e) => (e.classList.contains('is-in') ? 1 : 0)).join('');
        return [Math.round(scrollY), rv, document.querySelector('.cfooter').style.getPropertyValue('--fp'), document.getElementById('testimonials').classList.contains('is-paused') ? 1 : 0,
          document.documentElement.scrollHeight, document.querySelector('.rail__thumb').style.cssText];
      }));
      if (yy === maxY) break;
    }
    R[v] = rows;
    await b.close();
    console.log(v, 'stops', rows.length, 'maxY', maxY);
  }
  const B = R[VARS[0]];
  const first = (rows) => { const n = rows[0][1].length; const f = []; for (let i = 0; i < n; i++) { const r = rows.find((x) => x[1][i] === '1'); f.push(r ? r[0] : null); } return f; };
  const fb = first(B);
  for (const v of VARS.slice(1)) {
    const Rv = R[v]; const fv = first(Rv);
    const rv = fb.map((x, i) => (x !== fv[i] ? [i, x, fv[i]] : null)).filter(Boolean);
    const byY = Object.fromEntries(B.map((x) => [x[0], x]));
    const fp = [], tp = [], dh = [], th = [];
    for (const x of Rv) { const bx = byY[x[0]]; if (!bx) continue; if (bx[2] !== x[2]) fp.push([x[0], bx[2], x[2]]); if (bx[3] !== x[3]) tp.push([x[0], bx[3], x[3]]); if (bx[4] !== x[4]) dh.push([x[0], bx[4], x[4]]); if (bx[5] !== x[5]) th.push([x[0], bx[5], x[5]]); }
    console.log(`CMP ${v} vs ${VARS[0]}: revealFirstStopDiffs ${JSON.stringify(rv)} | fpDiffs ${fp.length} ${JSON.stringify(fp.slice(0, 6))} | pausedDiffs ${JSON.stringify(tp)} | docHDiffs ${dh.length} ${JSON.stringify(dh.slice(0, 3))} | thumbDiffs ${th.length} ${JSON.stringify(th.slice(0, 3))}`);
  }
  fs.writeFileSync(OUT, JSON.stringify(R));
})().catch((e) => { console.error(e); process.exit(1); });
