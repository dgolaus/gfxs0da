// node pricing.js <W,W,...> <variant...> : pricing bottom edge at desktop widths, exact pixel compare.
// For each width: baseline A, baseline B, variants. Positions: pricing bottom at 85%/55%/35% of vh, plus hovered last card.
const fs = require('fs'); const path = require('path'); const sharp = require('/home/user/gfxs0da/node_modules/sharp'); const L = require('./lib');
const [ws, ...vars] = process.argv.slice(2); const H = 900;
const OUT = path.join(__dirname, 'out', process.env.PREFREEZE ? 'pricing_prefreeze' : 'pricing'); fs.mkdirSync(OUT, { recursive: true });
async function exact(a, b) { const A = await sharp(a).raw().toBuffer({ resolveWithObject: true }), B = await sharp(b).raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return 'size';
  let n = 0, mx = 0, bb = [1e9, 1e9, -1, -1]; const ch = A.info.channels, W = A.info.width;
  for (let i = 0; i < A.data.length; i += ch) { let d = 0; for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A.data[i + k] - B.data[i + k])); if (d) { n++; mx = Math.max(mx, d); const px = i / ch, x = px % W, y = (px / W) | 0; bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x), Math.max(bb[3], y)]; } }
  return { diffPx: n, maxDelta: mx, bbox: n ? bb : null }; }
async function run(vname, label, W) {
  const b = await L.launch(); const { p } = await L.open(b, vname, { w: W, h: H });
  await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
  const info = await p.evaluate(() => ({ contain: getComputedStyle(document.getElementById('pricing')).contain, lenis: !!window.lenis, hoverNone: matchMedia('(hover: none)').matches,
    padB: getComputedStyle(document.getElementById('pricing')).paddingBottom }));
  if (process.env.PREFREEZE) await L.freeze(p);  // freeze floats BEFORE the cards are first rasterized (scroll later)
  const shots = [];
  for (const frac of [0.85, 0.55, 0.35, 'hover']) {
    const y = await p.evaluate((frac) => { const r = document.getElementById('pricing').getBoundingClientRect(); const f = frac === 'hover' ? 0.6 : frac; return Math.round(scrollY + r.bottom - innerHeight * f); }, frac);
    await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
    await L.w8(1300); await L.freeze(p);
    if (frac === 'hover') { const c = await p.$$('.pricing-grid .price-card'); const bx = await c[c.length - 1].boundingBox(); await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height - 30); await L.w8(1200); }
    const bot = await p.evaluate(() => document.getElementById('pricing').getBoundingClientRect().bottom);
    const top = Math.max(0, Math.round(bot) - 320), hgt = Math.min(H - top, 440);
    const f = path.join(OUT, `${W}_${label}_${frac}.png`); await sharp(await p.screenshot()).extract({ left: 0, top, width: W, height: hgt }).png().toFile(f); // viewport shot + crop (puppeteer clip is document-relative)
    shots.push({ frac, y, bot, top, hgt, f, sy: await p.evaluate(() => scrollY) });
    if (frac === 'hover') await p.mouse.move(5, 5);
    if (!process.env.PREFREEZE) await L.unfreeze(p);
  }
  const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs)); await b.close(); return { info, shots, errs };
}
(async () => { const res = [];
  for (const W of ws.split(',').map(Number)) {
    const R = { A: await run('baseline', 'A', W), B: await run('baseline', 'B', W) }; for (const v of vars) R[v] = await run(v, v, W);
    for (let i = 0; i < R.A.shots.length; i++) { const a = R.A.shots[i]; const row = { W, frac: a.frac, sy: a.sy, clip: [a.top, a.hgt], contain: Object.fromEntries(Object.entries(R).map(([k, r]) => [k, r.info.contain])), AB: await exact(a.f, R.B.shots[i].f) };
      for (const v of vars) { const x = R[v].shots[i]; row[v] = { sy: x.sy, clip: [x.top, x.hgt], vsA: await exact(a.f, x.f), vsB: await exact(R.B.shots[i].f, x.f) }; }
      res.push(row); console.log(JSON.stringify(row)); }
    console.log('info', W, JSON.stringify(Object.fromEntries(Object.entries(R).map(([k, r]) => [k, { ...r.info, errs: r.errs }]))));
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
