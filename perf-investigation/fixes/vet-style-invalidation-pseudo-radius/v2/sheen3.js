// Real-pixel test of the btnSheen sweep while the button is keyboard-focused (:focus-visible -> host radius 4px).
// For each .btn: force hover (+focus+focus-visible), then for t = 0..900 step 50 restart the forced state so a fresh
// btnSheen exists, pause it at t (everything else at 5000) and shoot the button (document-coordinate clip).
// usage: node sheen3.js <WxH> <mobile|-> <page> <variant...>
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [vp, mob, pg, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const tag = `${W}${(pg.replace(/[^a-z0-9]/g, '') || 'index')}`;
const OUT = path.join(__dirname, 'sheen3', tag); fs.mkdirSync(OUT, { recursive: true });
const TS = []; for (let t = 0; t <= 900; t += 50) TS.push(t);
const STATES = [['hover'], ['hover', 'focus', 'focus-visible']];

async function run(vname, label) {
  const b = await L.launch();
  const { p, c } = await L.open(b, vname, { w: W, h: H, mobile: mob === 'mobile' });
  await p.goto(L.BASE + pg, { waitUntil: 'load' });
  await L.settle(p, 2500);
  await c.send('DOM.enable'); await c.send('CSS.enable');
  const { root } = await c.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await c.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '.btn' });
  const shots = [];
  for (let i = 0; i < nodeIds.length; i++) {
    const ok = await p.evaluate((i) => {
      const el = document.querySelectorAll('.btn')[i]; const r = el.getBoundingClientRect(); if (!r.width) return false;
      const y = r.top + scrollY - innerHeight / 2;
      if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
      return true;
    }, i);
    if (!ok) continue;
    await L.w8(900);
    for (const [si, st] of STATES.entries()) {
      for (const t of TS) {
        await c.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: [] });
        await L.unfreeze(p); await L.w8(80);
        await c.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: st });
        const info = await p.evaluate((i, t) => {
          const el = document.querySelectorAll('.btn')[i];
          getComputedStyle(el, '::after').opacity; // flush style so the sheen animation exists
          let sheen = 0;
          for (const a of document.getAnimations()) { try { a.pause(); if (a.animationName === 'btnSheen') { a.currentTime = t; sheen++; } else if (a.animationName === 'focusPop') a.currentTime = 1000; else a.currentTime = 5000; } catch (e) {} }
          document.querySelectorAll('.counter').forEach((e) => { const v = parseFloat(e.dataset.value), d = parseInt(e.dataset.decimals || '0', 10); e.textContent = `${e.dataset.prefix || ''}${v.toFixed(d)}${e.dataset.suffix || ''}`; });
          const r = el.getBoundingClientRect();
          return { sheen, cls: el.className, afterR: getComputedStyle(el, '::after').borderTopLeftRadius, hostR: getComputedStyle(el).borderTopLeftRadius,
            x: Math.floor(r.left + scrollX - 6), y: Math.floor(r.top + scrollY - 6), w: Math.ceil(r.width + 12), h: Math.ceil(r.height + 12) };
        }, i, t);
        await L.w8(120);
        const f = path.join(OUT, `${label}_${i}_${si}_${t}.png`);
        await p.screenshot({ path: f, clip: { x: info.x, y: info.y, width: info.w, height: info.h }, captureBeyondViewport: false });
        shots.push({ i, si, t, st: st.join('+'), f, ...info });
      }
    }
    await c.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: [] });
  }
  await b.close();
  return shots;
}
(async () => {
  const A = await run('baseline', 'A'); const B = await run('baseline', 'B');
  const V = {}; for (const v of vars) V[v] = await run(v, v);
  const rows = [];
  for (let k = 0; k < A.length; k++) {
    const a = A[k]; const row = { i: a.i, cls: a.cls, st: a.st, t: a.t, sheenA: a.sheen, radiusA: a.afterR + '/' + a.hostR, noise: await L.diff(a.f, B[k].f) };
    for (const v of vars) { const x = V[v][k]; row[v] = { sheen: x.sheen, radius: x.afterR + '/' + x.hostR, vsA: await L.diff(a.f, x.f, path.join(OUT, `heat_${v}_${a.i}_${a.si}_${a.t}.png`)), vsB: await L.diff(B[k].f, x.f) }; }
    rows.push(row);
    const parts = vars.map((v) => { const x = row[v]; const bad = Math.min(x.vsA.pct, x.vsB.pct) > row.noise.pct; return `${v}[r ${x.radius} s${x.sheen}] ${x.vsA.mad}/${x.vsA.pct}%${bad ? ' bb=' + JSON.stringify(x.vsA.bbox) + ' <<<' : ''}`; });
    console.log(`#${row.i} [${row.cls}] ${row.st}@${row.t} A[r ${row.radiusA} s${row.sheenA}] noise=${row.noise.mad}/${row.noise.pct}%`, parts.join(' | '));
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(rows, null, 1));
  for (const v of vars) for (const s of ['hover', 'hover+focus+focus-visible']) console.log('SUMMARY', v, s, 'rows', rows.filter((r) => r.st === s).length, 'flagged', rows.filter((r) => r.st === s && Math.min(r[v].vsA.pct, r[v].vsB.pct) > r.noise.pct).length);
})().catch((e) => { console.error(e); process.exit(1); });
