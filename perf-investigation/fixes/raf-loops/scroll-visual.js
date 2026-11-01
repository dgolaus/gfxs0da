/* Scrolled-state pixel check (complements bench.js visual, which only shoots the top of the page).
 * For each scroll position: scroll (Lenis immediate), let lerps/transitions settle, freeze all
 * animations at a fixed currentTime, force counters final, screenshot the viewport, diff vs baseline.
 * Also reports a baseline-vs-baseline noise run.
 * Usage: node scroll-visual.js <variants.json> */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage: openPage0 } = require('./vis/bench.js');
const openPage = async (b, v, o) => { const r = await openPage0(b, v, o); if (process.env.MOBILE) await r.p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }); return r; };
let sharp; try { sharp = require(path.join('../node_modules/sharp')); } catch (e) {}
const OUT = path.join(__dirname, process.env.MOBILE ? 'scrollvis-mobile' : 'scrollvis');
fs.mkdirSync(OUT, { recursive: true });
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

async function positions(browser) {
  const { p } = await openPage(browser, { name: 'baseline' }, { throttle: 1 });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await w8(1500);
  const pos = await p.evaluate(() => {
    const vh = innerHeight, max = document.documentElement.scrollHeight - vh;
    const out = { top: 0, nav120: 120, nav250: 250, nav400: 400 };
    for (const id of ['about', 'process', 'trust', 'pricing']) {
      const e = document.getElementById(id); if (!e) continue;
      const b = e.getBoundingClientRect().bottom + scrollY;
      out['fade_' + id] = Math.round(b - vh * 0.15); // mid-fade (leave ≈ 0.5)
    }
    out.footerMid = Math.round(max - 300);
    out.footerEnd = Math.round(max);
    return out;
  });
  await p.close();
  return pos;
}

async function shoot(browser, v, pos, tag) {
  const { p } = await openPage(browser, v, { throttle: 1 });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await w8(2000);
  const files = {};
  for (const [name, y] of Object.entries(pos)) {
    await p.evaluate((y) => {
      // restart all animations so every variant is frozen at the same state later
      for (const a of document.getAnimations()) { try { a.play(); } catch (e) {} }
      if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    }, y);
    await w8(2600); // gradient lerp (0.10/frame), 0.18s fade transitions, rAF drivers
    await p.evaluate(() => {
      document.querySelectorAll('.counter').forEach((el) => {
        const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
        el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
      });
      const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
      for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} }
    });
    await w8(300);
    const f = path.join(OUT, `${tag}_${name}.png`);
    await p.screenshot({ path: f });
    const st = await p.evaluate(() => ({
      y: Math.round(scrollY),
      navStyle: (document.getElementById('nav') || {}).getAttribute ? document.getElementById('nav').getAttribute('style') : null,
      rootStyle: document.documentElement.getAttribute('style'),
      navPill: getComputedStyle(document.querySelector('.nav-links')).getPropertyValue('--nav-pill-vis').trim(),
      leave: ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => { const e = document.getElementById(id); return e ? getComputedStyle(e).opacity : null; }),
      fp: getComputedStyle(document.querySelector('.cfooter')).getPropertyValue('--fp').trim(),
    }));
    files[name] = { f, st };
  }
  await p.close();
  return files;
}

async function diffPng(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = A.info.width * A.info.height;
  let sum = 0, changed = 0, big = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3;
    sum += d; if (d > 8) changed++; if (d > 32) big++;
  }
  return { mad: +(sum / n).toFixed(3), pct: +(changed / n * 100).toFixed(3), big: +(big / n * 100).toFixed(3) };
}

(async () => {
  const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 600000 });
  const pos = await positions(browser);
  console.log('positions', JSON.stringify(pos));
  const base = await shoot(browser, { name: 'baseline' }, pos, 'baseline');
  const base2 = await shoot(browser, { name: 'baseline' }, pos, 'baseline2');
  const res = { __noise: {} };
  for (const k of Object.keys(pos)) res.__noise[k] = await diffPng(base[k].f, base2[k].f);
  const states = { baseline: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.st])) };
  for (const v of variants) {
    if (v.name === 'baseline') continue;
    const r = await shoot(browser, v, pos, v.name);
    res[v.name] = {};
    for (const k of Object.keys(pos)) res[v.name][k] = await diffPng(base[k].f, r[k].f);
    states[v.name] = Object.fromEntries(Object.entries(r).map(([k, x]) => [k, x.st]));
  }
  await browser.close();
  console.log(JSON.stringify(res, null, 1));
  console.log(JSON.stringify(states, null, 1));
})().catch((e) => { console.error('FAIL', e.stack || e.message); process.exit(1); });
