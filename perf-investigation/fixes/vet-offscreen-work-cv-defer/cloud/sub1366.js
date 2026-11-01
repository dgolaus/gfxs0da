// Cross-load check of the 'Check Slots' label subpixel shift seen in walk L_j1366/L_j1366b at y=2688.
// Loads each variant, waits WAIT ms, optional End+back (walk 'jump' order), scrolls to 2688, freezes,
// screenshots the button region and dumps the label's text range rect. node sub1366.js <waitMs> <jump0|1> ; VARS env
const fs = require('fs'); const path = require('path');
const L = require('./lib.js');
const [WAIT, JUMP] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,base_i,cvd_gh3,cvw_stay').split(',');
const OUT = path.join(__dirname, 'out', 'L_sub1366'); fs.mkdirSync(OUT, { recursive: true });
const to = (p, y) => p.evaluate((y) => window.lenis.scrollTo(y, { immediate: true, force: true }), y);
(async () => {
  const shots = {};
  for (const v of VARS) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: 1366, h: 768 });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, +WAIT);
    if (JUMP === '1') { await to(p, 5181); await L.w8(1300); for (const y of [4992, 4608, 4224, 3840, 3456, 3072]) { await to(p, y); await L.w8(600); } }
    await to(p, 2688); await L.w8(1300);
    await L.freeze(p);
    const info = await p.evaluate(() => {
      const a = [...document.querySelectorAll('#process a')].find((x) => /Check Slots/.test(x.textContent));
      const r = a.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(a); const t = rg.getBoundingClientRect();
      const sec = document.getElementById('process').getBoundingClientRect();
      return { btn: [r.left, r.top, r.width, r.height].map((x) => Math.round(x * 1000) / 1000), text: [t.left, t.top, t.width].map((x) => Math.round(x * 1000) / 1000), sec: [sec.left, sec.top].map((x) => Math.round(x * 1000) / 1000), font: getComputedStyle(a).fontFamily + ' ' + getComputedStyle(a).fontWeight, cv: document.getElementById('process').style.contentVisibility };
    });
    const f = path.join(OUT, `${v}_${WAIT}_${JUMP}.png`);
    await p.screenshot({ path: f, clip: { x: 250, y: 380, width: 300, height: 110 } });
    shots[v] = f;
    console.log(v, JSON.stringify(info));
    await b.close();
  }
  for (const v of VARS.slice(1)) console.log('diff', VARS[0], 'vs', v, JSON.stringify(await L.diff(shots[VARS[0]], shots[v])));
})().catch((e) => { console.error(e); process.exit(1); });
