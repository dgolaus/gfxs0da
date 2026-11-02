// node masked.js <outdir> <variant>  -- re-diff walk shots with timing-artefact elements masked (rects recorded per shot in masks.json)
// mask = union of rects of the known nondeterministic widgets, padded 24px; masked pixels copied from A into the other image.
const fs = require('fs'); const path = require('path');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const L = require('../lib');
const [dir, v] = process.argv.slice(2);
const masks = JSON.parse(fs.readFileSync(path.join(dir, 'masks.json'), 'utf8'));
async function apply(src, ref, rects, dst) {
  const meta = await sharp(src).metadata(); const W = meta.width, H = meta.height;
  let img = sharp(src).ensureAlpha(); const comps = [];
  for (const r of rects) {
    const left = Math.max(0, Math.floor(r.x - 24)), top = Math.max(0, Math.floor(r.y - 24));
    const width = Math.min(W - left, Math.ceil(r.w + 48)), height = Math.min(H - top, Math.ceil(r.h + 48));
    if (width <= 0 || height <= 0) continue;
    comps.push({ input: await sharp(ref).ensureAlpha().extract({ left, top, width, height }).toBuffer(), left, top });
  }
  await img.composite(comps).png().toFile(dst);
}
(async () => {
  const rows = [];
  for (const [y, m] of Object.entries(masks)) {
    const dpr = m.dpr || 1; const rects = m.rects.map((r) => ({ x: r.x * dpr, y: r.y * dpr, w: r.w * dpr, h: r.h * dpr }));
    const A = path.join(dir, `A_${y}.png`), B = path.join(dir, `B_${y}.png`), C = path.join(dir, `${v}_${y}.png`);
    const Bm = path.join(dir, `mB_${y}.png`), Cm = path.join(dir, `m${v}_${y}.png`);
    await apply(B, A, rects, Bm); await apply(C, A, rects, Cm);
    const noise = await L.diff(A, Bm); const d = await L.diff(A, Cm, path.join(dir, `mheat_${v}_${y}.png`));
    // B vs C masked the same way (copy B pixels into C under masks)
    const Cb = path.join(dir, `mb${v}_${y}.png`); await apply(C, B, rects, Cb); const dB = await L.diff(B, Cb);
    rows.push({ y, nrects: rects.length, noise, vsA: d, vsB: dB, flag: Math.min(d.pct, dB.pct) > noise.pct + 0.02 });
    console.log(`y=${y} masked(${rects.length}) noise ${noise.mad}/${noise.pct} | ${v} A ${d.mad}/${d.pct} B ${dB.mad}/${dB.pct} bb=${JSON.stringify(d.bbox)}${rows.at(-1).flag ? ' <<<' : ''}`);
  }
  fs.writeFileSync(path.join(dir, `masked_${v}.json`), JSON.stringify(rows, null, 1));
})();
