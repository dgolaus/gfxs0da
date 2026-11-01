const puppeteer = require('../node_modules/puppeteer');
const { serve } = require('./disk.js');
const FIX = 'fixes/forced-layout';
const V = { base: {}, var: { '/script.js': FIX + '/script.js' } };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const HOOK = `(() => {
  window.__log = []; const T = () => Math.round(performance.now());
  const sp = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (k, v, pr) {
    if (k === '--leave' && v !== '0.000') window.__log.push(T() + ' L' + v + ' y' + scrollY.toFixed(1));
    return sp.call(this, k, v, pr);
  };
  addEventListener('load', () => { window.__log.push(T() + ' LOAD y' + scrollY.toFixed(1) + ' H' + document.documentElement.scrollHeight); }, true);
  let ly = -1; addEventListener('scroll', () => { const y = scrollY; if (y !== ly) { window.__log.push(T() + ' s' + y.toFixed(1)); ly = y; } }, { passive: true });
})();`;
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const url of (process.argv[2] || '/tos/#refunds').split(',')) for (const vn of ['base', 'var', 'base', 'var']) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await serve(p, V[vn]);
    await p.evaluateOnNewDocument(`try{localStorage.setItem('s0da-lite','0')}catch(e){}; Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8}); Object.defineProperty(navigator,'deviceMemory',{get:()=>8});`);
    await p.evaluateOnNewDocument(HOOK);
    await p.goto('http://localhost:5173' + url, { waitUntil: 'networkidle2', timeout: 60000 });
    await w8(2500);
    const r = await p.evaluate(() => { const t = document.getElementById(location.hash.slice(1)); return { y: scrollY, H: document.documentElement.scrollHeight, lim: window.lenis && window.lenis.limit, top: t.getBoundingClientRect().top, log: window.__log.join(' | ') }; });
    console.log(url, vn, JSON.stringify({ y: r.y, H: r.H, lim: r.lim, top: r.top }), '\n   ', r.log);
    await ctx.close();
  }
  await browser.close();
})();
