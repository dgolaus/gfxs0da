const fs = require('fs');
const path = require('path');
const R = '/home/user/gfxs0da/node_modules/';
const puppeteer = require(R + 'puppeteer');
const sharp = require(R + 'sharp');
const PI = '/home/user/gfxs0da/perf-investigation/';
const BASE = 'http://localhost:5173';
const DTYPES = {'.js':'application/javascript','.css':'text/css','.json':'application/json','.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff','.avif':'image/avif','.ico':'image/x-icon','.mp4':'video/mp4','.webm':'video/webm','.gif':'image/gif','.txt':'text/plain','.xml':'application/xml'};
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const V = JSON.parse(fs.readFileSync(path.join(__dirname, 'variants.json'), 'utf8'));

const PRELUDE = `(() => {
  try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  const add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function (...c) {
    if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; }
    return add.apply(this, c);
  };
  window.__errs = [];
  window.addEventListener('error', (e) => window.__errs.push(String(e.message)));
})();`;

async function launch() {
  return puppeteer.launch({ headless: 'new', executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'], protocolTimeout: 240000 });
}

async function open(browser, vname, o = {}) {
  const files = (V[vname] && V[vname].files) || {};
  const p = await browser.newPage();
  const w = o.w || 1440, h = o.h || 900;
  await p.setViewport({ width: w, height: h, isMobile: !!o.mobile, hasTouch: !!o.mobile, deviceScaleFactor: o.dpr || 1 });
  if (o.mobile) await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  if (o.reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const c = await p.target().createCDPSession();
  if (o.throttle) await c.send('Emulation.setCPUThrottlingRate', { rate: o.throttle });
  const map = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, fs.readFileSync(path.resolve(PI, f))]));
  const type = (k) => k.endsWith('.js') ? 'application/javascript' : k.endsWith('.css') ? 'text/css' : k.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8';
  await p.setRequestInterception(true);
  p.on('request', (req) => {
    const u = new URL(req.url());
    let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
    if (k.endsWith('/') ) k = k + 'index.html';
    if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: type(k), body: map[k] });
    if (u.host === 'localhost:5173') {  // shared server went down: serve the repo from disk for EVERY variant (baseline too)
      const f = path.join('/home/user/gfxs0da', decodeURIComponent(k));
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return req.respond({ status: 200, contentType: DTYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return req.respond({ status: 404, contentType: 'text/plain', body: '' });
    }
    if (o.block && o.block.test(req.url())) return req.abort();
    req.continue();
  });
  p.on('pageerror', (e) => { (p.__errs = p.__errs || []).push(String(e.message)); });
  await p.evaluateOnNewDocument(PRELUDE);
  if (o.pre) await p.evaluateOnNewDocument(o.pre);
  return { p, c };
}

async function settle(p, extra = 1500) {
  await p.evaluate(async () => {
    const pend = [...document.images].filter((i) => !i.complete && i.loading !== 'lazy');
    await Promise.race([Promise.all(pend.map((i) => new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); }))), new Promise((r) => setTimeout(r, 8000))]);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  await w8(extra);
}

// pause every animation at the same local time; force counters; neutralize pointer parallax
async function freeze(p, T = 5000) {
  await p.evaluate((T) => {
    document.querySelectorAll('.counter').forEach((el) => {
      const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
      el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
    });
    const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = T; } catch (e) {} }
  }, T);
  await w8(250);
}
async function unfreeze(p) {
  await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) {} } });
}

async function diff(a, b, heatFile, region) {
  let A = sharp(a), B = sharp(b);
  if (region) { A = A.extract(region); B = B.extract(region); }
  A = await A.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  B = await B.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return { error: 'size', a: A.info, b: B.info };
  const W = A.info.width, n = W * A.info.height;
  let sum = 0, changed = 0, big = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
  const heat = heatFile ? Buffer.alloc(n * 3) : null;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3;
    sum += d; if (d > 8) { changed++; const x = i % W, y = (i / W) | 0; if (x < minx) minx = x; if (y < miny) miny = y; if (x > maxx) maxx = x; if (y > maxy) maxy = y; } if (d > 32) big++;
    if (heat) { heat[i * 3] = Math.min(255, d * 4); }
  }
  if (heat && changed) await sharp(heat, { raw: { width: W, height: A.info.height, channels: 3 } }).png().toFile(heatFile);
  return { mad: +(sum / n).toFixed(3), pct: +(changed / n * 100).toFixed(3), big: +(big / n * 100).toFixed(3), bbox: changed ? [minx, miny, maxx, maxy] : null };
}

module.exports = { launch, open, settle, freeze, unfreeze, diff, w8, V, BASE, PI };
