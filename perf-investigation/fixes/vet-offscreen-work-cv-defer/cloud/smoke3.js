const L = require('./lib.js');
(async () => { const b = await L.launch();
  for (const mobile of [false, true]) { const { p } = await L.open(b, 'baseline', { w: mobile ? 390 : 1440, h: mobile ? 844 : 900, mobile }); await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.w8(2000);
  console.log(mobile ? 'mobile' : 'desktop', await p.evaluate(() => ['(hover: none)','(hover: hover)','(pointer: fine)','(pointer: coarse)'].map((m) => m + '=' + matchMedia(m).matches).join(' ') + ' lenis=' + !!window.lenis + ' limit=' + (window.lenis && window.lenis.limit)));
  await p.close(); }
  await b.close(); })();
