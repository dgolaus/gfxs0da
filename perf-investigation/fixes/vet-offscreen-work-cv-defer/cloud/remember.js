// Does contain-intrinsic-height:auto remember the real height after a section has rendered once?
// Scroll down at a given pace, then at the bottom compare each cv section's height (auto, skipped)
// with its real height (content-visibility forced visible). node remember.js <WxH[m]> <stepPx> <waitMs> [variant]
const L = require('./lib.js');
const [SZ, STEP, WAIT, V0] = process.argv.slice(2);
const mobile = SZ.endsWith('m'); const [W, H] = SZ.replace('m', '').split('x').map(Number);
(async () => {
  const b = await L.launch();
  const { p } = await L.open(b, V0 || 'cvd_gh3', { w: W, h: H, mobile });
  await p.goto(L.BASE + '/', { waitUntil: 'load' });
  await L.settle(p, 2000);
  const hs = () => p.evaluate(() => [...document.querySelectorAll('#main > section.about, #main > section.process, #main > section.trust, #main > section.pricing, #contact')].map((s) => s.id + ':' + s.offsetHeight));
  console.log('top      ', JSON.stringify(await hs()));
  const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const log = [];
  for (let y = 0; y <= maxY + +STEP; y += +STEP) {
    await p.evaluate((y) => { window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); }, Math.min(y, maxY));
    await L.w8(+WAIT);
  }
  await L.w8(1000);
  console.log('bottom   ', JSON.stringify(await hs()));
  await p.evaluate(() => { const s = document.createElement('style'); s.id = '__off'; s.textContent = '#main > section, #contact{content-visibility:visible !important}'; document.head.appendChild(s); });
  await L.w8(300);
  console.log('visible  ', JSON.stringify(await hs()));
  await p.evaluate(() => document.getElementById('__off').remove());
  await L.w8(300);
  console.log('auto again', JSON.stringify(await hs()));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
