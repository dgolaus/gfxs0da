// Independent check: for every .btn / .quote / .price-card host on every page, at several widths,
// in rest + forced :hover/:focus-visible/:active states, with/without reduced motion and lite,
// compare the FULL computed style of ::after (and host border radii) baseline vs variant.
const fs = require('fs');
const path = require('path');
const puppeteer = require('../node_modules/puppeteer');
const VAR = process.argv[2];
const REPO = '..';
const TYPES = {'.js':'application/javascript','.css':'text/css','.json':'application/json','.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2','.avif':'image/avif','.ico':'image/x-icon','.mp4':'video/mp4','.webm':'video/webm'};
const varCss = fs.readFileSync(VAR);
const PAGES = ['/', '/tos/', '/slots/', '/404.html'];
const WIDTHS = [1440, 1024, 768, 375];
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

async function collect(browser, useVariant, url, width, opts) {
  const p = await browser.newPage();
  await p.setViewport({ width, height: 900 });
  const c = await p.target().createCDPSession();
  if (opts.rm) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setRequestInterception(true);
  p.on('request', (req) => {
    const u = new URL(req.url());
    if (u.host !== 'localhost:5173') return req.continue();
    if (useVariant && u.pathname === '/styles.css') return req.respond({ status: 200, contentType: 'text/css', body: varCss });
    let k = decodeURIComponent(u.pathname); if (k.endsWith('/')) k += 'index.html';
    const f = path.join(REPO, k);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return req.respond({ status: 200, contentType: TYPES[path.extname(k)] || 'application/octet-stream', body: fs.readFileSync(f) });
    return req.respond({ status: 404, body: '' });
  });
  await p.evaluateOnNewDocument((lite) => {
    try { localStorage.setItem('s0da-lite', lite ? '1' : '0'); } catch (e) {}
  }, !!opts.lite);
  await p.goto('http://localhost:5173' + url, { waitUntil: 'load' });
  await w8(1500);
  if (opts.lite) await p.evaluate(() => document.documentElement.classList.add('lite'));
  await c.send('DOM.enable'); await c.send('CSS.enable');
  const out = {};
  const grab = async (state) => p.evaluate((state) => {
    document.getAnimations().forEach((an) => { try { an.pause(); an.currentTime = 300; } catch (e) {} });
    const r = [];
    document.querySelectorAll('.btn, .quote, .price-card').forEach((el, i) => {
      const h = getComputedStyle(el), a = getComputedStyle(el, '::after');
      const all = {}; for (let k = 0; k < a.length; k++) { const n = a[k]; all[n] = a.getPropertyValue(n); }
      r.push({ i, cls: el.className, hostR: [h.borderTopLeftRadius, h.borderTopRightRadius, h.borderBottomRightRadius, h.borderBottomLeftRadius].join(' '),
        aftR: [a.borderTopLeftRadius, a.borderTopRightRadius, a.borderBottomRightRadius, a.borderBottomLeftRadius].join(' '), content: a.content, all });
    });
    return r;
  }, state);
  out.rest = await grab('rest');
  // forced pseudo states on each host
  const { root } = await c.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await c.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '.btn, .quote, .price-card' });
  for (const st of [['hover'], ['focus', 'focus-visible'], ['active', 'hover']]) {
    for (const id of nodeIds) await c.send('CSS.forcePseudoState', { nodeId: id, forcedPseudoClasses: st });
    out[st.join('+')] = await grab(st.join('+'));
    for (const id of nodeIds) await c.send('CSS.forcePseudoState', { nodeId: id, forcedPseudoClasses: [] });
  }
  await p.close();
  return out;
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  let diffs = 0, checked = 0, hostMismatch = 0;
  const report = []; const agg = {};
  for (const url of PAGES) for (const width of WIDTHS) for (const opts of [{}, { rm: true }, { lite: true }]) {
    const a = await collect(browser, false, url, width, opts);
    const b = await collect(browser, true, url, width, opts);
    for (const st of Object.keys(a)) {
      if (a[st].length !== b[st].length) { report.push(`${url} ${width} ${JSON.stringify(opts)} ${st}: count ${a[st].length} vs ${b[st].length}`); diffs++; continue; }
      a[st].forEach((x, k) => {
        const y = b[st][k]; checked++;
        // per-element in variant: ::after radius must equal host radius
        if (y.content !== 'none' && y.aftR !== y.hostR) { hostMismatch++; const key=`HOST!=AFTER ${st} ${y.cls} host=${y.hostR} after=${y.aftR}`; agg[key]=(agg[key]||0)+1; }
        if (x.aftR !== x.hostR) { const key=`BASE HOST!=AFTER ${st} ${x.cls} host=${x.hostR} after=${x.aftR} content=${x.content}`; agg[key]=(agg[key]||0)+1; }
        for (const n of Object.keys(x.all)) if (x.all[n] !== y.all[n]) { diffs++; const key = `${st} [${x.cls.replace(/ reveal| is-in| in-view/g,"")}] ${n}: ${x.all[n]} -> ${y.all[n]}`; agg[key] = (agg[key]||0)+1; }
      });
    }
  }
  await browser.close();
  console.log(JSON.stringify({ checked, diffs, hostMismatch, report, agg }, null, 1));
})();
