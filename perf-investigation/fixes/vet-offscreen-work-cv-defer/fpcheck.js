const fs = require('fs');
const puppeteer = require('../node_modules/puppeteer');
const SP = 'scratchpad';
const OW = SP + '/fixes/offscreen-work';
const RUNS = [{ name: 'base' }, { name: 'cv', files: { '/styles.css': OW + '/styles.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' } }];
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (const v of RUNS) {
    const b = await puppeteer.launch({ headless: 'new' });
    const p = await b.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    const map = v.files ? Object.fromEntries(Object.entries(v.files).map(([k, f]) => [k, fs.readFileSync(f)])) : {};
    await p.setRequestInterception(true);
    p.on('request', (req) => { const u = new URL(req.url()); let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
      if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: k.endsWith('.js') ? 'application/javascript' : 'text/css', body: map[k] }); req.continue(); });
    await p.evaluateOnNewDocument(() => { try { localStorage.setItem('s0da-lite', '0'); sessionStorage.setItem('s0da-booted', '1'); } catch (e) {}
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); });
    await p.goto('http://localhost:5173/', { waitUntil: 'load' });
    await w8(2500);
    const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const log = [];
    for (let y = 0; y <= maxY + 675; y += 675) {
      const yy = Math.min(y, maxY);
      await p.evaluate((y) => scrollTo(0, y), yy); await w8(1400);
      log.push(await p.evaluate(() => {
        const f = document.querySelector('.cfooter'), c = document.getElementById('contact');
        return `y=${Math.round(scrollY)} fp=${f.style.getPropertyValue('--fp')} leave=${c.style.getPropertyValue('--leave')} mainB=${document.querySelector('main').getBoundingClientRect().bottom.toFixed(2)} fH=${f.offsetHeight}`;
      }));
      if (yy === maxY) break;
    }
    console.log(v.name, '\n  ' + log.join('\n  '));
    await b.close();
  }
})();
