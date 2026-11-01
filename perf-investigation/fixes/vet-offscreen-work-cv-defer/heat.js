const sharp = require('../node_modules/sharp');
(async () => {
  const [a, b, out] = process.argv.slice(2);
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = A.info; const n = w * h;
  const img = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) { const o = i * 4; const d = (Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2]))/3;
    const g = Math.round((A.data[o]+A.data[o+1]+A.data[o+2])/3*0.35);
    img[i*3] = d > 8 ? 255 : g; img[i*3+1] = d > 8 ? 0 : g; img[i*3+2] = d > 8 ? 0 : g; }
  await sharp(img, { raw: { width: w, height: h, channels: 3 } }).png().toFile(out);
})();
