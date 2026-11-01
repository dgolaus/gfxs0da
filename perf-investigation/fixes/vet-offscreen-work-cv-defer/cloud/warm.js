// Where do deferred-section renders land in time when the visitor stays at the top?
// Logs: inline content-visibility flips on the cv sections (warm-up / settle), idle callbacks (duration),
// long tasks, rAF gaps > 50ms, all relative to navigation start. node warm.js <out.json> <throttle> <reps> ; VARS env
const fs = require('fs');
const L = require('./lib.js');
const [OUT, THR, REPS] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,cvd,cvw').split(',');
const PRE = `(() => {
  const log = window.__wl = { flips: [], idle: [], lt: [], gaps: [] };
  const ric = window.requestIdleCallback;
  if (ric) window.requestIdleCallback = (fn, o) => ric((d) => { const t0 = performance.now(); fn(d); log.idle.push([Math.round(t0), Math.round(performance.now() - t0)]); }, o);
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => log.lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  let last = 0; const f = (t) => { if (last && t - last > 50) log.gaps.push([Math.round(last), Math.round(t - last)]); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#main > section, #contact').forEach((s) => new MutationObserver(() => log.flips.push([Math.round(performance.now()), s.id, s.style.contentVisibility || 'auto'])).observe(s, { attributes: true, attributeFilter: ['style'] }));
  });
})();`;
(async () => {
  const res = [];
  const b = await L.launch();
  for (let r = 0; r < +REPS; r++) for (const v of VARS) {
    const { p } = await L.open(b, v, { w: 1440, h: 900, throttle: +THR, pre: PRE });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.w8(14000);
    const w = await p.evaluate(() => ({ ...window.__wl, load: Math.round(performance.getEntriesByType('navigation')[0].loadEventStart) }));
    const inWin = (x) => x[0] >= 3500 && x[0] <= 8500;
    const s = { v, r, load: w.load, flips: w.flips, idleMax: w.idle.reduce((m, x) => Math.max(m, x[1]), 0), idle: w.idle.filter((x) => x[1] > 5),
      ltAfter3s: w.lt.filter((x) => x[0] > 3000), gapsAfter3s: w.gaps.filter((x) => x[0] > 3000), ltInSteady: w.lt.filter(inWin), gapsInSteady: w.gaps.filter(inWin) };
    res.push(s);
    console.log(JSON.stringify(s));
    await p.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
