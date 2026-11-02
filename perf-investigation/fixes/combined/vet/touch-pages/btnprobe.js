// node btnprobe.js <tag> <WxH> <mobile|desk> <page> <variant...> : every visible .btn screenshotted (clip, padded 6px) after freeze;
// exact pixel compare vs first baseline run; rect precision + dpr env DPR.
const fs = require('fs'); const path = require('path'); const sharp = require('/home/user/gfxs0da/node_modules/sharp'); const L = require('./lib');
const [tag, vp, mode, pg, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number); const mobile = mode === 'mobile';
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true }); const DPR = +(process.env.DPR || 1);
async function exact(a, b) { const A = await sharp(a).raw().toBuffer({ resolveWithObject: true }), B = await sharp(b).raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return 'size'; let n = 0, mx = 0; const ch = A.info.channels;
  for (let i = 0; i < A.data.length; i += ch) { let d = 0; for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A.data[i + k] - B.data[i + k])); if (d) { n++; mx = Math.max(mx, d); } } return n ? `${n}px max${mx}` : 0; }
async function run(v, label) {
  const b = await L.launch({ touch: mobile }); const { p } = await L.open(b, v, { w: W, h: H, mobile, dpr: DPR, reduced: !!process.env.REDUCED });
  await p.goto(L.BASE + pg, { waitUntil: 'load' }); await L.settle(p, 2500);
  const n = await p.evaluate(() => document.querySelectorAll('.btn').length); const res = [];
  for (let i = 0; i < n; i++) {
    const y = await p.evaluate((i) => { const e = document.querySelectorAll('.btn')[i]; const r = e.getBoundingClientRect(); if (!r.width) return null; return Math.max(0, Math.round(scrollY + r.top - innerHeight / 2)); }, i);
    if (y == null) { res.push(null); continue; }
    await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
    await L.w8(900); await L.freeze(p);
    const info = await p.evaluate((i) => { const e = document.querySelectorAll('.btn')[i]; const r = e.getBoundingClientRect(); const a = getComputedStyle(e, '::after');
      return { cls: e.className, text: e.textContent.trim().slice(0, 20), r: [r.x, r.y, r.width, r.height], tf: getComputedStyle(e).transform, rad: a.borderRadius, afterTr: a.translate, afterOp: a.opacity, sy: scrollY }; }, i);
    const clip = { x: Math.max(0, Math.floor(info.r[0]) - 6), y: Math.max(0, Math.floor(info.r[1]) - 6), width: Math.ceil(info.r[2]) + 12, height: Math.ceil(info.r[3]) + 12 };
    clip.width = Math.min(clip.width, W - clip.x); clip.height = Math.min(clip.height, H - clip.y);
    const f = path.join(OUT, `${label}_btn${i}.png`); await sharp(await p.screenshot()).extract({ left: clip.x, top: clip.y, width: clip.width, height: clip.height }).png().toFile(f); // viewport-relative crop res.push({ ...info, clip, f });
    await L.unfreeze(p);
  }
  const lenis = await p.evaluate(() => !!window.lenis); await b.close(); return { res, lenis };
}
(async () => { const labels = ['A', 'B', ...vars]; const R = {};
  for (const l of labels) R[l] = await run(l === 'A' || l === 'B' ? 'baseline' : l, l);
  const rows = [];
  for (let i = 0; i < R.A.res.length; i++) { const a = R.A.res[i]; if (!a) continue; const row = { i, text: a.text, cls: a.cls, rA: a.r.map((v) => +v.toFixed(3)).join(','), rad: a.rad };
    for (const l of labels.slice(1)) { const x = R[l].res[i]; row[l] = { px: JSON.stringify(x.clip) === JSON.stringify(a.clip) ? await exact(a.f, x.f) : 'clip ' + JSON.stringify([a.clip, x.clip]), r: x.r.join() === a.r.join() ? 'same' : x.r.map((v) => +v.toFixed(3)).join(','), rad: x.rad, sy: [a.sy, x.sy] }; }
    rows.push(row); console.log(JSON.stringify(row)); }
  console.log('lenis', JSON.stringify(Object.fromEntries(labels.map((l) => [l, R[l].lenis]))));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(rows, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
