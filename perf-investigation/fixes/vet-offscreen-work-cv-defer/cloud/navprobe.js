// Nav pill state vs scroll position on mobile after a jump to the bottom (walk.js 'jump' order).
// node navprobe.js <WxH[m]> ; VARS env
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
    const st = () => p.evaluate(() => {
      const nav = document.getElementById('nav'); const btn = nav.querySelector('.btn'); const r = btn.getBoundingClientRect(); const nr = nav.getBoundingClientRect();
      const rs = document.documentElement.style;
      return [Math.round(scrollY), rs.getPropertyValue('--nav-pill'), nav.className, Math.round(r.left * 10) / 10, Math.round(r.right * 10) / 10, Math.round(nr.left * 10) / 10, Math.round(nr.width * 10) / 10, getComputedStyle(nav).width];
    });
    const out = [await st()];
    const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (const y of [maxY, 3000, 844, 422, 0]) { await p.evaluate((y) => scrollTo(0, y), y); await L.w8(1300); out.push(await st()); }
    console.log(v, SZ, JSON.stringify(out));
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
