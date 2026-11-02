// node compose.js <dir> <y> [variant] [crop x,y,w,h] -> <dir>/cmp_<variant>_<y>.png : A | B | variant | |A-variant|x4
const sharp = require('/home/user/gfxs0da/node_modules/sharp'); const path = require('path');
const [dir, y, v = 'combined', crop] = process.argv.slice(2);
(async () => {
  const fs = [`A_${y}.png`, `B_${y}.png`, `${v}_${y}.png`].map((f) => path.join(dir, f));
  const ext = crop ? (() => { const [left, top, width, height] = crop.split(',').map(Number); return { left, top, width, height }; })() : null;
  const load = async (f) => { let s = sharp(f); if (ext) s = s.extract(ext); return s.removeAlpha().raw().toBuffer({ resolveWithObject: true }); };
  const [A, B, C] = await Promise.all(fs.map(load)); const { width: W, height: H } = A.info;
  const D = Buffer.alloc(W * H * 3); for (let i = 0; i < W * H * 3; i++) D[i] = Math.min(255, Math.abs(A.data[i] - C.data[i]) * 4);
  const D2 = Buffer.alloc(W * H * 3); for (let i = 0; i < W * H * 3; i++) D2[i] = Math.min(255, Math.abs(A.data[i] - B.data[i]) * 4);
  const tiles = [A.data, B.data, C.data, D, D2];
  const out = sharp({ create: { width: W * 5 + 40, height: H, channels: 3, background: '#0f0' } }).composite(tiles.map((d, i) => ({ input: d, raw: { width: W, height: H, channels: 3 }, left: i * (W + 10), top: 0 })));
  const o = path.join(dir, `cmp_${v}_${y}${crop ? '_crop' : ''}.png`); await out.png().toFile(o); console.log(o);
})();
