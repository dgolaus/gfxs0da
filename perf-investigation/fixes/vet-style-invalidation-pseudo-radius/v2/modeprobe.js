// How often does each variant land in each sub-pixel text-raster "mode" for the hero CTA row?
// Load, settle, freeze (same as walk.js stop y=0), screenshot the CTA row, hash it. Variants interleaved.
// usage: node modeprobe.js <WxH> <mobile|-> <reps> <variant...>
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const L = require('./lib');
const [vp, mob, reps, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const OUT = path.join(__dirname, 'modeprobe', `${W}`); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const tally = {}; const rows = [];
  for (let k = 0; k < +reps; k++) for (const v of vars) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: W, h: H, mobile: mob === 'mobile' });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    await L.freeze(p);
    const r = await p.evaluate(() => { const el = document.querySelector('.hero .btn-ghost, .btn.btn-ghost.btn-lg'); const b = el.getBoundingClientRect(); return { x: Math.floor(b.left), y: Math.floor(b.top + scrollY), w: Math.ceil(b.width), h: Math.ceil(b.height) }; });
    const f = path.join(OUT, `${v}_${k}.png`);
    await p.screenshot({ path: f, clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
    const buf = await require('/home/user/gfxs0da/node_modules/sharp')(f).raw().toBuffer();
    const h = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
    await b.close();
    (tally[v] = tally[v] || {})[h] = (tally[v][h] || 0) + 1;
    rows.push({ v, k, h, r }); console.log(v, k, h, JSON.stringify(r));
  }
  console.log('TALLY', JSON.stringify(tally));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ tally, rows }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
