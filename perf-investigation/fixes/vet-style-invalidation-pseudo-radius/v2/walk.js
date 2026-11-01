// node walk.js <tag> <WxH> <page> <flags:mobile,reduced,jump> <variant...>
// Runs baseline twice (A/A noise) + each variant, one browser per run, same scroll stops.
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [tag, vp, pg, flagsS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const flags = new Set((flagsS || '').split(',').filter(Boolean));
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });

async function run(vname, label, stops) {
  const b = await L.launch();
  const { p } = await L.open(b, vname, { w: W, h: H, mobile: flags.has('mobile'), reduced: flags.has('reduced') });
  await p.goto(L.BASE + pg, { waitUntil: 'load' });
  await L.settle(p, 2500);
  if (!stops) {
    const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    stops = []; for (let y = 0; y < maxY; y += Math.round(H * 0.5)) stops.push(y); stops.push(maxY);
    if (flags.has('jump')) stops = [stops[stops.length - 1], ...stops.slice().reverse().slice(1)];  // End, then walk up
  }
  const res = [];
  for (const y of stops) {
    await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
    await L.w8(1300);
    await L.freeze(p);
    const f = path.join(OUT, `${label}_${y}.png`);
    await p.screenshot({ path: f });
    const g = await p.evaluate(() => ({ sy: Math.round(scrollY * 10) / 10, docH: document.documentElement.scrollHeight,
      sec: [...document.querySelectorAll('#main > section, #contact')].map((s) => Math.round(s.getBoundingClientRect().top * 10) / 10),
      thumb: (document.querySelector('.rail__thumb') || {}).style ? document.querySelector('.rail__thumb').style.cssText : '' }));
    await L.unfreeze(p);
    res.push({ y, f, ...g });
  }
  const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
  await b.close();
  return { stops, res, errs };
}

(async () => {
  const A = await run('baseline', 'A');
  const B = await run('baseline', 'B', A.stops);
  const out = { tag, vp, pg, flags: [...flags], errs: { A: A.errs, B: B.errs }, rows: [] };
  const Vs = {};
  for (const v of vars) { Vs[v] = await run(v, v, A.stops); out.errs[v] = Vs[v].errs; }
  for (let i = 0; i < A.stops.length; i++) {
    const row = { y: A.stops[i], noise: await L.diff(A.res[i].f, B.res[i].f), geoA: A.res[i] };
    for (const v of vars) {
      const d = await L.diff(A.res[i].f, Vs[v].res[i].f, path.join(OUT, `heat_${v}_${A.stops[i]}.png`));
      const dB = await L.diff(B.res[i].f, Vs[v].res[i].f);
      const gv = Vs[v].res[i], ga = A.res[i];
      const geo = (gv.sy !== ga.sy || gv.docH !== ga.docH || gv.sec.join() !== ga.sec.join()) ? { sy: [ga.sy, gv.sy], docH: [ga.docH, gv.docH], sec: [ga.sec.join(' '), gv.sec.join(' ')] } : 'same';
      const thumb = gv.thumb === ga.thumb ? 'same' : [ga.thumb, gv.thumb];
      row[v] = { vsA: d, vsB: dB, geo, thumb };
    }
    delete row.geoA;
    out.rows.push(row);
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
  // compact summary: flag stops where variant differs from BOTH baselines more than A/A noise
  console.log(`== ${tag} ${vp} ${pg} ${[...flags]} errs:`, JSON.stringify(out.errs));
  for (const r of out.rows) {
    const parts = [`y=${r.y} noise=${r.noise.mad}/${r.noise.pct}`];
    for (const v of vars) {
      const x = r[v]; const flag = (Math.min(x.vsA.pct, x.vsB.pct) > r.noise.pct + 0.02) ? ' <<<' : '';
      parts.push(`${v}: A ${x.vsA.mad}/${x.vsA.pct} B ${x.vsB.mad}/${x.vsB.pct} bb=${JSON.stringify(x.vsA.bbox)}${x.geo === 'same' ? '' : ' GEO=' + JSON.stringify(x.geo)}${x.thumb === 'same' ? '' : ' THUMB'}${flag}`);
    }
    console.log(parts.join(' | '));
  }
})().catch((e) => { console.error(e); process.exit(1); });
