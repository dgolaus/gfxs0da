// node tostop.js N variant...  — repeated /tos/ top screenshots at 1920x1080 (contain:paint applies to tos #pricing >=1440); clusters by pixel equality
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const L = require('./lib');
const [Ns, ...vars] = process.argv.slice(2); const N = +Ns; const OUT = path.join(__dirname, 'out', process.env.TAG || 'tostop'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const shots = [];
  for (let i = 0; i < N; i++) for (const v of vars) {
    const b = await L.launch();
    try { const { p } = await L.open(b, v, { w: 1920, h: 1080 });
      await p.goto(L.BASE + '/tos/', { waitUntil: 'load' }); await L.settle(p, 3000);
      const info = await p.evaluate(() => { const s = document.getElementById('pricing'); const r = s.getBoundingClientRect(); return { contain: getComputedStyle(s).contain, r: [r.x, r.y, r.width, r.height].map(Math.round), lenis: !!window.lenis, reveal: s.className, tf: getComputedStyle(s).transform, op: getComputedStyle(s).opacity }; });
      await L.freeze(p); const f = path.join(OUT, `${v}_${i}.png`); await p.screenshot({ path: f });
      const raw = await require('/home/user/gfxs0da/node_modules/sharp')(f).raw().toBuffer();
      const h = crypto.createHash('md5').update(raw).digest('hex').slice(0, 8);
      shots.push({ v, i, f, h, info, errs: (p.__errs || []).concat(await p.evaluate(() => window.__errs)) }); console.log(v, i, h, JSON.stringify(info));
    } finally { await b.close(); }
  }
  const clusters = {}; for (const s of shots) (clusters[s.h] = clusters[s.h] || []).push(s.v + s.i);
  const ref = shots[0]; const diffs = [];
  for (const s of shots.slice(1)) diffs.push({ a: ref.v + ref.i, b: s.v + s.i, d: await L.diff(ref.f, s.f) });
  console.log('clusters', JSON.stringify(clusters)); diffs.forEach((d) => console.log(JSON.stringify(d)));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ shots, clusters, diffs }, null, 1));
})();
