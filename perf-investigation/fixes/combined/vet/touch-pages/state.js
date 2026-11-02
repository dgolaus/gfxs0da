// node state.js <WxH> <mobile|desk> [reduced] : steady-state (unfrozen, long waits) of JS-written styles, baseline vs combined.
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [vp, mode, red] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number); const mobile = mode === 'mobile';
const rd = () => { const o = {}; const cs = getComputedStyle;
  document.querySelectorAll('.accent-text').forEach((e, i) => { o['acc' + i] = e.style.backgroundImage.slice(0, 40); o['accRectTop' + i] = e.getBoundingClientRect().top.toFixed(2); });
  document.querySelectorAll('.hero-title .accent, .process-text h2 .accent-soft').forEach((e, i) => { o['accParentInline' + i] = e.style.backgroundImage.slice(0, 30); o['accParentComputed' + i] = cs(e).backgroundImage.slice(0, 30); });
  document.querySelectorAll('.scroll-fade').forEach((e) => { o['leave#' + e.id] = e.style.getPropertyValue('--leave'); o['op#' + e.id] = cs(e).opacity; o['flt#' + e.id] = cs(e).filter; o['tf#' + e.id] = cs(e).transform; });
  const ft = document.querySelector('.footer, footer'); if (ft) { o.fpInline = ft.style.getPropertyValue('--fp'); o.fp = cs(ft).getPropertyValue('--fp').trim(); }
  const n = document.getElementById('nav'); if (n) { o.navComputed = ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => parseFloat(cs(n).getPropertyValue(k))).join(','); o.isPill = n.classList.contains('is-pill');
    o.navPad = cs(n).paddingTop; o.pillPad = cs(n.querySelector('.nav-links') || n).padding; o.brandOp = cs(n.querySelector('.brand') || n).opacity; }
  o.htmlInlineNav = document.documentElement.style.getPropertyValue('--nav-pill'); o.navInline = n ? n.style.getPropertyValue('--nav-pill') : '';
  o.tq = [...document.querySelectorAll('.tcol-track')].map((t) => t.children.length + ':' + t.querySelectorAll('[aria-hidden]').length + ':' + Math.round(t.getBoundingClientRect().height)).join(' ');
  o.lenis = !!window.lenis; o.sy = scrollY; return o; };
(async () => { const R = {};
  for (const v of ['baseline', 'combined']) { const b = await L.launch({ touch: mobile }); const { p } = await L.open(b, v, { w: W, h: H, mobile, reduced: !!red });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 6000); R[v] = { top: await p.evaluate(rd) };
    for (const y of [300, 2000, 4500]) { await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y); await L.w8(4000); R[v]['y' + y] = await p.evaluate(rd); }
    const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, maxY); await L.w8(4000); R[v].bottom = await p.evaluate(rd);
    await p.evaluate(() => { if (window.lenis) window.lenis.scrollTo(0, { immediate: true, force: true }); else window.scrollTo(0, 0); }); await L.w8(4000); R[v].backTop = await p.evaluate(rd);
    R[v].errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs)); await b.close(); }
  const tag = `state_${W}x${H}_${mode}${red ? '_reduced' : ''}`; fs.writeFileSync(path.join(__dirname, 'out', tag + '.json'), JSON.stringify(R, null, 1));
  console.log('==', tag, 'errs', JSON.stringify([R.baseline.errs, R.combined.errs]));
  for (const k of Object.keys(R.baseline)) { if (k === 'errs') continue; const a = R.baseline[k], c = R.combined[k];
    const d = Object.keys({ ...a, ...c }).filter((x) => a[x] !== c[x]).map((x) => `${x}: ${JSON.stringify(a[x])} -> ${JSON.stringify(c[x])}`); console.log(k, d.length ? '\n   ' + d.join('\n   ') : 'identical'); }
})().catch((e) => { console.error(e); process.exit(1); });
