// node cmp.js <dir> <out.png> <fileA> <fileB> [<fileC>] : side-by-side + heat
const sharp = require('/home/user/gfxs0da/node_modules/sharp'); const path = require('path');
const [dir, out, ...fs] = process.argv.slice(2);
(async () => { const ims = []; let W = 0, H = 0;
  for (const f of fs) { const m = await sharp(path.join(dir, f)).metadata(); W += m.width + 6; H = Math.max(H, m.height); ims.push({ f, m }); }
  const A = await sharp(path.join(dir, fs[0])).raw().ensureAlpha().toBuffer({ resolveWithObject: true }); const B = await sharp(path.join(dir, fs[fs.length - 1])).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const n = A.info.width * A.info.height; const heat = Buffer.alloc(n * 3); for (let i = 0; i < n; i++) { const o = i * 4; const d = (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2])) / 3; heat[i * 3] = Math.min(255, d * 6); heat[i * 3 + 1] = d > 8 ? 255 : 0; }
  const hp = await sharp(heat, { raw: { width: A.info.width, height: A.info.height, channels: 3 } }).png().toBuffer();
  let x = 0; const comp = []; for (const im of ims) { comp.push({ input: path.join(dir, im.f), left: x, top: 0 }); x += im.m.width + 6; }
  comp.push({ input: hp, left: x, top: 0 }); W += A.info.width;
  await sharp({ create: { width: W, height: H, channels: 3, background: '#00ff00' } }).composite(comp).png().toFile(out);
})();
