// node hovernat.js <WxH> <btnIndex> <N> <variant...>  (env DPR)
// Natural hover: Lenis real wheel scroll until the .btn is near mid-viewport, pointer moved onto it in steps, NOTHING frozen,
// wait 2.5s (sheen over), clip-screenshot the button (viewport clip). Then a rest shot after moving the pointer away (2.5s).
// Census of pixel hashes + horizontal text-centroid of the label.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const L = require('../../lib');
const [vp, iS, nS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number); const I = +iS; const N = +nS; const DPR = +(process.env.DPR || 1);
const OUT = path.join(__dirname, 'out', `hovernat_${vp}_dpr${DPR}_btn${I}${process.env.TAG || ''}`); fs.mkdirSync(OUT, { recursive: true });
async function centroid(f) {
  const { data, info } = await sharp(f).greyscale().raw().toBuffer({ resolveWithObject: true });
  let s = 0, sx = 0; for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const v = data[y * info.width + x]; if (v > 120) { s += v; sx += v * x; } }
  return s ? +(sx / s).toFixed(3) : null;
}
(async () => {
  const rows = [];
  for (let k = 0; k < N; k++) for (const v of vars) {
    const b = await L.launch({});
    try {
      const { p } = await L.open(b, v, { w: W, h: H, dpr: DPR });
      await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
      await p.mouse.move(W - 30, 30);
      for (let j = 0; j < 80; j++) {
        const top = await p.evaluate((i) => document.querySelectorAll('.btn')[i].getBoundingClientRect().top, I);
        if (top < H * 0.6) break;
        await p.mouse.wheel({ deltaY: 100 }); await L.w8(90);
      }
      await L.w8(2000);
      const r = await p.evaluate((i) => { const e = document.querySelectorAll('.btn')[i]; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, t: e.textContent.trim() }; }, I);
      const clip = { x: Math.floor(r.x) - 8, y: Math.floor(r.y) - 8, width: Math.ceil(r.w) + 16, height: Math.ceil(r.h) + 16 };
      const so = await p.evaluate(() => [scrollX, scrollY]);
      const sh = async (name) => { const f = path.join(OUT, `${v}_${k}_${name}.png`); await p.screenshot({ path: f, clip: { ...clip, x: clip.x + so[0], y: clip.y + so[1] }, captureBeyondViewport: false }); const h = crypto.createHash('md5').update(await sharp(f).raw().toBuffer()).digest('hex').slice(0, 8); return { f, h, cx: await centroid(f) }; };
      const rest = await sh('rest');
      await p.mouse.move(r.x + r.w / 2, r.y + r.h / 2, { steps: 6 }); await L.w8(2500);
      const hov = await sh('hover');
      const lay = await p.evaluate((i) => { const e = document.querySelectorAll('.btn')[i]; return { anims: document.getAnimations().filter((a) => a.effect && a.effect.target && (a.effect.target === e || e.contains(a.effect.target))).map((a) => (a.animationName || a.transitionProperty) + ':' + a.playState), hov: e.matches(':hover') }; }, I);
      await p.mouse.move(W - 30, 30, { steps: 4 }); await L.w8(2500);
      const after = await sh('after');
      rows.push({ v, k, label: r.t, rest, hov, after, lay });
      console.log(v, k, JSON.stringify(r.t), 'rest', rest.h, rest.cx, '| hover', hov.h, hov.cx, '| after', after.h, after.cx, JSON.stringify(lay));
    } finally { await b.close(); }
  }
  const census = (key) => { const c = {}; for (const r of rows) { (c[r.v] = c[r.v] || {})[r[key].h] = (c[r.v][r[key].h] || 0) + 1; } return c; };
  for (const key of ['rest', 'hov', 'after']) console.log('CENSUS', key, JSON.stringify(census(key)));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(rows, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
