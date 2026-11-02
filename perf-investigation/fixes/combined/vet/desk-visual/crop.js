// node crop.js <dir> <outpng> <left,top,w,h> <scale> <file...>   stacks crops vertically
const sharp = require('/home/user/gfxs0da/node_modules/sharp'); const path = require('path');
const [dir, outp, reg, sc, ...fs] = process.argv.slice(2); const [l, t, w, h] = reg.split(',').map(Number); const s = +sc;
(async () => { const im = await Promise.all(fs.map((f) => sharp(path.join(dir, f)).extract({ left: l, top: t, width: w, height: h }).resize(Math.round(w * s), Math.round(h * s), { kernel: 'nearest' }).png().toBuffer()));
  await sharp({ create: { width: Math.round(w * s), height: Math.round(h * s) * fs.length + 4 * fs.length, channels: 3, background: '#00f' } }).composite(im.map((b, i) => ({ input: b, left: 0, top: i * (Math.round(h * s) + 4) }))).png().toFile(outp); })();
