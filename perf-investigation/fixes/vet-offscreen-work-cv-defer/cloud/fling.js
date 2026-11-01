// Compositor-driven scrolls (touch fling via Input.synthesizeScrollGesture, keyboard End) and blank content:
// screencast every frame and measure detail (edge density) of each frame below the nav. A frame where a
// section is not painted yet is nearly flat (background only). Compare per-frame minima baseline vs variant.
// node fling.js <tag> <WxH[m]> <mode:fling|end|flingup> <speed> [throttle] ; VARS env
const fs = require('fs'); const path = require('path');
const L = require('./lib.js');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const [tag, SZ, MODE, SPEED, THR] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,cvd,cvd_gh3,cvw_gh3').split(',');
const mobile = SZ.endsWith('m'); const [W, H] = SZ.replace('m', '').split('x').map(Number);
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
async function detail(buf) {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height; const y0 = Math.round(h * 0.12);
  let s = 0, n = 0;
  for (let y = y0; y < h - 1; y += 2) for (let x = 0; x < w - 12; x += 2) { const i = y * w + x; s += Math.abs(data[i] - data[i + 1]) + Math.abs(data[i] - data[i + w]); n++; }
  return +(s / n).toFixed(2);
}
(async () => {
  const summary = {};
  for (const v of VARS) {
    const b = await L.launch();
    const { p, c } = await L.open(b, v, { w: W, h: H, mobile, throttle: +(THR || 0) });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    await L.w8(+(process.env.EXTRA || 0));
    if (MODE === 'flingup' || MODE === 'dragup') { await p.evaluate(() => { window.lenis ? window.lenis.scrollTo(document.documentElement.scrollHeight, { immediate: true, force: true }) : scrollTo(0, document.documentElement.scrollHeight); }); await L.w8(1500); }
    const frames = [];
    c.on('Page.screencastFrame', async (f) => { frames.push({ y: f.metadata.scrollOffsetY, data: f.data }); try { await c.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {} });
    await c.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1, maxWidth: W, maxHeight: H });
    await L.w8(300);
    const n0 = frames.length;
    if (MODE === 'end') { await p.mouse.move(W / 2, H / 2); await p.keyboard.press('End'); }
    else if (MODE === 'drag' || MODE === 'dragup') {
      // fast finger drags (compositor-threaded touch scrolling; headless has no fling momentum)
      const step = +SPEED, dir = MODE === 'dragup' ? -1 : 1;
      for (let k = 0; k < 14; k++) {
        const ys = dir > 0 ? [H - 40, 60] : [60, H - 40];
        await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: W / 2, y: ys[0] }] });
        for (let y = ys[0]; dir > 0 ? y > ys[1] : y < ys[1]; y -= dir * step) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: W / 2, y }] }); await L.w8(8); }
        await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }
    else {
      const dist = MODE === 'flingup' ? 9000 : -9000;
      c.send('Input.synthesizeScrollGesture', { x: Math.round(W / 2), y: Math.round(H / 2), yDistance: dist, speed: +SPEED, gestureSourceType: mobile ? 'touch' : 'mouse', preventFling: false }).catch(() => {});
    }
    await L.w8(4000);
    await c.send('Page.stopScreencast');
    const rows = [];
    for (let i = n0; i < frames.length; i++) {
      const buf = Buffer.from(frames[i].data, 'base64');
      const d = await detail(buf);
      rows.push([i - n0, Math.round(frames[i].y), d]);
      fs.writeFileSync(path.join(OUT, `${v}_f${i - n0}.jpg`), buf);
    }
    const ds = rows.map((r) => r[2]);
    const sorted = [...ds].sort((a, b) => a - b);
    summary[v] = { frames: rows.length, min: sorted[0], p10: sorted[Math.floor(sorted.length * 0.1)], median: sorted[Math.floor(sorted.length / 2)], lowFrames: rows.filter((r) => r[2] < 2.0) };
    console.log(v, MODE, SZ, 'thr', THR || 0, JSON.stringify(summary[v]));
    console.log('   ', v, 'frames [i, scrollY, detail]:', JSON.stringify(rows));
    await b.close();
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
