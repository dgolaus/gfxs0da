const path = require('path');
const { openPage } = require('../../bench.js');
const sharp = require('../node_modules/sharp');
const puppeteer = require('../node_modules/puppeteer');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const F = 'fixes/offscreen-work/';
const CV = { name: 'cv', files: { '/styles.css': F + 'styles.css', '/script.js': F + 'script.c2.js', '/smooth-scroll.js': F + 'smooth-scroll.js' } };
async function diff(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let ch = 0, maxd = 0, minY = 1e9, maxY = -1;
  for (let i = 0; i < A.info.width * A.info.height; i++) { const o = i * 4; const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; if (d > 2) { ch++; const y = Math.floor(i / A.info.width); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } maxd = Math.max(maxd, d); }
  return { px: ch, maxd: +maxd.toFixed(1), rows: ch ? [minY, maxY] : null };
}
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const { p } = await openPage(b, CV, { throttle: 1 });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await w8(1500);
  await p.evaluate(() => window.__cvSettle());
  await w8(300);
  await p.evaluate(() => { window.setTimeout = () => 0; const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none!important}'; document.head.appendChild(s); });
  const cases = [
    ['.chat-mock', 'process', [[0.6, 3, 8], [0.85, 1.5, 4], [0.3, 4.5, 13]]],
    ['.process-text', 'process', [[0.6, 3, 8], [0.3, 4.5, 13]]],
    ['.about-head', 'about', [[0.6, 3, 8], [0.3, 4.5, 13]]],
    ['#trust .section-head', 'trust', [[0.6, 3, 8]]],
    ['#pricing .section-head', 'pricing', [[0.6, 3, 8]]],
  ];
  for (const [sel, sec, states] of cases) {
    for (const [op, bl, ty] of states) {
      await p.evaluate((sec) => { const s = document.getElementById(sec); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 300); }, sec);
      await w8(800);
      await p.evaluate((sel, op, bl, ty) => { const el = document.querySelector(sel); el.style.opacity = op; el.style.filter = `blur(${bl}px)`; el.style.transform = `translateY(${ty}px)`; for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} } }, sel, op, bl, ty);
      await w8(300);
      const fa = path.join(__dirname, 'shots', 'mid_A.png'), fb = path.join(__dirname, 'shots', 'mid_B.png');
      await p.screenshot({ path: fa });
      await p.evaluate(() => { const s = document.createElement('style'); s.id = '__nocv'; s.textContent = '#main > section, #contact { content-visibility: visible !important; }'; document.head.appendChild(s); });
      await w8(300);
      await p.screenshot({ path: fb });
      await p.evaluate((sel) => { document.getElementById('__nocv').remove(); const el = document.querySelector(sel); el.style.opacity = ''; el.style.filter = ''; el.style.transform = ''; }, sel);
      console.log(sel, op, bl, ty, JSON.stringify(await diff(fa, fb)));
    }
  }
  await b.close();
})();
