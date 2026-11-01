// Horizontal overflow on narrow / mobile viewports: layout viewport width, scrollWidth, fixed nav position,
// and the elements inside the deferred sections whose box extends past the viewport (baseline vs variant).
// node width.js <WxH[m]> ; VARS env
const L = require('./lib.js');
const [SZ] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,cvd_gh3').split(',');
const mobile = SZ.endsWith('m'); const [W, H] = SZ.replace('m', '').split('x').map(Number);
(async () => {
  for (const v of VARS) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: W, h: H, mobile });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    const g = () => p.evaluate((W) => {
      const nb = document.querySelector('#nav .btn'); const r = nb ? nb.getBoundingClientRect() : null;
      return { innerW: innerWidth, vvW: visualViewport ? Math.round(visualViewport.width * 100) / 100 : null, scale: visualViewport ? visualViewport.scale : null, docSW: document.documentElement.scrollWidth, bodySW: document.body.scrollWidth, navBtnRight: r ? Math.round(r.right * 100) / 100 : null, sx: scrollX };
    }, W);
    const top = await g();
    // offenders (only measured in baseline, where nothing is skipped)
    let off = [];
    if (v === 'baseline') off = await p.evaluate((W) => [...document.querySelectorAll('#main > section, #contact')].flatMap((s) => [...s.querySelectorAll('*')].map((e) => { const r = e.getBoundingClientRect(); return [s.id, e.tagName.toLowerCase() + '.' + [...e.classList].slice(0, 2).join('.'), Math.round(r.right * 10) / 10, Math.round((r.top + scrollY))]; }).filter((x) => x[2] > W + 0.5)).slice(0, 15), W);
    await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await L.w8(1500);
    const bottom = await g();
    console.log(v, SZ, 'top', JSON.stringify(top), 'bottom', JSON.stringify(bottom), off.length ? 'overflowing: ' + JSON.stringify(off) : '');
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
