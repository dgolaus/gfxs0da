// Replicates bench.js shot() and dumps animation list + accent gradient state.
const path = require('path');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./bench.js');
const S = 'scratchpad';
const VARIANT = { name: 'v', files: { '/script.js': S + '/fixes/forced-layout/script.js' } };
const BASE = { name: 'baseline' };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const T = +(process.argv[2] || 900);
const REPS = +(process.argv[3] || 3);

async function one(browser, v) {
  const { p } = await openPage(browser, v, { throttle: 1 });
  // record gradient history
  await p.evaluateOnNewDocument(() => {
    window.__gh = [];
    const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'backgroundImage');
  });
  const t0 = Date.now();
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  const tLoad = Date.now() - t0;
  await p.evaluate(async () => {
    const pend = [...document.images].filter((i) => !i.complete && i.loading !== 'lazy');
    await Promise.race([Promise.all(pend.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 8000))]);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  await w8(300);
  const pre = await p.evaluate(() => {
    const el = document.querySelector('.hero-title .accent');
    return { bg: el.style.backgroundImage.slice(0, 50), top: el.getBoundingClientRect().top, now: performance.now() };
  });
  await p.evaluate((t) => {
    document.querySelectorAll('.counter').forEach((el) => {
      const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
      el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
    });
    const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
    window.scrollTo(0, 0);
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t; } catch (e) {} }
  }, T);
  await w8(250);
  const post = await p.evaluate(() => {
    const el = document.querySelector('.hero-title .accent');
    const anims = document.getAnimations().map((a) => {
      const tg = a.effect && a.effect.target; const nm = a.animationName || a.transitionProperty || a.constructor.name;
      return (tg ? (tg.id || tg.className || tg.tagName) : '?') + '::' + a.constructor.name + ':' + nm;
    });
    const stats = [...document.querySelectorAll('.hero-stats-strip .counter')].map((c) => c.textContent);
    return { bg: el.style.backgroundImage.slice(0, 50), top: el.getBoundingClientRect().top, nAnims: anims.length, anims, stats, now: performance.now() };
  });
  await p.close();
  return { tLoad, pre, post };
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const out = { base: [], v: [] };
  for (let i = 0; i < REPS; i++) { out.base.push(await one(browser, BASE)); out.v.push(await one(browser, VARIANT)); }
  await browser.close();
  for (const k of ['base', 'v']) out[k].forEach((r, i) => console.log(k, i, 'load', r.tLoad, 'pre', JSON.stringify(r.pre), 'post', r.post.bg, r.post.top.toFixed(2), 'n', r.post.nAnims, r.post.stats.join(',')));
  // diff anim lists
  const A = new Set(out.base[0].post.anims), B = new Set(out.v[0].post.anims);
  console.log('only base:', [...A].filter((x) => !B.has(x)));
  console.log('only v:', [...B].filter((x) => !A.has(x)));
})().catch((e) => { console.error(e.stack); process.exit(1); });
