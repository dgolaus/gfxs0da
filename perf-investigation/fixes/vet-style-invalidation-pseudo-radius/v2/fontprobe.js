// Is the sub-pixel text shift on ghost buttons caused by the CSS, or a load-order artefact?
// For each variant x N loads: measure text run widths of .btn labels/nav links (Range rects, full precision),
// screenshot hero CTA; then force a re-layout (viewport W+1 then back) and measure again.
// usage: node fontprobe.js <WxH> <mobile|-> <reps> <variant...>
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [vp, mob, reps, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const OUT = path.join(__dirname, 'fontprobe'); fs.mkdirSync(OUT, { recursive: true });
const MEAS = () => {
  const r = {};
  const els = [...document.querySelectorAll('.btn, .nav-links a, .hero-title')].slice(0, 14);
  els.forEach((el, i) => { const rg = document.createRange(); rg.selectNodeContents(el); const b = rg.getBoundingClientRect(); const e = el.getBoundingClientRect(); r[i + ':' + (el.textContent || '').trim().slice(0, 14)] = `${b.width.toFixed(4)}@${b.left.toFixed(4)} box ${e.width.toFixed(4)}`; });
  r.fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight + ' ' + f.style + ' ' + (f.unicodeRange || '').slice(0, 12)).sort().join(' | ');
  return r;
};
(async () => {
  const res = {};
  for (let k = 0; k < +reps; k++) for (const v of vars) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: W, h: H, mobile: mob === 'mobile' });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    const before = await p.evaluate(MEAS);
    await p.setViewport({ width: W + 1, height: H, isMobile: mob === 'mobile', hasTouch: mob === 'mobile' });
    await L.w8(500);
    await p.setViewport({ width: W, height: H, isMobile: mob === 'mobile', hasTouch: mob === 'mobile' });
    await L.w8(800);
    const after = await p.evaluate(MEAS);
    await b.close();
    (res[v] = res[v] || []).push({ before, after });
    const sig = (m) => Object.entries(m).filter(([kk]) => kk !== 'fonts').map(([, x]) => x).join(';');
    console.log(v, k, 'before-sig', require('crypto').createHash('md5').update(sig(before)).digest('hex').slice(0, 8), 'after-sig', require('crypto').createHash('md5').update(sig(after)).digest('hex').slice(0, 8), 'fontsEqual', before.fonts === after.fonts);
  }
  fs.writeFileSync(path.join(OUT, `probe_${W}.json`), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
