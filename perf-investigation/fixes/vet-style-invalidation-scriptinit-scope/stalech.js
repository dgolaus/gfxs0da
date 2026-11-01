/* How often does a font-relative (ch/ex) value stay computed against the fallback
   font after the web font loaded?  baseline vs variant, cold and warm cache. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('../node_modules/puppeteer');
const REPO = '..';
const OUT = __dirname;
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const all = JSON.parse(fs.readFileSync(path.join(OUT, process.argv[2] || 'variants.json'), 'utf8'));
const N = +process.argv[3] || 6;
const THR = +process.argv[4] || 1;
const COLD = process.argv[5] === 'cold';
const VW = +process.argv[6] || 1440;
const PRELUDE = `(() => {
  try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  const add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function (...c) {
    if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; }
    return add.apply(this, c);
  };
})();`;
const types = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
async function open(ctx, v) {
  const p = await ctx.newPage();
  await p.setViewport({ width: VW, height: 900 });
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
  return p;
}
const READ = () => {
  const g = (s, pse) => { const e = document.querySelector(s); return e ? getComputedStyle(e, pse || null) : null; };
  const h = document.querySelector('.hero-title');
  const ct = document.querySelector('.cta-title');
  return {
    h1max: g('.hero-title').maxWidth,
    h1h: Math.round(h.getBoundingClientRect().height),
    ctamax: ct ? getComputedStyle(ct).maxWidth : null,
    ctah: ct ? Math.round(ct.getBoundingClientRect().height) : null,
    shiny: (g('.btn-shiny .shiny-inner', '::before') || {}).boxShadow,
    fonts: document.fonts.status,
  };
};
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const res = {};
  let warmCtx = COLD ? null : (process.env.DEFCTX ? browser.defaultBrowserContext() : await browser.createBrowserContext());
  for (let r = 0; r < N; r++) for (const v of all) {
    const ctx = COLD ? await browser.createBrowserContext() : warmCtx;
    const p = await open(ctx, v);
    await p.goto('http://localhost:5173/', { waitUntil: process.env.WAITU || 'load' });
    await p.evaluate(async () => { await document.fonts.ready; });
    await w8(2500);
    const a = await p.evaluate(READ);
    // a real user scroll through the nav-morph range and back (wheel -> Lenis)
    await p.mouse.move(700, 450);
    for (let i = 0; i < 4; i++) { await p.mouse.wheel({ deltaY: 120 }); await w8(60); }
    await w8(900);
    for (let i = 0; i < 6; i++) { await p.mouse.wheel({ deltaY: -120 }); await w8(60); }
    await w8(1200);
    const b = await p.evaluate(READ);
    // then all the way down to the CTA and back
    await p.evaluate(() => { const e = document.querySelector('.cta-title'); if (e) e.scrollIntoView(); });
    await w8(800);
    const c = await p.evaluate(READ);
    (res[v.name] = res[v.name] || []).push({ a, b, c });
    await p.close();
    if (COLD) await ctx.close();
  }
  await browser.close();
  for (const [k, rows] of Object.entries(res)) {
    console.log(`== ${k}  (thr ${THR}, ${COLD ? 'cold' : 'warm'}, vw ${VW})`);
    for (const x of rows) console.log(`  load: h1 ${x.a.h1max}/${x.a.h1h} cta ${x.a.ctamax}/${x.a.ctah} shiny ${x.a.shiny} | after nav scroll: h1 ${x.b.h1max} cta ${x.b.ctamax} | at cta: h1 ${x.c.h1max} cta ${x.c.ctamax}/${x.c.ctah} shiny ${x.c.shiny}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
