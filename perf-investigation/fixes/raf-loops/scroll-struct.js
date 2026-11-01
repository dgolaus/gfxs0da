/* Structural (not timing) probe of scroll-time style work: wheel-scrolls the page in steps
 * and sums UpdateLayoutTree element counts. Usage: SERVE_FROM_DISK=1 node scroll-struct.js <variants.json> */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./vis/bench.js');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const PHASES = [
  { name: 'top0-400', from: 0, steps: 8, dy: 50 },          // nav pill morph zone
  { name: 'sections', from: 2000, steps: 16, dy: 120 },     // about/process fade zone
];
(async () => {
  const b = await puppeteer.launch({ headless: 'new', protocolTimeout: 600000 });
  for (const v of variants) {
    const { p } = await openPage(b, v, { throttle: 1 });
    await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await w8(4000);
    const row = [];
    for (const ph of PHASES) {
      await p.evaluate((y) => { window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y); }, ph.from);
      await w8(800);
      const file = path.join(__dirname, `ss_${v.name}_${ph.name}.json`);
      await p.tracing.start({ path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
      await p.mouse.move(700, 450);
      for (let i = 0; i < ph.steps; i++) { await p.mouse.wheel({ deltaY: ph.dy }); await w8(60); }
      await w8(1200);
      await p.tracing.stop();
      const ev = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents; fs.unlinkSync(file);
      const metas = ev.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain').map((m) => m.pid + ':' + m.tid);
      const cnt = {}; for (const e of ev) { const k = e.pid + ':' + e.tid; if (metas.includes(k)) cnt[k] = (cnt[k] || 0) + 1; }
      const main = Object.entries(cnt).sort((a, z) => z[1] - a[1])[0][0];
      const U = ev.filter((e) => e.ph === 'X' && e.name === 'UpdateLayoutTree' && (e.pid + ':' + e.tid) === main);
      const elems = U.reduce((a, e) => a + ((e.args && e.args.elementCount) || 0), 0);
      const big = U.filter((e) => ((e.args && e.args.elementCount) || 0) >= 300).length;
      const endY = await p.evaluate(() => Math.round(scrollY));
      row.push(`${ph.name}: recalcs=${U.length} elems=${elems} recalcs>=300elems=${big} endY=${endY}`);
    }
    console.log(v.name.padEnd(30), row.join(' | '));
    await p.close();
  }
  await b.close();
})().catch((e) => { console.error('FAIL', e.stack || e.message); process.exit(1); });
