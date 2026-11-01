/* Same-page A/B: load the ORIGINAL site, settle at a position, snapshot every element's
   rendered-relevant computed style + a screenshot, then register --leave exactly as the patch
   does (a <style> with the same @property rule) and snapshot again. Same JS state on both
   sides, so any difference is caused by the registration itself, not by load timing. */
const path = require('path'); const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const sharp = require(path.join('../node_modules/sharp'));
const { openPage } = require('./bench.js');
const OUT = path.join(__dirname, 'same'); fs.mkdirSync(OUT, { recursive: true });
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const RULE = "@property --leave { syntax: '<number>'; inherits: false; initial-value: 0; }";
const PROPS = ['opacity', 'filter', 'transform', 'translate', 'background-image', 'color', 'visibility', 'display', 'backdrop-filter', 'clip-path', 'mix-blend-mode', 'z-index'];

async function snap(p, file) {
  const st = await p.evaluate((PROPS) => {
    const out = [];
    const all = document.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i]; if (el.id === '__vet_reg') continue;
      for (const pe of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pe);
        if (pe && cs.content === 'none') continue;
        const r = pe ? null : el.getBoundingClientRect();
        out.push(el.tagName + '#' + el.id + '.' + (typeof el.className === 'string' ? el.className : '') + (pe || '') + ' ' + PROPS.map((k) => cs.getPropertyValue(k)).join('|') + (r ? `|${r.x.toFixed(2)},${r.y.toFixed(2)},${r.width.toFixed(2)},${r.height.toFixed(2)}` : ''));
      }
    }
    return out;
  }, PROPS);
  await p.screenshot({ path: file });
  return st;
}
async function diff(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = A.info.width * A.info.height; let sum = 0, ch = 0;
  for (let i = 0; i < n; i++) { const o = i * 4; const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; sum += d; if (d > 8) ch++; }
  return { mad: +(sum / n).toFixed(3), pct: +(ch / n * 100).toFixed(3) };
}

const CASES = [
  { name: 'top-desk', vp: { width: 1440, height: 900 } },
  { name: 'about-mid-desk', vp: { width: 1440, height: 900 }, sec: 'about', f: 0.5 },
  { name: 'trust-mid-desk', vp: { width: 1440, height: 900 }, sec: 'trust', f: 0.5 },
  { name: 'process-0.85-desk', vp: { width: 1440, height: 900 }, sec: 'process', f: 0.85 },
  { name: 'pricing-mid-desk', vp: { width: 1440, height: 900 }, sec: 'pricing', f: 0.5 },
  { name: 'bottom-desk', vp: { width: 1440, height: 900 }, bottom: true },
  { name: 'trust-mid-mob', vp: { width: 390, height: 844, isMobile: true, hasTouch: true }, sec: 'trust', f: 0.5 },
  { name: 'tos-pricing-mid', url: 'http://localhost:5173/tos/', vp: { width: 1440, height: 900 }, sec: 'pricing', f: 0.5 },
];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const c of CASES) {
    const { p } = await openPage(browser, { name: 'baseline' }, { throttle: 1 });
    await p.setViewport(c.vp);
    await p.goto(c.url || 'http://localhost:5173/', { waitUntil: 'networkidle2' });
    await w8(4000);
    if (c.sec || c.bottom) {
      const y = await p.evaluate((c) => {
        if (c.bottom) return document.documentElement.scrollHeight;
        const s = document.getElementById(c.sec); const b = s.getBoundingClientRect().bottom + window.scrollY;
        return Math.round(b - 0.30 * window.innerHeight * (1 - c.f));
      }, c);
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); }, y);
      await w8(1500);
    }
    // freeze every CSS/WAAPI animation; let the JS accent lerp and fade transitions settle
    await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 2000; } catch (e) {} } });
    await w8(2500);
    const leaveBefore = await p.evaluate(() => [...document.querySelectorAll('.scroll-fade')].map((s) => `${s.id}=${s.style.getPropertyValue('--leave')}`).join(' '));
    const A = await snap(p, path.join(OUT, `${c.name}_A.png`));
    const A2 = await snap(p, path.join(OUT, `${c.name}_A2.png`));
    await p.evaluate((rule) => { const s = document.createElement('style'); s.id = '__vet_reg'; s.textContent = rule; document.head.appendChild(s); }, RULE);
    await w8(800);
    const reg = await p.evaluate(() => { const s = document.querySelector('.scroll-fade'); const kid = s && s.querySelector('*'); return { sec: s && getComputedStyle(s).getPropertyValue('--leave'), kid: kid && getComputedStyle(kid).getPropertyValue('--leave'), running: document.getAnimations().filter((a) => a.playState === 'running').map((a) => (a.transitionProperty || a.animationName) + '@' + (a.effect && a.effect.target && (a.effect.target.id || a.effect.target.className))).slice(0, 8) }; });
    const B = await snap(p, path.join(OUT, `${c.name}_B.png`));
    const dA = A.filter((x, i) => x !== A2[i]).length;
    const dB = A.length !== B.length ? 'len' : A.filter((x, i) => x !== B[i]);
    const nz = await diff(path.join(OUT, `${c.name}_A.png`), path.join(OUT, `${c.name}_A2.png`));
    const px = await diff(path.join(OUT, `${c.name}_A.png`), path.join(OUT, `${c.name}_B.png`));
    console.log(`${c.name.padEnd(18)} leave[${leaveBefore}] styleRows=${A.length} A-vs-A2 changed=${dA} A-vs-B changed=${Array.isArray(dB) ? dB.length : dB} px noise=${JSON.stringify(nz)} px reg=${JSON.stringify(px)} kid--leave after=${JSON.stringify(reg.kid)} sec--leave=${JSON.stringify(reg.sec)} running=${JSON.stringify(reg.running)}`);
    if (Array.isArray(dB)) for (const r of dB.slice(0, 6)) { const i = A.indexOf(r); console.log('   A:', r.slice(0, 220)); console.log('   B:', B[i].slice(0, 220)); }
    await p.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
