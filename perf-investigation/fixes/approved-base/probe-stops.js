// node probe-stops.js <tag> <WxH> <flags> <reps> <stopsToShoot comma> <variant...>
// Same scroll path as walk.js (every half viewport from 0), interleaved reps, screenshots only at
// the requested stops, plus price-card/quote geometry and animation state at each shot.
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [tag, vp, flagsS, repsS, shootS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const flags = new Set((flagsS || '').split(',').filter(Boolean));
const shoot = new Set(shootS.split(',').map(Number));
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
async function run(vname, label) {
  const b = await L.launch();
  const { p } = await L.open(b, vname, { w: W, h: H, mobile: flags.has('mobile'), reduced: flags.has('reduced') });
  await p.goto(L.BASE + '/', { waitUntil: 'load' });
  await L.settle(p, 2500);
  const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const stops = []; for (let y = 0; y < maxY; y += Math.round(H * 0.5)) stops.push(y); stops.push(maxY);
  const res = {};
  for (const y of stops) {
    await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
    await L.w8(1300);
    if (!shoot.has(y)) continue;
    await L.freeze(p);
    const f = path.join(OUT, `${label}_${y}.png`);
    await p.screenshot({ path: f });
    const g = await p.evaluate(() => {
      const cards = [...document.querySelectorAll('.price-card')].map((c) => {
        const r = c.getBoundingClientRect(); const cs = getComputedStyle(c);
        return { top: r.top, h: r.height, tr: cs.translate, tf: cs.transform, op: cs.opacity, fi: cs.filter,
          anim: c.getAnimations().map((a) => `${a.animationName || a.transitionProperty}:${a.playState}:${Math.round(a.currentTime)}`).join(',') };
      });
      const secs = [...document.querySelectorAll('.scroll-fade')].map((s) => ({ id: s.id, leave: s.style.getPropertyValue('--leave'), cs: getComputedStyle(s).getPropertyValue('--leave'), top: s.getBoundingClientRect().top }));
      return { sy: scrollY, cards, secs };
    });
    await L.unfreeze(p);
    res[y] = { f, ...g };
  }
  await b.close();
  return res;
}
(async () => {
  const reps = +repsS; const all = {};
  for (let r = 0; r < reps; r++) for (const v of vars) { const label = `${v}_r${r}`; all[label] = await run(v, label); process.stderr.write(label + ' ');}
  const labels = Object.keys(all); const ref = labels[0];
  const out = { tag, vp, flags: [...flags], labels, stops: [...shoot], diffs: {}, geo: all };
  for (const y of shoot) {
    out.diffs[y] = {};
    for (const a of labels) for (const b of labels) if (a < b) out.diffs[y][`${a}~${b}`] = await L.diff(all[a][y].f, all[b][y].f);
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
  for (const y of shoot) {
    console.log(`== y=${y}`);
    for (const [k, d] of Object.entries(out.diffs[y])) console.log(`  ${k.padEnd(30)} mad=${d.mad} pct=${d.pct} big=${d.big} bb=${JSON.stringify(d.bbox)}`);
    for (const l of labels) console.log(`  ${l.padEnd(12)} cards: ${all[l][y].cards.map((c) => `${c.top.toFixed(3)}|${c.tr}|${c.anim}`).join('  ')}`);
    for (const l of labels) console.log(`  ${l.padEnd(12)} leave: ${all[l][y].secs.map((s) => `${s.id}:${s.leave}/${s.cs}@${s.top.toFixed(2)}`).join(' ')}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
