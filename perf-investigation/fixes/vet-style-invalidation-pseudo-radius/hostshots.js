// Targeted pixel test of the pseudo-elements the fix touches (the standard bench only shoots the
// top 1440x900 of "/", where these ::after are invisible). For each .btn/.quote/.price-card on every
// page: scroll it into view, force a state (hover / hover+focus-visible), put the cursor light
// (--mx/--my) in a corner, pin every animation to a fixed time, screenshot the element and diff
// baseline vs variant.
// usage: node hostshots.js <variantCss> [label]
const fs = require('fs');
const path = require('path');
const puppeteer = require('../node_modules/puppeteer');
const sharp = require('../node_modules/sharp');
const REPO = '..';
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.avif': 'image/avif', '.ico': 'image/x-icon' };
const VAR = process.argv[2];
const LABEL = process.argv[3] || 'v';
const varCss = fs.readFileSync(VAR);
const OUT = path.join(__dirname, 'shots_' + LABEL); fs.mkdirSync(OUT, { recursive: true });
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, useVariant, url, width) {
  const p = await browser.newPage();
  await p.setViewport({ width, height: 900 });
  await p.setRequestInterception(true);
  p.on('request', (req) => {
    const u = new URL(req.url());
    if (u.host !== 'localhost:5173') return req.respond({ status: 404, body: '' }); // no analytics/externals: determinism
    if (useVariant && u.pathname === '/styles.css') return req.respond({ status: 200, contentType: 'text/css', body: varCss });
    let k = decodeURIComponent(u.pathname); if (k.endsWith('/')) k += 'index.html';
    const f = path.join(REPO, k);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return req.respond({ status: 200, contentType: TYPES[path.extname(k)] || 'application/octet-stream', body: fs.readFileSync(f) });
    return req.respond({ status: 404, body: '' });
  });
  await p.evaluateOnNewDocument(() => {
    try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    const add = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...c) {
      if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; }
      return add.apply(this, c);
    };
  });
  await p.goto('http://localhost:5173' + url, { waitUntil: 'load' });
  await w8(1200);
  // make everything revealed and images loaded so both runs look the same
  await p.evaluate(async () => {
    document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; });
    await Promise.race([Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 5000))]);
    if (document.fonts) await document.fonts.ready;
  });
  return p;
}

async function shootAll(p, url, width, tag) {
  const c = await p.target().createCDPSession();
  await c.send('DOM.enable'); await c.send('CSS.enable');
  const { root } = await c.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await c.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '.btn, .quote, .price-card' });
  const n = await p.evaluate(() => document.querySelectorAll('.btn, .quote, .price-card').length);
  const files = [];
  const scenarios = [
    { st: ['hover'], t: 250, corner: [2, 3] },
    { st: ['hover'], t: 450, corner: [97, 96] },
    { st: ['hover', 'focus', 'focus-visible'], t: 300, corner: [2, 3] },
    { st: ['hover', 'focus', 'focus-visible'], t: 450, corner: [98, 97] },
    { st: ['hover', 'focus', 'focus-visible'], t: 600, corner: [50, 50] },
  ];
  // limit to first 3 tcols quotes per column + all others, to keep runtime sane
  for (let i = 0; i < n; i++) {
    const info = await p.evaluate((i) => {
      const el = document.querySelectorAll('.btn, .quote, .price-card')[i];
      const tr = el.closest('.tcol-track');
      if (tr && [...tr.children].indexOf(el) > 2) return null;
      return el.className;
    }, i);
    if (!info) continue;
    for (const [si, sc] of scenarios.entries()) {
      for (const id of nodeIds) await c.send('CSS.forcePseudoState', { nodeId: id, forcedPseudoClasses: [] });
      await c.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: sc.st });
      await p.evaluate((i, sc) => {
        const el = document.querySelectorAll('.btn, .quote, .price-card')[i];
        el.style.setProperty('--mx', sc.corner[0] + '%'); el.style.setProperty('--my', sc.corner[1] + '%');
        // stop every running animation (incl. tcol scroll/float) at the same time point
        for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = sc.t; } catch (e) {} }
        const r0 = el.getBoundingClientRect();
        const y = Math.max(0, r0.top + window.scrollY - (innerHeight - r0.height) / 2);
        if (window.lenis) { try { window.lenis.scrollTo(y, { immediate: true, force: true }); } catch (e) {} }
        window.scrollTo({ top: y, behavior: 'instant' });
        return null;
      }, i, sc);
      await w8(450);
      await p.evaluate((sc) => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = sc.t; } catch (e) {} } }, sc);
      await w8(80);
      const box = await p.evaluate((i) => {
        const el = document.querySelectorAll('.btn, .quote, .price-card')[i];
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, r.left - 12), y: Math.max(0, r.top - 12), w: r.width + 24, h: r.height + 24, sx: scrollX, sy: scrollY, off: r.bottom < 0 || r.top > innerHeight };
      }, i);
      if (box.off) { console.error('OFFSCREEN', url, width, i, info); continue; }
      const f = path.join(OUT, `${tag}_${url.replace(/\W/g, '_')}_${width}_${i}_${si}.png`);
      const vw = width;
      const clip = { x: box.x + box.sx, y: box.y + box.sy, width: Math.min(box.w, vw - box.x), height: Math.min(box.h, 900 - box.y) };
      if (clip.width < 4 || clip.height < 4) continue;
      await p.screenshot({ path: f, clip });
      files.push({ key: `${url}_${width}_${i}_${si}`, f, cls: info, st: sc.st.join('+') });
    }
  }
  return files;
}

async function diff(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return { sizeMismatch: `${A.info.width}x${A.info.height} vs ${B.info.width}x${B.info.height}` };
  const n = A.info.width * A.info.height; let sum = 0, changed = 0, maxd = 0;
  for (let i = 0; i < n; i++) { const o = i * 4; const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; sum += d; if (d > 0) changed++; if (d > maxd) maxd = d; }
  return { mean: +(sum / n).toFixed(4), changedPx: changed, maxd: +maxd.toFixed(1) };
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const res = [];
  for (const url of (process.env.PAGES || '/,/tos/,/slots/,/404.html').split(',')) for (const width of (process.env.WIDTHS || '1440,375').split(',').map(Number)) {
    const runs = {};
    for (const [tag, useV] of [['A', false], ['A2', false], ['B', true]]) {
      const p = await open(browser, useV, url, width);
      runs[tag] = await shootAll(p, url, width, tag);
      await p.close();
    }
    for (let k = 0; k < runs.A.length; k++) {
      const a = runs.A[k], a2 = runs.A2.find((x) => x.key === a.key), b = runs.B.find((x) => x.key === a.key);
      if (!a2 || !b) { res.push({ key: a.key, missing: true }); continue; }
      const noise = await diff(a.f, a2.f), d = await diff(a.f, b.f);
      res.push({ key: a.key, cls: a.cls, st: a.st, noise, d });
    }
  }
  await browser.close();
  const bad = res.filter((r) => r.missing || (r.d && (r.d.sizeMismatch || r.d.changedPx > 0)));
  console.log(JSON.stringify({ total: res.length, nonZero: bad.length, bad, noiseNonZero: res.filter((r) => r.noise && r.noise.changedPx > 0).length }, null, 1));
})();
