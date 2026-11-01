// Hero badge dot during the intro (badge heroBadgeIn: opacity+translate+blur, 0.9s) with the pulse running.
// Each load: for T in 0..1080 step 40, both freeze modes: shot ORIG, swap animation-name to the candidate keyframes
// (same T), shot SWAP, swap back, shot BACK. Loads of baseline AND stab (cross-load classes too).
// node herointro.js <tag> <reps> <variant...>
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const L = require('./lib');
const [tag, repsS, ...vars] = process.argv.slice(2);
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
const STABKF = `@keyframes pulseS { 0%, 100% { box-shadow: 0 0 0 0 rgba(177, 18, 18, 0.55), 0 0 0 10px rgba(177, 18, 18, 0); } 70% { box-shadow: 0 0 0 10px rgba(177, 18, 18, 0), 0 0 0 10px rgba(177, 18, 18, 0); } }
.hero-badge .dot.pulse { animation-name: pulseS !important; }`;
const ORIGKF = `@keyframes pulseO { 0%, 100% { box-shadow: 0 0 0 0 rgba(177, 18, 18, 0.55); } 70% { box-shadow: 0 0 0 10px rgba(177, 18, 18, 0); } }
.hero-badge .dot.pulse { animation-name: pulseO !important; }`;
const hash = (b) => crypto.createHash('md5').update(b).digest('hex').slice(0, 10);
async function setAll(p, mode, T) { await p.evaluate((mode, T) => { for (const a of document.getAnimations()) { try { if (mode === 'pause') a.pause(); a.currentTime = T; if (mode === 'slow') { a.playbackRate = 1e-9; a.play(); } } catch (e) {} } }, mode, T); await L.w8(mode === 'slow' ? 220 : 120); }
async function px(a, b) { if (a.h === b.h) return 0; const fa = path.join(OUT, '_a.png'), fb = path.join(OUT, '_b.png'); fs.writeFileSync(fa, a.buf); fs.writeFileSync(fb, b.buf); const d = await L.xdiff(fa, fb); return `${d.px}/${d.max}`; }
(async () => {
  const rows = []; const cross = {};
  for (let r = 0; r < +repsS; r++) for (const v of vars) {
    const b = await L.launch(); const { p } = await L.open(b, v, { w: 1440, h: 900, slotsOpen: true });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    await p.evaluate(() => { const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px'; });
    const r0 = await p.evaluate(() => { const q = document.querySelector('.hero-badge').getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; });
    const clip = { x: Math.floor(r0.x - 30), y: Math.floor(r0.y - 30), width: Math.ceil(r0.w + 60), height: Math.ceil(r0.h + 60) };
    for (const mode of ['pause', 'slow']) for (let T = 0; T <= 1080; T += 40) {
      await setAll(p, mode, T); const o = await p.screenshot({ clip }); const O = { buf: o, h: hash(o) };
      (cross[`${mode}_${T}`] = cross[`${mode}_${T}`] || {})[v] = [...((cross[`${mode}_${T}`] || {})[v] || []), O.h];
      const doSwap = async (css) => { await p.evaluate((css) => { const s = document.createElement('style'); s.id = '__k'; s.textContent = css; document.head.appendChild(s); }, css); await setAll(p, mode, T); const x = await p.screenshot({ clip }); await p.evaluate(() => document.getElementById('__k').remove()); await setAll(p, mode, T); return { buf: x, h: hash(x) }; };
      // control swap: identical keyframes under a new name (pulseO) -> measures restart/swap noise
      const C = await doSwap(ORIGKF); const S = await doSwap(STABKF);
      const back = await p.screenshot({ clip }); const B = { buf: back, h: hash(back) };
      const row = { v, r, mode, T, ctrl: await px(O, C), stab: await px(O, S), back: await px(O, B), stabVsCtrl: await px(C, S) };
      rows.push(row);
      if (S.h !== C.h) { fs.writeFileSync(path.join(OUT, `${v}_r${r}_${mode}_${T}_CTRL.png`), C.buf); fs.writeFileSync(path.join(OUT, `${v}_r${r}_${mode}_${T}_STAB.png`), S.buf); }
    }
    await b.close();
  }
  for (const r of rows) console.log(`${r.v}_r${r.r} ${r.mode} T=${r.T}  ctrl-swap ${r.ctrl}  stab-swap ${r.stab}  back ${r.back}  stab-vs-ctrl ${r.stabVsCtrl}${r.stabVsCtrl !== 0 ? ' <<<' : ''}`);
  const crossOut = Object.entries(cross).map(([k, o]) => { const bs = new Set(o[vars[0]]); const extra = vars.slice(1).map((v) => (o[v] || []).filter((h) => !bs.has(h)).length); return `${k}: baselineClasses=${bs.size} ${vars.slice(1).map((v, i) => v + 'Classes=' + new Set(o[v]).size + ' notInBase=' + extra[i]).join(' ')}`; });
  console.log(crossOut.join('\n'));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ rows, cross }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
