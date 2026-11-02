// node anchorrep.js <WxH> <hash> <N> <variant...>  -- repeat anchor landing (/#hash), freeze, shoot; census of pixel hashes
// of the .pricing-grid region (or the target section's viewport part) and full viewport; pairwise diffs within/cross variant.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const L = require('../../lib');
const [vp, hsh, nS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number); const N = +nS; const DPR = +(process.env.DPR || 1);
const SEL = process.env.SEL || '.pricing-grid';
const OUT = path.join(__dirname, 'out', `anchorrep_${hsh}_${vp}_dpr${DPR}${process.env.TAG || ''}`); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const shots = [];
  for (let k = 0; k < N; k++) for (const v of vars) {
    const b = await L.launch({});
    try {
      const { p } = await L.open(b, v, { w: W, h: H, dpr: DPR });
      await p.goto(L.BASE + '/#' + hsh, { waitUntil: 'load' });
      await L.settle(p, +(process.env.SETTLE || 3500));
      await L.freeze(p);
      const f = path.join(OUT, `${v}_${k}.png`);
      await p.screenshot({ path: f });
      const m = await p.evaluate((sel) => {
        const g = document.querySelector(sel).getBoundingClientRect();
        return { sy: scrollY, reg: { x: g.x, y: g.y, w: g.width, h: g.height },
          leave: [...document.querySelectorAll('.scroll-fade')].map((s) => s.style.getPropertyValue('--leave') + '/' + getComputedStyle(s).getPropertyValue('--leave').trim()),
          xf: [...document.querySelectorAll('.scroll-fade')].map((s) => getComputedStyle(s).transform + ' ' + getComputedStyle(s).opacity),
          cards: [...document.querySelectorAll('.price-card')].map((c) => { const r = c.getBoundingClientRect(); return [r.x, r.y].map((n) => +n.toFixed(3)).join(','); }) };
      }, SEL);
      const reg = { left: Math.max(0, Math.floor(m.reg.x * DPR) - 20), top: Math.max(0, Math.floor(m.reg.y * DPR) - 20), width: 0, height: 0 };
      reg.width = Math.min(W * DPR - reg.left, Math.ceil(m.reg.w * DPR) + 40); reg.height = Math.min(H * DPR - reg.top, Math.ceil(m.reg.h * DPR) + 40);
      const hr = crypto.createHash('md5').update(await sharp(f).extract(reg).raw().toBuffer()).digest('hex').slice(0, 8);
      const hf = crypto.createHash('md5').update(await sharp(f).raw().toBuffer()).digest('hex').slice(0, 8);
      shots.push({ v, k, f, hr, hf, ...m, reg });
      console.log(v, k, 'region', hr, 'full', hf, 'sy', m.sy, 'cards', m.cards.join(' | '), 'leave', m.leave.join(' '));
      console.log('   xf', m.xf.join(' ; '));
    } finally { await b.close(); }
  }
  const census = {}; for (const s of shots) { (census[s.v] = census[s.v] || {})[s.hr] = (census[s.v][s.hr] || 0) + 1; }
  console.log('CENSUS region', JSON.stringify(census));
  // pairwise region diffs
  const within = {}, cross = {};
  for (let i = 0; i < shots.length; i++) for (let j = i + 1; j < shots.length; j++) {
    const a = shots[i], b = shots[j]; const d = await L.diff(a.f, b.f, null, a.reg);
    if (a.v === b.v) (within[a.v] = within[a.v] || []).push(d.pct); else { const kk = [a.v, b.v].sort().join('|'); (cross[kk] = cross[kk] || []).push(d.pct); }
  }
  const st = (xs) => xs ? { n: xs.length, min: Math.min(...xs), max: Math.max(...xs), mean: +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(3) } : null;
  console.log('WITHIN', JSON.stringify(Object.fromEntries(Object.entries(within).map(([k, x]) => [k, st(x)]))));
  console.log('CROSS', JSON.stringify(Object.fromEntries(Object.entries(cross).map(([k, x]) => [k, st(x)]))));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ census, within, cross, shots }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
