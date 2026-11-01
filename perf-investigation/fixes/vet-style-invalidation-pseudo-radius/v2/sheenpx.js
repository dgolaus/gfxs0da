// Pixel test of the ::after of .btn/.quote/.price-card. Two modes per run:
//  real: unmodified page, host forced into a state, every animation pinned (btnSheen/focusPop at t, others at 5000)
//  iso : same, plus an identical-in-all-variants overlay stylesheet that paints the ::after solid white over a
//        black host with content hidden, so the screenshot is exactly the clipped shape of the pseudo (radius).
// Clips use DOCUMENT coordinates (puppeteer 24 clip = page coords). A, B (A/A noise), variants.
// usage: node sheenpx.js <WxH> <mobile|-> <page> <variant...>
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [vp, mob, pg, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const tag = `${W}${(pg.replace(/[^a-z0-9]/g, '') || 'index')}`;
const OUT = path.join(__dirname, 'sheen2', tag); fs.mkdirSync(OUT, { recursive: true });
const SEL = '.btn, .quote, .price-card';
const ISO = `
.iso-host { background: #000 !important; box-shadow: none !important; outline: none !important; border-color: transparent !important; color: transparent !important; filter: none !important; backdrop-filter: none !important; }
.iso-host > *, .iso-host::before { visibility: hidden !important; }
.iso-host::after { visibility: visible !important; background: #fff !important; opacity: 1 !important; translate: none !important; rotate: none !important; animation: none !important; transition: none !important; -webkit-mask-image: none !important; mask-image: none !important; }
`;
const SC = [
  { st: [], ts: [0] },
  { st: ['hover'], ts: [150, 300, 450, 650] },
  { st: ['focus', 'focus-visible'], ts: [0] },
  { st: ['hover', 'focus', 'focus-visible'], ts: [150, 300, 450, 650] },
];

async function run(vname, label) {
  const b = await L.launch();
  const { p, c } = await L.open(b, vname, { w: W, h: H, mobile: mob === 'mobile' });
  await p.goto(L.BASE + pg, { waitUntil: 'load' });
  await L.settle(p, 2500);
  await p.evaluate((css) => { const s = document.createElement('style'); s.id = 'iso'; s.textContent = css; document.head.appendChild(s); }, ISO);
  await c.send('DOM.enable'); await c.send('CSS.enable');
  const { root } = await c.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await c.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: SEL });
  const shots = [];
  for (let i = 0; i < nodeIds.length; i++) {
    const ok = await p.evaluate((i, SEL) => {
      const el = document.querySelectorAll(SEL)[i];
      const tr = el.closest('.tcol-track'); if (tr && [...tr.children].indexOf(el) > 0) return false;
      const r = el.getBoundingClientRect(); if (!r.width) return false;
      const y = r.top + scrollY - innerHeight / 2 + r.height / 2;
      if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
      return true;
    }, i, SEL);
    if (!ok) continue;
    await L.w8(900);
    for (const mode of ['real', 'iso']) {
      for (const [si, sc] of SC.entries()) {
        await c.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: sc.st });
        await L.w8(150);
        for (const t of sc.ts) {
          const clip = await p.evaluate((i, t, mode, SEL) => {
            const el = document.querySelectorAll(SEL)[i];
            el.classList.toggle('iso-host', mode === 'iso');
            el.style.setProperty('--mx', '8%'); el.style.setProperty('--my', '10%');
            document.querySelectorAll('.counter').forEach((e) => { const v = parseFloat(e.dataset.value), d = parseInt(e.dataset.decimals || '0', 10); e.textContent = `${e.dataset.prefix || ''}${v.toFixed(d)}${e.dataset.suffix || ''}`; });
            for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = (a.animationName === 'btnSheen' || a.animationName === 'focusPop') ? t : 5000; } catch (e) {} }
            const r = el.getBoundingClientRect();
            const x = Math.max(0, Math.floor(r.left + scrollX - 8)), y = Math.max(0, Math.floor(r.top + scrollY - 8));
            return { x, y, width: Math.ceil(r.width + 16), height: Math.ceil(r.height + 16), cls: el.className.replace(' iso-host', ''), view: [Math.round(r.left), Math.round(r.top)] };
          }, i, t, mode, SEL);
          await L.w8(200);
          const f = path.join(OUT, `${label}_${mode}_${i}_${si}_${t}.png`);
          await p.screenshot({ path: f, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height }, captureBeyondViewport: false });
          shots.push({ i, si, t, mode, st: sc.st.join('+') || 'rest', cls: clip.cls, f });
          await L.unfreeze(p);
        }
        await c.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: [] });
        await p.evaluate((i, SEL) => document.querySelectorAll(SEL)[i].classList.remove('iso-host'), i, SEL);
        await L.w8(400);
      }
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
    const a = A[k]; const row = { i: a.i, mode: a.mode, st: a.st, t: a.t, cls: a.cls, noise: await L.diff(a.f, B[k].f) };
    for (const v of vars) {
      const x = V[v][k]; if (!x || x.i !== a.i || x.t !== a.t || x.mode !== a.mode) { row[v] = 'misaligned'; continue; }
      row[v] = { vsA: await L.diff(a.f, x.f, path.join(OUT, `heat_${v}_${a.mode}_${a.i}_${a.si}_${a.t}.png`)), vsB: await L.diff(B[k].f, x.f) };
    }
    R.rows.push(row);
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(R, null, 1));
  for (const r of R.rows) {
    const parts = vars.map((v) => { const x = r[v]; if (typeof x === 'string') return v + ':' + x; const bad = Math.min(x.vsA.pct, x.vsB.pct) > r.noise.pct; return `${v} ${x.vsA.mad}/${x.vsA.pct}%${bad ? ' bb=' + JSON.stringify(x.vsA.bbox) + ' <<<' : ''}`; });
    console.log(`${r.mode} #${r.i} [${r.cls}] ${r.st}@${r.t} noise=${r.noise.mad}/${r.noise.pct}%`, parts.join(' | '));
  }
  for (const v of vars) for (const mode of ['real', 'iso']) console.log('SUMMARY', v, mode, 'rows', R.rows.filter((r) => r.mode === mode).length, 'flagged', R.rows.filter((r) => r.mode === mode && typeof r[v] !== 'string' && Math.min(r[v].vsA.pct, r[v].vsB.pct) > r.noise.pct).length);
})().catch((e) => { console.error(e); process.exit(1); });
