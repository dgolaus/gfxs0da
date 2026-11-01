const puppeteer = require('../node_modules/puppeteer');
const { serve } = require('./disk.js');
const FIX = 'fixes/forced-layout';
const V = { base: {}, var: { '/script.js': FIX + '/script.js', '/index.html': FIX + '/index.html' } };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const vn of ['base', 'var', 'base', 'var']) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await serve(p, V[vn]);
    await p.evaluateOnNewDocument(`try{localStorage.setItem('s0da-lite','0')}catch(e){}; Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8}); Object.defineProperty(navigator,'deviceMemory',{get:()=>8});`);
    const c = await p.target().createCDPSession();
    let last = null; c.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers && e.layers.length) last = e.layers; });
    const snap = async () => { last = null; await c.send('LayerTree.enable'); await w8(700); await c.send('LayerTree.disable'); const ls = (last || []).filter((l) => l.drawsContent); return ls.length + ' layers ' + (ls.reduce((a, l) => a + l.width * l.height, 0) / 1e6).toFixed(1) + 'MP big:' + ls.filter((l) => l.width > 4096 || l.height > 4096).map((l) => Math.round(l.width) + 'x' + Math.round(l.height)).join(','); };
    p.goto('http://localhost:5173/', { timeout: 60000 }).catch(() => {});
    await w8(1200); const early = await snap();
    await w8(2500); const top = await snap();
    await p.evaluate(() => { const y = document.getElementById('trust').offsetTop; if (window.lenis) window.lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y); });
    await w8(1500); const mid = await snap();
    console.log(vn.padEnd(5), '| ~1.2s:', early, '| top:', top, '| trust:', mid);
    await ctx.close();
  }
  await browser.close();
})();
