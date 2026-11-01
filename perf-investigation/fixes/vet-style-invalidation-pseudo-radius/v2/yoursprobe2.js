// Reproduce bench.js visual's t=500 shot (same steps as shot() in bench.js) many times, interleaved, and classify
// the hero accent word region ("Yours", bbox 156,373-404,448) into raster states. Also dumps the animations on the
// hero title subtree at the moment of the pause, to explain any alternate state.
// usage: node yoursprobe.js <reps> <t> <variant...>
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const L = require('./lib');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const [reps, T, ...vars] = process.argv.slice(2);
const OUT = path.join(__dirname, 'yoursprobe2'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const tally = {}; const rows = []; const firstOf = {};
  for (let k = 0; k < +reps; k++) for (const v of vars) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: 1440, h: 900 });
    await p.goto(L.BASE + '/', { waitUntil: 'networkidle2' });
    await p.evaluate(async () => {
      const pend = [...document.images].filter((i) => !i.complete && i.loading !== 'lazy');
      await Promise.race([Promise.all(pend.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 8000))]);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    });
    await L.w8(300);
    const anims = await p.evaluate((t) => {
      document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
      const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
      window.scrollTo(0, 0);
      const before = document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.hero-title'))
        .map((a) => `${a.animationName || a.transitionProperty}@${a.effect.target.className || a.effect.target.tagName}:${a.playState}:${Math.round(a.currentTime)}`);
      for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t; } catch (e) {} }
      return before;
    }, +T);
    await L.w8(250);
    const grad = await p.evaluate(() => { const t = document.querySelector('.hero-title .accent > .accent-text'); const r = document.querySelector('.hero-title .accent').getBoundingClientRect(); return (t.style.backgroundImage.match(/at 50% (-?[\d.]+)vh/) || [])[1] + ' top=' + r.top.toFixed(1); });
    anims.push('GRAD ' + grad);
    const f = path.join(OUT, `${v}_${k}.png`);
    await p.screenshot({ path: f, clip: { x: 0, y: 0, width: 1440, height: 900 } });
    await b.close();
    const buf = await sharp(f).extract({ left: 150, top: 365, width: 260, height: 90 }).raw().toBuffer();
    const h = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
    (tally[v] = tally[v] || {})[h] = (tally[v][h] || 0) + 1;
    if (!firstOf[h]) firstOf[h] = f; else fs.unlinkSync(f);
    rows.push({ v, k, h, anims }); console.log(v, k, h, anims.length, anims.join(' '));
  }
  console.log('TALLY', JSON.stringify(tally)); console.log('EXEMPLARS', JSON.stringify(firstOf));
  fs.writeFileSync(path.join(OUT, `result_${T}.json`), JSON.stringify({ tally, firstOf, rows }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
