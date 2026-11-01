// Repeated in-page toggles on one frozen baseline page at the #pricing bottom edge: N, X (control repaint), C (contain),
// in an interleaved sequence. Hash the region above+below the edge; print the class letter of each shot. If C shots
// fall in classes the N/X shots never reach, the change is caused by contain; if classes mix, it is raster history.
// node rep.js <tag> <WxH> <dpr> <reps>
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const L = require('./lib');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const [tag, vp, dprS, repsS] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number); const dpr = +dprS;
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
async function freezeAt(p, mode, T) {
  await p.evaluate((mode, T) => {
    document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
    for (const a of document.getAnimations()) { try { if (a instanceof CSSTransition) { a.finish(); continue; } if (mode === 'pause') a.pause(); a.currentTime = T; if (mode === 'slow') { a.playbackRate = 1e-9; a.play(); } } catch (e) {} }
  }, mode, T); await L.w8(350);
}
async function release(p) { await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.playbackRate = 1; a.play(); } catch (e) {} } }); }
(async () => {
  const b = await L.launch(); const { p } = await L.open(b, 'baseline', { w: W, h: H, dpr });
  await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
  const g = await p.evaluate(() => { const q = document.getElementById('pricing'); const r = q.getBoundingClientRect(); return { top: r.top + scrollY, bot: r.bottom + scrollY, bg: getComputedStyle(q).backgroundColor }; });
  for (let y = g.top - H; y < g.bot; y += H / 2) { await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(300); }
  await p.evaluate((y) => window.scrollTo(0, y), Math.round(g.bot - H * 0.75)); await L.w8(1200);
  const edge = await p.evaluate(() => document.getElementById('pricing').getBoundingClientRect().bottom);
  const region = { left: 0, top: Math.round((edge - 160) * dpr), width: W * dpr, height: Math.round(220 * dpr) };
  console.log('geom', JSON.stringify(g), 'edge', edge, 'region', JSON.stringify(region));
  const apply = async (s) => { await p.evaluate((s, bg) => { const q = document.getElementById('pricing'); q.style.contain = s === 'C' ? 'paint' : ''; q.style.backgroundColor = s === 'X' ? (bg === 'rgba(0, 0, 0, 0)' ? 'transparent' : bg) : ''; if (s === 'X') q.style.outline = '0px solid transparent'; else q.style.outline = ''; }, s, g.bg); await L.w8(350); };
  const seq = 'NCNXNCNXCCNNXXCN'.split('');
  for (const mode of (process.env.MODES || 'pause,slow').split(',')) for (const T of (process.env.TS || '0,1100,3300').split(',').map(Number)) for (let r = 0; r < +repsS; r++) {
    await freezeAt(p, mode, T);
    const classes = []; const hashes = {}; let line = '';
    for (const [i, s] of seq.entries()) {
      await apply(s); const f = path.join(OUT, `tmp.png`); await p.screenshot({ path: f });
      const buf = await sharp(f).extract(region).raw().toBuffer(); const h = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
      if (!(h in hashes)) { hashes[h] = String.fromCharCode(65 + Object.keys(hashes).length); fs.copyFileSync(f, path.join(OUT, `${mode}_${T}_r${r}_class${hashes[h]}_${s}.png`)); }
      line += `${s}${hashes[h]} `;
    }
    await apply('N'); await release(p); await L.w8(600);
    console.log(`${tag} ${mode} T=${T} r${r}: ${line}`);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
