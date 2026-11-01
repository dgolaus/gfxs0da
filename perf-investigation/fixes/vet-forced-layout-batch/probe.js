// Equivalence probe: baseline vs variant script.js, multiple scenarios.
const path = require('path');
const crypto = require('crypto');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./bench.js');
const S = 'scratchpad';
const VARIANT = { name: 'v', files: { '/script.js': S + '/fixes/forced-layout/script.js' } };
const BASE = { name: 'baseline' };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

const collect = () => {
  const cs = (el, props, pseudo) => { if (!el) return null; const s = getComputedStyle(el, pseudo || null); const o = {}; props.forEach((p) => o[p] = s.getPropertyValue(p)); return o; };
  const out = {};
  out.scrollY = Math.round(window.scrollY);
  const tracks = [...document.querySelectorAll('.tcol-track')];
  out.tracks = tracks.map((t) => ({ n: t.children.length, hidden: t.querySelectorAll('[aria-hidden="true"].quote').length, h: Math.round(t.getBoundingClientRect().height) }));
  out.tracksHTML = tracks.map((t) => t.innerHTML);
  const nav = document.getElementById('nav');
  out.nav = cs(nav, ['padding-top', 'padding-bottom']);
  out.navCls = nav ? nav.className : null;
  out.navBefore = cs(nav, ['opacity'], '::before');
  out.brand = cs(document.querySelector('.nav > .brand'), ['opacity', 'transform']);
  out.navBtn = cs(document.querySelector('.nav > .btn'), ['opacity', 'transform']);
  out.links = cs(document.querySelector('.nav-links'), ['padding-top', 'padding-left']);
  out.linksBefore = cs(document.querySelector('.nav-links'), ['opacity'], '::before');
  out.sections = ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => { const e = document.getElementById(id); return e ? Object.assign({ id, cls: e.className }, cs(e, ['opacity', 'filter', 'transform', '--leave'])) : null; });
  const f = document.querySelector('.cfooter');
  out.footerFp = f ? getComputedStyle(f).getPropertyValue('--fp').trim() : null;
  out.footerKids = [...document.querySelectorAll('.cfooter *')].filter((e) => { const s = getComputedStyle(e); return s.opacity !== '1' || s.transform !== 'none'; }).slice(0, 20).map((e) => { const s = getComputedStyle(e); return e.className + '|' + s.opacity + '|' + s.transform; });
  out.accents = [...document.querySelectorAll('.hero-title .accent, .process-text h2 .accent-soft')].map((el) => { const t = el.querySelector(':scope > .accent-text'); return { same: t ? t.style.backgroundImage === el.style.backgroundImage : null, has: !!el.style.backgroundImage, tight: /12vh/.test(el.style.backgroundImage) }; });
  out.htmlInline = document.documentElement.getAttribute('style');
  out.htmlCls = document.documentElement.className;
  out.errors = window.__errs || [];
  return out;
};

const ERR = `window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));`;

async function run(browser, v, sc) {
  const vv = Object.assign({}, v, { js: ERR });
  const { p } = await openPage(browser, vv, { throttle: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message)));
  if (sc.viewport) await p.setViewport(sc.viewport);
  if (sc.rm) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto('http://localhost:5173' + (sc.path || '/'), { waitUntil: 'networkidle2' });
  await w8(2500);
  const snaps = [];
  snaps.push(['load', await p.evaluate(collect)]);
  for (const y of sc.ys || []) {
    await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y === 'end' ? document.documentElement.scrollHeight : y, { immediate: true }); else window.scrollTo(0, y === 'end' ? 1e7 : y); }, y);
    await w8(1200);
    snaps.push([String(y), await p.evaluate(collect)]);
  }
  await p.close();
  return { snaps, errs };
}

function cmp(a, b, pre, diffs, ignore) {
  if (typeof a !== 'object' || a === null || b === null || typeof b !== 'object') {
    if (a !== b) diffs.push(pre + ': ' + JSON.stringify(a).slice(0, 120) + ' vs ' + JSON.stringify(b).slice(0, 120));
    return;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (ignore.includes(k)) continue; cmp(a[k], b[k], pre + '.' + k, diffs, ignore); }
}

(async () => {
  const scenarios = [
    { name: 'desk', ys: [150, 300, 500, 1500, 2600, 3700, 5000, 'end', 0] },
    { name: 'desk-hash', path: '/#pricing', ys: [0] },
    { name: 'tablet', viewport: { width: 900, height: 1000 }, ys: [400, 'end', 0] },
    { name: 'mobile', viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, ys: [400, 3000, 'end', 0] },
    { name: 'rm', rm: true, ys: [400, 'end', 0] },
    { name: 'tos', path: '/tos/', ys: [400, 'end', 0] },
    { name: 'tos-hash', path: '/tos/#pricing', ys: [] },
  ];
  const browser = await puppeteer.launch({ headless: 'new' });
  const res = {};
  for (const sc of scenarios) {
    const a = await run(browser, BASE, sc);
    const b = await run(browser, VARIANT, sc);
    const diffs = [];
    a.snaps.forEach(([lbl, sa], i) => {
      const sb = b.snaps[i] && b.snaps[i][1];
      const ta = sa.tracksHTML.map((h) => crypto.createHash('md5').update(h).digest('hex').slice(0, 8));
      const tb = sb.tracksHTML.map((h) => crypto.createHash('md5').update(h).digest('hex').slice(0, 8));
      if (JSON.stringify(ta) !== JSON.stringify(tb)) diffs.push(lbl + ' tracksHTML ' + ta + ' vs ' + tb);
      cmp(sa, sb, lbl, diffs, ['tracksHTML', 'htmlInline']);
    });
    res[sc.name] = {
      diffs,
      pageErrors: [a.errs, b.errs],
      loadSummary: { base: { tracks: a.snaps[0][1].tracks, inline: a.snaps[0][1].htmlInline, y: a.snaps[0][1].scrollY, fp: a.snaps[0][1].footerFp }, variant: { tracks: b.snaps[0][1].tracks, inline: b.snaps[0][1].htmlInline, y: b.snaps[0][1].scrollY, fp: b.snaps[0][1].footerFp } },
      lastInline: [a.snaps[a.snaps.length - 1][1].htmlInline, b.snaps[b.snaps.length - 1][1].htmlInline],
    };
    console.error('done', sc.name, diffs.length);
  }
  await browser.close();
  console.log(JSON.stringify(res, null, 2));
})().catch((e) => { console.error(e.stack); process.exit(1); });
