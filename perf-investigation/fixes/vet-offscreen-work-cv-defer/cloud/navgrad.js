// Gradient (6c) on '.process-text h2 .accent-soft' per frame during an in-page anchor click from the top.
// lag = smoothed center - target center (vh). Only frames with the accent on screen matter.
// node navgrad.js <out.json> <sizes> <hrefs> [waitBeforeClickMs] [reps]
const fs = require('fs');
const L = require('./lib.js');
const [OUT, SZ, HR, WB, RP] = process.argv.slice(2);
const SIZES = SZ.split(','); const HREFS = HR.split(','); const WAIT = +(WB || 4000); const REPS = +(RP || 1);
const VARS = (process.env.VARS || 'baseline,cvd,cvw').split(',');
(async () => {
  const res = [];
  const b = await L.launch();
  for (const sz of SIZES) for (const href of HREFS) for (let r = 0; r < REPS; r++) for (const v of VARS) {
    const mobile = sz.endsWith('m');
    const [W, H] = sz.replace('m', '').split('x').map(Number);
    const { p } = await L.open(b, v, { w: W, h: H, mobile });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.w8(WAIT);
    await p.evaluate((href) => {
      let a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === href && x.offsetParent);
      if (!a) { a = document.createElement('a'); a.href = href; a.textContent = 'x'; a.id = '__probe'; a.style.cssText = 'position:fixed;left:0;top:0;opacity:0;z-index:9999'; document.body.appendChild(a); }
      window.__a = a;
      window.__f = [];
      const acc = document.querySelector('.process-text h2 .accent-soft');
      const f = () => {
        const m = acc.style.backgroundImage.match(/at 50% (-?[\d.]+)vh/);
        window.__f.push([Math.round(performance.now()), scrollY, m ? +m[1] : null]);
        if (window.__f.length < 260) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }, href);
    await L.w8(100);
    await p.evaluate(() => window.__a.click());
    await L.w8(4200);
    const out = await p.evaluate(() => {
      const acc = document.querySelector('.process-text h2 .accent-soft');
      const r = acc.getBoundingClientRect();
      return { f: window.__f, accDoc: r.top + scrollY, accH: r.height, vh: innerHeight, sy: scrollY, errs: window.__errs };
    });
    const t0 = out.f[0][0];
    const rows = out.f.map(([t, sy, g]) => {
      const tgt = 50 - ((out.accDoc - sy) / out.vh) * 100;
      const scr = out.accDoc - sy;
      return [t - t0, sy, g, g == null ? null : Math.round((g - tgt) * 100) / 100, scr > -out.accH && scr < out.vh ? 1 : 0];
    });
    const onScreen = rows.filter((x) => x[4] && x[3] != null);
    const maxLagOn = onScreen.reduce((m, x) => Math.max(m, Math.abs(x[3])), 0);
    res.push({ sz, href, r, v, finalSy: out.sy, maxLagOn, rows, errs: out.errs });
    console.log(sz, href, r, v, 'finalSy', out.sy, 'frames', rows.length, 'onScreenFrames', onScreen.length, 'maxLagOnScreen', maxLagOn.toFixed(2),
      'firstOnScreen', JSON.stringify(onScreen.slice(0, 3)), 'nullFrames', rows.filter((x) => x[2] == null).length);
    await p.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(res));
})().catch((e) => { console.error(e); process.exit(1); });
