const { openPage } = require('../../bench.js');
const puppeteer = require('../node_modules/puppeteer');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const F = 'fixes/offscreen-work/';
const CV = { name: 'cv', files: { '/styles.css': F + 'styles.css', '/script.js': F + 'script.c2.js', '/smooth-scroll.js': F + 'smooth-scroll.js' } };
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  for (const v of process.argv[2] === 'base' ? [{ name: 'base' }] : [CV]) {
    const { p } = await openPage(b, v, { throttle: 1 });
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await w8(1500);
    const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const m = () => p.evaluate(() => { const de = document.documentElement; const nb = document.querySelector('.nav > .btn'); return `scrollW=${de.scrollWidth} vv=${visualViewport.width.toFixed(1)}@${visualViewport.scale.toFixed(3)} navR=${nb.getBoundingClientRect().right.toFixed(1)} sx=${scrollX}`; });
    for (let y = 0; y < total; y += 150) { await p.evaluate((y) => window.scrollTo(0, y), y); await w8(30); }
    console.log(v.name, 'after walk', await m());
    await w8(3000);
    console.log(v.name, 'after 3s', await m());
    await p.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 5000; } });
    await w8(300);
    console.log(v.name, 'paused5000', await m());
    await p.evaluate(() => window.scrollTo(0, 1948)); await w8(500);
    console.log(v.name, 'y1948', await m());
    await p.evaluate(() => { const s = document.createElement('style'); s.id = '__nocv'; s.textContent = '#main > section, #contact { content-visibility: visible !important; }'; document.head.appendChild(s); });
    await w8(300);
    console.log(v.name, 'nocv', await m());
    const wide = await p.evaluate(() => { const out = []; for (const el of document.querySelectorAll('#main > section:not(.hero):not(.work) *, #contact *')) { const r = el.getBoundingClientRect(); if (r.right > 391 && r.width > 0 && r.width < 2000) out.push(el.tagName + '.' + String(el.className).split(' ').slice(0, 2).join('.') + ' R' + r.right.toFixed(0)); } return out.slice(0, 20); });
    console.log(wide);
    await p.close();
  }
  await b.close();
})();
