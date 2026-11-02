// node leaverep.js <N> : m390 touch, replicate walk sequence up to y=5908; record --leave#trust, trust rect, process height, screenshot hash. Alternates baseline/combined.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const L = require('./lib');
const N = +process.argv[2] || 3; const OUT = path.join(__dirname, 'out', 'leaverep'); fs.mkdirSync(OUT, { recursive: true });
(async () => { const log = [];
  for (let r = 0; r < N; r++) for (const v of ['baseline', 'combined']) {
    const b = await L.launch({ touch: true }); const { p } = await L.open(b, v, { w: 390, h: 844, mobile: true });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    for (let y = 0; y <= 5908; y += 422) { await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(1300); await L.freeze(p); await L.unfreeze(p); }
    await p.evaluate(() => window.scrollTo(0, 5908)); await L.w8(1300); await L.freeze(p);
    const st = await p.evaluate(() => { const t = document.getElementById('trust'), pr = document.getElementById('process');
      const tb = t.getBoundingClientRect(); return { leave: getComputedStyle(t).getPropertyValue('--leave').trim(), inl: t.style.getPropertyValue('--leave'), op: getComputedStyle(t).opacity,
        trustTop: +tb.top.toFixed(2), trustBottom: +tb.bottom.toFixed(2), processH: +pr.getBoundingClientRect().height.toFixed(2), fadeStart: innerHeight * 0.3,
        expectedNow: +Math.min(1, Math.max(0, (innerHeight * 0.3 - tb.bottom) / (innerHeight * 0.3))).toFixed(3), sy: scrollY }; });
    const f = path.join(OUT, `${v}_${r}.png`); await p.screenshot({ path: f });
    const h = crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
    log.push({ r, v, h, ...st }); console.log(JSON.stringify({ r, v, h, ...st }));
    await b.close();
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(log, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
