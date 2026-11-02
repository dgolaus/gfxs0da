// node stopreps.js <tag> <WxH> <flags mobile,reduced> <page> <y,y,..> <N> <variant...> : N alternating rounds, frozen shots at stops;
// prints per stop: max within-variant pct diff vs min cross-variant pct diff (pct of px with mean |d|>8).
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, vp, flagsS, pg, ys, N, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number);
const flags = new Set((flagsS || '').split(',').filter(Boolean)); const mobile = flags.has('mobile');
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true }); const stops = ys.split(',').map(Number);
(async () => { const shots = {};
  for (let r = 0; r < +N; r++) for (const v of vars) {
    const b = await L.launch({ touch: mobile }); const { p } = await L.open(b, v, { w: W, h: H, mobile, reduced: flags.has('reduced'), fonts: process.env.FONTS });
    await p.goto(L.BASE + pg, { waitUntil: 'load' }); await L.settle(p, 2500);
    for (const y of stops) { await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
      await L.w8(1300); await L.freeze(p); const f = path.join(OUT, `${v}_r${r}_${y}.png`); await p.screenshot({ path: f }); (shots[y] = shots[y] || []).push({ v, r, f }); await L.unfreeze(p); }
    await b.close(); }
  const res = {};
  for (const y of stops) { const s = shots[y]; const within = {}, cross = []; 
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { const d = await L.diff(s[i].f, s[j].f); const k = s[i].v === s[j].v ? s[i].v : 'x'; if (k === 'x') cross.push(d.pct); else (within[k] = within[k] || []).push(d.pct); }
    res[y] = { within, cross }; console.log(`y=${y} within=${JSON.stringify(Object.fromEntries(Object.entries(within).map(([k, a]) => [k, [Math.min(...a), Math.max(...a)]])))} cross=[${Math.min(...cross)}, ${Math.max(...cross)}]`); }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
