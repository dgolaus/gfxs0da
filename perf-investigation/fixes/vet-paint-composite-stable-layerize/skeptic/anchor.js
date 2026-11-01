// Scroll anchoring probe: land at the #pricing bottom edge, then apply L.freeze at several T values and a layout
// change above the viewport (a 10px spacer at the top of <main>/body), logging scrollY after each step.
// If contain:paint changes which node Chrome uses as scroll anchor, the adjustments differ. node anchor.js <tag> <W> <reps> [W0]
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [tag, Ws, repsS, W0s] = process.argv.slice(2); const H = 900; const W = +Ws; const W0 = +(W0s || Ws);
(async () => {
  for (let r = 0; r < +repsS; r++) for (const v of (r % 2 ? ['c1440', 'baseline'] : ['baseline', 'c1440'])) {
    const b = await L.launch(); const { p } = await L.open(b, v, { w: W0, h: H });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    if (W0 !== W) { for (const w of [1440, 1024, 390, W]) { await p.setViewport({ width: w, height: H }); await L.w8(600); } }
    const g = await p.evaluate(() => { const q = document.getElementById('pricing').getBoundingClientRect(); return { top: q.top + scrollY, bot: q.bottom + scrollY }; });
    for (let y = g.top - H; y < g.bot; y += H / 2) { await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(250); }
    const tgt = Math.round(g.bot - H * 0.75); await p.evaluate((y) => window.scrollTo(0, y), tgt); await L.w8(1300);
    const log = [`land=${await p.evaluate(() => scrollY)}`];
    for (const T of [2000, 0, 1700, 3400, 5100]) { await L.freeze(p, T); log.push(`frz${T}=${await p.evaluate(() => scrollY)}`); await L.unfreeze(p); await L.w8(300); log.push(`run=${await p.evaluate(() => scrollY)}`); }
    await p.evaluate(() => { const d = document.createElement('div'); d.id = '__sp'; d.style.height = '10px'; document.body.prepend(d); }); await L.w8(300);
    log.push(`spacer+10=${await p.evaluate(() => scrollY)}`);
    await p.evaluate(() => document.getElementById('__sp').remove()); await L.w8(300);
    log.push(`spacer-10=${await p.evaluate(() => scrollY)}`);
    // layout change between hero and pricing: grow the testimonials section by 7px
    await p.evaluate(() => { const s = document.getElementById('testimonials') || document.querySelector('section'); s.style.paddingTop = (parseFloat(getComputedStyle(s).paddingTop) + 7) + 'px'; }); await L.w8(300);
    log.push(`mid+7=${await p.evaluate(() => scrollY)}`);
    console.log(`${tag} ${v} r${r} tgt=${tgt} ${log.join(' ')}`);
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
