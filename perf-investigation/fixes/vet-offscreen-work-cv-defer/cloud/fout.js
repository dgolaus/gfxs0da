// FOUT check: font faces used only inside the deferred sections are requested only when the section renders.
// With font latency (FONT_DELAY env, ms), scroll down from the top with the wheel (Lenis) after WAIT ms and
// record, per frame, which faces are still not loaded while an element that uses them is on screen.
// node fout.js <out.json> <WxH> <waitMs> <wheelDelta> ; VARS, FONT_DELAY env
const fs = require('fs');
const L = require('./lib.js');
const [OUT, SZ, WAIT, DELTA] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,cvd_gh2,cvw_gh2').split(',');
const [W, H] = SZ.split('x').map(Number);
(async () => {
  const res = {};
  const b = await L.launch();
  for (const v of VARS) {
    const ctx = await b.createBrowserContext();
    const { p } = await L.open(ctx, v, { w: W, h: H });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.w8(+WAIT);
    await p.evaluate(() => {
      // elements (leaf text) inside the deferred sections and the face they ask for
      const secs = [...document.querySelectorAll('#main > section.about, #main > section.process, #main > section.trust, #main > section.pricing, #contact')];
      window.__fo = { frames: [], late: {} };
      const faces = [...document.fonts].filter((x) => x.unicodeRange.startsWith('U+0-FF'));
      // per section; only sections whose own box is on screen are inspected (a rect query inside a
      // skipped section would force its layout and its font loads)
      const track = secs.map((s) => [s, [...s.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))]);
      const f = () => {
        const notLoaded = faces.filter((x) => x.status !== 'loaded').map((x) => x.family + ' ' + x.weight);
        const nl = new Set(notLoaded);
        let hits = 0, ex = null;
        if (nl.size) for (const [s, list] of track) { const sr = s.getBoundingClientRect(); if (sr.bottom < 0 || sr.top > innerHeight) continue; for (const e of list) {
          const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || !r.height) continue;
          const cs = getComputedStyle(e); const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
          const key = fam + ' ' + cs.fontWeight;
          if (nl.has(key)) { hits++; ex = ex || key + ' :: ' + e.className + ' :: ' + e.textContent.trim().slice(0, 30); }
        } }
        window.__fo.frames.push([Math.round(performance.now()), Math.round(scrollY), notLoaded.length, hits, ex]);
        if (!window.__foStop) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await p.mouse.move(W / 2, H / 2);
    for (let i = 0; i < 400; i++) { await p.mouse.wheel({ deltaY: +DELTA }); await L.w8(16); if (i % 20 === 0 && (await p.evaluate(() => scrollY >= document.documentElement.scrollHeight - innerHeight - 2))) break; }
    await L.w8(800);
    const fo = await p.evaluate(() => { window.__foStop = true; return window.__fo; });
    const bad = fo.frames.filter((x) => x[3] > 0);
    res[v] = { bad, n: fo.frames.length };
    console.log(v, 'FONT_DELAY', process.env.FONT_DELAY || 0, 'frames', fo.frames.length, 'frames with on-screen text whose face is not loaded:', bad.length, JSON.stringify(bad.slice(0, 4)));
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
