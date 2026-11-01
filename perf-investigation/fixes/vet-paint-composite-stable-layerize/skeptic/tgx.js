// In-page toggle of #pricing contain:paint (== c1440 rule at >=1440) on the BASELINE page, with DPR support and
// scenes the vetter did not run: hover-OUT mid-transition, card->card hover switch mid-transition (sibling blur
// in/out), keyboard Tab focus on each CTA, bottom edge at float phases, scroll-fade leave fine values.
// node tgx.js <tag> <WxH> <dpr> <flags:reduced,mobile> [page=/]
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, vp, dprS, flagsS, page = '/'] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number); const dpr = +dprS || 1;
const flags = new Set((flagsS || '').split(',').filter(Boolean));
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
const rows = [];
async function freezeAt(p, mode, T, tt) {
  await p.evaluate((mode, T, tt) => {
    document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
    const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
    for (const a of document.getAnimations()) {
      try { const isT = a instanceof CSSTransition; if (isT && tt == null) { a.finish(); continue; }
        if (mode === 'pause') a.pause(); a.currentTime = isT ? tt : T; if (mode === 'slow') { a.playbackRate = 1e-9; a.play(); } } catch (e) {}
    }
  }, mode, T, tt);
  await L.w8(mode === 'slow' ? 350 : 200);
}
async function release(p) { await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.playbackRate = 1; a.play(); } catch (e) {} } }); }
async function ab(p, name, mode) {
  const f = (s) => path.join(OUT, `${name}_${s}.png`);
  const setC = (on) => p.evaluate((on) => { document.getElementById('pricing').style.contain = on ? 'paint' : ''; }, on);
  await p.screenshot({ path: f('N') });
  await setC(true); await L.w8(mode === 'slow' ? 350 : 200); await p.screenshot({ path: f('C') });
  await setC(false); await L.w8(mode === 'slow' ? 350 : 200); await p.screenshot({ path: f('N2') });
  const noise = await L.xdiff(f('N'), f('N2')); const d = await L.xdiff(f('N'), f('C'), f('heat')); const d2 = await L.xdiff(f('N2'), f('C'));
  const row = { name, noise, d, d2 }; rows.push(row);
  const flag = Math.min(d.px, d2.px) > noise.px ? ' <<<' : '';
  console.log(`${name.padEnd(34)} noise ${noise.px}/${noise.max} | C-N ${d.px}/${d.max} ${JSON.stringify(d.bbox)} | C-N2 ${d2.px}/${d2.max}${flag}`);
  if (!flag) for (const s of ['N', 'C', 'N2']) fs.unlinkSync(f(s));
}
const scrollTo = (p, y) => p.evaluate((y) => window.scrollTo(0, y), y);
const cardBox = (p, k) => p.evaluate((k) => { const r = document.querySelectorAll('#pricing .price-card')[k].getBoundingClientRect(); return { x: r.left + r.width * 0.6, y: Math.max(r.top + 30, Math.min(r.bottom - 30, innerHeight - 10)) }; }, k);
(async () => {
  const b = await L.launch(); const { p } = await L.open(b, 'baseline', { w: W, h: H, dpr, mobile: flags.has('mobile'), reduced: flags.has('reduced') });
  await p.goto(L.BASE + page, { waitUntil: 'load' }); await L.settle(p, 2500);
  const g = await p.evaluate(() => { const q = document.getElementById('pricing'); const r = q.getBoundingClientRect(); return { top: r.top + scrollY, bot: r.bottom + scrollY, pb: getComputedStyle(q).paddingBottom, max: document.documentElement.scrollHeight - innerHeight, dpr: devicePixelRatio, iw: innerWidth }; });
  console.log('geom', JSON.stringify(g));
  for (let y = g.top - H; y < g.bot; y += H / 2) { await scrollTo(p, y); await L.w8(300); }
  if (page !== '/') {
    for (let y = 0; y <= g.max + H / 2; y += Math.round(H / 2)) { const yy = Math.min(y, g.max); await scrollTo(p, yy); await L.w8(700); for (const mode of ['pause', 'slow']) { await freezeAt(p, mode, 3000, null); await ab(p, `walk${yy}_${mode}`, mode); await release(p); } }
  } else {
    const yb = Math.round(g.bot - H * 0.75);
    await scrollTo(p, yb); await L.w8(1200);
    for (const mode of ['pause', 'slow']) for (const T of [0, 1100, 2200, 3300, 4400]) { await freezeAt(p, mode, T, null); await ab(p, `bot_${mode}_${T}`, mode); await release(p); }
    const n = await p.evaluate(() => document.querySelectorAll('#pricing .price-card').length);
    // hover-out mid transition
    for (let k = 0; k < n; k++) {
      await p.mouse.move(2, 2); await scrollTo(p, yb); await L.w8(700);
      const bx = await cardBox(p, k); await p.mouse.move(bx.x, bx.y); await L.w8(1100);
      await p.mouse.move(bx.x, 5); await L.w8(15); // leave all cards (above the grid)
      for (const tt of [20, 80, 150, 220, 300]) { await freezeAt(p, 'pause', 2000, tt); await ab(p, `hoverOut${k + 1}_t${tt}`, 'pause'); }
      await release(p); await L.w8(900);
    }
    // card -> card switch (sibling blur crossfade)
    for (const [a, c] of [[0, 3], [3, 0], [1, 2], [2, 1]]) {
      await p.mouse.move(2, 2); await scrollTo(p, yb); await L.w8(700);
      const A = await cardBox(p, a); await p.mouse.move(A.x, A.y); await L.w8(1100);
      const C = await cardBox(p, c); await p.mouse.move(C.x, C.y); await L.w8(15);
      for (const tt of [40, 120, 200]) { await freezeAt(p, 'pause', 2000, tt); await ab(p, `switch${a + 1}to${c + 1}_t${tt}`, 'pause'); }
      await release(p); await L.w8(1000); await freezeAt(p, 'slow', 2000, null); await ab(p, `switch${a + 1}to${c + 1}_settled`, 'slow'); await release(p);
    }
    // keyboard focus on each CTA (no mouse)
    await p.mouse.move(2, 2); await L.w8(600);
    const nctas = await p.evaluate(() => document.querySelectorAll('#pricing .price-cta').length);
    for (let k = 0; k < nctas; k++) {
      await p.evaluate((k) => { const a = document.querySelectorAll('#pricing .price-cta')[k]; a.blur(); }, k);
      // focus via keyboard so :focus-visible matches: focus previous focusable then Tab
      await p.evaluate((k) => { const prev = k === 0 ? document.querySelector('#pricing .section-head') : document.querySelectorAll('#pricing .price-cta')[k - 1]; if (k === 0) { prev.tabIndex = -1; } prev.focus({ preventScroll: true }); }, k);
      await p.keyboard.press('Tab'); await L.w8(150);
      const fv = await p.evaluate(() => { const a = document.activeElement; return a && a.className + ' fv=' + a.matches(':focus-visible'); });
      await scrollTo(p, yb); await L.w8(700);
      await freezeAt(p, 'slow', 2000, null); await ab(p, `focus${k + 1}_${fv.replace(/\W+/g, '')}`, 'slow'); await release(p);
    }
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); const s = document.querySelector('#pricing .section-head'); s.removeAttribute('tabindex'); });
    for (let i = 0; i <= 20; i++) { const lv = i / 20;
      await scrollTo(p, Math.round(g.bot - H * 0.30 * (1 - lv))); await L.w8(700);
      await freezeAt(p, 'slow', 2000, null); await ab(p, `leave${lv.toFixed(2)}`, 'slow'); await release(p);
    }
  }
  const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
  await b.close();
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ g, errs, rows }, null, 1));
  console.log('rows', rows.length, 'aboveNoise', rows.filter((r) => Math.min(r.d.px, r.d2.px) > r.noise.px).length, 'errs', JSON.stringify(errs));
})().catch((e) => { console.error(e); process.exit(1); });
