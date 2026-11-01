/* Equivalência além do topo da página (complementa bench.js visual):
   - DOM final das colunas de depoimentos (desktop e mobile)
   - valores computados de --leave / --nav-* / --fp e estilos que dependem deles
   - screenshots com animações congeladas em várias posições de scroll e em /#pricing
   uso: node equiv.js <variants.json>   (usa BENCH_URL se definido) */
const fs = require('fs');
const path = require('path');
const SP = path.join(__dirname, '..', '..');
const { openPage } = require(path.join(__dirname, 'bench_local.js'));
const puppeteer = require(path.join('../node_modules/puppeteer'));
const sharp = require(path.join('../node_modules/sharp'));
const BASE = process.env.BENCH_URL || 'http://localhost:5173/';
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(__dirname, 'eq');
fs.mkdirSync(OUT, { recursive: true });

async function diffPng(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = A.info.width * A.info.height; let sum = 0, changed = 0;
  for (let i = 0; i < n; i++) { const o = i * 4; const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; sum += d; if (d > 8) changed++; }
  return { mad: +(sum / n).toFixed(3), pct: +(changed / n * 100).toFixed(3) };
}

const PROBE = () => {
  const cs = (el, p) => el ? getComputedStyle(el).getPropertyValue(p).trim() : null;
  const root = document.documentElement;
  const secs = ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => document.getElementById(id));
  const nav = document.getElementById('nav');
  const foot = document.querySelector('.cfooter');
  return {
    tracks: [...document.querySelectorAll('.tcols .tcol-track')].map((t) => [...t.children].map((c) => (c.getAttribute('aria-hidden') ? 'h' : 'o') + (c.querySelector('.who') || {}).textContent).join(',')),
    tcolsHTMLlen: (document.querySelector('.tcols') || {}).outerHTML.length,
    navPill: nav ? [cs(nav, 'padding-top'), nav.className, cs(nav.querySelector('.brand'), 'opacity'), cs(nav.querySelector('.brand'), 'transform')] : null,
    rootVars: ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => parseFloat(cs(root, k))),
    secs: secs.map((s) => s && [s.className, parseFloat(cs(s, '--leave')), cs(s, 'opacity'), cs(s, 'filter'), cs(s, 'transform')].join('|')),
    fp: foot && [parseFloat(cs(foot, '--fp'))],
    accents: [...document.querySelectorAll('.hero-title .accent, .process-text h2 .accent-soft')].map((e) => [e.style.backgroundImage.length, (e.querySelector(':scope > .accent-text') || {}).style.backgroundImage === e.style.backgroundImage]),
    docH: root.scrollHeight,
  };
};

async function shot(browser, v, { vp, url, scrollY, file }) {
  const { p } = await openPage(browser, v, { throttle: 1 });
  await p.setViewport(vp);
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await w8(1200);
  if (scrollY != null) {
    await p.evaluate((y) => { const Y = y < 0 ? document.documentElement.scrollHeight - innerHeight : y; if (window.lenis) window.lenis.scrollTo(Y, { immediate: true }); else window.scrollTo(0, Y); }, scrollY);
  }
  await w8(2000); // gradiente (lerp 0.10) e transições de 0.18s assentam
  const probe = await p.evaluate(PROBE);
  await p.evaluate(() => {
    document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
    const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} }
  });
  await w8(300);
  await p.screenshot({ path: file });
  const sy = await p.evaluate(() => scrollY);
  await p.close();
  return { probe, sy };
}

(async () => {
  const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const base = variants.find((v) => v.name === 'baseline');
  const desk = { width: 1440, height: 900 };
  const mob = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
  const scenarios = [
    { id: 'top', vp: desk, url: BASE, scrollY: null },
    { id: 'y1500', vp: desk, url: BASE, scrollY: 1500 },
    { id: 'y2600', vp: desk, url: BASE, scrollY: 2600 },
    { id: 'y3700', vp: desk, url: BASE, scrollY: 3700 },
    { id: 'end', vp: desk, url: BASE, scrollY: -1 },
    { id: 'hashPricing', vp: desk, url: BASE + '#pricing', scrollY: null },
    { id: 'mobTop', vp: mob, url: BASE, scrollY: null },
    { id: 'mobY3000', vp: mob, url: BASE, scrollY: 3000 },
  ];
  const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 120000 });
  const out = {};
  for (const sc of scenarios) {
    const bf = path.join(OUT, `${sc.id}_baseline.png`), bf2 = path.join(OUT, `${sc.id}_baseline2.png`);
    const B = await shot(browser, base, { ...sc, file: bf });
    const B2 = await shot(browser, base, { ...sc, file: bf2 });
    out[sc.id] = { __noise: { ...(await diffPng(bf, bf2)), probeSame: JSON.stringify(B.probe) === JSON.stringify(B2.probe) }, baselineScrollY: B.sy };
    for (const v of variants) {
      if (v.name === 'baseline') continue;
      const vf = path.join(OUT, `${sc.id}_${v.name}.png`);
      const V = await shot(browser, v, { ...sc, file: vf });
      const diffs = Object.keys(B.probe).filter((k) => JSON.stringify(B.probe[k]) !== JSON.stringify(V.probe[k])).map((k) => ({ k, base: B.probe[k], variant: V.probe[k] }));
      out[sc.id][v.name] = { ...(await diffPng(bf, vf)), scrollY: V.sy, probeDiffs: diffs };
    }
    console.error('done', sc.id);
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
