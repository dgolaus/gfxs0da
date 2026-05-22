// One-shot image optimizer for assets/work/ thumbnails
// Converts PNGs to WebP at quality 85, max dimension 1920px on long edge.
// Run: node optimize-images.js

const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'assets', 'work');
const MAX_DIM = 1920;
const QUALITY = 85;

async function main() {
  const files = await fs.readdir(SRC_DIR);
  const images = files.filter((f) => /\.(png|jpe?g)$/i.test(f));

  console.log(`Found ${images.length} images to optimize.\n`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of images) {
    const srcPath = path.join(SRC_DIR, file);
    const baseName = file.replace(/\.(png|jpe?g)$/i, '');
    const outPath = path.join(SRC_DIR, `${baseName}.webp`);

    const srcStat = await fs.stat(srcPath);
    const srcSize = srcStat.size;
    totalBefore += srcSize;

    const meta = await sharp(srcPath).metadata();
    const longEdge = Math.max(meta.width || 0, meta.height || 0);
    const needsResize = longEdge > MAX_DIM;

    let pipeline = sharp(srcPath);
    if (needsResize) {
      pipeline = pipeline.resize({
        width: MAX_DIM,
        height: MAX_DIM,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    await pipeline
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(outPath);

    // Also output AVIF — ~15-25% smaller than WebP at equivalent quality.
    // Used in <picture> tags as primary source with WebP fallback.
    const avifPath = path.join(SRC_DIR, `${baseName}.avif`);
    let pipelineAvif = sharp(srcPath);
    if (needsResize) {
      pipelineAvif = pipelineAvif.resize({
        width: MAX_DIM,
        height: MAX_DIM,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    await pipelineAvif
      .avif({ quality: 65, effort: 6 })
      .toFile(avifPath);

    const outStat = await fs.stat(outPath);
    const avifStat = await fs.stat(avifPath);
    const outSize = outStat.size;
    const avifSize = avifStat.size;
    totalAfter += outSize;

    const reduction = (((srcSize - outSize) / srcSize) * 100).toFixed(1);
    const fmt = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';
    const dim = needsResize
      ? ` (resized ${meta.width}x${meta.height} → fit ${MAX_DIM}px)`
      : ` (${meta.width}x${meta.height})`;

    console.log(
      `  ${file.padEnd(28)} ${fmt(srcSize).padStart(8)} → webp ${fmt(outSize).padStart(8)} · avif ${fmt(avifSize).padStart(8)}${dim}`
    );
  }

  const fmt = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';
  const totalReduction = (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1);
  console.log(
    `\nTotal: ${fmt(totalBefore)} → ${fmt(totalAfter)}  (-${totalReduction}%)`
  );
  console.log(`\nDone. Update HTML to use .webp instead of .png.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
