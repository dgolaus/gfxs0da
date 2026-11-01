// Pulse rings: per load, freeze every animation at T (0..2400 step 30, pause mode; step 120 slow mode) and capture a clip
// around each pulsing dot (hero badge, chat status, footer eyebrow). Cross-load: crops grouped by hash.
// In-page swap (on baseline loads): same frozen state, animation-name swapped to the candidate's keyframes, shot, swapped back.
// node pulse.js <tag> <WxH> <flags: mobile,open> <reps> <variant...>
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const L = require('./lib');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const [tag, vp, flagsS, repsS, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number);
const flags = new Set((flagsS || '').split(',').filter(Boolean));
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
const DOTS = { hero: '.hero-badge .dot.pulse', chat: '.chat-status .dot.pulse', foot: '.cfooter-eyebrow .dot.pulse' };
const STABKF = `@keyframes pulseS { 0%, 100% { box-shadow: 0 0 0 0 rgba(177, 18, 18, 0.55), 0 0 0 10px rgba(177, 18, 18, 0); } 70% { box-shadow: 0 0 0 10px rgba(177, 18, 18, 0), 0 0 0 10px rgba(177, 18, 18, 0); } }
@keyframes pulseGreenS { 0%, 100% { box-shadow: 0 0 8px #57F287, 0 0 0 0 rgba(87, 242, 135, 0.45), 0 0 0 9px rgba(87, 242, 135, 0); } 70% { box-shadow: 0 0 8px #57F287, 0 0 0 9px rgba(87, 242, 135, 0), 0 0 0 9px rgba(87, 242, 135, 0); } }
.dot.pulse { animation-name: pulseS !important; } .chat-status .dot.pulse { animation-name: pulseGreenS !important; }`;
const hash = (b) => crypto.createHash('md5').update(b).digest('hex').slice(0, 10);
async function setAll(p, mode, T) {
  await p.evaluate((mode, T) => { for (const a of document.getAnimations()) { try { if (mode === 'pause') a.pause(); a.currentTime = T; if (mode === 'slow') { a.playbackRate = 1e-9; a.play(); } } catch (e) {} } }, mode, T);
  await L.w8(mode === 'slow' ? 200 : 120);
}
async function run(v, label, swap) {
  const b = await L.launch(); const { p } = await L.open(b, v, { w: W, h: H, mobile: flags.has('mobile'), slotsOpen: flags.has('open') });
  await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
  const res = {}; const swapRes = [];
  for (const [k, sel] of Object.entries(DOTS)) {
    const st = await p.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; el.scrollIntoView({ block: 'center' }); const cs = getComputedStyle(el); return { anim: cs.animationName, closed: !!el.closest('.is-comms-closed') }; }, sel);
    if (!st) continue; await L.w8(900);
    await p.evaluate(() => { const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px'; document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; }); });
    const r = await p.evaluate((sel) => { const q = document.querySelector(sel).getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; }, sel);
    const clip = { x: Math.max(0, Math.floor(r.x - 26)), y: Math.max(0, Math.floor(r.y - 26)), width: Math.ceil(r.w + 52), height: Math.ceil(r.h + 52) };
    res[k] = { st, clip, shots: {} };
    for (const mode of ['pause', 'slow']) {
      for (let T = 0; T <= 2400; T += mode === 'pause' ? 30 : 120) {
        await setAll(p, mode, T); const buf = await p.screenshot({ clip }); res[k].shots[`${mode}_${T}`] = hash(buf);
        if (T % 240 === 0 || (T >= 1560 && T <= 1800 && T % 60 === 0)) fs.writeFileSync(path.join(OUT, `${label}_${k}_${mode}_${T}.png`), buf);
        if (swap && mode === 'pause') {
          await p.evaluate((css) => { const s = document.createElement('style'); s.id = '__stab'; s.textContent = css; document.head.appendChild(s); }, STABKF);
          await setAll(p, 'pause', T); const bS = await p.screenshot({ clip });
          await p.evaluate(() => document.getElementById('__stab').remove());
          await setAll(p, 'pause', T); const bN2 = await p.screenshot({ clip });
          const nameS = await p.evaluate((sel) => getComputedStyle(document.querySelector(sel)).animationName, sel);
          swapRes.push({ k, T, orig: hash(buf), swapped: hash(bS), back: hash(bN2), nameBack: nameS });
          if (hash(bS) !== hash(buf)) { fs.writeFileSync(path.join(OUT, `${label}_${k}_SWAP_${T}.png`), bS); fs.writeFileSync(path.join(OUT, `${label}_${k}_ORIG_${T}.png`), buf); }
        }
      }
      await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.playbackRate = 1; a.play(); } catch (e) {} } });
    }
  }
  await b.close(); return { res, swapRes };
}
(async () => {
  const reps = +repsS; const R = {};
  for (let r = 0; r < reps; r++) for (const v of vars) (R[v] = R[v] || []).push(await run(v, `${v}_r${r}`, v === 'baseline' && r === 0));
  const summary = { tag, vp, flags: [...flags], perDot: {}, swap: null };
  for (const k of Object.keys(DOTS)) {
    const any = R[vars[0]][0].res[k]; if (!any) continue;
    const keys = Object.keys(any.shots); let mism = []; let classesPerKey = {};
    for (const key of keys) {
      const byV = {}; for (const v of vars) byV[v] = R[v].map((x) => x.res[k] && x.res[k].shots[key]);
      const base = new Set(byV[vars[0]]);
      for (const v of vars.slice(1)) for (const h of byV[v]) if (!base.has(h)) mism.push(`${key}:${v}`);
      classesPerKey[key] = Object.fromEntries(vars.map((v) => [v, [...new Set(byV[v])].length]));
    }
    const multi = Object.entries(classesPerKey).filter(([, c]) => Object.values(c).some((n) => n > 1)).length;
    summary.perDot[k] = { state: any.st, clip: any.clip, samples: keys.length, variantHashNotInBaselineSet: mism.length, mismatches: mism.slice(0, 40), keysWithMultipleHashesWithinAVariant: multi };
  }
  const sw = R.baseline[0].swapRes;
  summary.swap = { n: sw.length, swappedDiffers: sw.filter((s) => s.swapped !== s.orig).map((s) => `${s.k}@${s.T}`), backDiffers: sw.filter((s) => s.back !== s.orig).map((s) => `${s.k}@${s.T}`), nameBack: [...new Set(sw.map((s) => s.nameBack))] };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ summary, R }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
