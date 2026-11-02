// node navlayout.js <tag> <fontmode> <WxH> <mobile|desk> <N> <variant...> : sample nav LAYOUT (offset* , transform-free) + computed nav vars
// every ~60ms for 5s from navigation, no screenshots. Collapses to the sequence of distinct layout states per run.
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, fm, vp, mode, N, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number); const mobile = mode === 'mobile';
const probe = () => { const n = document.getElementById('nav'); if (!n) return null;
  const lay = (e) => { let x = 0, y = 0, o = e; while (o && o !== n) { x += o.offsetLeft || 0; y += o.offsetTop || 0; o = o.offsetParent; } return [x, y, e.offsetWidth, e.offsetHeight].join(','); };
  const cs = getComputedStyle(n);
  return { lay: [n.offsetWidth + 'x' + n.offsetHeight, ...[...n.querySelectorAll('*')].filter((e) => e.offsetParent !== null || e === n).map(lay)].join(';'),
    vars: ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => parseFloat(cs.getPropertyValue(k))).join(',') + ' pad=' + cs.paddingTop + ' lpad=' + getComputedStyle(n.querySelector('.nav-links') || n).padding + ' pill=' + n.classList.contains('is-pill'),
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').length, ff: document.fonts.check('600 14px "Inter Tight"') }; };
(async () => { const out = {};
  for (let r = 0; r < +N; r++) for (const v of vars) {
    const b = await L.launch({ touch: mobile }); const { p } = await L.open(b, v, { w: W, h: H, mobile, fonts: fm === 'none' ? undefined : fm });
    const t0 = Date.now(); const g = p.goto(L.BASE + '/', { waitUntil: 'load' }).catch((e) => e); const seq = [];
    while (Date.now() - t0 < 5000) { try { const s = await p.evaluate(probe); if (s) { const k = s.lay + '|' + s.vars + '|' + s.fonts; if (!seq.length || seq[seq.length - 1].k !== k) seq.push({ t: Date.now() - t0, k, ...s }); } } catch (e) {} await L.w8(60); }
    await g; await L.settle(p, 1000); const fin = await p.evaluate(probe); await b.close();
    (out[v] = out[v] || []).push({ seq, fin }); console.log(v, 'r' + r, 'states:', seq.map((s) => `${s.t}ms f${s.fonts} ${s.vars}`).join(' -> '));
  }
  // compare: distinct (lay,vars) per font-state across variants
  const sig = (run) => [...new Set(run.seq.map((s) => `f${s.fonts > 0 ? 'web' : 'fallback'}|${s.lay}|${s.vars}`))].sort();
  const all = {}; for (const v of vars) all[v] = new Set(out[v].flatMap(sig));
  const base = all[vars[0]]; for (const v of vars.slice(1)) { const onlyV = [...all[v]].filter((x) => !base.has(x)), onlyB = [...base].filter((x) => !all[v].has(x));
    console.log(`${v} vs ${vars[0]}: layout states only in ${v}: ${onlyV.length}, only in ${vars[0]}: ${onlyB.length}`); onlyV.concat(onlyB).forEach((x) => console.log('   ', x.slice(0, 300))); }
  const fins = vars.map((v) => out[v].map((r) => r.fin.lay + '|' + r.fin.vars)); console.log('final layouts identical across all runs:', new Set(fins.flat()).size === 1);
  fs.writeFileSync(path.join(__dirname, 'out', tag + '.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
