// Replicates rerun/bench.js shot() (disk-served) and measures "Yours" brightness + gradient state.
process.env.BENCH_DISK = '1';
const path = require('path');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const sharp = require(path.join('../node_modules/sharp'));
const { openPage } = require('./rerun/bench.js');
const S = 'scratchpad';
const VARIANT = { name: 'v', files: { '/script.js': S + '/fixes/forced-layout/script.js' } };
const BASE = { name: 'baseline' };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const T = +(process.argv[2] || 900);
const REPS = +(process.argv[3] || 6);
const HOOK = `(() => {
  window.__g = [];
  const tick = () => { const el = document.querySelector(".hero-title .accent"); if (el) { const m = /at 50% (-?[d.]+)vh/.exec(el.style.backgroundImage); const v = m ? m[1] : "none"; if (window.__g.length === 0 || window.__g[window.__g.length-1][1] !== v) window.__g.push([Math.round(performance.now()), v, Math.round(scrollY)]); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

async function one(browser, v, file) {
  const { p } = await openPage(browser, Object.assign({}, v, { js: HOOK }), { throttle: 1 });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await p.evaluate(async () => {
    const pend = [...document.images].filter((i) => !i.complete && i.loading !== 'lazy');
    await Promise.race([Promise.all(pend.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 8000))]);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  await w8(300);
  const tf = await p.evaluate((t) => {
    document.querySelectorAll('.counter').forEach((el) => {
      const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
      el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
    });
    const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
    window.scrollTo(0, 0);
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t; } catch (e) {} }
    return Math.round(performance.now());
  }, T);
  await w8(250);
  await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  const st = await p.evaluate(() => ({ g: window.__g.slice(-12), first: window.__g.slice(0, 3), n: window.__g.length, now: Math.round(performance.now()), ts: document.querySelector('.hero-title .accent .accent-text').style.backgroundImage.slice(0, 40) }));
  await p.close();
  const { data, info } = await sharp(file).extract({ left: 150, top: 360, width: 260, height: 90 }).raw().toBuffer({ resolveWithObject: true });
  let r = 0; for (let i = 0; i < data.length; i += info.channels) r += data[i];
  return { red: Math.round(r / (data.length / info.channels)), tf, ...st };
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (let i = 0; i < REPS; i++) {
    for (const v of [BASE, VARIANT]) {
      const r = await one(browser, v, path.join(__dirname, `dh_${v.name}_${i}.png`));
      console.log(v.name, i, 'red', r.red, 'freezeAt', r.tf, 'shotAt', r.now, 'n', r.n, 'first', JSON.stringify(r.first), 'last', JSON.stringify(r.g.slice(-4)), r.ts);
    }
  }
  await browser.close();
})().catch((e) => { console.error(e.stack); process.exit(1); });
