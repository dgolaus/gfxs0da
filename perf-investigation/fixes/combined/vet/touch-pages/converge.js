// node converge.js : does the 6c gradient reach the same steady value in baseline and combined given enough time?
// desktop 1440 (Lenis) and reduced; samples acc0 vs target at 2s intervals up to 16s after a jump.
const fs = require('fs'); const path = require('path'); const L = require('./lib');
(async () => { const out = {};
  for (const red of [false, true]) for (const v of ['baseline', 'combined']) {
    const b = await L.launch(); const { p } = await L.open(b, v, { w: 1440, h: 900, reduced: red });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 1500);
    await p.evaluate(() => { if (window.lenis) window.lenis.scrollTo(300, { immediate: true, force: true }); else window.scrollTo(0, 300); });
    const s = [];
    for (let i = 0; i < 8; i++) { await L.w8(2000); s.push(await p.evaluate(() => { const e = document.querySelector('.hero-title .accent-text'); const top = e.getBoundingClientRect().top;
      return { acc: (e.style.backgroundImage.match(/at 50% ([-\d.]+)vh/) || [])[1], target: (50 - top / innerHeight * 100).toFixed(2), full: e.style.backgroundImage }; })); }
    out[(red ? 'reduced_' : 'desk_') + v] = s; console.log(red ? 'reduced' : 'desk', v, s.map((x) => x.acc + '/' + x.target).join(' '));
    await b.close(); }
  const k = (r) => out[r][7].full; console.log('final strings identical desk:', k('desk_baseline') === k('desk_combined'), ' reduced:', k('reduced_baseline') === k('reduced_combined'));
  fs.writeFileSync(path.join(__dirname, 'out', 'converge.json'), JSON.stringify(out, null, 1));
})();
