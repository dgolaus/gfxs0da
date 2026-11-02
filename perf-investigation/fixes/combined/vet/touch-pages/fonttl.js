// node fonttl.js <tag> <fontmode abort|delay:N|none> <WxH> <flags mobile,scrollEarly> <variant...>
// Timeline under blocked/late web fonts: screenshots + nav/hero geometry at fixed times after navigation,
// then a frozen settled state at y=0 / y=200 (mid nav morph) / y=600. Baseline twice (A/A) + variants.
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, fm, vp, flagsS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number); const flags = new Set((flagsS || '').split(',').filter(Boolean));
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
const TS = [500, 1200, 1900, 2400, 2900, 3600, 5000];
const geo = () => { const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10).join(','); };
  const n = document.getElementById('nav');
  return { nav: n ? [r(n), ...[...n.querySelectorAll('*')].map(r)].join(';') : null,
    hero: r(document.querySelector('.hero-title')), accent: r(document.querySelector('.hero-title .accent')),
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').length, fontsErr: [...document.fonts].filter((f) => f.status === 'error').length,
    fam: n ? getComputedStyle(n.querySelector('a') || n).fontFamily.slice(0, 40) : '', sy: scrollY,
    navVars: n ? ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => getComputedStyle(n).getPropertyValue(k).trim()).join(',') : '',
    lenis: !!window.lenis, hoverNone: matchMedia('(hover: none)').matches, docH: document.documentElement.scrollHeight }; };
async function run(vname, label) {
  const b = await L.launch({ touch: flags.has('mobile') });
  const fonts = fm === 'none' ? undefined : fm;
  const { p } = await L.open(b, vname, { w: W, h: H, mobile: flags.has('mobile'), fonts });
  const t0 = Date.now(); const nav = p.goto(L.BASE + '/', { waitUntil: 'load' }).catch((e) => e);
  const tl = [];
  for (const T of TS) {
    const wait = T - (Date.now() - t0); if (wait > 0) await L.w8(wait);
    if (flags.has('scrollEarly') && T === 1200) await p.evaluate(() => { if (window.lenis) window.lenis.scrollTo(260, { immediate: true, force: true }); else scrollTo(0, 260); }).catch(() => {});
    const t = Date.now() - t0; const f = path.join(OUT, `${label}_t${T}.png`);
    try { await p.screenshot({ path: f }); tl.push({ T, t, f, g: await p.evaluate(geo) }); } catch (e) { tl.push({ T, t, err: String(e) }); }
  }
  await nav; await L.settle(p, 2000);
  const fin = [];
  for (const y of [0, 200, 600]) {
    await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
    await L.w8(1300); await L.freeze(p);
    const f = path.join(OUT, `${label}_fin${y}.png`); await p.screenshot({ path: f });
    fin.push({ y, f, g: await p.evaluate(geo) }); await L.unfreeze(p);
  }
  const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs)); const fr = p.__fontReqs || [];
  await b.close(); return { tl, fin, errs, fontReqs: fr.length };
}
(async () => {
  const R = { A: await run('baseline', 'A'), B: await run('baseline', 'B') };
  for (const v of vars) R[v] = await run(v, v);
  const out = { tag, fm, vp, flags: [...flags], runs: {}, cmp: [] };
  for (const k in R) out.runs[k] = { errs: R[k].errs, fontReqs: R[k].fontReqs, tl: R[k].tl.map((x) => ({ T: x.T, t: x.t, g: x.g })), fin: R[k].fin.map((x) => ({ y: x.y, g: x.g })) };
  const nav = NaN;
  const pairs = (key) => R.A[key].map((a, i) => ({ a, i }));
  for (const key of ['tl', 'fin']) for (const { a, i } of pairs(key)) {
    const bq = R.B[key][i]; if (!a.f || !bq.f) continue;
    const row = { key, at: a.T != null ? a.T : 'y' + a.y, tA: a.t, tB: bq.t, noise: await L.diff(a.f, bq.f), navAB: a.g.nav === bq.g.nav ? 'same' : 'DIFF' };
    for (const v of vars) { const x = R[v][key][i]; if (!x.f) continue;
      row[v] = { t: x.t, vsA: await L.diff(a.f, x.f, path.join(OUT, `heat_${v}_${key}_${row.at}.png`)), vsB: await L.diff(bq.f, x.f),
        nav: x.g.nav === a.g.nav ? 'same' : (x.g.nav === bq.g.nav ? 'sameB' : 'DIFF'), hero: x.g.hero === a.g.hero || x.g.hero === bq.g.hero ? 'same' : [a.g.hero, x.g.hero],
        fonts: [a.g.fonts, bq.g.fonts, x.g.fonts], navVars: [a.g.navVars, x.g.navVars] }; }
    out.cmp.push(row);
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
  console.log(`== ${tag} fonts=${fm} ${vp} ${[...flags]} lenis=${R.A.fin[0].g.lenis} hoverNone=${R.A.fin[0].g.hoverNone} fontReqs=${Object.entries(R).map(([k, r]) => k + ':' + r.fontReqs)} errs=${JSON.stringify(Object.fromEntries(Object.entries(R).map(([k, r]) => [k, r.errs])))}`);
  for (const r of out.cmp) { const parts = [`${r.key}@${r.at} tA=${r.tA} tB=${r.tB} noise=${r.noise.mad}/${r.noise.pct} navAB=${r.navAB}`];
    for (const v of vars) { const x = r[v]; if (!x) continue; const flag = Math.min(x.vsA.pct, x.vsB.pct) > r.noise.pct + 0.02 ? ' <<<' : '';
      parts.push(`${v}(t=${x.t}): A ${x.vsA.mad}/${x.vsA.pct} B ${x.vsB.mad}/${x.vsB.pct} bb=${JSON.stringify(x.vsA.bbox)} nav=${x.nav} hero=${JSON.stringify(x.hero)} fonts=${x.fonts} vars=${x.navVars}${flag}`); }
    console.log(parts.join(' | ')); }
})().catch((e) => { console.error(e); process.exit(1); });
