/* Deterministic scrolled comparison, baseline vs variant.
   Freezes everything time-dependent the same way in both, walks the page in
   viewport steps (native scrollTo), screenshots each step and diffs.
   Also reports geometry (section tops, doc height, rail thumb) at the top
   before anything below is rendered.
   node walk.js WxH [mobile] */
const fs = require('fs');
const path = require('path');
const puppeteer = require('../node_modules/puppeteer');
const sharp = require('../node_modules/sharp');
const SP = 'scratchpad';
const OW = SP + '/fixes/offscreen-work';
const OUT = SP + '/fixes/vet-offscreen-work-cv-defer/walk';
fs.mkdirSync(OUT, { recursive: true });
const VARS = [
  { name: 'baseline' },
  { name: 'baselineB' },
  { name: 'cv', files: { '/styles.css': OW + '/styles.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' } },
];
const [W, H] = (process.argv[2] || '1440x900').split('x').map(Number);
const mobile = process.argv[3] === 'mobile';
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

const FREEZE_CSS = `*,*::before,*::after{transition:none!important;caret-color:transparent!important}
#chat-messages,#chat-typing{visibility:hidden!important}`;

async function open(browser, v) {
  const p = await browser.newPage();
  await p.setViewport({ width: W, height: H, isMobile: mobile, hasTouch: mobile });
  const map = v.files ? Object.fromEntries(Object.entries(v.files).map(([k, f]) => [k, fs.readFileSync(f)])) : {};
  await p.setRequestInterception(true);
  p.on('request', (req) => {
    const u = new URL(req.url());
    let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
    if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: k.endsWith('.js') ? 'application/javascript' : 'text/css', body: map[k] });
    req.continue();
  });
  await p.evaluateOnNewDocument((css) => {
    try { localStorage.setItem('s0da-lite', '0'); sessionStorage.setItem('s0da-booted', '1'); } catch (e) {}
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    const add = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...c) { if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; } return add.apply(this, c); };
    const put = () => { const s = document.createElement('style'); s.id = '__freeze'; s.textContent = css; document.head.appendChild(s); };
    document.addEventListener('DOMContentLoaded', put);
  }, FREEZE_CSS);
  await p.goto('http://localhost:5173/', { waitUntil: 'load' });
  await p.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
  await w8(2500);
  return p;
}

const freeze = (p) => p.evaluate(() => {
  document.querySelectorAll('.counter').forEach((el) => {
    const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
    el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
    el.classList.remove('is-done');
  });
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
  document.querySelectorAll('.star').forEach((s) => { s.classList.add('lit'); s.classList.remove('flash'); });
  document.querySelectorAll('.stars').forEach((g) => g.classList.add('is-lit'));
  const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
  for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} }
});

async function geometry(p) {
  return p.evaluate(() => {
    const ids = ['work', 'about', 'process', 'trust', 'pricing', 'contact'];
    const o = {};
    for (const id of ids) { const e = document.getElementById(id); if (e) { const r = e.getBoundingClientRect(); o[id] = +(r.top + scrollY).toFixed(2) + '/' + +r.height.toFixed(2); } }
    o.docH = document.documentElement.scrollHeight;
    const t = document.querySelector('.rail__thumb');
    o.thumb = t ? t.style.height : null;
    o.lenisLimit = window.lenis ? Math.round(window.lenis.limit) : null;
    return o;
  });
}

async function diff(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = A.info.width * A.info.height; let sum = 0, ch = 0; let minY = 1e9, maxY = -1, minX = 1e9, maxX = -1;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3;
    sum += d; if (d > 8) { ch++; const y = Math.floor(i / A.info.width), x = i % A.info.width; if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x; }
  }
  return { mad: +(sum / n).toFixed(3), pct: +(ch / n * 100).toFixed(3), box: ch ? `x${minX}-${maxX} y${minY}-${maxY}` : '' };
}

(async () => {
  const b = await puppeteer.launch({ headless: 'new', protocolTimeout: 120000, args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  const pages = {};
  for (const v of VARS) pages[v.name] = await open(b, v);
  // geometry at top, before scrolling (variant: estimates for sections below)
  for (const v of VARS) console.log('geomTop', v.name.padEnd(10), JSON.stringify(await geometry(pages[v.name])));
  const maxY = await pages.baseline.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const ys = []; for (let y = 0; y < maxY; y += Math.round(H * 0.75)) ys.push(y); ys.push(maxY);
  for (const y of ys) {
    const files = {};
    for (const v of VARS) {
      const p = pages[v.name]; await p.bringToFront();
      await p.evaluate((y) => window.scrollTo(0, y), y);
      await w8(1400);  // let lerps converge, IO/c-v settle, is-scrolling clear
      await freeze(p);
      await w8(150);
      files[v.name] = path.join(OUT, `${W}x${H}_${v.name}_${y}.png`);
      await p.screenshot({ path: files[v.name] });
    }
    const noise = await diff(files.baseline, files.baselineB);
    const dv = await diff(files.baseline, files.cv);
    const sy = await pages.cv.evaluate(() => Math.round(scrollY));
    console.log(`y=${String(y).padStart(5)} (cv at ${sy})  noise mad ${noise.mad} pct ${noise.pct} ${noise.box}   | cv mad ${dv.mad} pct ${dv.pct} ${dv.box}`);
  }
  for (const v of VARS) console.log('geomEnd', v.name.padEnd(10), JSON.stringify(await geometry(pages[v.name])));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
