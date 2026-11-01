const puppeteer = require('../node_modules/puppeteer');
const sharp = require('../node_modules/sharp');
const { serve } = require('./disk.js');
const FIX = 'fixes/forced-layout';
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const out = [];
  for (const url of ['/#pricing', '/#process', '/#contact']) for (let rep = 0; rep < 2; rep++) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await serve(p, {});
    await p.evaluateOnNewDocument(`try{localStorage.setItem('s0da-lite','0')}catch(e){}; Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8}); Object.defineProperty(navigator,'deviceMemory',{get:()=>8});`);
    await p.goto('http://localhost:5173' + url, { waitUntil: 'networkidle2', timeout: 60000 });
    await w8(1800);
    // freeze, then force the section above to two leave values and screenshot each (same page, same everything else)
    const prev = { '/#pricing': 'trust', '/#process': 'about', '/#contact': 'pricing' }[url];
    await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} } document.querySelectorAll('.scroll-fade').forEach((s) => s.style.transition = 'none'); });
    const shots = [];
    for (const lv of ['0.790', '0.760', '0.720']) {
      await p.evaluate((id, lv) => document.getElementById(id).style.setProperty('--leave', lv), prev, lv);
      await w8(200);
      const f = `strip_${prev}_${lv}_${rep}.png`;
      await p.screenshot({ path: f });
      shots.push(f);
    }
    const d = async (a, b) => { const A = await sharp(a).raw().toBuffer({ resolveWithObject: true }); const B = await sharp(b).raw().toBuffer({ resolveWithObject: true }); const ch = A.info.channels; let n = 0, maxY = -1, sum = 0; for (let i = 0; i < A.info.width * A.info.height; i++) { const o = i * ch; const dd = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; sum += dd; if (dd > 2) { n++; maxY = Math.max(maxY, Math.floor(i / A.info.width)); } } return { px: n, maxY, mad: +(sum / (A.info.width * A.info.height)).toFixed(4) }; };
    console.log(url, prev, rep, '0.79 vs 0.76', JSON.stringify(await d(shots[0], shots[1])), '0.79 vs 0.72', JSON.stringify(await d(shots[0], shots[2])));
    await ctx.close();
  }
  await browser.close();
})();
