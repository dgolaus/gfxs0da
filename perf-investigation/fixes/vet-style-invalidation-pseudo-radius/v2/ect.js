// Element-count trace: UpdateLayoutTree elementCount per recalc in steady state, baseline vs variants.
// Structural (counts), not timing. 1x CPU. usage: node ect.js <rounds> <variant...>
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [rounds, ...vars] = process.argv.slice(2);
const OUT = path.join(__dirname, 'ect'); fs.mkdirSync(OUT, { recursive: true });
const SPOTS = [['top', null], ['testimonials', '#testimonials'], ['pricing', '#pricing']];

async function one(vname, rep) {
  const b = await L.launch();
  const { p } = await L.open(b, vname, { w: 1440, h: 900 });
  await p.goto(L.BASE + '/', { waitUntil: 'load' });
  await L.settle(p, 4000);
  const res = {};
  for (const [name, sel] of SPOTS) {
    await p.evaluate((sel) => {
      const y = sel ? document.querySelector(sel).getBoundingClientRect().top + scrollY + 40 : 0;
      if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
    }, sel);
    await L.w8(2500);
    const file = path.join(OUT, `tr_${vname}_${rep}_${name}.json`);
    await p.tracing.start({ path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
    await L.w8(3000);
    await p.tracing.stop();
    const ev = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents;
    const mains = new Set(ev.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain').map((m) => m.pid + ':' + m.tid));
    const counts = []; let frames = 0;
    for (const e of ev) {
      if (!mains.has(e.pid + ':' + e.tid)) continue;
      if (e.name === 'BeginMainThreadFrame' || (e.name === 'BeginFrame' && e.ph === 'I')) frames++;
      if (e.name !== 'UpdateLayoutTree') continue;
      const ec = e.args && (e.args.elementCount != null ? e.args.elementCount : (e.args.endData && e.args.endData.elementCount));
      if (ec != null) counts.push(ec);
    }
    const sorted = counts.slice().sort((a, b) => a - b);
    const sum = counts.reduce((a, b) => a + b, 0);
    res[name] = { recalcs: counts.length, sumElements: sum, perRecalcMedian: sorted[sorted.length >> 1] || 0, perRecalcMax: sorted[sorted.length - 1] || 0,
      elementsPerSec: Math.round(sum / 3), hist: Object.entries(counts.reduce((h, x) => { h[x] = (h[x] || 0) + 1; return h; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}x${v}`).join(' ') };
    fs.unlinkSync(file);
  }
  await b.close();
  return res;
}
(async () => {
  const all = {};
  for (let r = 0; r < +rounds; r++) for (const v of vars) { const x = await one(v, r); (all[v] = all[v] || []).push(x); console.log(v, r, JSON.stringify(x)); }
  fs.writeFileSync(path.join(OUT, 'ect_result.json'), JSON.stringify(all, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
