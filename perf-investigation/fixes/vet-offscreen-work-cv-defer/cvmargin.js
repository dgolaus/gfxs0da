/* When does each c-v:auto section get rendered, relative to the viewport?
   Also: when do the trust avatars / pricing robux mask / deferred fonts get requested,
   baseline vs variant, scrolling down at a steady pace with network emulation.
   node cvmargin.js WxH "Fast 4G"|"Fast 3G"|"none" pxPerFrame */
const fs = require('fs');
const puppeteer = require('../node_modules/puppeteer');
const { PredefinedNetworkConditions } = puppeteer;
const SP = 'scratchpad';
const OW = SP + '/fixes/offscreen-work';
const VAR = { name: 'cv-defer', files: { '/styles.css': OW + '/styles.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' } };
const BASEV = { name: 'baseline' };
const [W, H] = (process.argv[2] || '1440x900').split('x').map(Number);
const NET = process.argv[3] || 'Fast 4G';
const STEP = +(process.argv[4] || 15);
const mobile = W < 700;
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(browser, v) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: W, height: H, isMobile: mobile, hasTouch: mobile });
  await p.setCacheEnabled(false);
  if (NET !== 'none') await p.emulateNetworkConditions(PredefinedNetworkConditions[NET]);
  await p.evaluateOnNewDocument(() => {
    try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    const add = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...c) { if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; } return add.apply(this, c); };
    window.__cv = [];
    document.addEventListener('contentvisibilityautostatechange', (e) => {
      const r = e.target.getBoundingClientRect();
      window.__cv.push({ id: e.target.id, skipped: e.skipped, top: Math.round(r.top), bottom: Math.round(r.bottom), y: Math.round(scrollY), t: Math.round(performance.now()) });
    }, true);
  });
  const map = v.files ? Object.fromEntries(Object.entries(v.files).map(([k, f]) => [k, fs.readFileSync(f)])) : {};
  await p.setRequestInterception(true);
  p.on('request', (req) => {
    const u = new URL(req.url());
    let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
    if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: k.endsWith('.js') ? 'application/javascript' : 'text/css', body: map[k] });
    req.continue();
  });
  const fin = [];
  p.on('request', async (req) => { if (/pfps\/|robux|studios\//.test(req.url())) { const y = await p.evaluate(() => Math.round(scrollY)).catch(() => null); fin.push({ url: 'REQ ' + req.url().replace(/^.*\//, '').slice(0, 36), y }); } });
  p.on("requestfinished", async (req) => {
    const url = req.url();
    if (/pfps\/|robux|fonts\.gstatic|studios\//.test(url)) {
      const y = await p.evaluate(() => Math.round(scrollY)).catch(() => null);
      fin.push({ url: url.replace(/^.*\//, '').slice(0, 40), y });
    }
  });
  await p.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 120000 });
  await w8(2500);
  // where are the deferred elements in page coordinates?
  const geo = await p.evaluate(() => {
    const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.top + scrollY); };
    return { about: g('#about'), process: g('#process'), trust: g('#trust'), testimonials: g('#testimonials'), pricing: g('#pricing'), robux: g('.robux'), contact: g('#contact'), H: document.documentElement.scrollHeight };
  });
  // steady scroll: STEP px per animation frame (no Lenis interference: native scrollTo)
  const maxY = geo.H - H;
  await p.evaluate(async (STEP, maxY) => {
    await new Promise((res) => {
      let y = 0;
      const f = () => { y = Math.min(maxY, y + STEP); window.scrollTo(0, y); if (y < maxY) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f);
    });
  }, STEP, maxY);
  await w8(1500);
  const cv = await p.evaluate(() => window.__cv);
  await ctx.close();
  return { geo, fin, cv };
}

(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  for (const v of [BASEV, VAR]) {
    const r = await run(b, v);
    console.log(`== ${v.name} ${W}x${H} net=${NET} step=${STEP}px/frame`);
    console.log('   geo', JSON.stringify(r.geo));
    console.log('   cv events (unskip):', r.cv.filter((e) => !e.skipped).map((e) => `${e.id}: top=${e.top} (vh ${(e.top / H).toFixed(2)}) y=${e.y}`).join(' | '));
    console.log('   resource finished at scrollY (viewport bottom = y+' + H + '):');
    const seen = new Set();
    for (const f of r.fin) { if (seen.has(f.url)) continue; seen.add(f.url); console.log('     ', f.url.padEnd(42), 'y=', f.y, ' viewportBottom=', f.y + H); }
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
