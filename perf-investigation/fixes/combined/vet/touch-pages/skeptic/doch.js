// node doch.js <variant...> : 820x1180 touch DPR2; sample docH + #process height every 200ms for 60s, scrolling to the process section after 3s (so chat timeline starts like in the walk)
const fs = require('fs'); const path = require('path'); const L = require('./lib'); const out = {};
(async () => { for (const v of process.argv.slice(2)) for (const r of [0, 1]) { const b = await L.launch({ touch: true }); const { p } = await L.open(b, v, { w: 820, h: 1180, mobile: true, dpr: 2 });
  await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
  const s = []; const t0 = Date.now(); let scrolled = false;
  while (Date.now() - t0 < 60000) { if (!scrolled && Date.now() - t0 > 3000) { await p.evaluate(() => window.scrollTo(0, document.getElementById('process').offsetTop - 200)); scrolled = true; }
    s.push(await p.evaluate(() => document.documentElement.scrollHeight + '/' + Math.round(document.getElementById('process').getBoundingClientRect().height))); await L.w8(200); }
  out[v + '#' + r] = { distinct: [...new Set(s)], n: s.length }; console.log(v + '#' + r, JSON.stringify([...new Set(s)])); await b.close(); }
  fs.writeFileSync(path.join(__dirname, 'out', 'docH_timeseries.json'), JSON.stringify(out, null, 1)); })();
