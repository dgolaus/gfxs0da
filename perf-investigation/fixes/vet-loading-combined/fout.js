// Measures, frame by frame during real loading (CPU 4x), whether the hero text is
// visible while its web font is not yet loaded (FOUT), for baseline vs variant.
const path = require('path');
const fs = require('fs');
const SP = 'scratchpad';
const { openPage } = require('./page.js');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const reps = +(process.argv[3] || 2);
const LOG = `(() => {
  window.__fl = [];
  const st = (fam) => { let s = 'none'; try { for (const f of document.fonts) { if (f.family.replace(/"/g,'') === fam && /U\\+0-FF|U\\+0000-00FF/i.test(f.unicodeRange)) { if (f.status === 'loaded') return 'L'; s = f.status[0]; } } } catch (e) {} return s; };
  const tick = (t) => {
    const hi = document.querySelector('.hero-inner'), h1 = document.querySelector('.hero-title');
    let op = null, w = null;
    if (hi) { op = +getComputedStyle(hi).opacity; }
    if (h1) { w = Math.round(h1.getBoundingClientRect().height); }
    window.__fl.push([Math.round(t), op == null ? null : +op.toFixed(2), w, st('Inter Tight'), st('Inter'), st('JetBrains Mono')]);
    if (t < 8000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const mode of ['cold', 'warm']) for (let r = 0; r < reps; r++) for (const v of variants) {
    if (mode === 'warm') { // prime cache
      const { p } = await openPage(browser, v, { throttle: 1 }); await p.setCacheEnabled(true);
      await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await p.close();
    }
    const { p, c } = await openPage(browser, v, { throttle: 4 });
    await p.setCacheEnabled(mode !== 'cold');
    await p.evaluateOnNewDocument(LOG);
    const reqs = [];
    p.on('requestfinished', (q) => { const u = q.url(); if (u.includes('gstatic')) reqs.push(u.split('/').pop().slice(-14)); });
    await p.goto('http://localhost:5173/', { waitUntil: 'load' });
    await new Promise((res) => setTimeout(res, 3500));
    const fl = await p.evaluate(() => window.__fl);
    // summarize: frames where hero visible (op>0.05) and Inter Tight not loaded
    const vis = fl.filter((x) => x[1] != null && x[1] > 0.05);
    const fout = vis.filter((x) => x[3] !== 'L');
    const firstVis = vis[0] ? vis[0][0] : null;
    const itLoaded = (fl.find((x) => x[3] === 'L') || [null])[0];
    const heights = [...new Set(fl.filter((x) => x[2] != null).map((x) => x[2]))];
    console.log(`${mode} ${v.name.padEnd(16)} firstHeroVisible@${firstVis} interTightLoaded@${itLoaded} FOUTframes=${fout.length} (op up to ${fout.length ? Math.max(...fout.map((x) => x[1])) : 0}) h1Heights=${heights.join('/')} gstatic=${reqs.length}`);
    await p.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
