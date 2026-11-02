// node reps.js <tag> <WxH> <mobile|desk> <reduced 0|1> <btnIndex> <N> <variant...> : alternate variants N rounds, hash the frozen clip of .btn[btnIndex].
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const L = require('./lib');
const [tag, vp, mode, red, bi, N, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number); const mobile = mode === 'mobile';
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true }); const DPR = +(process.env.DPR || 1); const WAIT = +(process.env.WAIT || 2500);
(async () => { const hashes = {}; const log = [];
  for (let r = 0; r < +N; r++) for (const v of vars) {
    const b = await L.launch({ touch: mobile }); const { p } = await L.open(b, v, { w: W, h: H, mobile, reduced: red === '1', dpr: DPR });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, WAIT);
    const y = await p.evaluate((i) => { const e = document.querySelectorAll('.btn')[i]; const r = e.getBoundingClientRect(); return Math.max(0, Math.round(scrollY + r.top - innerHeight / 2)); }, +bi);
    await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
    await L.w8(900); await L.freeze(p);
    const r = await p.evaluate((i) => { const b = document.querySelectorAll('.btn')[i].getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }, +bi);
    const clip = { x: Math.max(0, Math.floor(r[0]) - 6), y: Math.max(0, Math.floor(r[1]) - 6), width: Math.ceil(r[2]) + 12, height: Math.ceil(r[3]) + 12 };
    clip.width = Math.min(clip.width, W - clip.x); clip.height = Math.min(clip.height, H - clip.y);
    const buf = await require('/home/user/gfxs0da/node_modules/sharp')(await p.screenshot()).extract({ left: clip.x * DPR, top: clip.y * DPR, width: clip.width * DPR, height: clip.height * DPR }).png().toBuffer(); // viewport-relative crop, device px
    const h = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
    if (!hashes[h]) { hashes[h] = path.join(OUT, `state_${h}.png`); fs.writeFileSync(hashes[h], buf); }
    const lenis = await p.evaluate(() => !!window.lenis); log.push({ r, v, h, lenis, rect: r.map((x) => +x.toFixed(3)).join() }); console.log(r, v, h, 'lenis=' + lenis);
    await b.close();
  }
  const sum = {}; for (const x of log) { sum[x.v] = sum[x.v] || {}; sum[x.v][x.h] = (sum[x.v][x.h] || 0) + 1; }
  console.log('SUMMARY', JSON.stringify(sum)); fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ log, sum, hashes }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
