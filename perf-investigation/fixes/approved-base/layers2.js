// node layers2.js <reps> : composited layer tree at several scroll stops, baseline vs base (fresh browser per load)
const L = require('./lib'); const fs = require('fs'); const path = require('path');
const reps = +process.argv[2] || 2; const res = [];
(async () => {
  for (let r = 0; r < reps; r++) for (const v of ['baseline', 'base']) {
    const b = await L.launch();
    const { p, c } = await L.open(b, v, { w: 1440, h: 900 });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    let last = null, events = 0;
    c.on('LayerTree.layerTreeDidChange', (e) => { events++; if (e.layers && e.layers.length) last = e.layers; });
    await c.send('LayerTree.enable');
    const row = { r, v, stops: {} };
    for (const y of [0, 2400, 3400, 4550, 99999]) {
      last = null;
      await p.evaluate((y) => { const t = Math.min(y, document.documentElement.scrollHeight - innerHeight); if (window.lenis) { window.lenis.scrollTo(t + 1, { immediate: true, force: true }); window.lenis.scrollTo(t, { immediate: true, force: true }); } else { scrollTo(0, t + 1); scrollTo(0, t); } }, y);
      await L.w8(1500);
      const ls = (last || []);
      const dc = ls.filter((l) => l.drawsContent);
      row.stops[y] = { total: ls.length, draws: dc.length, mp: +(dc.reduce((a, l) => a + l.width * l.height, 0) / 1e6).toFixed(2),
        sig: dc.map((l) => `${Math.round(l.width)}x${Math.round(l.height)}`).sort().join(',') };
    }
    await b.close();
    res.push(row);
    console.log(`r${r} ${v.padEnd(9)} ` + Object.entries(row.stops).map(([y, s]) => `y${y}: ${s.total}/${s.draws} ${s.mp}MP`).join(' | '));
  }
  // signature equality per stop vs first baseline
  const ref = res[0];
  for (const x of res.slice(1)) console.log(`${x.v} r${x.r} sigEqual:`, Object.keys(ref.stops).map((y) => `${y}=${ref.stops[y].sig === x.stops[y].sig}`).join(' '));
  fs.writeFileSync(path.join(__dirname, 'out', 'layers2.json'), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
