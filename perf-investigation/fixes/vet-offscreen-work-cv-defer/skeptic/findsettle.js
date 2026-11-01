// Find-in-page (window.find) / focus jump before warm-up, then NO input for 7s. Per frame: viewport top of the
// matched element, scrollY, lenis.animatedScroll, contentVisibility of each cv section. Any change of the
// target's viewport top after the jump = content moving on screen with no user input.
// node findsettle.js <out.json> <sizes> <T0ms> <method> [vars]   method: find:<text>@<selector> | focus:<selector>
const fs = require('fs');
const L = require('../cloud/lib.js');
const [OUT, SZ, T0s, METHOD, VS] = process.argv.slice(2);
const SIZES = SZ.split(','); const T0 = +T0s; const VARS = (VS || 'baseline,baseline,cvw_stay').split(',');
(async () => {
  const res = [];
  for (const sz of SIZES) for (const [vi, v] of VARS.entries()) {
    const b = await L.launch();
    const mobile = sz.endsWith('m');
    const [W, H] = sz.replace('m', '').split('x').map(Number);
    const { p } = await L.open(b, v, { w: W, h: H, mobile });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await L.w8(T0);
    if (!mobile) await p.mouse.move(W / 2, H / 2);
    const [kind, rest] = METHOD.split(/:(.*)/s);
    const [text, sel] = kind === 'find' ? rest.split('@') : [null, rest];
    await p.evaluate((sel) => {
      const el = document.querySelector(sel);
      const cvs = [...document.querySelectorAll('#main > section.about, #main > section.process, #main > section.trust, #main > section.pricing, #contact')];
      window.__f = []; window.__t0 = performance.now();
      const f = () => {
        const r = el.getBoundingClientRect();
        window.__f.push([Math.round(performance.now() - window.__t0), scrollY, window.lenis ? Math.round(window.lenis.animatedScroll * 100) / 100 : null,
          Math.round(r.top * 100) / 100, cvs.map((s) => (s.style.contentVisibility || '-')[0]).join(''), document.documentElement.scrollHeight]);
        if (!window.__stop) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }, sel);
    await L.w8(100);
    if (kind === 'find') await p.evaluate((t) => window.find(t, false, false, true), text);
    else if (kind === 'tab') { for (let i = 0; i < 300; i++) { await p.keyboard.press('Tab'); await L.w8(60); if (await p.evaluate((sel) => document.activeElement === document.querySelector(sel), sel)) break; } }
    else await p.evaluate((sel) => document.querySelector(sel).focus(), sel);
    const tJump = await p.evaluate(() => performance.now() - window.__t0);
    await L.w8(7000);
    const fr = await p.evaluate(() => { window.__stop = true; return window.__f; });
    // frames after the jump settled: first frame whose scrollY differs from the first one, +2 frames
    let j = fr.findIndex((x) => x[1] !== fr[0][1]);
    if (kind === 'tab') j = fr.findIndex((x) => x[0] > tJump + 50);
    const after = j >= 0 ? fr.slice(j + 1) : [];
    const moves = [];
    for (let i = 1; i < after.length; i++) if (Math.abs(after[i][3] - after[i - 1][3]) > 0.01) moves.push({ t: after[i][0], top: [after[i - 1][3], after[i][3]], sy: [after[i - 1][1], after[i][1]], cv: after[i][4], docH: after[i][5] });
    const land = after[0] || null, last = fr[fr.length - 1];
    const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
    res.push({ sz, v, run: vi, method: METHOD, land, last, moves, errs });
    console.log(sz, `${v}#${vi}`, 'land', JSON.stringify(land), 'final', JSON.stringify(last), '| on-screen moves after landing:', moves.length, JSON.stringify(moves.slice(0, 6)), 'errs', errs.length);
    await p.close(); await b.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
