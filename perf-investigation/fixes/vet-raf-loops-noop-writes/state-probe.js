/* Deterministic state comparison (not timing): baseline vs variant.
   For each scenario and scroll position, pauses CSS keyframe animations at a
   fixed time, waits for transitions + JS lerps to settle, then dumps the
   computed rendering properties of EVERY element (+ the nav pseudo elements)
   and diffs baseline vs variant. Also collects page errors. */
const path = require('path'); const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./bench.js');
const VAR = path.join(__dirname, 'script.variant.js').replace(/\\/g, '/');
const FREEZE_CSS = '#chat-messages{height:700px!important;min-height:0!important;max-height:700px!important;overflow:hidden!important}';
const variants = [{ name: 'baseline', css: FREEZE_CSS }, { name: 'variant', css: FREEZE_CSS, files: { '/script.js': process.env.VARFILE || VAR } }];
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

const DUMP = () => {
  for (const a of document.getAnimations()) {
    if (a.constructor && a.constructor.name === 'CSSAnimation') { try { a.pause(); a.currentTime = 5000; } catch (e) {} }
  }
  const props = ['opacity', 'filter', 'transform', 'translate', 'scale', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'backgroundImage', 'visibility', 'display', 'width', 'height'];
  const out = {};
  const all = document.querySelectorAll('body *');
  let i = 0;
  for (const el of all) {
    if (el.closest('#chat-messages, .tcols, .counter')) continue; // time-driven content
    i++;
    const cs = getComputedStyle(el);
    const key = (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.')) + '@' + i;
    const o = {};
    for (const p of props) o[p] = cs[p];
    const r = el.getBoundingClientRect();
    o.rect = [r.left, r.top, r.width, r.height].map((x) => Math.round(x * 100) / 100).join(',');
    out[key] = o;
  }
  for (const sel of ['.nav', '.nav-links']) {
    const el = document.querySelector(sel); if (!el) continue;
    const cs = getComputedStyle(el, '::before');
    out[sel + '::before'] = { opacity: cs.opacity, width: cs.width, height: cs.height };
  }
  const nav = document.getElementById('nav');
  out.__meta = { scrollY: Math.round(window.scrollY), navClass: nav ? nav.className : null, htmlClass: document.documentElement.className.replace(/\blenis[-\w]*\b/g, '').trim() };
  return out;
};

async function scenario(browser, v, sc) {
  const { p, c } = await openPage(browser, v, { throttle: 1 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e.message || e)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (sc.mobile) await p.emulate({ viewport: { width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36' });
  if (sc.reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto('http://localhost:5173' + sc.url, { waitUntil: 'networkidle2' });
  await w8(1800);
  const res = {};
  const positions = sc.positions ? await p.evaluate(sc.positions) : [null];
  for (const y of positions) {
    if (y != null) {
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
    }
    await w8(sc.settle || 2600);
    res[String(y)] = await p.evaluate(DUMP);
  }
  await p.close();
  return { res, errors };
}

const POS_HOME = () => {
  const vh = innerHeight; const out = [0, 40, 120, 200, 250, 300, 359, 420];
  const max = document.documentElement.scrollHeight - vh;
  for (const id of ['about', 'process', 'trust', 'pricing']) {
    const el = document.getElementById(id); if (!el) continue;
    const b = el.getBoundingClientRect().bottom + scrollY;
    out.push(Math.round(b - vh * 0.15), Math.round(b + vh * 0.05));
  }
  const f = document.querySelector('.cfooter');
  if (f) out.push(Math.round(max - f.offsetHeight * 0.6), Math.round(max - f.offsetHeight * 0.2), max);
  out.push(0);
  return out.filter((y) => y >= 0 && y <= max);
};
const POS_TOS = () => { const max = document.documentElement.scrollHeight - innerHeight; return [0, 150, 300, 420, Math.round(max / 2), max, 0].filter((y) => y <= max); };

const SCENARIOS = {
  home: { url: '/', positions: POS_HOME },
  hash: { url: '/#pricing', positions: null },
  mobile: { url: '/', mobile: true, positions: POS_HOME },
  reduced: { url: '/', reduced: true, positions: POS_HOME, settle: 900 },
  tos: { url: '/tos/', positions: POS_TOS },
  toshash: { url: '/tos/#pricing', positions: null },
};

(async () => {
  const which = (process.argv[2] || Object.keys(SCENARIOS).join(',')).split(',');
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const name of which) {
    const sc = SCENARIOS[name];
    const A = await scenario(browser, variants[0], sc);
    const B = await scenario(browser, variants[1], sc);
    const lines = [];
    let diffs = 0, compared = 0;
    for (const y of Object.keys(A.res)) {
      const a = A.res[y], b = B.res[y];
      if (!b) { lines.push(`  pos ${y}: missing in variant`); continue; }
      if (JSON.stringify(a.__meta) !== JSON.stringify(b.__meta)) lines.push(`  pos ${y}: META base=${JSON.stringify(a.__meta)} var=${JSON.stringify(b.__meta)}`);
      for (const k of Object.keys(a)) {
        if (k === '__meta') continue;
        if (!b[k]) { lines.push(`  pos ${y}: ${k} missing in variant`); diffs++; continue; }
        for (const p of Object.keys(a[k])) {
          compared++;
          if (a[k][p] !== b[k][p]) { diffs++; if (lines.length < 60) lines.push(`  pos ${y}: ${k}.${p}\n      base=${String(a[k][p]).slice(0, 160)}\n      var =${String(b[k][p]).slice(0, 160)}`); }
        }
      }
    }
    console.log(`== ${name}: positions=${Object.keys(A.res).join(',')} compared=${compared} diffs=${diffs}`);
    console.log(`   errors base=${JSON.stringify(A.errors)} var=${JSON.stringify(B.errors)}`);
    for (const l of lines) console.log(l);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
