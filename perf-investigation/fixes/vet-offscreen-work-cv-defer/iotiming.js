/* When do the IntersectionObserver callbacks for the deferred sections' content fire,
   baseline vs variant, for the same scroll script? Logs isIntersecting entries for
   #trust-stats, #process, .reveal inside deferred sections, #testimonials.
   node iotiming.js WxH stepPx stepWaitMs */
const fs = require('fs');
const puppeteer = require('../node_modules/puppeteer');
const SP = 'scratchpad';
const OW = SP + '/fixes/offscreen-work';
const VARS = [
  { name: 'baseline' },
  { name: 'cv', files: { '/styles.css': OW + '/styles.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' } },
];
const [W, H] = (process.argv[2] || '1440x900').split('x').map(Number);
const STEP = +(process.argv[3] || 675), WAIT = +(process.argv[4] || 1550);
const mobile = W < 700;
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const res = {};
  for (const v of VARS) {
    const p = await b.newPage();
    await p.setViewport({ width: W, height: H, isMobile: mobile, hasTouch: mobile });
    const map = v.files ? Object.fromEntries(Object.entries(v.files).map(([k, f]) => [k, fs.readFileSync(f)])) : {};
    await p.setRequestInterception(true);
    p.on('request', (req) => {
      const u = new URL(req.url());
      let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
      if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: k.endsWith('.js') ? 'application/javascript' : 'text/css', body: map[k] });
      req.continue();
    });
    await p.evaluateOnNewDocument(() => {
      try { localStorage.setItem('s0da-lite', '0'); sessionStorage.setItem('s0da-booted', '1'); } catch (e) {}
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      const add = DOMTokenList.prototype.add;
      DOMTokenList.prototype.add = function (...c) { if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; } return add.apply(this, c); };
      window.__io = [];
      window.__step = 0;
      const IO = window.IntersectionObserver;
      window.IntersectionObserver = function (cb, opts) {
        const wrapped = (entries, obs) => {
          for (const e of entries) {
            const t = e.target;
            const name = t.id ? '#' + t.id : (t.className && typeof t.className === 'string' ? '.' + t.className.split(' ').slice(0, 2).join('.') : t.tagName);
            if (/trust|process|testimonials|pricing|about|contact|reveal|price-card|tcols/.test(name)) {
              window.__io.push({ step: window.__step, dt: Math.round(performance.now() - (window.__stepT || 0)), name, inter: e.isIntersecting, ratio: +e.intersectionRatio.toFixed(2), th: JSON.stringify(opts && opts.threshold) });
            }
          }
          return cb(entries, obs);
        };
        return new IO(wrapped, opts);
      };
      window.IntersectionObserver.prototype = IO.prototype;
    });
    await p.goto('http://localhost:5173/', { waitUntil: 'load' });
    await w8(2500);
    const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    let i = 0;
    for (let y = 0; y <= maxY; y += STEP) {
      i++;
      await p.evaluate((y, i) => { window.__step = i; window.__stepT = performance.now(); window.scrollTo(0, y); }, y, i);
      await w8(WAIT);
    }
    res[v.name] = await p.evaluate(() => window.__io);
    await p.close();
  }
  await b.close();
  // compare: first isIntersecting=true per (name, threshold) occurrence order
  const firstTrue = (arr) => { const m = new Map(); for (const e of arr) { if (!e.inter) continue; const k = e.name + ' th=' + e.th; if (!m.has(k)) m.set(k, []); m.get(k).push(`s${e.step}+${e.dt}ms`); } return m; };
  const A = firstTrue(res.baseline), B = firstTrue(res.cv);
  const keys = new Set([...A.keys(), ...B.keys()]);
  for (const k of keys) {
    const a = (A.get(k) || []).join(','), bb = (B.get(k) || []).join(',');
    const same = a.replace(/\+\d+ms/g, '') === bb.replace(/\+\d+ms/g, '');
    console.log((same ? '   ' : '!! ') + k.padEnd(60).slice(0, 60), ' base:', a.slice(0, 60), ' | cv:', bb.slice(0, 60));
  }
})().catch((e) => { console.error(e); process.exit(1); });
