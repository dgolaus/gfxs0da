// node intro.js <WxH> <mode: glob|bench> <variant...>
// glob: CDP Animation.setPlaybackRate(0) before navigation, so EVERY animation (incl. ones that would have finished
//       and dropped out of getAnimations) stays alive at local time 0; after settle each is set to t and shot.
// bench: same as bench.js visual (settle, then pause whatever is alive at currentTime t).
// A/A: baseline run twice in separate browsers.
const fs = require('fs'); const path = require('path');
const { L, withPage, compare, out } = require('./dv');
const [vp, mode, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const TIMES = [0, 100, 200, 350, 500, 700, 900, 1100, 1300, 1600, 1900, 2200, 2500, 2800, 3000, 5000];
const OUT = out(`intro_${mode}_${vp}`);

async function run(v, label) {
  return withPage(v, { w: W, h: H }, async (p, c) => {
    if (mode === 'glob') { await c.send('Animation.enable'); await c.send('Animation.setPlaybackRate', { playbackRate: 0 }); }
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    const shots = [];
    for (const t of TIMES) {
      const meta = await p.evaluate((t) => {
        document.querySelectorAll('.counter').forEach((el) => {
          const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
          el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
        });
        const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
        let n = 0; for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t; n++; } catch (e) {} }
        return { n, sy: scrollY, lenis: !!window.lenis, hoverNone: matchMedia('(hover: none)').matches };
      }, t);
      await L.w8(300);
      const f = path.join(OUT, `${label}_${t}.png`);
      await p.screenshot({ path: f });
      shots.push({ key: t, f, meta });
    }
    return shots;
  });
}

(async () => {
  const A = await run('baseline', 'A'); const B = await run('baseline', 'B');
  const Vs = {}; const errs = { A: A.errs, B: B.errs };
  for (const v of vars) { const r = await run(v, v); Vs[v] = r.r; errs[v] = r.errs; }
  const res = await compare(OUT, A.r, B.r, Vs);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ vp, mode, errs, ...res }, null, 1));
  console.log(`== intro ${mode} ${vp} errs ${JSON.stringify(errs)} lenis=${A.r[0].meta.lenis} hoverNone=${A.r[0].meta.hoverNone} flagged=${JSON.stringify(res.flagged)}`);
  for (const r of res.rows) console.log(`t=${r.key} n=${r.metaA.n} noise ${r.noise.mad}/${r.noise.pct} ` + vars.map((v) => `${v}: A ${r[v].vsA.mad}/${r[v].vsA.pct} B ${r[v].vsB.mad}/${r[v].vsB.pct} bb=${JSON.stringify(r[v].vsA.bbox)} n=${(r[v].meta || r.metaA).n}${r[v].flag ? ' <<<' : ''}`).join(' | '));
})().catch((e) => { console.error(e); process.exit(1); });
