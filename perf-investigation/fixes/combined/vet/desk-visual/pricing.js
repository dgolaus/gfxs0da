// node pricing.js <WxH> <variant...>
// #pricing edges (contain:paint at >=1440): top/bottom bands across priceFloat phases, --leave sweep, card hover lift.
const fs = require('fs'); const path = require('path');
const { L, withPage, compare, out } = require('./dv');
const [vp, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const OUT = out(`pricing_${vp}${process.env.TAG || ''}`);
const PHASES = [0, 1100, 2200, 3300, 4400, 5500, 6600, 7700];
const LEAVES = [0, 0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 1];

async function scrollTo(p, y) {
  await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); }, y);
  await L.w8(1300);
}
async function freeze(p, floatT) {
  return p.evaluate((ft) => {
    document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = (ft != null && /^priceFloat/.test(a.animationName || '')) ? ft : 5000; } catch (e) {} }
    const s = document.getElementById('pricing'); const r = s.getBoundingClientRect(); const cs = getComputedStyle(s);
    return { top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, sy: Math.round(scrollY * 10) / 10, leave: parseFloat(cs.getPropertyValue('--leave')), __contain: cs.contain, op: cs.opacity, filter: cs.filter, tf: cs.transform };
  }, floatT);
}
const thaw = (p) => p.evaluate(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) {} } });
const band = (c, H) => { const y = Math.max(0, Math.floor(c - 220)); return { x: 0, y, width: W, height: Math.min(H - y, 440) }; };

async function run(v, label) {
  return withPage(v, { w: W, h: H }, async (p) => {
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    await p.mouse.move(W - 3, 3);
    const g = await p.evaluate(() => { const r = document.getElementById('pricing').getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, max: document.documentElement.scrollHeight - innerHeight }; });
    const shots = [];
    const shoot = async (key, clip, meta) => { if (meta && meta.__contain !== undefined) { shots.contain = meta.__contain; delete meta.__contain; } const f = path.join(OUT, `${label}_${key}.png`); const so = await p.evaluate(() => [scrollX, scrollY]); await p.screenshot(clip ? { path: f, clip: { ...clip, x: clip.x + so[0], y: clip.y + so[1] }, captureBeyondViewport: false } : { path: f }); /* v2: clip is document-relative in CDP */ shots.push({ key, f, meta }); };
    // top band: section top at 45% of viewport
    await scrollTo(p, Math.round(g.top - H * 0.45));
    for (const ph of PHASES) { const m = await freeze(p, ph); await L.w8(150); await shoot(`top_ph${ph}`, band(m.top, H), m); await thaw(p); }
    // bottom band: section bottom at 60% (leave 0)
    await scrollTo(p, Math.min(g.max, Math.round(g.bottom - H * 0.6)));
    for (const ph of PHASES) { const m = await freeze(p, ph); await L.w8(150); await shoot(`bot_ph${ph}`, band(m.bottom, H), m); await thaw(p); }
    // --leave sweep: section bottom at fadeStart*(1-l)
    for (const l of LEAVES) {
      const y = Math.min(g.max, Math.round(g.bottom - H * 0.30 * (1 - l)));
      await scrollTo(p, y); const m = await freeze(p, 2200); await L.w8(150); await shoot(`leave${l}`, null, { ...m, want: y }); await thaw(p);
    }
    // card hover lift: cards centred in viewport
    const cards = await p.evaluate(() => document.querySelectorAll('#pricing .price-card').length);
    const gc = await p.evaluate(() => { const r = document.querySelector('#pricing .pricing-grid').getBoundingClientRect(); return r.top + scrollY + r.height / 2; });
    for (let i = 0; i < cards; i++) {
      await p.mouse.move(W - 3, 3); await scrollTo(p, Math.round(gc - H / 2));
      await freeze(p, 2200);
      const b = await p.evaluate((i) => { const r = document.querySelectorAll('#pricing .price-card')[i].getBoundingClientRect(); window.__bg = new Set(document.getAnimations()); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, i);
      await p.mouse.move(b.x + b.w / 2, b.y + b.h * 0.3, { steps: 3 });
      await p.evaluate(() => { for (const a of document.getAnimations()) if (!window.__bg.has(a)) { try { a.pause(); } catch (e) {} } });
      await L.w8(300);
      const s = await p.evaluate(() => { const r = document.getElementById('pricing').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
      const clip = { x: 0, y: Math.max(0, Math.floor(s.top)), width: W, height: Math.min(H, Math.ceil(s.bottom)) - Math.max(0, Math.floor(s.top)) };
      for (const ts of [60, 140, 5000]) {
        const names = await p.evaluate((ts) => { const n = []; for (const a of document.getAnimations()) if (!window.__bg.has(a)) { try { a.pause(); a.currentTime = ts; n.push(a.animationName || 'T:' + a.transitionProperty + (a.effect.pseudoElement || '')); } catch (e) {} } return n.sort().join(','); }, ts);
        await L.w8(150); await shoot(`hover${i}_${ts}`, clip, { names, s });
      }
      await thaw(p);
    }
    console.log(label, 'contain on #pricing =', shots.contain); return shots;
  });
}

(async () => {
  const A = await run('baseline', 'A'); const B = await run('baseline', 'B');
  const Vs = {}; const errs = { A: A.errs, B: B.errs };
  for (const v of vars) { const r = await run(v, v); Vs[v] = r.r; errs[v] = r.errs; }
  const res = await compare(OUT, A.r, B.r, Vs);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ vp, errs, ...res }, null, 1));
  console.log(`== pricing ${vp} errs ${JSON.stringify(errs)} flagged=${JSON.stringify(res.flagged)}`);
  for (const r of res.rows) console.log(`${r.key} ${JSON.stringify(r.metaA).slice(0, 150)} noise ${r.noise.mad}/${r.noise.pct} | ` + vars.map((v) => `${v}: A ${r[v].vsA.mad}/${r[v].vsA.pct} B ${r[v].vsB.mad}/${r[v].vsB.pct} bb=${JSON.stringify(r[v].vsA.bbox)}${r[v].metaSame ? '' : ' META=' + JSON.stringify(r[v].meta).slice(0, 200)}${r[v].flag ? ' <<<' : ''}`).join(' | '));
})().catch((e) => { console.error(e); process.exit(1); });
