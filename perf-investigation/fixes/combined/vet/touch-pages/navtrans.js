// node navtrans.js <N> : mobile 390 touch: after load, scrollTo(422) and sample nav CTA transform + vars every 50ms for 1.5s; baseline vs combined.
const fs = require('fs'); const path = require('path'); const L = require('./lib');
(async () => { const out = {}; const N = +(process.argv[2] || 3);
  for (let r = 0; r < N; r++) for (const v of ['baseline', 'combined']) {
    const b = await L.launch({ touch: true }); const { p } = await L.open(b, v, { w: 390, h: 844, mobile: true });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    const s = await p.evaluate(async () => { const n = document.getElementById('nav'); const c = n.querySelector(':scope > .btn'); const res = []; const t0 = performance.now();
      window.scrollTo(0, 422);
      while (performance.now() - t0 < 1500) { await new Promise((r) => setTimeout(r, 50));
        res.push([Math.round(performance.now() - t0), new DOMMatrix(getComputedStyle(c).transform).m41.toFixed(2), getComputedStyle(n).getPropertyValue('--nav-pill').trim(), n.classList.contains('is-pill')]); }
      return res; });
    const firstVar = s.find((x) => parseFloat(x[2]) > 0.99), done = s.find((x) => x[1] === '24.00');
    (out[v] = out[v] || []).push(s); console.log(v, 'r' + r, 'vars@', firstVar && firstVar[0], 'ms  tx=24@', done && done[0], 'ms  samples:', s.filter((_, i) => i % 3 === 0).map((x) => x[0] + ':' + x[1]).join(' '));
    await b.close(); }
  fs.writeFileSync(path.join(__dirname, 'out', 'navtrans.json'), JSON.stringify(out, null, 1));
})();
