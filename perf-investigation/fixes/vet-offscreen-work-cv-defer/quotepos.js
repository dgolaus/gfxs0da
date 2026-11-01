/* Compare positions of testimonial quotes and price cards at a frozen frame, baseline vs variant. */
const fs = require('fs');
const puppeteer = require('../node_modules/puppeteer');
const SP = 'scratchpad';
const OW = SP + '/fixes/offscreen-work';
const RUNS = [{ name: 'base' }, { name: 'cv', files: { '/styles.css': OW + '/styles.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' } }];
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const res = {};
  for (const v of RUNS) {
    const b = await puppeteer.launch({ headless: 'new' });
    const p = await b.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    const map = v.files ? Object.fromEntries(Object.entries(v.files).map(([k, f]) => [k, fs.readFileSync(f)])) : {};
    await p.setRequestInterception(true);
    p.on('request', (req) => { const u = new URL(req.url()); let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
      if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: k.endsWith('.js') ? 'application/javascript' : 'text/css', body: map[k] }); req.continue(); });
    await p.evaluateOnNewDocument(() => { try { localStorage.setItem('s0da-lite', '0'); sessionStorage.setItem('s0da-booted', '1'); } catch (e) {}
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); });
    await p.goto('http://localhost:5173/', { waitUntil: 'load' });
    await p.evaluate(async () => { await document.fonts.ready; });
    await w8(2500);
    for (const y of [0, 675, 1350, 2025, 2700, 3375, 4050]) { await p.evaluate((y) => scrollTo(0, y), y); await w8(1400); }
    res[v.name] = await p.evaluate(() => {
      for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} }
      const tracks = [...document.querySelectorAll('.tcol-track')].map((t) => {
        const cs = getComputedStyle(t);
        return { tf: cs.transform, h: t.getBoundingClientRect().height, n: t.children.length,
          anim: t.getAnimations().map((a) => `${a.animationName}@${a.currentTime} start=${a.startTime}`).join(';'),
          html: t.innerHTML.length,
          q: [...t.children].slice(0, 4).map((q) => { const r = q.getBoundingClientRect(); return `${r.top.toFixed(3)},${r.height.toFixed(3)}`; }).join(' ') };
      });
      const cards = [...document.querySelectorAll('.price-card')].map((c) => { const r = c.getBoundingClientRect(); return `${r.left.toFixed(3)},${r.top.toFixed(3)} ${getComputedStyle(c).translate}`; });
      return { tracks, cards };
    });
    await b.close();
  }
  console.log(JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
