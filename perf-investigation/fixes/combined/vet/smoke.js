const L = require('./lib');
(async () => { for (const [v, o] of [['baseline', {}], ['combined', {}], ['combined', { mobile: true, w: 390, h: 844, touch: true }]]) {
  const b = await L.launch(o); const { p } = await L.open(b, v, o);
  await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 1500);
  console.log(v, JSON.stringify(o), JSON.stringify(await p.evaluate(() => ({ lenis: !!window.lenis, hoverNone: matchMedia('(hover: none)').matches, h: document.documentElement.scrollHeight,
    leaveProp: CSS.supports && getComputedStyle(document.getElementById('about')).getPropertyValue('--leave'), errs: window.__errs }))), p.__errs || []);
  await b.close(); } })();
