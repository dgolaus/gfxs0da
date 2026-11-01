// Pixel test with REAL input (no CSS.forcePseudoState): keyboard Tab gives the .btn :focus-visible, the real mouse
// hovers it. Two modes per button:
//  live: after the sheen and focusPop finished, nothing paused -> compositor-drawn steady state, 3 shots 300ms apart
//  pin : mouse leaves and re-enters (fresh btnSheen), then every animation is paused (btnSheen at t, others 5000)
// Also a 'kbd' row = focus-visible without hover (live), and 'hov' = hover only (live).
// usage: node px.js <WxH> <flags mobile,dpr2> <page> <variant...>
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [vp, flags = '', pg, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const F = new Set(flags.split(',').filter((x) => x && x !== '-'));
const tag = `${W}${F.has('dpr2') ? 'd2' : ''}${(pg.replace(/[^a-z0-9]/g, '') || 'index')}`;
const OUT = path.join(__dirname, 'px', tag); fs.mkdirSync(OUT, { recursive: true });
const TS = [0, 60, 120, 200, 300, 400, 500, 600, 700, 800];

async function run(vname, label) {
  const b = await L.launch();
  const { p } = await L.open(b, vname, { w: W, h: H, mobile: F.has('mobile'), dpr: F.has('dpr2') ? 2 : 1 });
  await p.goto(L.BASE + pg, { waitUntil: 'load' });
  await L.settle(p, 3000);
  const nb = await p.evaluate(() => document.querySelectorAll('.btn').length);
  const shots = [];
  const shoot = async (i, mode, t, k) => {
    const info = await p.evaluate((i) => {
      document.querySelectorAll('.counter').forEach((e) => { const v = parseFloat(e.dataset.value), d = parseInt(e.dataset.decimals || '0', 10); e.textContent = `${e.dataset.prefix || ''}${v.toFixed(d)}${e.dataset.suffix || ''}`; });
      const el = document.querySelectorAll('.btn')[i]; const r = el.getBoundingClientRect();
      return { fv: el.matches(':focus-visible'), hov: el.matches(':hover'), afterR: getComputedStyle(el, '::after').borderTopLeftRadius, hostR: getComputedStyle(el).borderTopLeftRadius,
        x: Math.floor(r.left + scrollX - 8), y: Math.floor(r.top + scrollY - 8), w: Math.ceil(r.width + 16), h: Math.ceil(r.height + 16) };
    }, i);
    const f = path.join(OUT, `${label}_${i}_${mode}_${t}_${k}.png`);
    await p.screenshot({ path: f, clip: { x: Math.max(0, info.x), y: Math.max(0, info.y), width: info.w, height: info.h } });
    shots.push({ i, mode, t, k, f, ...info });
  };
  for (let i = 0; i < nb; i++) {
    const r = await p.evaluate((i) => {
      const el = document.querySelectorAll('.btn')[i]; if (!el.getBoundingClientRect().width) return null;
      const y = el.getBoundingClientRect().top + scrollY - innerHeight / 2;
      if (window.lenis) window.lenis.scrollTo(Math.max(0, y), { immediate: true, force: true }); else scrollTo(0, Math.max(0, y));
      const rr = el.getBoundingClientRect(); return { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 };
    }, i);
    if (!r || r.y < 0 || r.y > H) continue;
    await L.w8(900);
    const kbdFocus = async () => {
      await p.evaluate((i) => {
        const el = document.querySelectorAll('.btn')[i];
        const all = [...document.querySelectorAll('a[href],button,[tabindex]:not([tabindex="-1"])')].filter((e) => !e.disabled && (e.getBoundingClientRect().width || e === el));
        const k = all.indexOf(el); if (k > 0) all[k - 1].focus({ preventScroll: true });
      }, i);
      await p.keyboard.press('Tab');
    };
    // hover only (live)
    await p.mouse.move(2, H - 2); await L.w8(200);
    await p.mouse.move(r.x, r.y, { steps: 3 }); await L.w8(1500);
    for (let k = 0; k < 2; k++) { await shoot(i, 'hov', 0, k); await L.w8(300); }
    // focus-visible only (live)
    await p.mouse.move(2, H - 2); await L.w8(300);
    await kbdFocus(); await L.w8(1200);
    for (let k = 0; k < 2; k++) { await shoot(i, 'kbd', 0, k); await L.w8(300); }
    // focus-visible + hover live
    await p.mouse.move(r.x, r.y, { steps: 3 }); await L.w8(1500);
    for (let k = 0; k < 2; k++) { await shoot(i, 'kbdhov', 0, k); await L.w8(300); }
    // pinned sheen with real focus + real hover
    for (const t of TS) {
      await p.mouse.move(2, H - 2); await L.w8(120);
      await p.mouse.move(r.x, r.y);
      await p.evaluate((t) => {
        document.querySelectorAll('.btn').forEach((e) => getComputedStyle(e, '::after').opacity);
        for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = a.animationName === 'btnSheen' ? t : (a.animationName === 'focusPop' ? 1000 : 5000); } catch (e) {} }
      }, t);
      await L.w8(150);
      await shoot(i, 'pin', t, 0);
      await L.unfreeze(p);
    }
    await p.mouse.move(2, H - 2); await p.mouse.click(2, H - 2); await L.w8(200);
  }
  await b.close();
  return shots;
}
(async () => {
  const A = await run('baseline', 'A'); const B = await run('baseline', 'B');
  const V = {}; for (const v of vars) V[v] = await run(v, v);
  const rows = []; const sum = {};
  for (let k = 0; k < A.length; k++) {
    const a = A[k]; const bb = B[k];
    if (!bb || bb.i !== a.i || bb.mode !== a.mode || bb.t !== a.t) { console.log('MISALIGNED', k); continue; }
    const noise = await L.diff(a.f, bb.f);
    const row = { i: a.i, mode: a.mode, t: a.t, k: a.k, A: `${a.afterR}/${a.hostR}${a.fv ? ' fv' : ''}${a.hov ? ' hov' : ''}`, noise };
    for (const v of vars) {
      const x = V[v][k]; const vsA = await L.diff(a.f, x.f, path.join(OUT, `heat_${v}_${a.i}_${a.mode}_${a.t}_${a.k}.png`)); const vsB = await L.diff(bb.f, x.f);
      const bad = Math.min(vsA.pct, vsB.pct) > noise.pct;
      row[v] = { st: `${x.afterR}/${x.hostR}${x.fv ? ' fv' : ''}${x.hov ? ' hov' : ''}`, vsA, vsB, bad };
      const s = (sum[v + ' ' + a.mode] = sum[v + ' ' + a.mode] || { rows: 0, flagged: 0 }); s.rows++; if (bad) s.flagged++;
    }
    rows.push(row);
    console.log(`#${row.i} ${row.mode}@${row.t}.${row.k} A[${row.A}] noise=${noise.mad}/${noise.pct}%`, vars.map((v) => `${v}[${row[v].st}] ${row[v].vsA.mad}/${row[v].vsA.pct}% vsB ${row[v].vsB.pct}%${row[v].bad ? ' bb=' + JSON.stringify(row[v].vsA.bbox) + ' <<<' : ''}`).join(' | '));
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(rows, null, 1));
  for (const [k, s] of Object.entries(sum)) console.log('SUMMARY', tag, k, 'rows', s.rows, 'flagged', s.flagged);
})().catch((e) => { console.error(e); process.exit(1); });
