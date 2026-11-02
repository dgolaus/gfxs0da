// node persist.js <tag> <WxH> <touch|desk> <page> <N> <idxList> <variant...>
// tap/hover a .btn, let everything run naturally for WAIT ms (default 2500) with NO freezing, then freeze+crop ("after").
// Then tap/move elsewhere (empty area), wait 1500, freeze+crop ("cleared"). Hashes per variant.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const L = require('./lib'); const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const [tag, vp, mode, pg, N, idxs, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number); const touch = mode === 'touch'; const DPR = +(process.env.DPR || 1);
const IDX = idxs.split(',').map(Number); const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true }); const WAIT = +(process.env.WAIT || 2500);
(async () => { const log = []; const seen = {};
  async function crop(p, i, key, row) { await L.freeze(p);
    const rc = await p.evaluate((i) => { const b = document.querySelectorAll('.btn')[i].getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }, i);
    const x0 = Math.max(0, Math.floor(rc[0]) - 6), y0 = Math.max(0, Math.floor(rc[1]) - 6); const w = Math.min(W - x0, Math.ceil(rc[2]) + 12), h = Math.min(H - y0, Math.ceil(rc[3]) + 12);
    const buf = await sharp(await p.screenshot()).extract({ left: x0 * DPR, top: y0 * DPR, width: w * DPR, height: h * DPR }).png().toBuffer();
    const hh = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8); const f = path.join(OUT, `${key}_${hh}.png`); if (!seen[f]) { seen[f] = 1; fs.writeFileSync(f, buf); }
    row[key] = hh; await L.unfreeze(p); }
  for (let r = 0; r < +N; r++) for (const v of vars) {
    const b = await L.launch({ touch }); const { p } = await L.open(b, v, { w: W, h: H, mobile: touch, dpr: DPR });
    await p.goto(L.BASE + pg, { waitUntil: 'load' }); await L.settle(p, 2500);
    await p.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a,button')) e.preventDefault(); }, true));
    const row = { r, v };
    for (const i of IDX) {
      const y = await p.evaluate((i) => { const e = document.querySelectorAll('.btn')[i]; let t = 0, n = e; while (n) { t += n.offsetTop; n = n.offsetParent; } return Math.max(0, Math.round(t + e.offsetHeight / 2 - innerHeight / 2)); }, i);
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y); await L.w8(1300);
      await crop(p, i, `e${i}_before`, row);
      const c = await p.evaluate((i) => { const r = document.querySelectorAll('.btn')[i].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, i);
      if (touch) await p.touchscreen.tap(c[0], c[1]); else await p.mouse.move(c[0], c[1], { steps: 3 });
      await L.w8(WAIT); row[`e${i}_hover`] = await p.evaluate((i) => document.querySelectorAll('.btn')[i].matches(':hover'), i);
      await crop(p, i, `e${i}_after`, row);
      if (touch) await p.touchscreen.tap(4, H - 4); else await p.mouse.move(1, H - 2);
      await L.w8(1500); row[`e${i}_hover2`] = await p.evaluate((i) => document.querySelectorAll('.btn')[i].matches(':hover'), i);
      await crop(p, i, `e${i}_cleared`, row);
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y + 1500); await L.w8(1500);
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y); await L.w8(5000);
      await crop(p, i, `e${i}_rescrolled`, row);
    }
    log.push(row); console.log(JSON.stringify(row)); await b.close();
  }
  const sum = {}; for (const x of log) for (const k of Object.keys(x).filter((k) => /_(before|after|cleared|rescrolled)$/.test(k))) { const kk = k + ' ' + x.v; sum[kk] = sum[kk] || {}; sum[kk][x[k]] = (sum[kk][x[k]] || 0) + 1; }
  console.log('SUMMARY'); for (const k of Object.keys(sum).sort()) console.log(k, JSON.stringify(sum[k]));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ log, sum }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
