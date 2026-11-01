// Scroll down like a user (Lenis wheel on desktop, small scrollBy steps on touch) until <sel> is in the upper half,
// then resize the viewport (window resize / phone rotation) before warm-up. Per frame: viewport top of <sel>,
// scrollY, cv flags, docH. Compares the on-screen position after the resize with baseline (A/A included).
// node resize.js <out.json> <from WxH[m]> <to WxH[m]> <T0ms> <sel> [vars]
const fs = require('fs');
const L = require('../cloud/lib.js');
const [OUT, FROM, TO, T0s, SEL, VS] = process.argv.slice(2);
const VARS = (VS || 'baseline,baseline,cvw_stay').split(',');
const parse = (s) => { const m = s.endsWith('m'); const [w, h] = s.replace('m', '').split('x').map(Number); return { w, h, m }; };
const A = parse(FROM), B = parse(TO);
(async () => {
  const res = [];
  for (const [vi, v] of VARS.entries()) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: A.w, h: A.h, mobile: A.m });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await L.w8(+T0s);
    if (!A.m) await p.mouse.move(A.w / 2, A.h / 2);
    let steps = 0;
    for (; steps < 400; steps++) {
      const top = await p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, SEL);
      if (top < A.h * 0.35) break;
      if (A.m) await p.evaluate((d) => window.scrollBy(0, d), +(process.env.MSTEP||80)); else await p.mouse.wheel({ deltaY: +(process.env.DSTEP||120) });
      await L.w8(A.m ? 20 : 45);
    }
    await L.w8(700);
    await p.evaluate((s) => {
      const el = document.querySelector(s);
      const cvs = [...document.querySelectorAll('#main > section.about, #main > section.process, #main > section.trust, #main > section.pricing, #contact')];
      window.__f = []; window.__t0 = performance.now();
      const f = () => {
        window.__f.push([Math.round(performance.now() - window.__t0), scrollY, Math.round(el.getBoundingClientRect().top * 100) / 100,
          cvs.map((x) => (x.style.contentVisibility || '-')[0]).join(''), document.documentElement.scrollHeight, innerWidth]);
        if (!window.__stop) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }, SEL);
    const before = await p.evaluate((s) => [scrollY, document.querySelector(s).getBoundingClientRect().top], SEL);
    await L.w8(150);
    await p.setViewport({ width: B.w, height: B.h, isMobile: B.m, hasTouch: B.m });
    await L.w8(2500);
    const fr = await p.evaluate(() => { window.__stop = true; return window.__f; });
    const k = fr.findIndex((x) => x[5] === B.w);
    const post = fr.slice(k);
    const moves = [];
    for (let i = 1; i < post.length; i++) if (Math.abs(post[i][2] - post[i - 1][2]) > 0.01) moves.push({ t: post[i][0] - post[0][0], top: [post[i - 1][2], post[i][2]], sy: [post[i - 1][1], post[i][1]], cv: post[i][3], docH: post[i][4] });
    const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
    const last = fr[fr.length - 1];
    res.push({ v, run: vi, steps, before, first: post[0], last, moves, errs });
    console.log(`${FROM}->${TO}`, `${v}#${vi}`, 'steps', steps, 'before', JSON.stringify(before), 'firstAfter', JSON.stringify(post[0]), 'final', JSON.stringify(last), '| moves', moves.length, JSON.stringify(moves.slice(0, 5)), 'errs', errs.length);
    await p.close(); await b.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
