// node repeat.js <tag> <WxH> <y> <clipX,clipY,clipW,clipH> <N> <variant...>
// Loads each variant N times (fresh browser each, interleaved), scrolls to y like walk.js, freezes, shoots the clip.
// Clusters shots by exact pixel hash -> shows whether a difference is a state that baseline also produces.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const { L, withPage, out } = require('./dv');
const [tag, vp, yS, clipS, nS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number); const Y = +yS; const N = +nS;
const [cx, cy, cw, ch] = clipS.split(',').map(Number);
const OUT = out(`repeat_${tag}`);
(async () => {
  const res = {}; const clusters = {};
  for (let k = 0; k < N; k++) for (const v of vars) {
    const f = path.join(OUT, `${v}_${k}.png`);
    const { r } = await withPage(v, { w: W, h: H, dpr: +(process.env.DPR || 1) }, async (p) => {
      await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
      await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, Y);
      await L.w8(1300); await L.freeze(p);
      await p.screenshot({ path: f, clip: { x: cx, y: cy, width: cw, height: ch } });
      return p.evaluate(() => ({ lenis: !!window.lenis }));
    });
    const raw = await sharp(f).raw().toBuffer(); const h = crypto.createHash('md5').update(raw).digest('hex').slice(0, 8);
    (res[v] = res[v] || []).push(h); (clusters[h] = clusters[h] || []).push(`${v}_${k}`);
    console.log(v, k, h, 'lenis=' + r.lenis);
  }
  const summary = Object.fromEntries(Object.entries(res).map(([v, hs]) => [v, hs.reduce((m, h) => (m[h] = (m[h] || 0) + 1, m), {})]));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ tag, vp, Y, clip: clipS, N, summary, clusters }, null, 1));
  console.log('SUMMARY', JSON.stringify(summary));
})().catch((e) => { console.error(e); process.exit(1); });
