// Mobile 390: is the nav CTA painted at a different x with the cv sections auto vs visible? No freezing.
const fs = require('fs'); const path = require('path');
const L = require('./lib.js');
const OUT = path.join(__dirname, 'out', 'L_navpaint'); fs.mkdirSync(OUT, { recursive: true });
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
async function ctaLeft(f) { // first column from the left (x>=240) where the CTA border appears in rows 15..45
  const { data, info } = await sharp(f).extract({ left: 240, top: 15, width: 150, height: 30 }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const col = []; for (let x = 0; x < info.width; x++) { let s = 0; for (let y = 0; y < info.height; y++) s += data[y * info.width + x]; col.push(s / info.height); }
  return col.map((v) => Math.round(v)).join(',');
}
(async () => {
  for (const v of (process.env.VARS || 'baseline,cvd_gh3').split(',')) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: 390, h: 844, mobile: true });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2000);
    await p.evaluate(() => scrollTo(0, 1772)); await L.w8(2500);
    const fa = path.join(OUT, `${v}_a.png`); await p.screenshot({ path: fa, clip: { x: 0, y: 0, width: 390, height: 60 } });
    await p.evaluate(() => ['about', 'process', 'trust', 'pricing', 'contact'].forEach((id) => { document.getElementById(id).style.contentVisibility = 'visible'; })); await L.w8(800);
    const fb = path.join(OUT, `${v}_b.png`); await p.screenshot({ path: fb, clip: { x: 0, y: 0, width: 390, height: 60 } });
    const anim = await p.evaluate(() => document.querySelector('#nav > .btn').getAnimations().map((a) => (a.animationName || a.transitionProperty) + ':' + a.playState + ':' + Math.round(a.currentTime)).join('|'));
    console.log(v, 'auto-vs-visible same page', JSON.stringify(await L.diff(fa, fb)), 'anims', anim);
    await b.close();
  }
  console.log('cross-load baseline_a vs cvd_gh3_a', JSON.stringify(await L.diff(path.join(OUT, 'baseline_a.png'), path.join(OUT, 'cvd_gh3_a.png'))));
})().catch((e) => { console.error(e); process.exit(1); });
