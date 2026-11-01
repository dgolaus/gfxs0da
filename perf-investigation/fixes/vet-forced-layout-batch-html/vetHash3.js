// hash loads: final landing scrollY + section states, 3 reps each, no scripted scroll
const puppeteer = require('../node_modules/puppeteer');
const { serve } = require('./disk.js');
const FIX = 'fixes/forced-layout';
const V = { base: {}, var: { '/script.js': FIX + '/script.js', '/index.html': FIX + '/index.html' }, js: { '/script.js': FIX + '/script.js' }, html: { '/index.html': FIX + '/index.html' } };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const urls = ['/#pricing'];
  for (const url of urls) {
    const line = {};
    for (const vn of ['base', 'js', 'html']) {
      line[vn] = [];
      for (let rep = 0; rep < 10; rep++) {
        const ctx = await browser.createBrowserContext();
        const p = await ctx.newPage();
        await p.setViewport({ width: 1440, height: 900 });
        await serve(p, V[vn]);
        const errs = [];
        p.on('pageerror', (e) => errs.push(e.message));
        await p.evaluateOnNewDocument(`try{localStorage.setItem('s0da-lite','0')}catch(e){}; Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8}); Object.defineProperty(navigator,'deviceMemory',{get:()=>8});`);
        await p.goto('http://localhost:5173' + url, { waitUntil: 'networkidle2', timeout: 60000 });
        await w8(1800);
        const r = await p.evaluate(() => {
          const cs = (el, k) => getComputedStyle(el).getPropertyValue(k).trim();
          const root = document.documentElement, nav = document.getElementById('nav');
          const secs = [...document.querySelectorAll('.scroll-fade')].map((s) => s.id + ':' + parseFloat(cs(s, '--leave')).toFixed(2) + ':' + cs(s, 'opacity').slice(0, 5));
          return { y: Math.round(scrollY), nav: nav ? [cs(nav, 'padding-top'), nav.className, cs(root, '--nav-pill')] : null, secs: secs.join(' '), inline: root.getAttribute('style') };
        });
        r.errs = errs.length;
        line[vn].push(r);
        await ctx.close();
      }
    }
    console.log(url);
    for (const vn of Object.keys(line)) console.log('  ', vn.padEnd(5), line[vn].map((r) => r.y + ':' + r.secs.split(' ').filter((s) => !/:0.00:/.test(s) && !/:1.00:/.test(s)).join(',')).join('  '));
  }
  await browser.close();
})().catch((e) => { console.error(e.stack); process.exit(1); });
