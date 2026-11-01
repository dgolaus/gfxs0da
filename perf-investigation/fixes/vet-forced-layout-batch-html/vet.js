/* Adversarial checks for forced-layout-batch-html.
   A) pre-script window: script.js held back, screenshot + layer/style probe
   B) scripted scroll sequences (incremental), mid-fade positions, scroll back up
   C) reduced motion, mobile, /tos/
   usage: node vet.js A|B|C   */
const fs = require('fs');
const path = require('path');
const puppeteer = require('../node_modules/puppeteer');
const sharp = require('../node_modules/sharp');
const BASE = 'http://localhost:5173';
const OUT = __dirname;
const FIX = 'fixes/forced-layout';
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

const VARIANTS = {
  base: {},
  base2: {},
  var: { '/script.js': FIX + '/script.js', '/index.html': FIX + '/index.html' },
};

const PRELUDE = `(() => {
  try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
  try { if (window.__booted) sessionStorage.setItem('s0da-booted', '1'); } catch (e) {}
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  const add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function (...c) {
    if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; }
    return add.apply(this, c);
  };
})();`;

async function open(browser, vname, { vp = { width: 1440, height: 900 }, holdScript = 0, booted = true, reduced = false, mobile = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : vp);
  if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await require('./disk.js').serve(p, VARIANTS[vname], { holdScript });
  await p.evaluateOnNewDocument(`window.__booted = ${booted};`);
  await p.evaluateOnNewDocument(PRELUDE);
  return { p, ctx };
}

async function diffPng(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return { sizeMismatch: true };
  const n = A.info.width * A.info.height; let sum = 0, changed = 0, max = 0;
  for (let i = 0; i < n; i++) { const o = i * 4; const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; sum += d; if (d > 8) changed++; if (d > max) max = d; }
  return { mad: +(sum / n).toFixed(3), pct: +(changed / n * 100).toFixed(3), max: Math.round(max) };
}

const FREEZE = (t) => {
  document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); if (!isNaN(v)) el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
  const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
  for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t; } catch (e) {} }
};

const PROBE = () => {
  const cs = (el, p) => el ? getComputedStyle(el).getPropertyValue(p).trim() : null;
  const root = document.documentElement;
  const secs = ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => document.getElementById(id));
  const foot = document.querySelector('.cfooter');
  return {
    scrollY: Math.round(scrollY),
    rootInline: root.getAttribute('style'),
    rootVars: ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => parseFloat(cs(root, k))),
    secs: secs.map((s) => s && [s.id, s.className, s.style.getPropertyValue('--leave'), parseFloat(cs(s, '--leave')).toFixed(3), cs(s, 'opacity'), cs(s, 'filter'), cs(s, 'transform'), cs(s, 'will-change')].join('|')),
    fp: foot && [foot.style.getPropertyValue('--fp'), parseFloat(cs(foot, '--fp')).toFixed(3)],
    tracks: [...document.querySelectorAll('.tcols .tcol-track')].map((t) => t.children.length + ':' + [...t.children].filter((c) => c.getAttribute('aria-hidden')).length),
    accentBg: [...document.querySelectorAll('.hero-title .accent, .process-text h2 .accent-soft')].map((e) => e.style.backgroundImage.slice(0, 40) + '|' + ((e.querySelector(':scope > .accent-text') || {}).style || {}).backgroundImage?.slice(0, 40)),
  };
};

async function layerCount(p) {
  const c = await p.target().createCDPSession();
  let last = null;
  c.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers && e.layers.length) last = e.layers; });
  await c.send('LayerTree.enable');
  await w8(400);
  await c.send('LayerTree.disable');
  return last ? last.filter((l) => l.drawsContent).length : null;
}

/* ---------- A: pre-script window ---------- */
async function A() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const out = {};
  const urls = ['/', '/#about', '/#process', '/#trust', '/#pricing', '/#contact'];
  for (const url of urls) {
    for (const vn of ['base', 'base2', 'var']) {
      const { p, ctx } = await open(browser, vn, { holdScript: 9000 });
      p.goto(BASE + url, { timeout: 60000 }).catch(() => {});
      await w8(4500);
      const info = await p.evaluate(() => ({
        scriptRan: typeof window.lenis !== 'undefined' || !!document.querySelector('.tcol-track .quote[aria-hidden]') && false,
        y: Math.round(scrollY),
        cls: ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => (document.getElementById(id) || {}).className),
        visible: ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }),
      }));
      const layers = await layerCount(p);
      await p.evaluate(FREEZE, 1000);
      await w8(300);
      const f = path.join(OUT, `A_${url.replace(/[\/#]/g, '_')}_${vn}.png`);
      await p.screenshot({ path: f });
      out[url] = out[url] || {};
      out[url][vn] = { ...info, layers, f };
      await ctx.close();
    }
    const r = out[url];
    r.noise = await diffPng(r.base.f, r.base2.f);
    r.diff = await diffPng(r.base.f, r.var.f);
  }
  await browser.close();
  return out;
}

/* ---------- B: scripted scroll sequences ---------- */
async function seq(browser, vn, opts, steps) {
  const { p, ctx } = await open(browser, vn, opts);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + (opts.url || '/'), { waitUntil: 'networkidle2', timeout: 60000 });
  await p.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
  await w8(1500);
  const res = [];
  for (const st of steps) {
    // incremental wheel-like scroll via Lenis (or native), 12 sub-steps one per frame
    await p.evaluate(async (st) => {
      const H = document.documentElement.scrollHeight - innerHeight;
      let Y;
      if (st.to === 'end') Y = H;
      else if (typeof st.to === 'number') Y = st.to;
      else { // mid-fade for section: bottom at frac*vh
        const s = document.getElementById(st.to.id);
        const b = s.getBoundingClientRect().bottom + scrollY;
        Y = Math.round(b - st.to.frac * innerHeight);
      }
      Y = Math.max(0, Math.min(H, Y));
      const y0 = scrollY;
      const N = 12;
      for (let i = 1; i <= N; i++) {
        const y = y0 + (Y - y0) * i / N;
        if (window.lenis) window.lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(r));
      }
    }, st);
    await w8(1500);
    const probe = await p.evaluate(PROBE);
    let f = null;
    if (st.shot) {
      await p.evaluate(FREEZE, 5000);
      await w8(250);
      f = path.join(OUT, `B_${opts.tag}_${st.name}_${vn}.png`);
      await p.screenshot({ path: f });
      // un-freeze
      await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) {} } });
    }
    res.push({ name: st.name, probe, f });
  }
  await ctx.close();
  return { res, errs };
}

function cmpProbe(a, b) {
  const d = [];
  for (const k of Object.keys(a)) {
    if (k === 'rootInline') continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) d.push({ k, a: a[k], b: b[k] });
  }
  return d;
}

async function B(tag, opts) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const steps = [
    { name: 'y0', to: 0 },
    { name: 'y200', to: 200 },
    { name: 'about_mid', to: { id: 'about', frac: 0.15 }, shot: true },
    { name: 'process_mid', to: { id: 'process', frac: 0.2 } },
    { name: 'trust_mid', to: { id: 'trust', frac: 0.1 } },
    { name: 'pricing_mid', to: { id: 'pricing', frac: 0.15 }, shot: true },
    { name: 'end', to: 'end', shot: true },
    { name: 'back_trust', to: { id: 'trust', frac: 0.5 } },
    { name: 'back_top', to: 0, shot: true },
  ];
  const r = {};
  for (const vn of ['base', 'base2', 'var']) r[vn] = await seq(browser, vn, { ...opts, tag }, steps);
  await browser.close();
  const out = { errs: { base: r.base.errs, var: r.var.errs }, steps: [] };
  for (let i = 0; i < steps.length; i++) {
    const s = { name: steps[i].name, noiseProbe: cmpProbe(r.base.res[i].probe, r.base2.res[i].probe), varProbe: cmpProbe(r.base.res[i].probe, r.var.res[i].probe), baseRootInline: r.base.res[i].probe.rootInline, varRootInline: r.var.res[i].probe.rootInline };
    if (steps[i].shot) { s.noise = await diffPng(r.base.res[i].f, r.base2.res[i].f); s.diff = await diffPng(r.base.res[i].f, r.var.res[i].f); }
    if (i === 0 || steps[i].name === 'pricing_mid') s.baseProbe = r.base.res[i].probe;
    out.steps.push(s);
  }
  return out;
}

(async () => {
  const mode = process.argv[2];
  let r;
  if (mode === 'A') r = await A();
  else if (mode === 'B') r = await B('desk', {});
  else if (mode === 'Bm') r = await B('mob', { mobile: true });
  else if (mode === 'Br') r = await B('rm', { reduced: true });
  else if (mode === 'Bh') r = await B('hash', { url: '/#pricing' });
  fs.writeFileSync(path.join(OUT, `out_${mode}.json`), JSON.stringify(r, null, 1));
  console.log(JSON.stringify(r, null, 1));
})().catch((e) => { console.error(e.stack); process.exit(1); });
