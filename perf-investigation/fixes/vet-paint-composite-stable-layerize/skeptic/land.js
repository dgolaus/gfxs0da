// Scroll-landing check: after load at W0 and a resize to W, run the same scroll sequence as resize.js and sample
// scrollY / lenis state after the final window.scrollTo. node land.js <tag> <reps> <W0> <W>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, repsS, W0s, Ws] = process.argv.slice(2); const H = 900; const W = +Ws;
(async () => {
  const res = [];
  for (let r = 0; r < +repsS; r++) for (const v of (r % 2 ? ['c1440', 'baseline'] : ['baseline', 'c1440'])) {
    const b = await L.launch(); const { p } = await L.open(b, v, { w: +W0s, h: H });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    if (W !== +W0s) { await p.setViewport({ width: W, height: H }); await L.w8(500); }
    const g = await p.evaluate(() => { const q = document.getElementById('pricing').getBoundingClientRect(); return { top: q.top + scrollY, bot: q.bottom + scrollY }; });
    for (let y = g.top - H; y < g.bot; y += H / 2) { await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(250); }
    const tgt = Math.round(g.bot - H * 0.75);
    await p.evaluate((y) => window.scrollTo(0, y), tgt);
    const s = [];
    for (const t of [100, 300, 600, 1000, 1300, 2000, 3500]) { await L.w8(t - (s.length ? [100, 300, 600, 1000, 1300, 2000, 3500][s.length - 1] : 0)); s.push(await p.evaluate(() => `${scrollY}${window.lenis ? '/L' + Math.round(window.lenis.animatedScroll) + '>' + Math.round(window.lenis.targetScroll) + (window.lenis.isScrolling ? '*' : '') : ''}`)); }
    const lim = await p.evaluate(() => ({ docH: document.documentElement.scrollHeight, limit: window.lenis ? window.lenis.limit : null }));
    console.log(`${tag} ${v} r${r} tgt=${tgt} docH=${lim.docH} limit=${lim.limit} samples(100,300,600,1000,1300,2000,3500ms): ${s.join(' ')}`);
    res.push({ v, r, tgt, s, lim });
    await b.close();
  }
  fs.writeFileSync(path.join(__dirname, 'out', `${tag}.json`), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
