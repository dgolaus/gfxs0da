// Which font faces are loaded while the visitor stays at the top (baseline vs variant)?
// And on an anchor load, when does each face finish relative to the jump (FOUT window)?
// node fontprobe.js <out.json> <WxH[m]> [hash] ; VARS env
const fs = require('fs');
const L = require('./lib.js');
const [OUT, SZ, HASH] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,base_i,cvd,cvw').split(',');
const mobile = SZ.endsWith('m'); const [W, H] = SZ.replace('m', '').split('x').map(Number);
const PRE = `(() => {
  window.__fl = [];
  const t0 = performance.now();
  const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (/fonts\\.gstatic|\\.woff2?/.test(e.name)) window.__fl.push([Math.round(e.startTime), Math.round(e.responseEnd), e.name.split('/').slice(-3).join('/')]); }));
  po.observe({ type: 'resource', buffered: true });
  window.__jump = null; let last = 0;
  const f = () => { if (window.__jump == null && scrollY > 10) window.__jump = Math.round(performance.now()); if (performance.now() < 6000) requestAnimationFrame(f); }; requestAnimationFrame(f);
})();`;
(async () => {
  const res = {};
  const b = await L.launch();
  for (const v of VARS) {
    const ctx = await b.createBrowserContext();   // fresh HTTP cache per run
    const { p } = await L.open(ctx, v, { w: W, h: H, mobile, pre: PRE });
    await p.goto(L.BASE + '/' + (HASH ? '#' + HASH : ''), { waitUntil: 'load' });
    await L.w8(6000);
    const o = await p.evaluate(() => ({
      faces: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.unicodeRange.slice(0, 14)} ${f.status}`).filter((s) => !s.endsWith('unloaded')),
      fl: window.__fl, jump: window.__jump, load: Math.round(performance.getEntriesByType('navigation')[0].loadEventStart),
    }));
    res[v] = o;
    console.log(v, 'loaded faces', o.faces.length, 'font fetches', o.fl.length, 'jump at', o.jump, 'load', o.load);
    await ctx.close();
  }
  await b.close();
  const B = res[VARS[0]];
  for (const v of VARS.slice(1)) {
    const R = res[v];
    console.log(v, 'faces only in baseline:', JSON.stringify(B.faces.filter((f) => !R.faces.includes(f))), 'only in variant:', JSON.stringify(R.faces.filter((f) => !B.faces.includes(f))));
    const late = R.fl.filter((x) => !B.fl.some((y) => y[2] === x[2]) || x[0] > 1500);
    console.log('   ', v, 'font fetches started >1.5s or not in baseline:', JSON.stringify(late));
  }
  console.log('baseline fetches', JSON.stringify(B.fl));
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
