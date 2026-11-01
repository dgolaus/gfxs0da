/* Compare testimonial tracks (children count, heights, transform) baseline vs variant,
   at the moment the cloner ran and after the page settled. node tracks.js WxH [cold] */
const fs = require('fs');
const puppeteer = require('../node_modules/puppeteer');
const SP = 'scratchpad';
const OW = SP + '/fixes/offscreen-work';
const VARS = [
  { name: 'baseline' },
  { name: 'cv', files: { '/styles.css': OW + '/styles.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' } },
];
const [W, H] = (process.argv[2] || '1440x900').split('x').map(Number);
const cold = process.argv[3] === 'cold';
const mobile = W < 700;
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  for (const v of VARS) {
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: W, height: H, isMobile: mobile, hasTouch: mobile });
    if (cold) await p.setCacheEnabled(false);
    const map = v.files ? Object.fromEntries(Object.entries(v.files).map(([k, f]) => [k, fs.readFileSync(f)])) : {};
    await p.setRequestInterception(true);
    p.on('request', (req) => {
      const u = new URL(req.url());
      let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
      if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: k.endsWith('.js') ? 'application/javascript' : 'text/css', body: map[k] });
      req.continue();
    });
    await p.evaluateOnNewDocument(() => {
      try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      const add = DOMTokenList.prototype.add;
      DOMTokenList.prototype.add = function (...c) { if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; } return add.apply(this, c); };
      // record when quotes get cloned (appendChild on a .tcol-track)
      const ap = Node.prototype.appendChild;
      window.__clone = [];
      Node.prototype.appendChild = function (c) {
        if (this.classList && this.classList.contains('tcol-track') && !window.__cloneT) {
          window.__cloneT = performance.now();
          window.__fontsAtClone = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight).join(', ');
          window.__fontsStatus = document.fonts.status;
        }
        return ap.call(this, c);
      };
    });
    await p.goto('http://localhost:5173/', { waitUntil: 'load' });
    await w8(2000);
    // walk to the trust section so the variant's cloner runs
    const trustY = await p.evaluate(() => document.getElementById('trust').getBoundingClientRect().top + scrollY);
    for (let y = 0; y <= trustY; y += 300) { await p.evaluate((y) => scrollTo(0, y), y); await w8(80); }
    await w8(1500);
    const r = await p.evaluate(() => {
      const tr = [...document.querySelectorAll('.tcol-track')];
      return {
        cloneAt: Math.round(window.__cloneT || -1), fontsAtClone: window.__fontsAtClone, fontsStatusAtClone: window.__fontsStatus,
        tracks: tr.map((t) => `${t.children.length}ch h=${t.getBoundingClientRect().height.toFixed(2)} offH=${t.offsetHeight}`).join(' | '),
        wrapH: document.querySelector('.tcols').getBoundingClientRect().height.toFixed(2),
      };
    });
    console.log(v.name.padEnd(9), JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
