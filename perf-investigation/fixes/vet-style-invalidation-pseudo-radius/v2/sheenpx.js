// Pixel test of the .btn::after sheen (and quote/price ::after glow) in hover, focus-visible and
// hover+focus-visible, pinned at several sheen times. Clips each host (+12px). A, B (noise), variants.
// usage: node sheenpx.js <WxH> <mobile|-> <page> <variant...>
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [vp, mob, pg, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const tag = `${W}${(pg.replace(/[^a-z0-9]/g, '') || 'index')}`;
const OUT = path.join(__dirname, 'sheen', tag); fs.mkdirSync(OUT, { recursive: true });
const SC = [
  { st: ['hover'], ts: [150, 300, 500, 750] },
  { st: ['focus', 'focus-visible'], ts: [0] },
  { st: ['hover', 'focus', 'focus-visible'], ts: [100, 200, 300, 400, 500, 650, 800] },
];

async function run(vname, label) {
  const b = await L.launch();
  const { p, c } = await L.open(b, vname, { w: W, h: H, mobile: mob === 'mobile' });
  await p.goto(L.BASE + pg, { waitUntil: 'load' });
  await L.settle(p, 2500);
  await c.send('DOM.enable'); await c.send('CSS.enable');
  const { root } = await c.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await c.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '.btn, .quote, .price-card' });
  const n = nodeIds.length; const shots = [];
  for (let i = 0; i < n; i++) {
    const ok = await p.evaluate((i) => {
      const el = document.querySelectorAll('.btn, .quote, .price-card')[i];
      const tr = el.closest('.tcol-track'); if (tr && [...tr.children].indexOf(el) > 1) return false;
      const r = el.getBoundingClientRect(); if (!r.width) return false;
      const y = r.top + scrollY - innerHeight / 2 + r.height / 2;
      if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
      return true;
    }, i);
    if (!ok) continue;
    await L.w8(900);
    for (const [si, sc] of SC.entries()) {
      await c.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: sc.st });
      await L.w8(150);
      for (const t of sc.ts) {
        const clip = await p.evaluate((i, t) => {
          const el = document.querySelectorAll('.btn, .quote, .price-card')[i];
          el.style.setProperty('--mx', '8%'); el.style.setProperty('--my', '10%');
          document.querySelectorAll('.counter').forEach((e) => { const v = parseFloat(e.dataset.value), d = parseInt(e.dataset.decimals || '0', 10); e.textContent = `${e.dataset.prefix || ''}${v.toFixed(d)}${e.dataset.suffix || ''}`; });
          for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = (a.animationName === 'btnSheen' || a.animationName === 'focusPop') ? t : 5000; } catch (e) {} }
          const r = el.getBoundingClientRect();
          const x = Math.max(0, Math.floor(r.left - 12)), y = Math.max(0, Math.floor(r.top - 12));
          return { x, y, width: Math.min(innerWidth - x, Math.ceil(r.width + 24)), height: Math.min(innerHeight - y, Math.ceil(r.height + 24)), cls: el.className };
        }, i, t);
        await L.w8(200);
        const f = path.join(OUT, `${label}_${i}_${si}_${t}.png`);
        await p.screenshot({ path: f, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height } });
        shots.push({ i, si, t, st: sc.st.join('+'), cls: clip.cls, f });
        await L.unfreeze(p);
      }
      await c.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: [] });
      await L.w8(500);
    }
  }
  await b.close();
  return shots;
}
(async () => {
  const A = await run('baseline', 'A'); const B = await run('baseline', 'B');
  const R = { tag, rows: [] };
  const V = {}; for (const v of vars) V[v] = await run(v, v);
  for (let k = 0; k < A.length; k++) {
    const a = A[k]; const row = { i: a.i, st: a.st, t: a.t, cls: a.cls, noise: await L.diff(a.f, B[k].f) };
    for (const v of vars) {
      const x = V[v][k]; if (!x || x.i !== a.i || x.t !== a.t) { row[v] = 'misaligned'; continue; }
      row[v] = { vsA: await L.diff(a.f, x.f, path.join(OUT, `heat_${v}_${a.i}_${a.st}_${a.t}.png`)), vsB: await L.diff(B[k].f, x.f) };
    }
    R.rows.push(row);
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(R, null, 1));
  for (const r of R.rows) {
    const parts = vars.map((v) => { const x = r[v]; if (typeof x === 'string') return v + ':' + x; const bad = Math.min(x.vsA.pct, x.vsB.pct) > r.noise.pct; return `${v} ${x.vsA.mad}/${x.vsA.pct}% bb=${JSON.stringify(x.vsA.bbox)}${bad ? ' <<<' : ''}`; });
    if (parts.some((s) => s.includes('<<<')) || r.noise.pct > 0) console.log(`[${r.cls}] ${r.st}@${r.t} noise=${r.noise.mad}/${r.noise.pct}%`, parts.join(' | '));
  }
  console.log('rows', R.rows.length, 'flagged', R.rows.filter((r) => vars.some((v) => typeof r[v] !== 'string' && Math.min(r[v].vsA.pct, r[v].vsB.pct) > r.noise.pct)).length);
})().catch((e) => { console.error(e); process.exit(1); });
