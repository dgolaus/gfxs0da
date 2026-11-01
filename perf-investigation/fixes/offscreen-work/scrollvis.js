/* Scrolled visual identity check (below the fold), complement to bench visual.
   node -r ./diskserve-hook.js scrollvis.js variants.json [mode=walk|jump] [WxH]
   walk: scrolls down like a user, stopping at each target; jump: scrollTo(target) directly.
   Normalization applied identically to every variant: counters forced to final value,
   chat message area hidden (its playback is time-driven), all animations paused at
   currentTime 5000 before each screenshot. */
const fs = require('fs');
const path = require('path');
const { openPage } = require('../../bench.js');
const puppeteer = require('../node_modules/puppeteer');
const sharp = require('../node_modules/sharp');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(__dirname, 'svis');
fs.mkdirSync(OUT, { recursive: true });
const vs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const mode = process.argv[3] || 'walk';
const [W, H] = (process.argv[4] || '1440x900').split('x').map(Number);
const NORM_CSS = '.chat-messages, .chat-typing { visibility: hidden !important; }';

async function run(b, v) {
  const { p } = await openPage(b, v, { throttle: 1 });
  const mobile = W < 768;
  await p.setViewport({ width: W, height: H, isMobile: mobile, hasTouch: mobile });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await p.evaluate(async (css) => { await document.fonts.ready; const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }, NORM_CSS);
  await w8(4000);
  const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const targets = [];
  for (let y = Math.round(H * 0.9); y < total; y += Math.round(H * 0.55)) targets.push(y);
  targets.push(total);
  const shots = [];
  let cur = 0;
  for (const t of targets) {
    if (mode === 'walk') {
      for (let y = cur; y < t; y += 120) { await p.evaluate((y) => window.scrollTo(0, y), y); await w8(16); }
    }
    await p.evaluate((y) => window.scrollTo(0, y), t);
    cur = t;
    await w8(mode === 'walk' ? 4000 : 120);
    await p.evaluate(() => {
      document.querySelectorAll('.counter').forEach((el) => {
        const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
        el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
      });
      for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} }
    });
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const f = path.join(OUT, `${mode}_${W}_${v.name}_${t}.png`);
    await p.screenshot({ path: f });
    const sy = await p.evaluate(() => Math.round(scrollY));
    shots.push({ t, f, sy });
    // resume so later stops keep animating normally
    await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) {} } });
  }
  await p.close();
  return shots;
}
async function diff(a, b) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = A.info.width * A.info.height; let sum = 0, ch = 0, minY = 1e9, maxY = -1;
  for (let i = 0; i < n; i++) { const o = i * 4; const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; sum += d; if (d > 8) { ch++; const y = Math.floor(i / A.info.width); if (y < minY) minY = y; if (y > maxY) maxY = y; } }
  return { mad: +(sum / n).toFixed(3), pct: +(ch / n * 100).toFixed(3), rows: ch ? `${minY}-${maxY}` : '' };
}
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const res = {};
  for (const v of vs) res[v.name] = await run(b, v);
  // noise: second baseline run
  res.__baseline2 = await run(b, { ...vs[0], name: 'baseline2' });
  await b.close();
  const base = res[vs[0].name];
  for (const [name, shots] of Object.entries(res)) {
    if (name === vs[0].name) continue;
    const line = [];
    for (let i = 0; i < shots.length; i++) {
      const bs = base[i];
      if (!bs) { line.push(`${shots[i].t}:nobase`); continue; }
      const d = await diff(bs.f, shots[i].f);
      line.push(`${shots[i].t}${bs.sy !== shots[i].sy ? `(sy ${bs.sy}/${shots[i].sy})` : ''}:${d.mad}/${d.pct}%${d.rows ? '[' + d.rows + ']' : ''}`);
    }
    console.log(name.padEnd(30), line.join('  '));
  }
})().catch((e) => { console.error(e); process.exit(1); });
