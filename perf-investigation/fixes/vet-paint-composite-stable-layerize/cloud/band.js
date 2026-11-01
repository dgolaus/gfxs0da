// node band.js <outdir> <prefixRegex> <top> <height> [variant]  -> exact diffs in a horizontal band
const L = require('./lib'); const fs = require('fs'); const path = require('path');
const [dir, rx, top, hgt, v = 'stab'] = process.argv.slice(2);
(async () => {
  const names = fs.readdirSync(dir).filter((f) => f.startsWith('A__') && new RegExp(rx).test(f)).map((f) => f.slice(3, -4));
  const sharp = require('/home/user/gfxs0da/node_modules/sharp');
  for (const n of names) {
    const meta = await sharp(path.join(dir, `A__${n}.png`)).metadata();
    const region = { left: 0, top: +top, width: meta.width, height: Math.min(+hgt, meta.height - +top) };
    const f = (x) => path.join(dir, `${x}__${n}.png`);
    if (!fs.existsSync(f(v))) continue;
    const ab = await L.xdiff(f('A'), f('B'), null, region), av = await L.xdiff(f('A'), f(v), null, region), bv = await L.xdiff(f('B'), f(v), null, region);
    const flag = Math.min(av.px, bv.px) > ab.px ? ' <<<' : '';
    console.log(n.padEnd(26), 'AB', ab.px + '/' + ab.max, '| A-' + v, av.px + '/' + av.max, JSON.stringify(av.bbox), '| B-' + v, bv.px + '/' + bv.max + flag);
  }
})();
