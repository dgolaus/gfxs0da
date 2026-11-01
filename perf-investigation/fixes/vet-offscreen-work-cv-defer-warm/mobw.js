const { openPage } = require('../../bench.js');
const puppeteer = require('../node_modules/puppeteer');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const { p } = await openPage(b, { name: 'base' }, { throttle: 1 });
  for (const W of (process.argv[2] || '320,360,375,390,414,430,480,540,600,700,760,1000,1100,1280,1440').split(',').map(Number)) {
    const mob = W < 768;
    await p.setViewport({ width: W, height: 844, isMobile: mob, hasTouch: mob });
    await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await w8(800);
    const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    let maxSW = 0; const culprits = new Set();
    for (let y = 0; y < total; y += 200) {
      await p.evaluate((y) => window.scrollTo(0, y), y); await w8(60);
      const r = await p.evaluate(() => { const de = document.documentElement; const out = []; if (de.scrollWidth > de.clientWidth) { for (const s of document.querySelectorAll('#main > section, #contact')) { for (const el of s.querySelectorAll('*')) { const rr = el.getBoundingClientRect(); if (rr.right > de.clientWidth + 0.5 && rr.width > 0) { out.push(s.id + ':' + el.tagName + '.' + String(el.className).split(' ')[0]); break; } } } } return { sw: de.scrollWidth, out }; });
      maxSW = Math.max(maxSW, r.sw); r.out.forEach((x) => culprits.add(x));
    }
    await w8(2500);
    const sw2 = await p.evaluate(() => document.documentElement.scrollWidth);
    console.log(W, 'maxScrollW', maxSW, 'final', sw2, [...culprits].join(' '));
  }
  await b.close();
})();
