/* Cold-cache network probe: which resources are requested in the first N ms
   with the page left at the top (no scroll), baseline vs variant.
   node netprobe.js WxH [waitMs] */
const fs = require('fs');
const path = require('path');
const puppeteer = require('../node_modules/puppeteer');
const SP = 'scratchpad';
const OW = SP + '/fixes/offscreen-work';
const VAR = { name: 'cv-defer', files: { '/styles.css': OW + '/styles.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' } };
const BASEV = { name: 'baseline' };
const [W, H] = (process.argv[2] || '1440x900').split('x').map(Number);
const WAIT = +(process.argv[3] || 4000);
const mobile = W < 700;
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(browser, v) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: W, height: H, isMobile: mobile, hasTouch: mobile });
  await p.setCacheEnabled(false);
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    const add = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...c) { if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; } return add.apply(this, c); };
  });
  const map = v.files ? Object.fromEntries(Object.entries(v.files).map(([k, f]) => [k, fs.readFileSync(f)])) : {};
  await p.setRequestInterception(true);
  const reqs = [];
  const t0 = Date.now();
  p.on('request', (req) => {
    const u = new URL(req.url());
    reqs.push({ t: Date.now() - t0, url: req.url().replace(/^https?:\/\/[^/]+/, (m) => (m.includes('localhost') ? '' : m)), type: req.resourceType() });
    let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
    if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: k.endsWith('.js') ? 'application/javascript' : 'text/css', body: map[k] });
    req.continue();
  });
  await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await w8(WAIT);
  const fontsLoaded = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style} ${f.unicodeRange.slice(0, 20)}`).sort());
  await ctx.close();
  return { reqs, fontsLoaded };
}

(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const A = await run(b, BASEV);
  const B = await run(b, VAR);
  await b.close();
  const key = (r) => r.url;
  const sa = new Set(A.reqs.map(key)), sb = new Set(B.reqs.map(key));
  console.log(`== ${W}x${H}, first ${WAIT}ms, no scroll`);
  console.log('baseline requests', sa.size, ' variant requests', sb.size);
  console.log('-- requested by BASELINE but NOT by variant:');
  for (const r of A.reqs) if (!sb.has(key(r))) console.log('   ', r.t + 'ms', r.type, r.url.slice(0, 140));
  console.log('-- requested by VARIANT but NOT by baseline:');
  for (const r of B.reqs) if (!sa.has(key(r))) console.log('   ', r.t + 'ms', r.type, r.url.slice(0, 140));
  const fa = new Set(A.fontsLoaded), fb = new Set(B.fontsLoaded);
  console.log('-- FontFaces loaded in baseline but not in variant:');
  for (const f of A.fontsLoaded) if (!fb.has(f)) console.log('   ', f);
  console.log('-- FontFaces loaded in variant but not in baseline:');
  for (const f of B.fontsLoaded) if (!fa.has(f)) console.log('   ', f);
})().catch((e) => { console.error(e); process.exit(1); });
