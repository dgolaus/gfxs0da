/* touch-pages copy: adds o.fonts / FONTS env = 'abort' | 'delay:<ms>' for fonts.gstatic.com.
 * Desktop-real vetting harness for the combined patch.
 * - DESKTOP (default): Chromium launched with a mouse pointer (headless otherwise reports hover:none,
 *   which skips Lenis and runs script.js in touch mode). TOUCH=1 / o.mobile: no pointer flags, touch viewport.
 * - Lenis 1.1.18 served from perf-investigation/vendor (cdn.jsdelivr.net is unreachable here).
 * - Every localhost request is served from the repo on disk (the :5173 static server is flaky); variant
 *   files override their paths. Baseline and variant go through the identical path.
 * Variants: see ./variants.json (paths relative to perf-investigation/).
 */
const fs = require('fs'); const path = require('path');
const R = '/home/user/gfxs0da/node_modules/';
const puppeteer = require(R + 'puppeteer'); const sharp = require(R + 'sharp');
const REPO = '/home/user/gfxs0da', PI = REPO + '/perf-investigation/';
const LENIS = fs.readFileSync(PI + 'vendor/lenis-1.1.18.min.js');
const BASE = 'http://localhost:5173';
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const V = JSON.parse(fs.readFileSync(path.join(__dirname, 'variants.json'), 'utf8'));
const MIME = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.gif': 'image/gif', '.txt': 'text/plain', '.xml': 'application/xml' };
const PRELUDE = `(() => {
  try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  const add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function (...c) {
    if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; }
    return add.apply(this, c);
  };
  window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message)));
})();`;
const DESKTOP_FLAGS = ['--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4'];
async function launch(o = {}) {
  const touch = o.touch || process.env.TOUCH;
  return puppeteer.launch({ headless: 'new', executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', ...(touch ? [] : DESKTOP_FLAGS)], protocolTimeout: 300000 });
}
async function open(browser, vname, o = {}) {
  if (!(vname in V)) throw new Error('unknown variant ' + vname);
  const files = V[vname].files || {};
  const p = await browser.newPage();
  await p.setViewport({ width: o.w || 1440, height: o.h || 900, isMobile: !!o.mobile, hasTouch: !!o.mobile, deviceScaleFactor: o.dpr || 1 });
  if (o.mobile) await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  if (o.reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const c = await p.target().createCDPSession();
  if (o.throttle) await c.send('Emulation.setCPUThrottlingRate', { rate: o.throttle });
  const map = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, fs.readFileSync(path.resolve(PI, f))]));
  await p.setRequestInterception(true);
  p.on('request', (req) => {
    const u = new URL(req.url());
    if (u.host === 'cdn.jsdelivr.net' && u.pathname === '/npm/lenis@1.1.18/dist/lenis.min.js') return req.respond({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: LENIS });
    const fm = o.fonts || process.env.FONTS;
    if (fm && u.host === 'fonts.gstatic.com') {
      (p.__fontReqs = p.__fontReqs || []).push(u.pathname);
      if (fm === 'abort') return req.abort('failed');
      if (fm.startsWith('delay:')) return setTimeout(() => req.continue().catch(() => {}), +fm.slice(6));
    }
    if (!u.host.startsWith('localhost')) return req.continue();
    let k = decodeURIComponent(u.pathname); if (k === '' || k.endsWith('/')) k += 'index.html';
    if (map[k]) return req.respond({ status: 200, contentType: MIME[path.extname(k)] || 'application/octet-stream', body: map[k] });
    let f = path.join(REPO, k);
    if (!path.extname(f) && fs.existsSync(f + '.html')) f += '.html';
    if (f.startsWith(REPO) && fs.existsSync(f) && fs.statSync(f).isFile()) return req.respond({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    return req.respond({ status: 404, contentType: 'text/html', body: fs.readFileSync(REPO + '/404.html') });
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
async function unfreeze(p) { await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) {} } }); }
async function diff(a, b, heatFile, region) {
  let A = sharp(a), B = sharp(b);
  if (region) { A = A.extract(region); B = B.extract(region); }
  A = await A.ensureAlpha().raw().toBuffer({ resolveWithObject: true }); B = await B.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return { error: 'size' };
  const W = A.info.width, n = W * A.info.height; let sum = 0, ch = 0, big = 0, bb = [1e9, 1e9, -1, -1];
  const heat = heatFile ? Buffer.alloc(n * 3) : null;
  for (let i = 0; i < n; i++) { const o = i * 4; const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3;
    sum += d; if (d > 8) { ch++; const x = i % W, y = (i / W) | 0; bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x), Math.max(bb[3], y)]; } if (d > 32) big++; if (heat) heat[i * 3] = Math.min(255, d * 4); }
  if (heat && ch) await sharp(heat, { raw: { width: W, height: A.info.height, channels: 3 } }).png().toFile(heatFile);
  return { mad: +(sum / n).toFixed(3), pct: +(ch / n * 100).toFixed(3), big: +(big / n * 100).toFixed(3), bbox: ch ? bb : null };
}
module.exports = { launch, open, settle, freeze, unfreeze, diff, w8, V, BASE, PI, REPO };
