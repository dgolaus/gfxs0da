// One-shot conversion script. Edit `jobs` and run:
//   node scripts/convert-apoc-thumbs.js
//
// Each job copies the source .png to the dest .png and emits
// matching .webp (quality 85) and .avif (quality 55, effort 6).
const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

const WORK = path.join(__dirname, '..', 'assets', 'work');

const jobs = [
  { src: 'Killioz_Zombie_177.png', dest: 'apoc-thumb-2' },
  { src: 'Killioz_Zombie_178.png', dest: 'apoc-thumb-3' },
];

(async () => {
  for (const { src, dest } of jobs) {
    const srcPath = path.join(WORK, src);
    const buf = await fs.readFile(srcPath);

    await fs.writeFile(path.join(WORK, dest + '.png'), buf);
    await sharp(buf).webp({ quality: 85 }).toFile(path.join(WORK, dest + '.webp'));
    await sharp(buf).avif({ quality: 55, effort: 6 }).toFile(path.join(WORK, dest + '.avif'));

    const sizes = await Promise.all(['png', 'webp', 'avif'].map(async ext => {
      const s = await fs.stat(path.join(WORK, dest + '.' + ext));
      return `${ext}=${(s.size / 1024).toFixed(0)}KB`;
    }));
    console.log(`${dest} → ${sizes.join(' ')}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
