// node btnhash.js <tag> <WxH> <mobile|desk> <N> <variant...>: alternate variants N rounds; for .btn #0,#2,#4 on / crop+hash frozen viewport region.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const L = require('./lib'); const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const [tag, vp, mode, N, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number); const mobile = mode === 'mobile'; const DPR = +(process.env.DPR || 1);
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
(async () => { const log = []; const seen = {};
  for (let r = 0; r < +N; r++) for (const v of vars) {
    const b = await L.launch({ touch: mobile }); const { p } = await L.open(b, v, { w: W, h: H, mobile, dpr: DPR });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500); const row = { r, v };
    for (const bi of [0, 2, 4]) {
      const y = await p.evaluate((i) => { const e = document.querySelectorAll('.btn')[i]; const r = e.getBoundingClientRect(); return Math.max(0, Math.round(scrollY + r.top - innerHeight / 2)); }, bi);
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
      await L.w8(900); await L.freeze(p);
      const rc = await p.evaluate((i) => { const b = document.querySelectorAll('.btn')[i].getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }, bi);
      const x0 = Math.max(0, Math.floor(rc[0]) - 6), y0 = Math.max(0, Math.floor(rc[1]) - 6); const w = Math.min(W - x0, Math.ceil(rc[2]) + 12), h = Math.min(H - y0, Math.ceil(rc[3]) + 12);
      const buf = await sharp(await p.screenshot()).extract({ left: x0 * DPR, top: y0 * DPR, width: w * DPR, height: h * DPR }).png().toBuffer();
      const hh = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8); const f = path.join(OUT, `b${bi}_${hh}.png`); if (!seen[f]) { seen[f] = 1; fs.writeFileSync(f, buf); }
      row['b' + bi] = hh; row['r' + bi] = rc.map((x) => +x.toFixed(2)).join(); await L.unfreeze(p);
    }
    row.lenis = await p.evaluate(() => !!window.lenis); log.push(row); console.log(JSON.stringify(row)); await b.close();
  }
  const sum = {}; for (const x of log) for (const bi of [0, 2, 4]) { const k = x.v + ' b' + bi; sum[k] = sum[k] || {}; sum[k][x['b' + bi]] = (sum[k][x['b' + bi]] || 0) + 1; }
  console.log('SUMMARY ' + JSON.stringify(sum, null, 0)); fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ log, sum }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
