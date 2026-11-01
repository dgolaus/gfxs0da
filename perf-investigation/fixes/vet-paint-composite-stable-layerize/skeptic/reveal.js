// Cross-load: real wheel scroll (Lenis) from top to the footer; record, for every .reveal in #pricing, the scrollY
// (and time) when it gets .is-in, and the --leave value written on #pricing at each wheel step.
// IntersectionObserver clips the target by ancestors with paint containment, so a contain:paint section could
// shift reveal timing. node reveal.js <tag> <WxH> <dpr> <reps> <variant...>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, vp, dprS, repsS, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number);
const OUT = path.join(__dirname, 'out'); const res = [];
(async () => {
  for (let r = 0; r < +repsS; r++) for (const v of vars) {
    const b = await L.launch(); const { p } = await L.open(b, v, { w: W, h: H, dpr: +dprS });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    await p.evaluate(() => {
      window.__rev = []; const els = [...document.querySelectorAll('#pricing .reveal')];
      const mo = new MutationObserver(() => { for (const [i, el] of els.entries()) if (el.classList.contains('is-in') && !el.__seen) { el.__seen = 1; const rc = el.getBoundingClientRect(); window.__rev.push({ i, y: Math.round(scrollY), top: Math.round(rc.top), t: Math.round(performance.now()) }); } });
      for (const el of els) mo.observe(el, { attributes: true, attributeFilter: ['class'] });
      window.__contain = getComputedStyle(document.getElementById('pricing')).contain;
    });
    await p.mouse.move(W / 2, H / 2);
    const leaves = [];
    for (let i = 0; i < 400; i++) {
      await p.mouse.wheel({ deltaY: 60 }); await L.w8(35);
      const s = await p.evaluate(() => ({ y: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight, lv: document.getElementById('pricing').style.getPropertyValue('--leave') }));
      if (i % 4 === 0) leaves.push(`${s.y}:${s.lv}`);
      if (s.y >= s.max - 2) break;
    }
    await L.w8(1500);
    const out = await p.evaluate(() => ({ rev: window.__rev, contain: window.__contain, inCount: document.querySelectorAll('#pricing .reveal.is-in').length, total: document.querySelectorAll('#pricing .reveal').length }));
    const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
    res.push({ v, r, ...out, errs, leaves });
    console.log(`${tag} ${v} r${r} contain=${out.contain} in=${out.inCount}/${out.total} errs=${errs.length} reveals: ${out.rev.map((e) => `#${e.i}@y${e.y}(top${e.top})`).join(' ')}`);
    await b.close();
  }
  fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
