// In-page A/B for `#pricing { contain: paint }` on the BASELINE page: same load, same frozen state,
// shot N (no contain) -> shot C (inline contain:paint) -> shot N2 (removed). N vs N2 = toggle noise.
// Scenes: top edge (float phases), reveal mid-states, bottom edge, hover each card (mid + final), scroll-fade --leave values.
// node toggle.js <tag> <WxH> <flags:mobile,reduced> [page=/]
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, vp, flagsS, page = '/'] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number);
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
  console.log(`${name.padEnd(30)} noise ${noise.px}/${noise.max} | C-N ${d.px}/${d.max} ${JSON.stringify(d.bbox)} | C-N2 ${d2.px}/${d2.max}${flag}`);
  if (!flag) for (const s of ['N', 'C', 'N2']) fs.unlinkSync(f(s));
}
const scrollTo = (p, y) => p.evaluate((y) => window.scrollTo(0, y), y);
(async () => {
  const b = await L.launch(); const { p } = await L.open(b, 'baseline', { w: W, h: H, mobile: flags.has('mobile'), reduced: flags.has('reduced') });
  await p.goto(L.BASE + page, { waitUntil: 'load' }); await L.settle(p, 2500);
  const g = await p.evaluate(() => { const r = document.getElementById('pricing').getBoundingClientRect(); return { top: r.top + scrollY, bot: r.bottom + scrollY, max: document.documentElement.scrollHeight - innerHeight, lenis: !!window.lenis }; });
  console.log('geom', JSON.stringify(g));
  for (let y = g.top - H; y < g.bot; y += H / 2) { await scrollTo(p, y); await L.w8(300); }
  if (page !== '/') {
    // generic: walk the whole page, frozen, both modes
    for (let y = 0; y <= g.max + H / 2; y += Math.round(H / 2)) { const yy = Math.min(y, g.max); await scrollTo(p, yy); await L.w8(700); for (const mode of ['pause', 'slow']) { await freezeAt(p, mode, 3000, null); await ab(p, `walk${yy}_${mode}`, mode); await release(p); } }
    await b.close(); fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(rows, null, 1)); return;
  }
  await scrollTo(p, Math.round(g.top - H * 0.35)); await L.w8(1200);
  for (const mode of ['pause', 'slow']) for (const T of [0, 1100, 2200, 3300, 4400, 5500, 6600, 7700]) { await freezeAt(p, mode, T, null); await ab(p, `top_${mode}_${T}`, mode); await release(p); }
  for (const mode of ['pause', 'slow']) {
    await p.evaluate(() => { const els = [...document.querySelectorAll('#pricing .reveal')]; for (const el of els) { el.classList.remove('is-in'); el.style.transition = 'none'; } void document.body.offsetWidth; for (const el of els) el.style.transition = ''; void document.body.offsetWidth; for (const el of els) el.classList.add('is-in'); });
    await L.w8(20);
    for (const tt of [0, 40, 80, 120, 160, 200, 260, 330, 400, 500, 600, 750, 900, 1100]) { await freezeAt(p, mode, 3000, tt); await ab(p, `reveal_${mode}_${tt}`, mode); }
    await release(p); await p.evaluate(() => { for (const a of document.getAnimations()) if (a instanceof CSSTransition) a.finish(); }); await L.w8(200);
  }
  await scrollTo(p, Math.round(g.bot - H * 0.75)); await L.w8(1200);
  for (const mode of ['pause', 'slow']) for (const T of [0, 1700, 3400, 5100]) { await freezeAt(p, mode, T, null); await ab(p, `bot_${mode}_${T}`, mode); await release(p); }
  const cards = await p.evaluate(() => [...document.querySelectorAll('#pricing .price-card')].map((c) => { const r = c.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; }));
  for (let k = 0; k < cards.length; k++) for (const pos of ['center', 'bottom', 'topedge']) {
    const y = pos === 'center' ? Math.round(cards[k].top + cards[k].h / 2 - H / 2) : pos === 'bottom' ? Math.round(g.bot - H * 0.75) : Math.round(g.top - 40);
    await p.mouse.move(2, 2); await scrollTo(p, y); await L.w8(800);
    const box = await p.evaluate((k) => { const r = document.querySelectorAll('#pricing .price-card')[k].getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: Math.max(r.top + 30, Math.min(r.bottom - 30, innerHeight - 10)), vis: r.bottom > 30 && r.top < innerHeight - 30 }; }, k);
    if (!box.vis) continue;
    await p.mouse.move(box.x, box.y); await L.w8(20);
    for (const tt of [30, 90, 160, 240]) { await freezeAt(p, 'pause', 2000, tt); await ab(p, `hover${k + 1}_${pos}_mid${tt}`, 'pause'); }
    await release(p); await L.w8(1000);
    for (const mode of ['pause', 'slow']) { await freezeAt(p, mode, 2000, null); await ab(p, `hover${k + 1}_${pos}_${mode}`, mode); await release(p); }
  }
  await p.mouse.move(2, 2); await L.w8(600);
  for (const lv of [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]) {
    await scrollTo(p, Math.round(g.bot - H * 0.30 * (1 - lv))); await L.w8(800);
    for (const mode of ['pause', 'slow']) { await freezeAt(p, mode, 2000, null); await ab(p, `leave${lv}_${mode}`, mode); await release(p); }
    // mid scroll-fade transition (0.18s) frozen part-way
    await scrollTo(p, Math.round(g.bot - H * 0.30 * (1 - lv)) + 40); await L.w8(40); await freezeAt(p, 'pause', 2000, 60); await ab(p, `leave${lv}_midtrans`, 'pause'); await release(p); await L.w8(400);
  }
  const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
  await b.close();
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ g, errs, rows }, null, 1));
  console.log('rows', rows.length, 'aboveNoise', rows.filter((r) => Math.min(r.d.px, r.d2.px) > r.noise.px).length, 'errs', JSON.stringify(errs));
})().catch((e) => { console.error(e); process.exit(1); });
