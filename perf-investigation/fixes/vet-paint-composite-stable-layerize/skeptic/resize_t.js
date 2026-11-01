// Live resize across the 1440 media boundary with the real c1440 file vs baseline (cross-load): load at W0, scroll
// to the pricing bottom edge, then resize through a list of widths; at each, check computed contain and shoot a
// frozen 120px band under the #pricing bottom edge and a band over the cards. node resize.js <tag> <dpr> <reps> <W0> <W...>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, dprS, repsS, W0s, ...Ws] = process.argv.slice(2); const H = 900; const dpr = +dprS;
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const shots = [];
  for (let r = 0; r < +repsS; r++) for (const v of ['baseline', 'c1440']) {
    const b = await L.launch(); const { p } = await L.open(b, v, { w: +W0s, h: H, dpr });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    for (const W of Ws.map(Number)) {
      await p.setViewport({ width: W, height: H, deviceScaleFactor: dpr }); await L.w8(500);
      const g = await p.evaluate(() => { const q = document.getElementById('pricing').getBoundingClientRect(); return { top: q.top + scrollY, bot: q.bottom + scrollY }; });
      for (let y = g.top - H; y < g.bot; y += H / 2) { await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(250); }
      await p.evaluate(() => { if (!window.__scl) { window.__scl = 1; addEventListener('scroll', () => window.__sc.push([Math.round(performance.now() - window.__t0), scrollY])); } window.__sc = []; window.__t0 = performance.now(); });
      await p.evaluate((y) => window.scrollTo(0, y), Math.round(g.bot - H * 0.75)); await L.w8(1300);
      const preF = await p.evaluate(() => scrollY);
      await L.freeze(p, 2000);
      const info = await p.evaluate(() => { const q = document.getElementById('pricing'); return { sy: scrollY, docH: document.documentElement.scrollHeight, ptop: q.getBoundingClientRect().top + scrollY, tf: getComputedStyle(q).transform, lv: q.style.getPropertyValue('--leave'), edge: q.getBoundingClientRect().bottom, contain: getComputedStyle(q).contain, pb: getComputedStyle(q).paddingBottom }; });
      const f = path.join(OUT, `${v}_r${r}_${W}.png`); await p.screenshot({ path: f });
      info.preF = preF; info.postShot = await p.evaluate(() => scrollY); info.sc = await p.evaluate(() => window.__sc.map(([t, y]) => `${t}:${y}`).join(','));
      shots.push({ v, r, W, f, ...info });
      await L.unfreeze(p);
    }
    await b.close();
  }
  for (const W of Ws.map(Number)) {
    const ref = shots.find((s) => s.v === 'baseline' && s.r === 0 && s.W === W);
    for (const s of shots.filter((s) => s.W === W && s !== ref)) {
      const top = Math.round(ref.edge * dpr), hh = Math.min(Math.round(120 * dpr), Math.round(H * dpr) - top);
      const d = hh > 0 ? await L.xdiff(ref.f, s.f, null, { left: 0, top, width: Math.round(W * dpr), height: hh }) : { px: 'n/a' };
      console.log(`${tag} W=${W} ${s.v}_r${s.r} sy=${s.sy} docH=${s.docH} ptop=${s.ptop.toFixed(2)} lv=${s.lv} contain=${s.contain} pb=${s.pb} edge=${s.edge.toFixed(2)} (ref ${ref.edge.toFixed(2)}) band120 ${d.px}/${d.max} preFreeze=${s.preF} postShot=${s.postShot} scrollEv=${s.sc}`);
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
