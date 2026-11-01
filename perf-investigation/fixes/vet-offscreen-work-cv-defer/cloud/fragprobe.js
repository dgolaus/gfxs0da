// Anchor load: does a frame get painted at the browser's own fragment position (target at viewport top,
// no 80px nav offset) before script.js's go() at load re-aims it? Counts per variant.
// node fragprobe.js <out.json> <WxH[m]> <hash> <reps> [throttle] ; VARS env
const fs = require('fs');
const L = require('./lib.js');
const [OUT, SZ, HASH, REPS, THR] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,base_i,cvd,cvw').split(',');
const mobile = SZ.endsWith('m'); const [W, H] = SZ.replace('m', '').split('x').map(Number);
const PRE = `(() => {
  const ev = window.__ev = [];
  const T = () => Math.round(performance.now());
  document.addEventListener('DOMContentLoaded', () => ev.push(['dcl', T(), scrollY]));
  window.addEventListener('load', () => ev.push(['load', T(), scrollY]), true);
  window.addEventListener('scroll', () => ev.push(['scroll', T(), scrollY]), { passive: true, capture: true });
  let last = -1; const f = () => { if (scrollY !== last) { ev.push(['frame', T(), scrollY]); last = scrollY; } if (performance.now() < 5000) requestAnimationFrame(f); }; requestAnimationFrame(f);
})();`;
(async () => {
  const res = []; const cnt = {};
  const b = await L.launch();
  for (let r = 0; r < +REPS; r++) for (const v of VARS) {
    const { p } = await L.open(b, v, { w: W, h: H, mobile, throttle: +(THR || 0), pre: PRE });
    await p.goto(L.BASE + '/#' + HASH, { waitUntil: 'load' });
    await L.w8(5000);
    const o = await p.evaluate((h) => ({ ev: window.__ev, fin: scrollY, tgt: document.getElementById(h).getBoundingClientRect().top + scrollY }), HASH);
    const frames = o.ev.filter((e) => e[0] === 'frame').map((e) => e[2]);
    const extra = frames.filter((y) => y !== 0 && y !== o.fin);
    cnt[v] = cnt[v] || { runs: 0, extraJump: 0 }; cnt[v].runs++; if (extra.length) cnt[v].extraJump++;
    res.push({ v, r, ...o, extra });
    console.log(v, r, 'fin', o.fin, 'extra frames', JSON.stringify(extra), JSON.stringify(o.ev.filter((e) => e[0] !== 'scroll' || true).slice(0, 12)));
    await p.close();
  }
  await b.close();
  console.log('COUNTS', JSON.stringify(cnt));
  fs.writeFileSync(OUT, JSON.stringify({ cnt, res }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
