// node classes.js <dir> <regexOnFile> <left,top,width,height> : hash a crop of each matching png, group into classes
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const [dir, rx, reg] = process.argv.slice(2); const [left, top, width, height] = reg.split(',').map(Number);
(async () => {
  const files = fs.readdirSync(dir).filter((f) => new RegExp(rx).test(f) && !f.startsWith('heat')).sort();
  const cls = {};
  for (const f of files) { const b = await sharp(path.join(dir, f)).extract({ left, top, width, height }).raw().toBuffer(); const h = crypto.createHash('md5').update(b).digest('hex').slice(0, 8); (cls[h] = cls[h] || []).push(f.replace('.png', '')); }
  for (const [h, v] of Object.entries(cls)) console.log(h, v.join(' '));
})();
