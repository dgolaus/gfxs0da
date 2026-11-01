const puppeteer = require('../node_modules/puppeteer');
const { serve } = require('./disk.js');
const FIX = 'fixes/forced-layout';
const V = { base: {}, html: { '/index.html': FIX + '/index.html' } };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const HOOK = `(() => {
  window.__log = []; const T = () => Math.round(performance.now());
  const sp = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (k, v, pr) {
    if (k === '--leave' && v !== '0.000') window.__log.push(T() + ' w' + v + ' y' + Math.round(scrollY));
    return sp.call(this, k, v, pr);
  };
  addEventListener('DOMContentLoaded', () => window.__log.push(T() + ' DCL y' + Math.round(scrollY)));
  addEventListener('load', () => window.__log.push(T() + ' LOAD y' + Math.round(scrollY)), true);
  let ly = -1; addEventListener('scroll', () => { const y = Math.round(scrollY); if (y !== ly) { window.__log.push(T() + ' scroll y' + y); ly = y; } }, { passive: true });
})();`;
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const vn of ['base', 'html']) for (let rep = 0; rep < 3; rep++) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await serve(p, V[vn]);
    await p.evaluateOnNewDocument(`try{localStorage.setItem('s0da-lite','0')}catch(e){}; Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8}); Object.defineProperty(navigator,'deviceMemory',{get:()=>8});`);
    await p.evaluateOnNewDocument(HOOK);
    await p.goto('http://localhost:5173/#process', { waitUntil: 'networkidle2', timeout: 60000 });
    await w8(2500);
    const r = await p.evaluate(() => ({ log: window.__log.slice(0, 40), leave: getComputedStyle(document.getElementById('about')).getPropertyValue('--leave') }));
    console.log(vn, rep, 'final', r.leave, '\n   ', r.log.join(' | '));
    await ctx.close();
  }
  await browser.close();
})();
