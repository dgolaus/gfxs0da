// contain:paint must apply only to the home #pricing at >= 1440px
const L = require('../../combined/vet/lib');
(async () => { const b = await L.launch();
  for (const [pg, w] of [['/', 1440], ['/', 1439], ['/', 1920], ['/', 1280], ['/tos/', 1440], ['/tos/', 1920]]) for (const v of ['baseline', 'final']) {
    const { p } = await L.open(b, v, { w, h: 900 }); await p.goto(L.BASE + pg, { waitUntil: 'load' });
    const r = await p.evaluate(() => { const e = document.getElementById('pricing'); return e ? getComputedStyle(e).contain : 'no #pricing'; });
    console.log(pg, w, v, 'contain=' + r, (p.__errs || []).join(';')); await p.close(); }
  await b.close(); })();
