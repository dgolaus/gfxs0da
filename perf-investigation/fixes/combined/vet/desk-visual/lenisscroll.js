// node lenisscroll.js <WxH> <variant...>
// Deterministic mid-scroll Lenis screenshots. A prelude replaces requestAnimationFrame with a manual queue; each
// "frame" runs every queued callback with a synthetic timestamp (+16.667ms), then yields two REAL frames so native
// scroll events / IntersectionObservers fire. Lenis (driven by smooth-scroll.js's rAF loop), the accent-gradient LERP
// loop, --leave loop, nav pill and footer --fp all advance only by these frames, so frame k means the same Lenis
// progress in every run. CSS animations/transitions are frozen at 5000ms before each shot (same as walk.js).
const fs = require('fs'); const path = require('path');
const { L, withPage, compare, out } = require('./dv');
const [vp, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const OUT = out(`lenis_${vp}`);
const PRE = `(() => {
  const oR = window.requestAnimationFrame.bind(window), oC = window.cancelAnimationFrame.bind(window);
  let man = false, id = 1e7, T = 0; const q = new Map();
  window.requestAnimationFrame = (cb) => { if (!man) return oR(cb); const i = ++id; q.set(i, cb); return i; };
  window.cancelAnimationFrame = (i) => { if (q.has(i)) q.delete(i); else oC(i); };
  const real = () => new Promise((r) => oR(() => oR(r)));
  window.__manualOn = async () => { man = true; await real(); await real(); await real(); T = performance.now() + 200; return q.size; };
  window.__step = async (n) => { for (let k = 0; k < n; k++) { T += 1000 / 60; const cur = [...q]; q.clear(); for (const [, cb] of cur) { try { cb(T); } catch (e) { (window.__errs = window.__errs || []).push('step:' + e.message); } } await real(); } return q.size; };
})();`;
// scenarios: [name, start, action]; frames at which to shoot
const FRAMES = [3, 8, 14, 20, 28, 36, 45, 55, 65, 72, 80, 95, 120];
const SCEN = [
  ['top_to_process', 'top', 'process'],
  ['top_to_pricing_click', 'top', 'click:#pricing'],
  ['pricing_to_top_click', 'pricing', 'click:#top'],
  ['process_to_trust', 'process', 'trust'],
];

async function run(v, label) {
  return withPage(v, { w: W, h: H, pre: PRE }, async (p) => {
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    await p.mouse.move(W - 3, H / 2);
    const shots = [];
    const q0 = await p.evaluate(() => window.__manualOn());
    for (const [name, start, act] of SCEN) {
      // start position (real rAF still on)
      await p.evaluate((s) => { const y = s === 'top' ? 0 : Math.min(window.lenis.limit, Math.max(0, document.getElementById(s).getBoundingClientRect().top + scrollY - 80)); window.lenis.scrollTo(y, { immediate: true, force: true }); }, start);
      // 240 synthetic frames: accent LERP converges, idle loops sleep, reveals fire (real frames in between)
      await p.evaluate(() => window.__step(240));
      await p.evaluate((act) => {
        if (act.startsWith('click:')) { document.querySelector(`.nav a[href="${act.slice(6)}"]`).click(); return; }
        const dest = document.getElementById(act);
        const y = Math.min(window.lenis.limit, Math.max(0, dest.getBoundingClientRect().top + window.scrollY - 80));
        window.lenis.scrollTo(y, { duration: 1.2 });
      }, act);
      let f0 = 0;
      for (const fr of FRAMES) {
        await p.evaluate((n) => window.__step(n), fr - f0); f0 = fr;
        const meta = await p.evaluate(() => {
          document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
          for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} }
          const acc = [...document.querySelectorAll('.hero-title .accent > .accent-text, .process-text h2 .accent-soft > .accent-text')].map((e) => (e.style.backgroundImage.match(/at 50% ([-\d.]+)vh/) || [])[1]);
          const leave = ['about', 'process', 'trust', 'pricing'].map((id) => parseFloat(getComputedStyle(document.getElementById(id)).getPropertyValue('--leave')));
          const nav = getComputedStyle(document.getElementById('nav'));
          return { sy: Math.round(scrollY * 100) / 100, lp: Math.round(window.lenis.progress * 1e4) / 1e4, acc, leave, navp: parseFloat(nav.getPropertyValue('--nav-pill')), navbar: parseFloat(nav.getPropertyValue('--nav-bar-vis')), navpill: parseFloat(nav.getPropertyValue('--nav-pill-vis')), fp: parseFloat(getComputedStyle(document.querySelector('.cfooter')).getPropertyValue('--fp')) };
        });
        await new Promise((r) => setTimeout(r, 150));
        const f = path.join(OUT, `${label}_${name}_${fr}.png`);
        await p.screenshot({ path: f });
        shots.push({ key: `${name}@${fr}`, f, meta });
        await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) {} } });
      }
      await p.evaluate(() => window.__step(60));
    }
    return shots;
  });
}

(async () => {
  const A = await run('baseline', 'A'); const B = await run('baseline', 'B');
  const Vs = {}; const errs = { A: A.errs, B: B.errs };
  for (const v of vars) { const r = await run(v, v); Vs[v] = r.r; errs[v] = r.errs; }
  const res = await compare(OUT, A.r, B.r, Vs);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ vp, errs, ...res }, null, 1));
  console.log(`== lenis ${vp} errs ${JSON.stringify(errs)} flagged=${JSON.stringify(res.flagged)}`);
  for (const r of res.rows) console.log(`${r.key} ${JSON.stringify(r.metaA)} noise ${r.noise.mad}/${r.noise.pct} | ` + vars.map((v) => `${v}: A ${r[v].vsA.mad}/${r[v].vsA.pct} B ${r[v].vsB.mad}/${r[v].vsB.pct} bb=${JSON.stringify(r[v].vsA.bbox)}${r[v].metaSame ? '' : ' META=' + JSON.stringify(r[v].meta)}${r[v].flag ? ' <<<' : ''}`).join(' | '));
})().catch((e) => { console.error(e); process.exit(1); });
