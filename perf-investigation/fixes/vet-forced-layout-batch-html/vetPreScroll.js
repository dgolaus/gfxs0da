const puppeteer = require('../node_modules/puppeteer');
const sharp = require('../node_modules/sharp');
const { serve } = require('./disk.js');
const FIX = 'fixes/forced-layout';
const V = { base: {}, base2: {}, var: { '/script.js': FIX + '/script.js', '/index.html': FIX + '/index.html' } };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
async function d(a, b) { const A = await sharp(a).raw().toBuffer({ resolveWithObject: true }); const B = await sharp(b).raw().toBuffer({ resolveWithObject: true }); const ch = A.info.channels, W = A.info.width; let n = 0, s = 0, mx = 0; for (let i = 0; i < W * A.info.height; i++) { const o = i * ch; const dd = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; s += dd; if (dd > 8) n++; if (dd > mx) mx = dd; } return { mad: +(s / (W * A.info.height)).toFixed(3), pct: +(n / (W * A.info.height) * 100).toFixed(3), max: Math.round(mx) }; }
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const id of ['about', 'process', 'trust', 'pricing']) {
    const f = {};
    for (const vn of ['base', 'base2', 'var']) {
      const ctx = await browser.createBrowserContext();
      const p = await ctx.newPage();
      await p.setViewport({ width: 1440, height: 900 });
      await serve(p, V[vn], { holdScript: 12000 });
      await p.evaluateOnNewDocument(`try{sessionStorage.setItem('s0da-booted','1');localStorage.setItem('s0da-lite','0')}catch(e){}; Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8}); Object.defineProperty(navigator,'deviceMemory',{get:()=>8});`);
      p.goto('http://localhost:5173/', { timeout: 60000 }).catch(() => {});
      await w8(3500);
      const st = await p.evaluate((id) => { const el = document.getElementById(id); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 200); return document.readyState; }, id);
      await w8(1500);
      await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 3000; } catch (e) {} } });
      await w8(300);
      f[vn] = `pre_${id}_${vn}.png`;
      const ready = await p.evaluate(() => document.readyState + ' y' + Math.round(scrollY));
      await p.screenshot({ path: f[vn] });
      console.log(id, vn, st, ready);
      await ctx.close();
    }
    console.log(id, 'noise', JSON.stringify(await d(f.base, f.base2)), 'var', JSON.stringify(await d(f.base, f.var)));
  }
  await browser.close();
})();
