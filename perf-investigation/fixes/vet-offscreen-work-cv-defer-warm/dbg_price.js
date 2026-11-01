const path = require('path');
const { openPage } = require('../../bench.js');
const puppeteer = require('../node_modules/puppeteer');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const F = 'fixes/offscreen-work/';
const V = process.argv[3] === 'base' ? { name: 'base' } : { name: 'cv', files: { '/styles.css': F + 'styles.css', '/script.js': F + 'script.c2.js', '/smooth-scroll.js': F + 'smooth-scroll.js' } };
const [W, H] = (process.argv[2] || '1280x800').split('x').map(Number);
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const { p } = await openPage(b, V, { throttle: 1 });
  await p.setViewport({ width: W, height: H });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await w8(1500);
  const info = () => p.evaluate(() => {
    const cards = [...document.querySelectorAll('.price-card')];
    return cards.map((c) => {
      const cs = getComputedStyle(c);
      const an = c.getAnimations().map((a) => `${a.animationName || a.id}:${a.playState}:${Math.round(a.currentTime)}`);
      return { cls: c.className, translate: cs.translate, anim: cs.animationName, border: cs.borderColor, an, top: Math.round(c.getBoundingClientRect().top) };
    });
  });
  const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y < total; y += 150) { await p.evaluate((y) => window.scrollTo(0, y), y); await w8(30); }
  await p.evaluate(() => { const s = document.getElementById('pricing'); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 100); });
  await w8(1500);
  console.log('A', JSON.stringify(await info(), null, 0));
  await p.evaluate(() => { const s = document.createElement('style'); s.id = '__nocv'; s.textContent = '#main > section, #contact { content-visibility: visible !important; contain-intrinsic-size: none !important; }'; document.head.appendChild(s); });
  await w8(300);
  console.log('B', JSON.stringify(await info(), null, 0));
  console.log(await p.evaluate(() => { const s = document.getElementById('pricing'); const cs = getComputedStyle(s); return [cs.contentVisibility, cs.containIntrinsicHeight, s.getAttribute('style'), document.querySelector('.pricing-grid').matches(':has(.price-card:hover)')]; }));
  await b.close();
})();
