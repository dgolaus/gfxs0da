// node interact.js <tag> <WxH> <page> <mode: desk|touch> <variant...>
// For every .btn (and .price-card/.quote originals on /), runs: hover (desk: mouse; touch: tap with nav prevented),
// then keyboard focus-visible. Freezes at fixed animation times (btnSheen 350ms, focusPop 160ms, rest 5000ms) and
// crops the element from the VIEWPORT screenshot. baseline runs twice (A/A noise). DPR env honoured.
const fs = require('fs'); const path = require('path'); const L = require('./lib'); const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const [tag, vp, pg, mode, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number); const touch = mode === 'touch';
const DPR = +(process.env.DPR || 1); const OUT = path.join(__dirname, 'out', 'ia_' + tag); fs.mkdirSync(OUT, { recursive: true });
const SEL = '.btn, .pricing-grid .price-card, .tcol-track .quote:not([aria-hidden])';
async function fz(p) { await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); const n = a.animationName || a.transitionProperty || '';
  a.currentTime = n === 'btnSheen' ? 350 : n === 'focusPop' ? 160 : 5000; } catch (e) {} } }); await L.w8(250); }
async function shot(p, i, f) {
  const r = await p.evaluate((sel, i) => { const b = document.querySelectorAll(sel)[i].getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }, SEL, i);
  const x = Math.max(0, Math.floor(r[0]) - 16), y = Math.max(0, Math.floor(r[1]) - 16);
  const w = Math.min(W - x, Math.ceil(r[2]) + 32), h = Math.min(H - y, Math.ceil(r[3]) + 32);
  if (w <= 0 || h <= 0) return null;
  await sharp(await p.screenshot()).extract({ left: x * DPR, top: y * DPR, width: w * DPR, height: h * DPR }).png().toFile(f); return r.map((v) => +v.toFixed(2)).join();
}
async function run(v, label) {
  const b = await L.launch({ touch }); const { p } = await L.open(b, v, { w: W, h: H, mobile: touch, dpr: DPR });
  await p.goto(L.BASE + pg, { waitUntil: 'load' }); await L.settle(p, 2500);
  await p.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a,button')) e.preventDefault(); }, true));
  const n = await p.evaluate((s) => document.querySelectorAll(s).length, SEL); const res = [];
  for (let i = 0; i < n; i++) {
    const info = await p.evaluate((s, i) => { const e = document.querySelectorAll(s)[i]; const r = e.getBoundingClientRect(); let t = 0, n = e; while (n) { t += n.offsetTop; n = n.offsetParent; } return { cls: e.className, vis: r.width > 0 && r.height > 0, y: Math.max(0, Math.round(t + e.offsetHeight / 2 - innerHeight / 2)) }; }, SEL, i);
    if (!info.vis) { res.push({ i, cls: info.cls, skip: true }); continue; }
    await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, info.y);
    await L.w8(1300);
    const c = await p.evaluate((s, i) => { const r = document.querySelectorAll(s)[i].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, SEL, i);
    // 1) hover / tap
    if (touch) await p.touchscreen.tap(c[0], c[1]); else await p.mouse.move(c[0], c[1], { steps: 3 });
    await L.w8(200); await fz(p);
    const hov = await p.evaluate((s, i) => { const e = document.querySelectorAll(s)[i]; return { hover: e.matches(':hover'), afterR: getComputedStyle(e, '::after').borderRadius, hostR: getComputedStyle(e).borderRadius, anims: document.getAnimations().filter((a) => a.effect && a.effect.target === e).map((a) => a.animationName || a.transitionProperty).join(' ') }; }, SEL, i);
    const fh = path.join(OUT, `${label}_${i}_hover.png`); const rh = await shot(p, i, fh);
    await L.unfreeze(p);
    if (!touch) await p.mouse.move(1, H - 2); await L.w8(900);
    // 2) keyboard focus-visible
    await p.keyboard.press('Shift'); await p.evaluate((s, i) => { const e = document.querySelectorAll(s)[i]; if (e.tabIndex < 0 && !e.matches('a,button')) e.setAttribute('tabindex', '-1'); e.focus({ preventScroll: true }); }, SEL, i);
    await L.w8(120); await fz(p);
    const foc = await p.evaluate((s, i) => { const e = document.querySelectorAll(s)[i]; return { fv: e.matches(':focus-visible'), afterR: getComputedStyle(e, '::after').borderRadius, hostR: getComputedStyle(e).borderRadius }; }, SEL, i);
    const ff = path.join(OUT, `${label}_${i}_focus.png`); const rf = await shot(p, i, ff);
    await L.unfreeze(p); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await L.w8(500);
    const sy = await p.evaluate(() => scrollY); res.push({ i, cls: info.cls, hov, foc, fh, fff: ff, rh, rf, sy });
  }
  const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs)); const lenis = await p.evaluate(() => !!window.lenis);
  await b.close(); return { res, errs, lenis };
}
(async () => {
  const A = await run('baseline', 'A'), B = await run('baseline', 'B'); const out = { tag, vp, pg, mode, lenis: A.lenis, errs: { A: A.errs, B: B.errs }, rows: [] };
  const Vs = {}; for (const v of vars) { Vs[v] = await run(v, v); out.errs[v] = Vs[v].errs; }
  for (let k = 0; k < A.res.length; k++) { const a = A.res[k], bb = B.res[k]; if (a.skip) { out.rows.push(a); continue; }
    const row = { i: a.i, cls: a.cls, hovA: a.hov, focA: a.foc };
    for (const kind of ['fh', 'fff']) { const nz = await L.diff(a[kind], bb[kind]); row[kind + '_noise'] = nz;
      for (const v of vars) { const x = Vs[v].res[k]; row[kind + '_' + v] = { vsA: await L.diff(a[kind], x[kind]), vsB: await L.diff(bb[kind], x[kind]), rect: x[kind === 'fh' ? 'rh' : 'rf'] === a[kind === 'fh' ? 'rh' : 'rf'] ? 'same' : [a.rh, x.rh], sy: [a.sy, bb.sy, x.sy], hov: x.hov, foc: x.foc }; } }
    out.rows.push(row); }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
  console.log(`== ${tag} ${vp} ${pg} ${mode} lenis=${A.lenis} errs=${JSON.stringify(out.errs)}`);
  for (const r of out.rows) { if (r.skip) { console.log(`#${r.i} ${r.cls} SKIP(invisible)`); continue; }
    const parts = [`#${r.i} ${r.cls.slice(0, 40)} hoverA=${r.hovA.hover} afterR=${r.hovA.afterR}/${r.hovA.hostR} fv=${r.focA.fv} focR=${r.focA.afterR}/${r.focA.hostR}`];
    for (const kind of ['fh', 'fff']) { const nz = r[kind + '_noise']; parts.push(`${kind === 'fh' ? 'HOV' : 'FOC'} noise=${nz.pct}`);
      for (const v of vars) { const x = r[kind + '_' + v]; const fl = Math.min(x.vsA.pct, x.vsB.pct) > nz.pct + 0.02 ? ' <<<' : '';
        parts.push(`${v}: A ${x.vsA.pct} B ${x.vsB.pct} r=${x.hov.afterR}|${x.foc.afterR}${x.rect === 'same' ? '' : ' RECT'}${fl}`); } }
    console.log(parts.join(' | ')); }
})().catch((e) => { console.error(e); process.exit(1); });
