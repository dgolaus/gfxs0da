// node iahash.js <tag> <WxH> <desk|touch> <page> <N> <idxList comma> <variant...>
// Same sequence as interact.js (scroll via layout offset, hover/tap, freeze, crop) but only for the listed SEL indices, hashing crops; alternates variants N rounds.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const L = require('./lib'); const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const [tag, vp, mode, pg, N, idxs, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number); const touch = mode === 'touch'; const DPR = +(process.env.DPR || 1);
const IDX = idxs.split(',').map(Number); const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
const SEL = '.btn, .pricing-grid .price-card, .tcol-track .quote:not([aria-hidden])'; const KIND = process.env.KIND || 'hover';
async function fz(p) { await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); const n = a.animationName || a.transitionProperty || ''; a.currentTime = n === 'btnSheen' ? 350 : n === 'focusPop' ? 160 : 5000; } catch (e) {} } }); await L.w8(250); }
(async () => { const log = []; const seen = {};
  for (let r = 0; r < +N; r++) for (const v of vars) {
    const b = await L.launch({ touch }); const { p } = await L.open(b, v, { w: W, h: H, mobile: touch, dpr: DPR });
    await p.goto(L.BASE + pg, { waitUntil: 'load' }); await L.settle(p, 2500); if (process.env.PRE) await fz(p);  // PRE: freeze floats before they are first rasterised (cards are off-screen at top)
    await p.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a,button')) e.preventDefault(); }, true));
    const row = { r, v };
    for (const i of IDX) {
      const y = await p.evaluate((s, i) => { const e = document.querySelectorAll(s)[i]; let t = 0, n = e; while (n) { t += n.offsetTop; n = n.offsetParent; } return Math.max(0, Math.round(t + e.offsetHeight / 2 - innerHeight / 2)); }, SEL, i);
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y); await L.w8(1300);
      const c = await p.evaluate((s, i) => { const r = document.querySelectorAll(s)[i].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, SEL, i);
      if (KIND === 'hover') { if (touch) await p.touchscreen.tap(c[0], c[1]); else await p.mouse.move(c[0], c[1], { steps: 3 }); await L.w8(200); }
      else if (KIND === 'focus') { await p.keyboard.press('Shift'); await p.evaluate((s, i) => { const e = document.querySelectorAll(s)[i]; if (!e.matches('a,button')) e.setAttribute('tabindex', '-1'); e.focus({ preventScroll: true }); }, SEL, i); await L.w8(120); }
      await fz(p);
      const rc = await p.evaluate((s, i) => { const b = document.querySelectorAll(s)[i].getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }, SEL, i);
      const x0 = Math.max(0, Math.floor(rc[0]) - 16), y0 = Math.max(0, Math.floor(rc[1]) - 16); const w = Math.min(W - x0, Math.ceil(rc[2]) + 32), h = Math.min(H - y0, Math.ceil(rc[3]) + 32);
      const buf = await sharp(await p.screenshot()).extract({ left: x0 * DPR, top: y0 * DPR, width: w * DPR, height: h * DPR }).png().toBuffer();
      const hh = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8); const f = path.join(OUT, `e${i}_${hh}.png`); if (!seen[f]) { seen[f] = 1; fs.writeFileSync(f, buf); }
      row['e' + i] = hh; row['r' + i] = rc.map((x) => +x.toFixed(2)).join() + '@' + (await p.evaluate(() => scrollY));
      if (!process.env.PRE) await L.unfreeze(p); if (!touch) await p.mouse.move(1, H - 2); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await L.w8(900);
    }
    row.lenis = await p.evaluate(() => !!window.lenis); log.push(row); console.log(JSON.stringify(row)); await b.close();
  }
  const sum = {}; for (const x of log) for (const i of IDX) { const k = 'e' + i + ' ' + x.v; sum[k] = sum[k] || {}; sum[k][x['e' + i]] = (sum[k][x['e' + i]] || 0) + 1; }
  console.log('SUMMARY'); for (const k of Object.keys(sum).sort()) console.log(k, JSON.stringify(sum[k]));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ log, sum }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
