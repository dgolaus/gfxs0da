// Anchor loads: per-frame scrollY + process-accent gradient center + target top, baseline vs cvd vs cvw.
// node anchors.js <out.json> [sizes] [hashes] [reps] [throttle]
const fs = require('fs');
const L = require('./lib.js');
const OUT = process.argv[2];
const SIZES = (process.argv[3] || '1440x900,1920x1080,1366x768,1280x720,390x844m').split(',');
const HASHES = (process.argv[4] || 'work,about,process,trust,pricing,contact').split(',');
const REPS = +(process.argv[5] || 1);
const THR = +(process.argv[6] || 0);
const VARS = (process.env.VARS || 'baseline,cvd,cvw').split(',');
const REC = `(() => {
  window.__rec = [];
  const t0 = performance.now();
  const f = () => {
    const a = document.querySelector('.process-text h2 .accent-soft');
    const m = a && a.style.backgroundImage.match(/at 50% (-?[\\d.]+)vh/);
    window.__rec.push([Math.round(performance.now() - t0), Math.round(scrollY * 10) / 10, m ? +m[1] : null]);
    if (performance.now() - t0 < 4200) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
})();`;
(async () => {
  const res = [];
  const b = await L.launch();
  for (const sz of SIZES) {
    const mobile = sz.endsWith('m');
    const [W, H] = sz.replace('m', '').split('x').map(Number);
    for (const h of HASHES) for (let r = 0; r < REPS; r++) for (const v of VARS) {
      const { p } = await L.open(b, v, { w: W, h: H, mobile, throttle: THR, pre: REC });
      for (let k = 0; ; k++) { try { await p.goto(L.BASE + '/#' + h, { waitUntil: 'load' }); break; } catch (e) { if (k > 30) throw e; await L.w8(10000); } }
      await L.w8(4300);
      const fin = await p.evaluate((h) => {
        const t = document.getElementById(h);
        return { sy: scrollY, top: Math.round(t.getBoundingClientRect().top * 100) / 100, docH: document.documentElement.scrollHeight,
          limit: window.lenis ? window.lenis.limit : null, rec: window.__rec, errs: window.__errs };
      }, h);
      const rec = fin.rec;
      // 100ms samples of scrollY
      const s100 = []; for (let t = 0; t <= 3000; t += 100) { const e = rec.filter((x) => x[0] <= t).pop(); s100.push(e ? e[1] : null); }
      // distinct scrollY plateaus (jumps)
      const jumps = []; let last = null; for (const e of rec) { if (e[1] !== last) { jumps.push([e[0], e[1]]); last = e[1]; } }
      res.push({ sz, h, r, v, sy: fin.sy, top: fin.top, docH: fin.docH, limit: fin.limit, jumps, s100, grad: rec.map((e) => [e[0], e[2]]), errs: fin.errs.concat(p.__errs || []) });
      await p.close();
      console.log(sz, h, r, v, 'sy', fin.sy, 'top', fin.top, 'docH', fin.docH, 'jumps', JSON.stringify(jumps));
    }
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(res));
})().catch((e) => { console.error(e); process.exit(1); });
