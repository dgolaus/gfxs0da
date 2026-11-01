/* Re-shoot t=900 (and others) several times, interleaved, logging the gradient state at screenshot time. */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./bench.js');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const T = (process.argv[3] || '900').split(',').map(Number);
const REPS = +(process.argv[4] || 3);
let sharp = require(path.join('../node_modules/sharp'));
async function diff(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = A.info.width * A.info.height; let s = 0, big = 0;
  for (let i = 0; i < n; i++) { const o = i * 4; const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; s += d; if (d > 32) big++; }
  return { mad: +(s / n).toFixed(3), big: +(big / n * 100).toFixed(3) };
}
(async () => {
  const b = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000 });
  const files = {};
  for (const t of T) for (let r = 0; r < REPS; r++) for (const v of variants) {
    const { p } = await openPage(b, v, { throttle: 1 });
    await p.evaluateOnNewDocument(() => {
      window.__ylog = [];
      addEventListener('scroll', () => window.__ylog.push(Math.round(scrollY)), { passive: true, capture: true });
    });
    await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await p.evaluate(async () => {
      await Promise.race([Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 4000))]);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    });
    await w8(300);
    const pre = await p.evaluate(() => { const t = document.querySelector('.hero-title .accent .accent-text'); return { bg: t.style.backgroundImage.slice(0, 45), top: Math.round(t.parentElement.getBoundingClientRect().top), y: scrollY, ylog: window.__ylog.slice(-6), html: document.documentElement.className }; });
    await p.evaluate((t) => {
      document.querySelectorAll('.counter').forEach((el) => {
        const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
        el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
      });
      const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
      window.scrollTo(0, 0);
      for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t; } catch (e) {} }
    }, t);
    await w8(250);
    const f = path.join(__dirname, `r_${v.name}_${t}_${r}.png`);
    await p.screenshot({ path: f, clip: { x: 0, y: 0, width: 1440, height: 900 } });
    const post = await p.evaluate(() => { const t = document.querySelector('.hero-title .accent .accent-text'); return { bg: t.style.backgroundImage.slice(0, 45), top: Math.round(t.parentElement.getBoundingClientRect().top), y: scrollY, ylog: window.__ylog.slice(-6) }; });
    console.log(v.name.padEnd(10), 't', t, 'r', r, 'PRE', JSON.stringify(pre), 'POST', JSON.stringify(post));
    (files[t] = files[t] || []).push({ v: v.name, f });
    await p.close();
  }
  for (const t of T) {
    const base = files[t].find((x) => x.v === 'baseline').f;
    for (const x of files[t]) console.log('t', t, x.v, path.basename(x.f), JSON.stringify(await diff(base, x.f)));
  }
  await b.close();
})().catch((e) => { console.error('FAIL', e.stack || e.message); process.exit(1); });
