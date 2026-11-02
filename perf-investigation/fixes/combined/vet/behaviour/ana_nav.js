const fs = require('fs'); const L = require('./lib');
const R = JSON.parse(fs.readFileSync(__dirname + '/out/navclicks.json'));
const clamp = (v) => Math.max(0, Math.min(1, v)); const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const f = (sy) => { const p = ease(clamp(sy / 360)); return [p.toFixed(3), clamp(1 - p * 1.5).toFixed(3), clamp((p - 0.30) / 0.50).toFixed(3)]; };
const parseY = (g) => { const m = /at 50% (-?[\d.]+)vh/.exec(g || ''); return m ? +m[1] : null; };
(async () => {
  const out = { runs: [], shots: [] };
  for (const run of R) {
    const s = { v: run.v, rep: run.rep, initial: run.initial, clicks: [] };
    for (const c of run.clicks) {
      let navBad = 0, navN = 0, accBad = 0, accN = 0, accMaxRes = 0, parentInline = new Set(), parentComputed = new Set(), childNone = 0; const looks = new Set();
      for (let i = 0; i < c.rec.length; i++) { const r = c.rec[i], pr = c.rec[i - 1];
        navN++; const ok = [r.sy, pr && pr.sy].filter((x) => x != null).some((sy) => f(sy).join() === r.nav.join()); if (!ok) navBad++;
        looks.add(JSON.stringify([r.nav, r.navLook]));
        r.acc.forEach((a, k) => { parentInline.add(a[2] ? 'set' : 'empty'); parentComputed.add(a[3]); if (a[4] === 'none') childNone++;
          if (i >= 1) { const y0 = parseY(pr.acc[k][0]), y1 = parseY(a[0]); if (y0 == null || y1 == null) return; accN++;
            // implied target from LERP 0.10; target = 50 - top/vh*100 with top read this frame or an adjacent frame
            const tgt = y0 + (y1 - y0) * 10; const cands = [a[1], pr.acc[k][1], c.rec[i + 1] && c.rec[i + 1].acc[k][1]].filter((x) => x != null).map((t) => 50 - t / 900 * 100);
            const res = Math.min(...cands.map((x) => Math.abs(x - tgt))); accMaxRes = Math.max(accMaxRes, res); if (res > 0.2) accBad++; } }); }
      const last = c.rec[c.rec.length - 1];
      s.clicks.push({ href: c.href, finSy: c.fin.sy, expect: c.pre.expect, durMs: c.durMs, frames: c.frames, clickErr: c.clickErr, hash: c.fin.hash, htmlInline: c.fin.html, navInline: c.fin.navInline,
        navMismatchFrames: navBad + '/' + navN, accentLerpViolations: accBad + '/' + accN, accentMaxResidualVh: +accMaxRes.toFixed(3), parentInline: [...parentInline], parentComputed: [...parentComputed], childComputedNone: childNone,
        finalNav: last.nav, finalLook: last.navLook, finalAcc: last.acc.map((a) => a[0]), distinctNavStates: looks.size, linkVis: c.pre.vis });
    }
    out.runs.push(s);
  }
  // compare final states baseline vs combined, per click index
  const by = (v, rep) => out.runs.find((r) => r.v === v && r.rep === rep);
  out.compare = [];
  for (let k = 0; k < R[0].clicks.length; k++) { const row = { k, href: R[0].clicks[k].href };
    for (const rep of [0, 1]) { const b = by('baseline', rep).clicks[k], c = by('combined', rep).clicks[k];
      row['rep' + rep] = { sy: [b.finSy, c.finSy], navEq: JSON.stringify(b.finalNav) === JSON.stringify(c.finalNav), lookEq: JSON.stringify(b.finalLook) === JSON.stringify(c.finalLook), accEq: JSON.stringify(b.finalAcc) === JSON.stringify(c.finalAcc), dur: [b.durMs, c.durMs] }; }
    const sh = (v, rep) => R.find((r) => r.v === v && r.rep === rep).clicks[k].shot;
    row.shotNoiseBB = await L.diff(sh('baseline', 0), sh('baseline', 1)); row.shotNoiseCC = await L.diff(sh('combined', 0), sh('combined', 1));
    row.shotB0C0 = await L.diff(sh('baseline', 0), sh('combined', 0), sh('combined', 0).replace('.png', '_heatB0.png')); row.shotB1C1 = await L.diff(sh('baseline', 1), sh('combined', 1)); row.shotB0C1 = await L.diff(sh('baseline', 0), sh('combined', 1));
    out.compare.push(row); }
  fs.writeFileSync(__dirname + '/out/navclicks_analysis.json', JSON.stringify(out, null, 1));
  for (const r of out.runs) { console.log(r.v, r.rep, 'initial', JSON.stringify(r.initial)); for (const c of r.clicks) console.log('  ', c.href, c.finSy, c.expect, c.durMs + 'ms', 'nav', c.navMismatchFrames, 'acc', c.accentLerpViolations, c.accentMaxResidualVh, 'pInl', c.parentInline, 'pCmp', c.parentComputed.map((x) => x.slice(0, 20)), 'childNone', c.childComputedNone, 'html', c.htmlInline.join(','), 'nav', c.navInline.join(','), 'states', c.distinctNavStates, 'err', c.clickErr, 'vis', JSON.stringify(c.linkVis)); }
  for (const r of out.compare) console.log(JSON.stringify(r));
})();
