/* Clean scrolled comparison: one browser per run (no background-tab throttling),
   baseline x2 and variant x2, same scroll script, all animations paused at the
   same currentTime, counters/reveals/stars forced. Also dumps composited layers
   at each stop. node walk2.js WxH [mobile] [variantName] */
const fs = require('fs');
const path = require('path');
const puppeteer = require('../node_modules/puppeteer');
const sharp = require('../node_modules/sharp');
const SP = 'scratchpad';
const OW = SP + '/fixes/offscreen-work';
const VET = SP + '/fixes/vet-offscreen-work-cv-defer';
const OUT = VET + '/walk3';
fs.mkdirSync(OUT, { recursive: true });
const ALL = {
  cv: { '/styles.css': OW + '/styles.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' },
  cvcssonly: { '/styles.css': OW + '/styles.css' },
  amended: { '/styles.css': VET + '/styles.amended.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' },
};
const [W, H] = (process.argv[2] || '1440x900').split('x').map(Number);
const mobile = process.argv[3] === 'mobile';
const VNAME = process.argv[4] || 'cv';
const RUNS = [{ name: 'base1' }, { name: 'base2' }, { name: VNAME + '1', pre: 4300, step: 1900 }, { name: VNAME + '2', pre: 900, step: 1100 }];
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const FREEZE_CSS = `*,*::before,*::after{transition:none!important;caret-color:transparent!important}
#chat-messages,#chat-typing{visibility:hidden!important}`;

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

async function runOne(v, ys) {
  const b = await puppeteer.launch({ headless: 'new', protocolTimeout: 120000 });
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
  await p.evaluateOnNewDocument((css) => {
    try { localStorage.setItem('s0da-lite', '0'); sessionStorage.setItem('s0da-booted', '1'); } catch (e) {}
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    const add = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...c) { if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; } return add.apply(this, c); };
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); });
  }, FREEZE_CSS);
  const c = await p.target().createCDPSession();
  let last = null;
  c.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) last = e.layers; });
  await c.send('LayerTree.enable');
  await p.goto('http://localhost:5173/', { waitUntil: 'load' });
  await p.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
  await w8(v.pre || 2500);
  if (!ys) { const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); ys = []; for (let y = 0; y < maxY; y += Math.round(H * 0.75)) ys.push(y); ys.push(maxY); }
  const out = [];
  for (const y of ys) {
    await p.evaluate((y) => window.scrollTo(0, y), y);
    await w8(v.step || 1400);
    await freeze(p);
    await w8(200);
    const f = path.join(OUT, `${W}x${H}_${v.name}_${y}.png`);
    await p.screenshot({ path: f });
    const ls = (last || []).filter((l) => l.drawsContent);
    const sy = await p.evaluate(() => Math.round(scrollY));
    out.push({ y, sy, f, layers: ls.length, layerSig: ls.map((l) => `${Math.round(l.width)}x${Math.round(l.height)}`).sort().join(',') });
  }
  await b.close();
  return { ys, out };
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
  return `mad ${(sum / n).toFixed(3)} pct ${(ch / n * 100).toFixed(3)}${ch ? ` box x${minX}-${maxX} y${minY}-${maxY}` : ''}`;
}

(async () => {
  const res = {};
  let ys = null;
  for (const v of RUNS) { const r = await runOne(v, ys); ys = r.ys; res[v.name] = r.out; }
  for (let i = 0; i < ys.length; i++) {
    const b1 = res.base1[i], b2 = res.base2[i], c1 = res[VNAME + '1'][i], c2 = res[VNAME + '2'][i];
    console.log(`y=${String(ys[i]).padStart(5)} sy b/c ${b1.sy}/${c1.sy} layers b ${b1.layers}/${b2.layers} c ${c1.layers}/${c2.layers}${b1.layerSig === c1.layerSig ? '' : ' LAYERS-DIFFER'}`);
    console.log(`     base1~base2 ${await diff(b1.f, b2.f)}`);
    console.log(`     ${VNAME}1~${VNAME}2 ${await diff(c1.f, c2.f)}`);
    console.log(`     base1~${VNAME}1 ${await diff(b1.f, c1.f)}`);
    console.log(`     base2~${VNAME}2 ${await diff(b2.f, c2.f)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
