// End key at T0 after load, then Lenis wheel scroll back up over never-rendered sections.
// Per frame: scrollY, lenis.animatedScroll, doc-top of every section; detects doc-top changes (content shift).
// Also geometry before/after: docH, section heights, rail thumb style.
// node endwheel.js <out.json> <sizes> <T0ms> [vars]
const fs = require('fs');
const L = require('./lib.js');
const [OUT, SZ, T0s, VS] = process.argv.slice(2);
const SIZES = SZ.split(','); const T0 = +T0s; const VARS = (VS || 'baseline,cvd,cvw').split(',');
const geo = () => ({
  sy: scrollY, docH: document.documentElement.scrollHeight,
  secs: [...document.querySelectorAll('#main > section, #contact')].map((s) => { const o = s.id === 'contact' ? s.offsetTop : s.offsetTop + document.getElementById('main').offsetTop; return [s.id, o, s.offsetHeight]; }),
  thumb: document.querySelector('.rail__thumb').style.cssText, limit: window.lenis ? window.lenis.limit : null,
});
(async () => {
  const res = [];
  const b = await L.launch();
  for (const sz of SIZES) for (const v of VARS) {
    const mobile = sz.endsWith('m');
    const [W, H] = sz.replace('m', '').split('x').map(Number);
    const { p } = await L.open(b, v, { w: W, h: H, mobile });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await L.w8(T0);
    const g0 = await p.evaluate(geo);
    if (mobile) await p.evaluate(() => window.scrollTo(0, 1e7)); else { await p.mouse.move(W / 2, H / 2); await p.keyboard.press('End'); }
    await L.w8(1500);
    const g1 = await p.evaluate(geo);
    await p.evaluate(() => {
      window.__f = [];
      const secs = [...document.querySelectorAll('#main > section, #contact')]; const main = document.getElementById('main');
      const f = () => {
        window.__f.push([Math.round(performance.now()), scrollY, window.lenis ? Math.round(window.lenis.animatedScroll * 10) / 10 : null,
          secs.map((s) => s.id === 'contact' ? s.offsetTop : s.offsetTop + main.offsetTop)]);
        if (!window.__stop) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    if (mobile) {
      // native: step the page up like a finger flick sequence
      for (let i = 0; i < 400; i++) { const y = await p.evaluate(() => { window.scrollBy(0, -60); return scrollY; }); await L.w8(16); if (y <= 0) break; }
    } else {
      for (let i = 0; i < 600; i++) { await p.mouse.wheel({ deltaY: -100 }); await L.w8(40); if (i % 10 === 0 && (await p.evaluate(() => scrollY)) <= 0) break; }
    }
    await L.w8(1500);
    const fr = await p.evaluate(() => { window.__stop = true; return window.__f; });
    const g2 = await p.evaluate(geo);
    // doc-top changes during the scroll-up
    const shifts = [];
    for (let i = 1; i < fr.length; i++) {
      const a = fr[i - 1][3], c = fr[i][3];
      const d = c.map((x, k) => Math.round((x - a[k]) * 100) / 100);
      if (d.some((x) => Math.abs(x) > 0.01)) shifts.push({ t: fr[i][0] - fr[0][0], sy: fr[i][1], prevSy: fr[i - 1][1], anim: fr[i][2], d });
    }
    // per-frame scroll jump not explained by lenis
    let maxDev = 0; for (const e of fr) if (e[2] != null) maxDev = Math.max(maxDev, Math.abs(e[1] - e[2]));
    const errs = await p.evaluate(() => window.__errs);
    res.push({ sz, v, T0, g0, g1, g2, frames: fr.length, shifts, maxDev, errs });
    console.log(sz, v, 'docH', g0.docH, '->', g1.docH, '->', g2.docH, 'thumb0', g0.thumb, '| shifts', shifts.length, JSON.stringify(shifts.slice(0, 6)), 'maxDev', maxDev, 'end sy', g2.sy);
    await p.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
