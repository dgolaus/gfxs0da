/* Timeline of .hero-title max-width (16ch) vs font loading and var writes. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('../node_modules/puppeteer');
const REPO = '..';
const OUT = __dirname;
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const all = JSON.parse(fs.readFileSync(path.join(OUT, process.argv[2] || 'v2.json'), 'utf8'));
const N = +process.argv[3] || 4;
const THR = +process.argv[4] || 1;
const CTX = process.argv[5] || 'cold';
const PRELUDE = `(() => {
  try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  const add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function (...c) {
    if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; }
    return add.apply(this, c);
  };
  const log = window.__chlog = [];
  let last = null;
  const sp = CSSStyleDeclaration.prototype.setProperty;
  let writes = 0;
  CSSStyleDeclaration.prototype.setProperty = function (k, v, pr) { if (/^--nav|^--leave/.test(k)) writes++; return sp.call(this, k, v, pr); };
  document.fonts && document.fonts.addEventListener('loadingdone', (e) => log.push([Math.round(performance.now()), 'fontsdone ' + e.fontfaces.map((f) => f.family + ' ' + f.weight).join(',')]));
  const tick = () => {
    const h = document.querySelector('.hero-title');
    if (h) {
      const w = getComputedStyle(h).maxWidth;
      if (w !== last) { log.push([Math.round(performance.now()), 'h1 ' + w + ' (varwrites ' + writes + ', fonts ' + document.fonts.status + ', ready ' + (document.body && document.body.classList.contains('ready')) + ')']); last = w; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;
const types = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const shared = CTX === 'warm' ? await browser.createBrowserContext() : CTX === 'default' ? browser.defaultBrowserContext() : null;
  for (let r = 0; r < N; r++) for (const v of all) {
    const ctx = shared || await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    const c = await p.target().createCDPSession();
    if (THR > 1) await c.send('Emulation.setCPUThrottlingRate', { rate: THR });
    const over = Object.fromEntries(Object.entries(v.files || {}).map(([k, f]) => [k, fs.readFileSync(f)]));
    await p.setRequestInterception(true);
    p.on('request', (req) => {
      const u = new URL(req.url());
      if (u.host !== 'localhost:5173') { if (/cloudflareinsights/.test(u.host)) return req.respond({ status: 204, body: '' }); return req.continue(); }
      let k = decodeURIComponent(u.pathname); if (k.endsWith('/')) k += 'index.html';
      const ct = types[path.extname(k)] || 'application/octet-stream';
      if (over[k]) return req.respond({ status: 200, contentType: ct, body: over[k] });
      const f = path.join(REPO, k);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return req.respond({ status: 200, contentType: ct, body: fs.readFileSync(f) });
      return req.respond({ status: 404, body: '' });
    });
    await p.evaluateOnNewDocument(PRELUDE);
    await p.goto('http://localhost:5173/', { waitUntil: 'load' });
    await w8(4000);
    const log = await p.evaluate(() => window.__chlog);
    console.log(`[${v.name} r${r} thr${THR} ${CTX}] ` + log.map(([t, s]) => t + ':' + s).join(' | '));
    await p.close();
    if (!shared) await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
