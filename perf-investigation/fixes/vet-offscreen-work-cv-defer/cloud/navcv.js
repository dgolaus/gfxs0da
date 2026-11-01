// Mobile: why does the fixed nav CTA move when the deferred sections switch content-visibility auto <-> visible?
const L = require('./lib.js');
(async () => {
  const b = await L.launch();
  const { p } = await L.open(b, process.argv[2] || 'cvd_gh3', { w: 390, h: 844, mobile: true });
  await p.goto(L.BASE + '/', { waitUntil: 'load' });
  await L.settle(p, 2000);
  await p.evaluate(() => scrollTo(0, 1772)); await L.w8(1500);
  const m = () => p.evaluate(() => { const n = document.getElementById('nav'), bt = n.querySelector('.btn'); const r = bt.getBoundingClientRect(), nr = n.getBoundingClientRect();
    return { btn: [r.left, r.right].map((x) => Math.round(x * 100) / 100), nav: [nr.left, nr.width].map((x) => Math.round(x * 100) / 100), tf: getComputedStyle(bt).transform, op: getComputedStyle(bt).opacity, pill: document.documentElement.style.getPropertyValue('--nav-pill'),
      cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, vv: [visualViewport.width, visualViewport.scale, visualViewport.offsetLeft], sx: scrollX, iw: innerWidth }; });
  console.log('auto      ', JSON.stringify(await m()));
  const ids = ['about', 'process', 'trust', 'pricing', 'contact'];
  for (const id of ids) {
    await p.evaluate((id) => { document.getElementById(id).style.contentVisibility = 'visible'; }, id); await L.w8(300);
    console.log('visible ' + id.padEnd(8), JSON.stringify(await m()));
    await p.evaluate((id) => { document.getElementById(id).style.contentVisibility = ''; }, id); await L.w8(300);
  }
  await p.evaluate((ids) => ids.forEach((id) => { document.getElementById(id).style.contentVisibility = 'visible'; }), ids); await L.w8(300);
  console.log('all vis   ', JSON.stringify(await m()));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
