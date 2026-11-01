/* Is the final --leave at a fade position deterministic? It reads rect.bottom, which includes the
 * section's own (transitioning) transform, so it may depend on frame timing in BOTH variants. */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./bench.js');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const REPS = +(process.argv[3] || 3);
(async () => {
  const b = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000 });
  for (let r = 0; r < REPS; r++) for (const v of variants) {
    const { p } = await openPage(b, v, { throttle: 1 });
    await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await w8(2000);
    const pos = await p.evaluate(() => {
      const vh = innerHeight; const out = [];
      for (const id of ['about', 'process', 'trust', 'pricing']) {
        const bt = document.getElementById(id).getBoundingClientRect().bottom + scrollY;
        for (const f of [0.28, 0.2, 0.1, 0.02, -0.05]) out.push([id, f, Math.round(bt - vh * f)]);
      }
      return out;
    });
    const row = [];
    for (const [id, f, y] of pos) {
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); }, y);
      await w8(700);
      row.push(await p.evaluate((id) => document.getElementById(id).style.getPropertyValue('--leave') || '(unset)', id));
    }
    console.log(v.name.padEnd(10), 'rep', r, row.join(' '));
    await p.close();
  }
  await b.close();
})().catch((e) => { console.error('FAIL', e.stack || e.message); process.exit(1); });
