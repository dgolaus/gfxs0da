// node hover.js <WxH> <page> <variant...>
// Desktop hover + focus-while-hover states. v2: every animation is paused right after the hover; then btnSheen,
// focusPop and every CSSTransition are set to local time ts, every other animation to 5000 (deterministic by name/type). Shots are clipped to the element +-48px.
const fs = require('fs'); const path = require('path');
const { L, withPage, compare, out } = require('./dv');
const [vp, pg, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const OUT = out(`hover_${vp}_${pg.replace(/\W+/g, '_') || 'root'}${process.env.TAG || ''}`);
const BTN_TS = [0, 80, 160, 250, 350, 450, 600, 750, 899];
const CARD_TS = [60, 150, 250, 5000];

async function run(v, label) {
  return withPage(v, { w: W, h: H }, async (p) => {
    await p.goto(L.BASE + pg, { waitUntil: 'load' });
    await L.settle(p, 2500);
    const targets = await p.evaluate(() => {
      const t = [];
      document.querySelectorAll('.btn').forEach((e, i) => { const r = e.getBoundingClientRect(); if (r.width && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.lightbox')) t.push({ sel: '.btn', i, kind: 'btn' }); });
      document.querySelectorAll('.price-card').forEach((e, i) => t.push({ sel: '.price-card', i, kind: 'card' }));
      document.querySelectorAll('.quote:not([aria-hidden])').forEach((e, i) => t.push({ sel: '.quote:not([aria-hidden])', i, kind: 'card' }));
      return t;
    });
    const shots = [];
    for (const tg of targets) {
      for (const focus of tg.kind === 'btn' ? [false, true] : [false]) {
        await p.mouse.move(W - 3, H - 3);
        await p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); for (const a of document.getAnimations()) { try { a.play(); } catch (e) {} } });
        // scroll target to centre (Lenis immediate), let scroll-driven JS settle
        await p.evaluate(({ sel, i }) => {
          const e = document.querySelectorAll(sel)[i]; const r = e.getBoundingClientRect();
          const y = Math.max(0, Math.round(scrollY + r.top + r.height / 2 - innerHeight / 2));
          if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
        }, tg);
        await L.w8(1300);
        // freeze everything at 5000
        await p.evaluate(() => {
          document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
          for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} }
        });
        await L.w8(150);
        const box = await p.evaluate(({ sel, i }) => { const r = document.querySelectorAll(sel)[i].getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, tg);
        const vis = box.w > 0 && box.y + box.h / 2 > 0 && box.y + box.h / 2 < H && box.x + box.w / 2 > 0 && box.x + box.w / 2 < W;
        const key = `${tg.sel}#${tg.i}${focus ? '+focus' : ''}`;
        if (!vis) { shots.push({ key, skip: true, meta: { box } }); continue; }
        if (focus) {  // keyboard focus (focus-visible) via Tab from the previous focusable element
          await p.evaluate(({ sel, i }) => { const e = document.querySelectorAll(sel)[i]; e.focus({ preventScroll: true }); }, tg);
          await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); await p.keyboard.press('Tab');
        }
        await p.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5, { steps: 3 });
        // pause the hover-started animations immediately so they cannot finish and drop out
        await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); } catch (e) {} } });
        await L.w8(1200);  // pointer parallax / tilt loops converge (identical in all variants)
        // v3: the pointer-parallax loop stops within 0.05px of its target, and that residual depends on how many frames
        // ran between the synthetic pointer moves (wall clock) -> pin it like walk.js/bench.js do.
        await p.evaluate(() => { const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px'; }); await L.w8(150);
        const box2 = await p.evaluate(({ sel, i }) => { const e = document.querySelectorAll(sel)[i]; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, fv: e.matches(':focus-visible'), hv: e.matches(':hover') }; }, tg);
        const pad = 48; const clip = { x: Math.max(0, Math.floor(box.x - pad)), y: Math.max(0, Math.floor(box.y - pad)) };
        clip.width = Math.min(W - clip.x, Math.ceil(box.w + 2 * pad)); clip.height = Math.min(H - clip.y, Math.ceil(box.h + 2 * pad));
        for (const ts of tg.kind === 'btn' ? BTN_TS : CARD_TS) {
          const names = await p.evaluate((ts) => { const n = []; for (const a of document.getAnimations()) { try { a.pause(); const isT = !!a.transitionProperty; const hov = isT || a.animationName === 'btnSheen' || a.animationName === 'focusPop'; a.currentTime = hov ? ts : 5000; if (hov) n.push(a.animationName || 'T:' + a.transitionProperty + (a.effect && a.effect.pseudoElement || '')); } catch (e) {} } return n.sort(); }, ts);
          await L.w8(120);
          const f = path.join(OUT, `${label}_${key.replace(/[^\w]+/g, '_')}_${ts}.png`);
          // v3: CDP clip is in DOCUMENT coordinates (puppeteer captureBeyondViewport defaults to true) -> add scroll offset,
          // and capture from the viewport surface only.
          const so = await p.evaluate(() => [scrollX, scrollY]);
          await p.screenshot({ path: f, clip: { ...clip, x: clip.x + so[0], y: clip.y + so[1] }, captureBeyondViewport: false });
          shots.push({ key: `${key}@${ts}`, f, meta: { box: box2, names, sy: await p.evaluate(() => scrollY) } });
        }
      }
    }
    return shots.filter((s) => !s.skip).concat(shots.filter((s) => s.skip).map((s) => ({ ...s, f: null })));
  });
}

(async () => {
  const A = await run('baseline', 'A'); const B = await run('baseline', 'B');
  const Vs = {}; const errs = { A: A.errs, B: B.errs };
  for (const v of vars) { const r = await run(v, v); Vs[v] = r.r; errs[v] = r.errs; }
  const keep = (l) => l.filter((s) => s.f);
  const res = await compare(OUT, keep(A.r), keep(B.r), Object.fromEntries(Object.entries(Vs).map(([k, l]) => [k, keep(l)])));
  const skipped = A.r.filter((s) => !s.f).map((s) => s.key);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ vp, pg, errs, skipped, ...res }, null, 1));
  console.log(`== hover ${vp} ${pg} errs ${JSON.stringify(errs)} shots=${keep(A.r).length} skipped=${JSON.stringify(skipped)} flagged=${JSON.stringify(res.flagged)}`);
  for (const r of res.rows) {
    const s = vars.map((v) => `${v}: A ${r[v].vsA ? r[v].vsA.mad + '/' + r[v].vsA.pct : r[v].error} B ${r[v].vsB ? r[v].vsB.mad + '/' + r[v].vsB.pct : ''}${r[v].metaSame ? '' : ' META'}${r[v].flag ? ' <<<' : ''}`).join(' | ');
    if (r.noise.pct > 0 || / <<<|META/.test(s) || /@(0|350|5000)$/.test(r.key)) console.log(`${r.key} hv=${r.metaA.box.hv} fv=${r.metaA.box.fv} [${r.metaA.names.join(',')}] noise ${r.noise.mad}/${r.noise.pct} | ${s}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
