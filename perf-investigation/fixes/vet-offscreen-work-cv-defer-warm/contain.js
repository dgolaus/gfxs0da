/* Same-page A/B: content-visibility:auto (as shipped by the variant) vs the SAME page with
   containment removed (content-visibility: visible !important). Everything else frozen.
   Any pixel difference = caused purely by layout/paint/style containment.
   node contain.js WxH [hover] */
const fs = require('fs');
const path = require('path');
const { openPage } = require('../../bench.js');
const sharp = require('../node_modules/sharp');
const puppeteer = require('../node_modules/puppeteer');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(__dirname, 'shots');
const F = 'fixes/offscreen-work/';
const V = { name: 'cv', files: { '/styles.css': F + 'styles.css', '/script.js': F + 'script.c2.js', '/smooth-scroll.js': F + 'smooth-scroll.js' } };
const [W, H] = (process.argv[2] || '1440x900').split('x').map(Number);
const HOVER = process.argv[3] === 'hover';

async function diff(a, b, heat) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = A.info.width * A.info.height; let sum = 0, ch = 0, big = 0, maxd = 0; let minY = 1e9, maxY = -1, minX = 1e9, maxX = -1;
  const hb = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3;
    sum += d; if (d > 2) { ch++; const y = Math.floor(i / A.info.width), x = i % A.info.width; if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x; }
    if (d > 16) big++; if (d > maxd) maxd = d;
    const h = Math.min(255, d * 8); hb[i * 3] = h; hb[i * 3 + 1] = h > 0 ? 40 : 0;
  }
  if (heat && ch) await sharp(hb, { raw: { width: A.info.width, height: A.info.height, channels: 3 } }).png().toFile(heat);
  return { mean: +(sum / n).toFixed(4), px: ch, big, maxd: +maxd.toFixed(1), bbox: ch ? [minX, minY, maxX, maxY] : null };
}

(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const { p } = await openPage(b, V, { throttle: 1 });
  const mobile = W < 768;
  await p.setViewport({ width: W, height: H, isMobile: mobile, hasTouch: mobile });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await p.evaluate(async () => { await document.fonts.ready; });
  await w8(1500);
  // make every section exact first (as the warm-up would)
  await p.evaluate(() => { window.__cvSettle && window.__cvSettle(); });
  await w8(500);
  const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const secs = await p.evaluate(() => ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { id, top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) }; }));
  console.log('total', total, JSON.stringify(secs));
  const targets = new Set();
  for (const s of secs) { targets.add(Math.max(0, s.top - Math.round(H / 2))); targets.add(Math.max(0, s.bottom - Math.round(H / 2))); targets.add(Math.max(0, s.top - 40)); }
  for (const s of secs) targets.add(Math.min(total, Math.max(0, s.bottom - Math.round(H * 0.12)))); // leaving (blurred) state
  targets.add(total);
  const list = [...targets].filter((y) => y <= total).sort((a, b) => a - b);
  // walk down once like a user so reveals/counters/IOs fire naturally
  for (let y = 0; y < total; y += 150) { await p.evaluate((y) => window.scrollTo(0, y), y); await w8(30); }
  await w8(3000);
  // freeze JS timers (chat playback etc.) after in-flight ones drain
  await p.evaluate(() => {
    document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
    window.setTimeout = () => 0; window.setInterval = () => 0;
    const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none!important}'; document.head.appendChild(s);
  });
  await w8(5000);
  const pauseAll = () => p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} } });
  const raf2 = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const results = [];
  async function ab(tag) {
    await pauseAll(); await raf2(); await w8(150);
    const fa = path.join(OUT, `${W}_${tag}_A.png`), fa2 = path.join(OUT, `${W}_${tag}_A2.png`), fb = path.join(OUT, `${W}_${tag}_B.png`);
    const sy0 = await p.evaluate(() => scrollY);
    await p.screenshot({ path: fa });
    await raf2(); await w8(100);
    await p.screenshot({ path: fa2 });
    await p.evaluate(() => { const s = document.createElement('style'); s.id = '__nocv'; s.textContent = '#main > section, #contact { content-visibility: visible !important; }'; document.head.appendChild(s); });
    await pauseAll(); await raf2(); await w8(200);
    const sy1 = await p.evaluate(() => scrollY);
    await p.screenshot({ path: fb });
    await p.evaluate(() => document.getElementById('__nocv').remove());
    await raf2(); await w8(100);
    const noise = await diff(fa, fa2);
    const d = await diff(fa, fb, path.join(OUT, `${W}_${tag}_heat.png`));
    const r = { tag, sy0, sy1, noise: noise.px, diff: d };
    results.push(r); console.log(JSON.stringify(r));
  }
  for (const y of list) {
    await p.evaluate((y) => window.scrollTo(0, y), y);
    await w8(1500); // gradient lerp converges
    await ab('y' + y);
  }
  if (HOVER && !mobile) {
    const hov = async (sel, tag, idx = 0, fx = 0.5, fy = 0.5) => {
      const box = await p.evaluate((sel, idx, fx, fy) => { const el = document.querySelectorAll(sel)[idx]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width * fx, y: r.top + r.height * fy }; }, sel, idx, fx, fy);
      if (!box) { console.log('no', sel); return; }
      await w8(1200);
      await p.mouse.move(box.x - 5, box.y - 5); await p.mouse.move(box.x, box.y, { steps: 5 });
      await w8(1500);
      await ab(tag);
      await p.mouse.move(2, 2);
    };
    await hov('.chat-mock', 'hover_chat');
    await p.mouse.move(2,2); await w8(300); await p.evaluate(()=>document.getElementById('chat-card').classList.remove('tilting'));
    await hov('.chat-mock', 'hover_chat_bl', 0, 0.06, 0.94);
    await hov('.chat-mock', 'hover_chat_br', 0, 0.94, 0.94);
    await p.mouse.move(2,2); await w8(300); await p.evaluate(()=>document.getElementById('chat-card').classList.remove('tilting'));
    await hov('.price-card', 'hover_price0', 0);
    await hov('.price-card', 'hover_price1', 1);
    await hov('.price-card', 'hover_price3', 3);
    await hov('.studio-chip', 'hover_studio');
    await hov('.process-cta .btn-primary', 'hover_processbtn');
    await hov('.tcols .quote', 'hover_quote', 0);
    await hov('.cfooter .fpill', 'hover_fpill', 0);
  }
  fs.writeFileSync(path.join(__dirname, `contain_${W}${HOVER ? '_hover' : ''}.json`), JSON.stringify(results, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
