/* Computed-style whole-document probe (deterministic, not timing).
 * For each scroll position: scroll, let drivers settle, finish/freeze every animation
 * at the same currentTime, then dump computed opacity/filter/transform/translate/padding/
 * background-image/visibility + rounded rect for EVERY element (+ ::before of nav parts).
 * Compares variant vs baseline and baseline vs baseline2 (noise).
 * Usage: node cs-probe.js <variants.json> [mobile|reduced]  */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./bench.js');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const MODE = process.argv[3] || 'desktop';

async function open(b, v) {
  const r = await openPage(b, v, { throttle: 1 });
  if (MODE === 'mobile') await r.p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  if (MODE === 'reduced') await r.p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  return r;
}

async function positions(b) {
  const { p } = await open(b, { name: 'baseline' });
  await p.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 120000 });
  await w8(1500);
  const pos = await p.evaluate(() => {
    const vh = innerHeight, max = document.documentElement.scrollHeight - vh;
    const out = { y0: 0, y30: 30, y90: 90, y150: 150, y200: 200, y270: 270, y330: 330, y360: 360, y500: 500 };
    for (const id of ['about', 'process', 'trust', 'pricing']) {
      const e = document.getElementById(id); if (!e) continue;
      const bt = e.getBoundingClientRect().bottom + scrollY;
      for (const f of [0.28, 0.2, 0.1, 0.02, -0.05]) out[`${id}_${f}`] = Math.round(bt - vh * f);
    }
    out.fmid = Math.round(max - 300); out.fend = Math.round(max); out.back0 = 0;
    return out;
  });
  await p.close();
  return pos;
}

async function dump(b, v, pos) {
  const { p } = await open(b, v);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 120000 });
  await w8(2000);
  const res = {};
  for (const [name, y] of Object.entries(pos)) {
    await p.evaluate((y) => {
      for (const a of document.getAnimations()) { try { a.play(); } catch (e) {} }
      if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
    }, y);
    await w8(2600);
    res[name] = await p.evaluate(() => {
      document.querySelectorAll('.counter').forEach((el) => {
        const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
        el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
      });
      const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
      for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} }
      const props = ['opacity', 'filter', 'transform', 'translate', 'paddingTop', 'paddingLeft', 'backgroundImage', 'visibility', 'clipPath'];
      const out = {};
      const all = [...document.querySelectorAll('body *')];
      let j = 0; all.forEach((el) => {
        if (el.closest('[class*="chat"], [class*="ticket"], script, style')) return;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const key = (j++) + ':' + el.tagName + (el.id ? '#' + el.id : '') + (el.className && el.className.baseVal === undefined ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : '');
        out[key] = props.map((k) => cs[k]).join('|') + `|${r.x.toFixed(2)},${r.y.toFixed(2)},${r.width.toFixed(2)},${r.height.toFixed(2)}`;
      });
      for (const sel of ['.nav', '.nav-links']) {
        const el = document.querySelector(sel); if (!el) continue;
        const cs = getComputedStyle(el, '::before');
        out[sel + '::before'] = ['opacity', 'filter', 'transform'].map((k) => cs[k]).join('|');
      }
      out.__y = Math.round(scrollY);
      return out;
    });
  }
  await p.close();
  return { res, errs };
}

function cmp(A, B) {
  const diffs = {};
  for (const pos of Object.keys(A)) {
    const a = A[pos], b = B[pos] || {};
    const d = [];
    for (const k of Object.keys(a)) if (a[k] !== b[k]) d.push([k, a[k], b[k]]);
    for (const k of Object.keys(b)) if (!(k in a)) d.push([k, undefined, b[k]]);
    diffs[pos] = d;
  }
  return diffs;
}

(async () => {
  const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const b = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000 });
  const pos = await positions(b);
  console.log('MODE', MODE, 'positions', JSON.stringify(pos));
  const base = await dump(b, { name: 'baseline' }, pos);
  const base2 = await dump(b, { name: 'baseline' }, pos);
  const noise = cmp(base.res, base2.res);
  console.log('baseline errs', JSON.stringify(base.errs));
  for (const v of variants) {
    if (v.name === 'baseline') continue;
    const r = await dump(b, v, pos);
    console.log(v.name, 'errs', JSON.stringify(r.errs));
    const d = cmp(base.res, r.res);
    for (const p of Object.keys(pos)) {
      const nk = new Set(noise[p].map((x) => x[0]));
      const real = d[p].filter((x) => !nk.has(x[0]));
      console.log(p.padEnd(16), 'y=' + base.res[p].__y + '/' + r.res[p].__y, 'noiseDiffs=' + noise[p].length, 'variantDiffs=' + d[p].length, 'variantOnly=' + real.length);
      for (const x of real.slice(0, 8)) console.log('    ', x[0], '\n       base:', x[1], '\n       var :', x[2]);
    }
  }
  await b.close();
})().catch((e) => { console.error('FAIL', e.stack || e.message); process.exit(1); });
