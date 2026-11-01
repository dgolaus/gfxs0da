const { openPage } = require('../../bench.js');
const puppeteer = require('../node_modules/puppeteer');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const F = 'fixes/offscreen-work/';
const CV = { name: 'cv', files: { '/styles.css': F + 'styles.css', '/script.js': F + 'script.c2.js', '/smooth-scroll.js': F + 'smooth-scroll.js' } };
const [W, H] = (process.argv[2] || '390x844').split('x').map(Number);
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  for (const v of [{ name: 'base' }, CV]) {
    const { p } = await openPage(b, v, { throttle: 1 });
    await p.setViewport({ width: W, height: H, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await w8(2000);
    const r = await p.evaluate(() => {
      const de = document.documentElement;
      const wide = [];
      for (const el of document.querySelectorAll('#main *, #contact *')) { const r = el.getBoundingClientRect(); if (r.right > de.clientWidth + 0.5 && r.width > 0) wide.push((el.id ? '#' + el.id : '') + '.' + (el.className && el.className.baseVal === undefined ? el.className : '').toString().split(' ').join('.') + ' right=' + r.right.toFixed(1)); }
      const nb = document.querySelector('.nav > .btn') || document.querySelector('.nav .btn');
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, innerW: innerWidth, vv: visualViewport.width + '@' + visualViewport.scale, nav: nb && nb.getBoundingClientRect().right.toFixed(1), wide: wide.slice(0, 15) };
    });
    console.log(v.name, JSON.stringify(r, null, 1));
    await p.screenshot({ path: `shots/mob_${v.name}_${W}_top.png` });
    await p.close();
  }
  await b.close();
})();
