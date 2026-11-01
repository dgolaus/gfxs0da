// Is any frame painted with a never-rendered section still empty right after an instant jump?
// Screencast every frame, jump (End key / immediate scroll to pricing), compare each captured frame
// with the settled frame at the same position (bottom 60% of the viewport, where the jump lands).
// node blankframe.js <tag> <WxH> <mode:end|pricing> ; VARS env
const fs = require('fs'); const path = require('path');
const L = require('./lib.js');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const [tag, SZ, MODE] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,cvd,cvd_gh3').split(',');
const [W, H] = SZ.split('x').map(Number);
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  for (const v of VARS) {
    const b = await L.launch();
    const { p, c } = await L.open(b, v, { w: W, h: H });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2000);
    const frames = [];
    c.on('Page.screencastFrame', async (f) => { frames.push({ t: Date.now(), data: f.data }); try { await c.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {} });
    await c.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: W, maxHeight: H });
    await L.w8(400);
    const n0 = frames.length;
    if (MODE === 'end') { await p.mouse.move(W / 2, H / 2); await p.keyboard.press('End'); }
    else await p.evaluate(() => { const y = document.getElementById('pricing').getBoundingClientRect().top + scrollY - 80; window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); });
    await L.w8(1500);
    await c.send('Page.stopScreencast');
    // settled reference (animations keep running: compare structure, threshold generous)
    const ref = path.join(OUT, `${v}_ref.png`);
    await p.screenshot({ path: ref });
    const sy = await p.evaluate(() => scrollY);
    const res = [];
    for (let i = n0; i < Math.min(frames.length, n0 + 12); i++) {
      const f = path.join(OUT, `${v}_f${i - n0}.png`);
      fs.writeFileSync(f, Buffer.from(frames[i].data, 'base64'));
      const meta = await sharp(f).metadata();
      if (meta.width !== W) { res.push({ i: i - n0, size: meta.width }); continue; }
      const d = await L.diff(ref, f, null, { left: 0, top: Math.round(H * 0.4), width: W, height: H - Math.round(H * 0.4) });
      res.push({ i: i - n0, mad: d.mad, pct: d.pct });
    }
    console.log(v, MODE, 'sy', sy, 'frames after jump', frames.length - n0, JSON.stringify(res));
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
