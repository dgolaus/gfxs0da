const L = require('./lib.js');
(async () => { const b = await L.launch(); for (const v of ['baseline','cvd_gh']) { const { p } = await L.open(b, v, { w: 1440, h: 900 }); await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 1500);
  console.log(v, await p.evaluate(() => ({ lenis: !!window.lenis, limit: window.lenis && window.lenis.limit, max: document.documentElement.scrollHeight - innerHeight, fonts: [...document.fonts].filter((f) => f.status === 'loaded').length, check: document.fonts.check('600 16px "Inter Tight"'), errs: window.__errs })));
  await p.close(); } await b.close(); })();
