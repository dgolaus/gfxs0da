/* Vet: compare baseline vs variant at many scroll positions (nav morph range and
   section fade-out range), on /, /tos/, /slots/, desktop and mobile, normal and
   reduced motion. Compares exact computed values of every var consumer, a
   whole-page computed-style snapshot, and screenshots. Disk-served. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('../node_modules/puppeteer');
const sharp = require('../node_modules/sharp');
const REPO = '..';
const OUT = __dirname;
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const variants = JSON.parse(fs.readFileSync(path.join(OUT, 'variants.json'), 'utf8')).filter((v) => v.name === 'var');
const PRELUDE = `(() => {
  try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  const add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function (...c) {
    if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; }
    return add.apply(this, c);
  };
  Math.random = (() => { let s = 12345; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
})();`;
const types = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

async function open(browser, v, vp, reduced) {
  const p = await browser.newPage();
  await p.setViewport({ width: vp.w, height: vp.h, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: 1 });
  if (vp.mobile) { const cdp = await p.target().createCDPSession(); await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'any-hover', value: 'none' }, { name: 'pointer', value: 'coarse' }, { name: 'any-pointer', value: 'coarse' }, ...(reduced ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [])] }); }
  else if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const over = Object.fromEntries(Object.entries(v.files || {}).map(([k, f]) => [k, fs.readFileSync(f)]));
  await p.setRequestInterception(true);
  p.on('request', (req) => {
    const u = new URL(req.url());
    if (u.host !== 'localhost:5173') {
      if (/cloudflareinsights/.test(u.host)) return req.respond({ status: 204, body: '' });
      return req.continue();
    }
    let k = decodeURIComponent(u.pathname); if (k.endsWith('/')) k += 'index.html';
    const ct = types[path.extname(k)] || 'application/octet-stream';
    if (over[k]) return req.respond({ status: 200, contentType: ct, body: over[k] });
    const f = path.join(REPO, k);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return req.respond({ status: 200, contentType: ct, body: fs.readFileSync(f) });
    return req.respond({ status: 404, body: '' });
  });
  await p.evaluateOnNewDocument(PRELUDE);
  return p;
}

const SNAP = () => {
  const props = ['opacity', 'filter', 'transform', 'translate', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'backdrop-filter', 'visibility', 'display', 'z-index', 'pointer-events', 'width', 'height', 'border-radius', 'box-shadow', 'background-color', 'color'];
  const vars = ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis', '--leave'];
  const key = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); return s; };
  const all = [...document.querySelectorAll('*')];
  const out = {};
  all.forEach((el, i) => {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && cs.content === 'none') continue;
      const r = props.map((pp) => cs.getPropertyValue(pp)).join('|');
      out[i + ':' + key(el) + (pseudo || '')] = r;
    }
  });
  const consumers = {};
  const sel = ['#nav', '.nav > .brand', '.nav > .btn', '.nav-links', '.nav-back', '#about', '#process', '#trust', '#pricing', '#contact'];
  for (const s of sel) {
    const el = document.querySelector(s); if (!el) continue;
    for (const pseudo of [null, '::before']) {
      const cs = getComputedStyle(el, pseudo);
      consumers[s + (pseudo || '')] = props.map((pp) => pp + '=' + cs.getPropertyValue(pp)).join('; ');
    }
    const r = el.getBoundingClientRect();
    consumers[s + ' rect'] = [r.x, r.y, r.width, r.height].map((x) => x.toFixed(2)).join(',');
  }
  const varsAt = {};
  for (const s of ['html', '#nav', '.nav-links', '#pricing', '#pricing > *']) {
    const el = document.querySelector(s); if (!el) continue;
    varsAt[s] = vars.map((v) => v + '=' + getComputedStyle(el).getPropertyValue(v).trim()).join(' ');
  }
  return { out, consumers, varsAt, scrollY: window.scrollY, isPill: document.getElementById('nav') && document.getElementById('nav').classList.contains('is-pill') };
};

async function settle(p) {
  await p.evaluate(() => {
    for (const a of document.getAnimations()) {
      try {
        const t = a.effect && a.effect.getComputedTiming();
        if (t && t.iterations === Infinity) { a.pause(); a.currentTime = 0; }
        else a.finish();
      } catch (e) {}
    }
  });
}

async function positions(p) {
  return p.evaluate(() => {
    const vh = innerHeight;
    const list = [0, 20, 60, 100, 140, 180, 220, 260, 300, 330, 360, 450];
    for (const id of ['about', 'process', 'trust', 'pricing', 'contact']) {
      const el = document.getElementById(id); if (!el) continue;
      const bottom = el.getBoundingClientRect().bottom + scrollY;
      for (const f of [0.35, 0.25, 0.15, 0.05, -0.05]) list.push(Math.max(0, Math.round(bottom - vh * f)));
    }
    const max = document.documentElement.scrollHeight - vh;
    return [...new Set(list.map((y) => Math.min(max, y)))];
  });
}

async function scrollTo(p, y) {
  await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await w8(450);
  await settle(p);
  await w8(80);
}

async function diffPng(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = A.info.width * A.info.height; let sum = 0, changed = 0, navChanged = 0; let bb = [1e9, 1e9, -1, -1];
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3;
    sum += d;
    if (d > 8) { changed++; const x = i % A.info.width, y = (i / A.info.width) | 0; if (y < 110) navChanged++; bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x), Math.max(bb[3], y)]; }
  }
  return { mean: +(sum / n).toFixed(3), pct: +(changed / n * 100).toFixed(3), navPx: navChanged, bbox: changed ? bb.join(',') : '' };
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const pages = (process.argv[2] || '/,/tos/,/slots/').split(',');
  const vps = [{ name: 'desk', w: 1440, h: 900 }, { name: 'mob', w: 375, h: 812, mobile: true }].filter((x) => (process.argv[4] || 'desk,mob').split(',').includes(x.name));
  const modes = (process.argv[3] || 'normal,reduced').split(',');
  const report = [];
  for (const pg of pages) for (const vp of vps) for (const mode of modes) {
    const reduced = mode === 'reduced';
    const tag = (pg.replace(/\W+/g, '') || 'home') + '_' + vp.name + '_' + mode;
    // baseline A, baseline B (noise), then each variant
    const runs = [{ name: 'baseA' }, { name: 'baseB' }, ...variants];
    const res = {};
    let pos = null;
    for (const v of runs) {
      const p = await open(browser, v, vp, reduced);
      await p.goto('http://localhost:5173' + pg, { waitUntil: 'networkidle2' });
      await p.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
      await w8(3500);
      await settle(p);
      if (!pos) pos = await positions(p);
      res[v.name] = [];
      for (const y of pos) {
        await scrollTo(p, y);
        const s = await p.evaluate(SNAP);
        const file = path.join(OUT, `sc_${tag}_${v.name}_${y}.png`);
        await p.screenshot({ path: file });
        res[v.name].push({ y, s, file });
      }
      await p.close();
    }
    for (const v of ['baseB', ...variants.map((x) => x.name)]) {
      for (let i = 0; i < pos.length; i++) {
        const A = res.baseA[i], B = res[v][i];
        const consDiff = Object.keys(A.s.consumers).filter((k) => A.s.consumers[k] !== B.s.consumers[k]).map((k) => `${k}: ${A.s.consumers[k]}  ||  ${B.s.consumers[k]}`);
        const keys = new Set([...Object.keys(A.s.out), ...Object.keys(B.s.out)]);
        const pageDiff = [...keys].filter((k) => A.s.out[k] !== B.s.out[k]);
        const px = await diffPng(A.file, B.file);
        report.push({ tag, v, y: pos[i], scrollA: A.s.scrollY, scrollB: B.s.scrollY, pillA: A.s.isPill, pillB: B.s.isPill, consDiff, pageDiffN: pageDiff.length, pageDiff: pageDiff.slice(0, 6).map((k) => k + ' :: ' + A.s.out[k] + ' || ' + B.s.out[k]), px, varsA: A.s.varsAt, varsB: B.s.varsAt });
      }
    }
    console.error('done ' + tag);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'scrollcheck_' + process.argv.slice(2).join('_').replace(/[^a-z_]+/gi, '') + '.json'), JSON.stringify(report, null, 1));
  // compact summary
  for (const r of report) {
    const flag = r.consDiff.length || r.pageDiffN || r.px.pct > 0 || r.scrollA !== r.scrollB;
    if (flag) console.log(`${r.tag} ${r.v} y=${r.y} scroll ${r.scrollA}/${r.scrollB} cons=${r.consDiff.length} page=${r.pageDiffN} px=${r.px.pct}% nav=${r.px.navPx} bbox=${r.px.bbox}`);
  }
  console.log('total rows', report.length);
})().catch((e) => { console.error(e); process.exit(1); });
