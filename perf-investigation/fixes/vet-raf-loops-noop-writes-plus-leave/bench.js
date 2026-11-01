/* Bancada compartilhada de performance da entrada do hero.
 *
 *   node bench.js timing  <variants.json> [reps]   → A/B de tempo de frame, intercalado
 *   node bench.js visual  <variants.json>          → diff de pixels vs baseline em instantes fixos
 *   node bench.js layers  <variants.json>          → camadas compostas (determinístico)
 *
 * variants.json = [{ "name": "baseline" }, { "name": "x", "css": "...", "js": "..." }, ...]
 *   css → injetado como <style> no fim do <head> (vence o styles.css)
 *   js  → executado no início do documento (antes de qualquer script da página)
 *
 * Regras fixas em todas as rodadas:
 *   - lite mode BLOQUEADO (queremos o site completo), hardwareConcurrency=8, deviceMemory=8
 *   - CPU throttle 4x + rasterização por software (headless) ≈ PC fraco
 *   - viewport 1440x900, página aberta no topo
 *   - janela de ENTRADA = 0–3500ms desde a navegação; ESTÁVEL = 3500–8500ms
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join('../node_modules/puppeteer'));
let sharp; try { sharp = require(path.join('../node_modules/sharp')); } catch (e) {}

const BASE = process.env.BENCH_URL || 'http://localhost:5173/';
const OUT = __dirname;
const ENTRY_MS = 3500, STEADY_MS = 8500;
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

const PRELUDE = `
  (() => {
    try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    // impede que a sonda de FPS ligue o lite no meio da medição
    const add = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...c) {
      if (this === document.documentElement.classList && c.includes('lite')) { window.__liteBlocked = (window.__liteBlocked || 0) + 1; c = c.filter((x) => x !== 'lite'); if (!c.length) return; }
      return add.apply(this, c);
    };
    window.__frames = [];
    const tick = (t) => { window.__frames.push(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__lt = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push({ s: e.startTime, d: e.duration }))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  })();`;

async function openPage(browser, v, { throttle = 4 } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  const c = await p.target().createCDPSession();
  if (throttle > 1) await c.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  // files: { "/script.js": "C:/.../script.modificado.js", "/index.html": "..." }
  // serve versões modificadas via interceptação, sem tocar no repo.
  if (process.env.SERVE_FROM_DISK || (v.files && Object.keys(v.files).length)) {
    const map = Object.fromEntries(Object.entries(v.files || {}).map(([k, f]) => [k, fs.readFileSync(f)]));
    const type = (k) => k.endsWith('.js') ? 'application/javascript' : k.endsWith('.css') ? 'text/css' : k.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8';
    await p.setRequestInterception(true);
    p.on('request', (req) => {
      const u = new URL(req.url());
      let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
      if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: type(k), body: map[k] });
      if (process.env.SERVE_FROM_DISK && u.host.startsWith('localhost')) { /* raf-loops copy: static server is down, serve repo from disk in-process */
        const ROOT = '..';
        let pth = decodeURIComponent(u.pathname); if (pth.endsWith('/')) pth += 'index.html';
        const fp = require('path').join(ROOT, pth);
        const MT = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.gif': 'image/gif', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain' };
        try { const body = fs.readFileSync(fp); return req.respond({ status: 200, contentType: MT[require('path').extname(fp).toLowerCase()] || 'application/octet-stream', body }); } catch (e) { return req.respond({ status: 404, contentType: 'text/plain', body: 'nf' }); }
      }
      req.continue();
    });
  }
  await p.evaluateOnNewDocument(PRELUDE);
  if (v.js) await p.evaluateOnNewDocument(v.js);
  if (v.css) {
    await p.evaluateOnNewDocument((css) => {
      const put = () => { const s = document.createElement('style'); s.id = '__bench_css'; s.textContent = css; (document.head || document.documentElement).appendChild(s); };
      if (document.head) put(); else document.addEventListener('readystatechange', function once() { if (document.head) { put(); document.removeEventListener('readystatechange', once); } });
      new MutationObserver((_, o) => { if (document.head && !document.getElementById('__bench_css')) { put(); o.disconnect(); } }).observe(document.documentElement, { childList: true, subtree: true });
    }, v.css);
  }
  return { p, c };
}

function stats(dts) {
  if (!dts.length) return null;
  const s = [...dts].sort((a, b) => a - b);
  const q = (x) => s[Math.min(s.length - 1, Math.floor(s.length * x))];
  const sum = dts.reduce((a, b) => a + b, 0);
  return {
    frames: dts.length,
    fps: +(1000 / (sum / dts.length)).toFixed(1),
    p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1),
    worst: +s[s.length - 1].toFixed(1),
    jank: dts.filter((d) => d > 50).length,                       // frames > 50ms (visível)
    lostMs: Math.round(dts.reduce((a, d) => a + Math.max(0, d - 16.7), 0)), // tempo "perdido" vs 60fps
  };
}

async function runTiming(browser, v) {
  const { p, c } = await openPage(browser, v);
  await c.send('Performance.enable');
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await w8(STEADY_MS + 300);
  const r = await p.evaluate((E, S) => {
    const f = window.__frames, dt = [], dtE = [], dtS = [];
    for (let i = 1; i < f.length; i++) { const d = f[i] - f[i - 1]; if (f[i] <= E) dtE.push(d); else if (f[i] <= S) dtS.push(d); }
    const lt = window.__lt || [];
    return { dtE, dtS, ltEntry: lt.filter((x) => x.s < E), liteBlocked: window.__liteBlocked || 0, lite: document.documentElement.classList.contains('lite') };
  }, ENTRY_MS, STEADY_MS);
  const m = await c.send('Performance.getMetrics');
  const met = Object.fromEntries(m.metrics.map((x) => [x.name, x.value]));
  await p.close();
  return {
    entry: stats(r.dtE), steady: stats(r.dtS),
    longTasks: r.ltEntry.length, longTaskMs: Math.round(r.ltEntry.reduce((a, x) => a + x.d, 0)),
    layoutCount: met.LayoutCount, recalcCount: met.RecalcStyleCount,
    liteBlocked: r.liteBlocked, lite: r.lite,
  };
}

const med = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

async function timing(variants, reps) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const res = Object.fromEntries(variants.map((v) => [v.name, []]));
  // intercalado: baseline, A, B, baseline, A, B ... reduz efeito de deriva da máquina
  for (let r = 0; r < reps; r++) for (const v of variants) {
    try { res[v.name].push(await runTiming(browser, v)); }
    catch (e) { console.error(`[${v.name} rep ${r}] ${e.message}`); }
  }
  await browser.close();
  const out = {};
  for (const v of variants) {
    const rs = res[v.name];
    const pick = (k1, k2) => med(rs.map((x) => x[k1] && (k2 ? x[k1][k2] : x[k1])));
    out[v.name] = {
      reps: rs.length,
      entry: { fps: pick('entry', 'fps'), p95: pick('entry', 'p95'), worst: pick('entry', 'worst'), jank: pick('entry', 'jank'), lostMs: pick('entry', 'lostMs') },
      steady: { fps: pick('steady', 'fps'), p95: pick('steady', 'p95'), jank: pick('steady', 'jank') },
      longTasks: med(rs.map((x) => x.longTasks)), longTaskMs: med(rs.map((x) => x.longTaskMs)),
      layoutCount: med(rs.map((x) => x.layoutCount)), recalcCount: med(rs.map((x) => x.recalcCount)),
      liteEver: rs.some((x) => x.lite),
      raw: rs.map((x) => ({ entryFps: x.entry && x.entry.fps, entryLost: x.entry && x.entry.lostMs, entryJank: x.entry && x.entry.jank })),
    };
  }
  return out;
}

/* ---------- identidade visual ---------- */
// Congela TODAS as animações (CSS e Web Animations) no mesmo currentTime e
// fotografa. Assim baseline e variante são comparados no mesmo quadro, inclusive
// no meio da intro. Contadores JS são forçados ao valor final.
async function shot(browser, v, t, file) {
  const { p } = await openPage(browser, v, { throttle: 1 });
  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await p.evaluate(async () => {
    await Promise.race([Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 4000))]); /* raf-loops copy: cap wait, lazy imgs below the fold never load */
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  await w8(300);
  await p.evaluate((t) => {
    document.querySelectorAll('.counter').forEach((el) => {
      const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
      el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
    });
    // JS de paralaxe de ponteiro e Lenis: zera deslocamentos
    const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
    window.scrollTo(0, 0);
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t; } catch (e) {} }
  }, t);
  await w8(250);
  await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await p.close();
}

async function diffPng(a, b, outFile) {
  if (!sharp) return { error: 'sharp indisponível' };
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = A.info.width * A.info.height;
  let sum = 0, changed = 0, big = 0;
  const heat = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3;
    sum += d; if (d > 8) changed++; if (d > 32) big++;
    const h = Math.min(255, d * 4); heat[i * 3] = h; heat[i * 3 + 1] = 0; heat[i * 3 + 2] = 0;
  }
  if (outFile) await sharp(heat, { raw: { width: A.info.width, height: A.info.height, channels: 3 } }).png().toFile(outFile);
  return { meanAbsDiff: +(sum / n).toFixed(3), pctChanged: +(changed / n * 100).toFixed(3), pctBigChange: +(big / n * 100).toFixed(3) };
}

async function visual(variants, times = [150, 500, 900, 1400, 5000]) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const base = variants.find((v) => v.name === 'baseline') || { name: 'baseline' };
  const out = {};
  for (const t of times) {
    const bf = path.join(OUT, `vis_baseline_${t}.png`);
    await shot(browser, base, t, bf);
    // ruído do próprio método: baseline contra baseline
    const bf2 = path.join(OUT, `vis_baseline2_${t}.png`);
    await shot(browser, base, t, bf2);
    (out.__noise = out.__noise || {})[t] = await diffPng(bf, bf2);
    for (const v of variants) {
      if (v.name === 'baseline') continue;
      const vf = path.join(OUT, `vis_${v.name}_${t}.png`);
      await shot(browser, v, t, vf);
      (out[v.name] = out[v.name] || {})[t] = await diffPng(bf, vf, path.join(OUT, `vis_${v.name}_${t}_heat.png`));
    }
  }
  await browser.close();
  return out;
}

/* ---------- camadas compostas (determinístico, sem tempo) ---------- */
async function layers(variants) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const out = {};
  for (const v of variants) {
    const { p, c } = await openPage(browser, v, { throttle: 1 });
    let last = null;
    c.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers && e.layers.length) last = e.layers; });
    await c.send('LayerTree.enable');
    await p.goto(BASE, { waitUntil: 'networkidle2' });
    await w8(2500);
    const ls = (last || []).filter((l) => l.drawsContent);
    const area = ls.reduce((a, l) => a + l.width * l.height, 0);
    const big = ls.filter((l) => l.width > 4096 || l.height > 4096).map((l) => `${Math.round(l.width)}x${Math.round(l.height)}`);
    out[v.name] = { layers: ls.length, megapixels: +(area / 1e6).toFixed(1), estTextureMB: +(area * 4 / 1048576).toFixed(1), over4096: big };
    await p.close();
  }
  await browser.close();
  return out;
}

if (require.main === module) {
  (async () => {
    const [mode, file, reps] = process.argv.slice(2);
    const variants = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : [{ name: 'baseline' }];
    let r;
    if (mode === 'timing') r = await timing(variants, +(reps || 5));
    else if (mode === 'visual') r = await visual(variants);
    else if (mode === 'layers') r = await layers(variants);
    else throw new Error('modo: timing | visual | layers');
    console.log(JSON.stringify(r, null, 2));
  })().catch((e) => { console.error('FALHOU:', e.stack || e.message); process.exit(1); });
}

module.exports = { timing, visual, layers, runTiming, openPage };
