const L = require('./lib');
(async () => { const b = await L.launch({ touch: true }); const { p } = await L.open(b, 'baseline', { w: 390, h: 844, mobile: true });
  await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
  await p.evaluate(() => window.scrollTo(0, 5908)); await L.w8(1300);
  console.log(await p.evaluate(() => ({ ih: innerHeight, docH: document.documentElement.scrollHeight, secs: [...document.querySelectorAll('#main > section, #contact')].map((s) => s.id + ':' + Math.round(s.getBoundingClientRect().top) + '/' + Math.round(s.getBoundingClientRect().bottom)) })));
  await b.close(); })();
