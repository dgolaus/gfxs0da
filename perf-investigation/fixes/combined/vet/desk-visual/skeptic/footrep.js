// node footrep.js <WxH> <N> <mode wheel|jump> <variant...> -- reach page bottom (real wheel via Lenis, or lenis.scrollTo immediate),
// settle, freeze, record --fp / footer transforms, census hashes of the footer links region; pairwise diffs.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const L = require('../../lib');
const [vp, nS, mode, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number); const N = +nS;
const OUT = path.join(__dirname, 'out', `footrep_${mode}_${vp}${process.env.TAG || ''}`); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const shots = [];
  for (let k = 0; k < N; k++) for (const v of vars) {
    const b = await L.launch({});
    try {
      const { p } = await L.open(b, v, { w: W, h: H });
      await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
      await p.mouse.move(W - 40, H / 2);
      if (mode === 'wheel') { for (let j = 0; j < 90; j++) { await p.mouse.wheel({ deltaY: 120 }); await L.w8(60); } }
      else await p.evaluate(() => window.lenis.scrollTo(document.documentElement.scrollHeight, { immediate: true, force: true }));
      await L.w8(3000);
      const pre = await p.evaluate(() => { const f = document.querySelector('.cfooter'); return { fp: f.style.getPropertyValue('--fp'), cfp: getComputedStyle(f).getPropertyValue('--fp').trim(),
        center: getComputedStyle(document.querySelector('.cfooter-center')).transform, sy: scrollY, max: document.documentElement.scrollHeight - innerHeight,
        sec: [...document.querySelectorAll('.cfooter-secondary .fpill')].map((e) => { const r = e.getBoundingClientRect(); return `${r.x.toFixed(3)},${r.y.toFixed(3)}`; }).join(' ') }; });
      await L.freeze(p);
      const f = path.join(OUT, `${v}_${k}.png`); await p.screenshot({ path: f });
      const reg = await p.evaluate(() => { const r = document.querySelector('.cfooter-links').getBoundingClientRect(); return { left: Math.max(0, Math.floor(r.x) - 10), top: Math.max(0, Math.floor(r.y) - 10), width: Math.ceil(r.width) + 20, height: Math.min(innerHeight - Math.max(0, Math.floor(r.y) - 10), Math.ceil(r.height) + 20) }; });
      const hr = crypto.createHash('md5').update(await sharp(f).extract(reg).raw().toBuffer()).digest('hex').slice(0, 8);
      shots.push({ v, k, f, hr, reg, ...pre });
      console.log(v, k, 'links', hr, JSON.stringify(pre));
    } finally { await b.close(); }
  }
  const census = {}; for (const s of shots) { (census[s.v] = census[s.v] || {})[s.hr] = (census[s.v][s.hr] || 0) + 1; }
  console.log('CENSUS links', JSON.stringify(census));
  const fpc = {}; for (const s of shots) { (fpc[s.v] = fpc[s.v] || {})[s.fp] = (fpc[s.v][s.fp] || 0) + 1; }
  console.log('CENSUS --fp', JSON.stringify(fpc));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ census, fpc, shots }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
