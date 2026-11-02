// How often does the frozen bench shot at t=900 show 'Yours' with its base gradient layer unpainted?
// Same steps as bench.js shot() (desktop launch via bench-real openPage), N alternating loads per variant.
process.env.LENIS_JS = process.env.LENIS_JS || '/home/user/gfxs0da/perf-investigation/vendor/lenis-1.1.18.min.js';
const B = require('./bench-real.js'); const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const pp = require('/home/user/gfxs0da/node_modules/puppeteer'); const fs = require('fs');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const V = JSON.parse(fs.readFileSync('/home/user/gfxs0da/perf-investigation/fixes/final/variants.json'));
const N = +(process.argv[2] || 10), T = +(process.argv[3] || 900);
(async () => {
  const br = await pp.launch({ headless: 'new', executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4'] });
  const res = {};
  for (let i = 0; i < N; i++) for (const v of V) {
    const { p } = await B.openPage(br, v, { throttle: 1 });
    await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await p.evaluate(async () => { const pend = [...document.images].filter((i) => !i.complete && i.loading !== 'lazy'); await Promise.race([Promise.all(pend.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 8000))]); if (document.fonts) await document.fonts.ready; });
    await w8(300);
    await p.evaluate((t) => { const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px'; window.scrollTo(0, 0); for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t; } catch (e) {} } }, T);
    await w8(250);
    const buf = await p.screenshot({ clip: { x: 156, y: 372, width: 332, height: 110 } });
    const { data } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let r = 0; for (let k = 0; k < data.length; k += 3) r += data[k]; r /= data.length / 3;
    (res[v.name] = res[v.name] || []).push(+r.toFixed(1));
    await p.close();
  }
  await br.close();
  console.log(JSON.stringify(res));
  for (const [k, a] of Object.entries(res)) console.log(k, 'mean red', a.join(' '), '| dark(<', 90, '):', a.filter((x) => x < 90).length + '/' + a.length);
})();
