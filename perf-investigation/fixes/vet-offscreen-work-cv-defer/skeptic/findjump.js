// Non-anchor long jumps the amendment does NOT hook (find-in-page via window.find, Tab focus),
// then Lenis wheel back up over never-rendered sections. Per frame: scrollY, lenis.animatedScroll,
// doc-top of every section. "vis" = unintended on-screen motion of the section under the viewport middle:
// d(docTop - scrollY) + d(animatedScroll)  (0 when content moves only by Lenis' own scroll).
// node findjump.js <out.json> <sizes> <T0ms> <method> [vars]
//   method: find:<text> | tab:<sectionId>
const fs = require('fs');
const L = require('../cloud/lib.js');
const [OUT, SZ, T0s, METHOD, VS] = process.argv.slice(2);
const SIZES = SZ.split(','); const T0 = +T0s; const VARS = (VS || 'baseline,cvw_stay').split(',');
const geo = () => ({
  sy: scrollY, docH: document.documentElement.scrollHeight,
  secs: [...document.querySelectorAll('#main > section, #contact')].map((s) => [s.id, Math.round((s.getBoundingClientRect().top + scrollY) * 100) / 100, s.offsetHeight]),
  thumb: document.querySelector('.rail__thumb').style.cssText, limit: window.lenis ? window.lenis.limit : null,
  cv: [...document.querySelectorAll('#main > section, #contact')].map((s) => s.style.contentVisibility || '-').join(','),
  ae: document.activeElement ? (document.activeElement.textContent || '').trim().slice(0, 30) : null,
});
(async () => {
  const res = [];
  for (const sz of SIZES) for (const v of VARS) {
    const b = await L.launch();
    const [W, H] = sz.split('x').map(Number);
    const { p } = await L.open(b, v, { w: W, h: H });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await L.w8(T0);
    const g0 = await p.evaluate(geo);
    await p.mouse.move(W / 2, H / 2);
    const [kind, arg] = METHOD.split(/:(.*)/s);
    let tabs = 0;
    if (kind === 'find') {
      await p.evaluate((t) => window.find(t, false, false, true), arg);
    } else if (kind === 'tab') {
      for (; tabs < 300; tabs++) {
        await p.keyboard.press('Tab'); await L.w8(30);
        const inside = await p.evaluate((id) => { const s = document.getElementById(id); return !!(s && s.contains(document.activeElement)); }, arg);
        if (inside) break;
      }
    }
    await L.w8(1500);
    const g1 = await p.evaluate(geo);
    const shot1 = OUT.replace(/\.json$/, '') + `_${sz}_${v}_land.png`;
    await L.freeze(p); await p.screenshot({ path: shot1 }); await L.unfreeze(p);
    await p.evaluate(() => {
      window.__f = [];
      const secs = [...document.querySelectorAll('#main > section, #contact')];
      const f = () => {
        window.__f.push([Math.round(performance.now()), scrollY, window.lenis ? window.lenis.animatedScroll : null,
          secs.map((s) => s.getBoundingClientRect().top + scrollY), innerHeight]);
        if (!window.__stop) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    for (let i = 0; i < 600; i++) { await p.mouse.wheel({ deltaY: -100 }); await L.w8(40); if (i % 10 === 0 && (await p.evaluate(() => scrollY)) <= 0) break; }
    await L.w8(1500);
    const fr = await p.evaluate(() => { window.__stop = true; return window.__f; });
    const g2 = await p.evaluate(geo);
    const shifts = [];
    let visSum = 0;
    for (let i = 1; i < fr.length; i++) {
      const [, syA, anA, topsA, vh] = fr[i - 1]; const [t, syB, anB, topsB] = fr[i];
      const mid = syA + vh / 2;
      let k = 0; for (let j = 0; j < topsA.length; j++) if (topsA[j] <= mid) k = j;
      const vis = (topsB[k] - syB) - (topsA[k] - syA) + ((anB ?? syB) - (anA ?? syA));
      const dTop = topsB.map((x, j) => Math.round((x - topsA[j]) * 100) / 100);
      if (Math.abs(vis) > 0.6 || dTop.some((x) => Math.abs(x) > 0.01)) shifts.push({ t: t - fr[0][0], sy: syB, sec: k, vis: Math.round(vis * 100) / 100, dTop });
      if (Math.abs(vis) > 0.6) visSum += Math.abs(vis);
    }
    const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
    res.push({ sz, v, T0, method: METHOD, tabs, g0, g1, g2, frames: fr.length, shifts, visSum, errs });
    console.log(sz, v, METHOD, 'tabs', tabs, 'land sy', g1.sy, 'ae', JSON.stringify(g1.ae), 'docH', g0.docH, '->', g1.docH, '->', g2.docH, 'cv@land', g1.cv,
      '| shifts', shifts.length, 'visSum', Math.round(visSum * 100) / 100, JSON.stringify(shifts.filter((s) => Math.abs(s.vis) > 0.6).slice(0, 5)), 'errs', errs.length);
    await p.close(); await b.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
