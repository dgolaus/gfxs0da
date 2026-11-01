/* Scrolled-state identity check: the fade sections only differ when scrolled, which the
   bench "visual" mode (top of page) never exercises. For each config and fade position,
   compares computed opacity/filter/transform of every .scroll-fade section and a frozen
   screenshot, baseline vs variant, with a baseline-vs-baseline noise run. */
const path = require('path'); const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const sharp = require(path.join('../node_modules/sharp'));
const { openPage } = require('./bench.js');
const OUT = path.join(__dirname, 'scroll'); fs.mkdirSync(OUT, { recursive: true });
const variants = JSON.parse(fs.readFileSync(path.join(__dirname, 'variants.json'), 'utf8'));
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

const CONFIGS = [
  { name: 'desk', url: 'http://localhost:5173/', vp: { width: 1440, height: 900 } },
  { name: 'mob', url: 'http://localhost:5173/', vp: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
  { name: 'rm', url: 'http://localhost:5173/', vp: { width: 1440, height: 900 }, reduced: true },
  { name: 'tos', url: 'http://localhost:5173/tos/', vp: { width: 1440, height: 900 } },
  { name: 'hash', url: 'http://localhost:5173/#pricing', vp: { width: 1440, height: 900 }, noScroll: true },
];
const FRACS = [0.15, 0.5, 0.85, 1];

async function run(browser, v, cfg, tag) {
  const { p } = await openPage(browser, v, { throttle: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.setViewport(cfg.vp);
  if (cfg.reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto(cfg.url, { waitUntil: 'networkidle2' });
  await p.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
  await w8(2500);
  const geo = await p.evaluate(() => [...document.querySelectorAll('.scroll-fade')].map((s) => ({ id: s.id, bottom: s.getBoundingClientRect().bottom + window.scrollY })));
  const states = [];
  const positions = [];
  if (cfg.noScroll) positions.push(null);
  else for (const g of geo) for (const f of FRACS) positions.push({ id: g.id, f, y: Math.max(0, Math.round(g.bottom - 0.30 * cfg.vp.height * (1 - f))) });
  for (const pos of positions) {
    if (pos) {
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); }, pos.y);
      await w8(900);
    } else await w8(1200);
    const st = await p.evaluate(() => {
      for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} }
      return {
        scrollY: Math.round(window.scrollY),
        secs: [...document.querySelectorAll('.scroll-fade')].map((s) => { const cs = getComputedStyle(s); return { id: s.id, inl: s.style.getPropertyValue('--leave'), op: cs.opacity, fi: cs.filter, tr: cs.transform }; }),
      };
    });
    await w8(150);
    const file = path.join(OUT, `${cfg.name}_${tag}_${pos ? pos.id + '_' + pos.f : 'load'}.png`);
    await p.screenshot({ path: file });
    states.push({ pos, st, file });
  }
  await p.close();
  return { states, errs };
}

async function diff(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return { sizeMismatch: true };
  const n = A.info.width * A.info.height; let sum = 0, ch = 0;
  for (let i = 0; i < n; i++) { const o = i * 4; const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; sum += d; if (d > 8) ch++; }
  return { mad: +(sum / n).toFixed(3), pct: +(ch / n * 100).toFixed(2) };
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const only = process.argv[2] ? process.argv[2].split(',') : null;
  for (const cfg of CONFIGS) {
    if (only && !only.includes(cfg.name)) continue;
    const base = await run(browser, variants[0], cfg, 'base');
    const base2 = await run(browser, variants[0], cfg, 'base2');
    const vr = await run(browser, variants[1], cfg, 'var');
    console.log(`\n### ${cfg.name}  errs base=${JSON.stringify(base.errs)} var=${JSON.stringify(vr.errs)}`);
    for (let i = 0; i < base.states.length; i++) {
      const b = base.states[i], b2 = base2.states[i], x = vr.states[i];
      const nz = await diff(b.file, b2.file), dv = await diff(b.file, x.file);
      const cmp = (s) => s.secs.map((q) => `${q.id}:${q.inl || '-'}|${(+q.op).toFixed(3)}|${q.fi}|${q.tr}`).join('  ');
      const same = cmp(b.st) === cmp(x.st);
      const label = b.pos ? `${b.pos.id}@${b.pos.f}` : 'load';
      console.log(`${label.padEnd(16)} y b/b2/v=${b.st.scrollY}/${b2.st.scrollY}/${x.st.scrollY}  noise=${JSON.stringify(nz)} var=${JSON.stringify(dv)}  computedSame=${same}`);
      if (!same) { console.log('   base:', cmp(b.st)); console.log('   base2:', cmp(b2.st)); console.log('   var :', cmp(x.st)); }
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
