/* How far off are the reserved heights (--cv-h) from the real section heights,
   across viewport sizes? Variant at the top (sections below not rendered yet)
   vs baseline. Also: rail thumb height at the top, Lenis limit. */
const fs = require('fs');
const puppeteer = require('../node_modules/puppeteer');
const SP = 'scratchpad';
const OW = SP + '/fixes/offscreen-work';
const RUNS = [{ name: 'base' }, { name: 'cv', files: { '/styles.css': OW + '/styles.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' } }];
const SIZES = (process.argv[2] || '2560x1440,1920x1080,1680x1050,1600x900,1536x864,1440x900,1366x768,1280x720,1180x820,1100x800,1024x768,900x1000,820x1180,768x1024,700x900,600x960,480x900,430x932,414x896,390x844,375x667,360x740,320x640').split(',');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const pages = {};
  for (const v of RUNS) {
    const p = await b.newPage();
    const map = v.files ? Object.fromEntries(Object.entries(v.files).map(([k, f]) => [k, fs.readFileSync(f)])) : {};
    await p.setRequestInterception(true);
    p.on('request', (req) => { const u = new URL(req.url()); let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
      if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: k.endsWith('.js') ? 'application/javascript' : 'text/css', body: map[k] }); req.continue(); });
    await p.evaluateOnNewDocument(() => { try { localStorage.setItem('s0da-lite', '0'); sessionStorage.setItem('s0da-booted', '1'); } catch (e) {}
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); });
    pages[v.name] = p;
  }
  console.log('size        section: real(base) / reserved(cv, unrendered) / delta ... | docH base/cv | thumb base/cv');
  for (const s of SIZES) {
    const [W, H] = s.split('x').map(Number);
    const mobile = W < 700;
    const r = {};
    for (const v of RUNS) {
      const p = pages[v.name];
      await p.bringToFront();
      await p.setViewport({ width: W, height: H, isMobile: mobile, hasTouch: mobile });
      await p.goto('http://localhost:5173/', { waitUntil: 'load' });
      await p.evaluate(async () => { await document.fonts.ready; });
      await w8(1200);
      r[v.name] = await p.evaluate(() => {
        const o = {};
        for (const id of ['about', 'process', 'trust', 'pricing', 'contact']) o[id] = document.getElementById(id).getBoundingClientRect().height;
        o.docH = document.documentElement.scrollHeight;
        const t = document.querySelector('.rail__thumb'); o.thumb = t ? t.style.height : '';
        o.skipped = ['about', 'process', 'trust', 'pricing', 'contact'].filter((id) => { const e = document.getElementById(id); return e.checkVisibility && !e.checkVisibility({ contentVisibilityAuto: true }); }).join('');
        return o;
      });
    }
    const parts = ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => {
      const d = r.cv[id] - r.base[id];
      return `${id.slice(0, 4)} ${r.base[id].toFixed(1)}/${r.cv[id].toFixed(1)}/${d >= 0 ? '+' : ''}${d.toFixed(1)}`;
    });
    console.log(s.padEnd(10), parts.join('  '), `| docH ${r.base.docH}/${r.cv.docH} | thumb ${r.base.thumb}/${r.cv.thumb}`);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
