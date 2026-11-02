// node navbtn.js <N> : m390 DPR3 touch, walk stops like walk.js up to 5064, record nav CTA computed state at each stop (baseline vs combined).
const fs = require('fs'); const path = require('path'); const L = require('./lib');
(async () => { const out = {}; const N = +(process.argv[2] || 1);
  for (let r = 0; r < N; r++) for (const v of ['baseline', 'combined']) {
    const b = await L.launch({ touch: true }); const { p } = await L.open(b, v, { w: 390, h: 844, mobile: true, dpr: 3 });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500); const rows = [];
    for (let y = 0; y <= 5064; y += 422) { await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(1300);
      rows.push(await p.evaluate(() => { const n = document.getElementById('nav'); const c = n.querySelector(':scope > .btn'); const cs = getComputedStyle(c); const r = c.getBoundingClientRect();
        return { y: scrollY, op: cs.opacity, tf: cs.transform, tr: cs.translate, x: +r.x.toFixed(2), vars: ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => getComputedStyle(n).getPropertyValue(k).trim()).join(','),
          anims: c.getAnimations().map((a) => (a.animationName || a.transitionProperty) + ':' + a.playState + '@' + Math.round(a.currentTime)).join(' ') }; })); }
    (out[v] = out[v] || []).push(rows); console.log(v, 'r' + r, rows.map((x) => `${x.y}:op${x.op} x${x.x} ${x.tf} [${x.vars}] ${x.anims}`).join('\n   '));
    await b.close(); }
  fs.writeFileSync(path.join(__dirname, 'out', 'navbtn.json'), JSON.stringify(out, null, 1));
})();
