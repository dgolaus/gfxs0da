// node scen.js <scenario> <WxH> <variant...>   (baseline twice as A/B automatically, then each variant)
// Scenarios the desk-visual vetter did NOT run:
//  anchor   : load /#pricing (and /#process) directly, real-time Lenis landing, settle, freeze, shoot
//  resize   : load at W, scroll to #pricing, live-resize to 1400 (crosses the 1440 contain:paint boundary), back to W; shoot each
//  wheel    : real mouse.wheel scrolling (Lenis real-time path, not scrollTo immediate) through the page, shoot at stops after settle
//  throttle : same as wheel, with CPU throttle 4x
// Env DPR for device scale. Masks: chat, stars, counters (rects stored, applied in diff).
const fs = require('fs'); const path = require('path');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const L = require('../../lib');
const [scen, vp, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const DPR = +(process.env.DPR || 1);
const OUT = path.join(__dirname, 'out', `${scen}_${vp}_dpr${DPR}`); fs.mkdirSync(OUT, { recursive: true });
const MASKSEL = '#chat-messages, #chat-typing, .chat-footer, #trust-stats .star, .counter';

async function shoot(p, label, key, shots) {
  await L.freeze(p);
  const f = path.join(OUT, `${label}_${key}.png`);
  await p.screenshot({ path: f });
  const g = await p.evaluate((sel) => ({ sy: Math.round(scrollY * 10) / 10, docH: document.documentElement.scrollHeight, iw: innerWidth,
    lenis: !!window.lenis, hoverNone: matchMedia('(hover: none)').matches,
    sec: [...document.querySelectorAll('#main > section, #contact')].map((s) => Math.round(s.getBoundingClientRect().top * 10) / 10).join(' '),
    pricingContain: getComputedStyle(document.getElementById('pricing')).contain,
    mk: [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.bottom > 0 && r.top < innerHeight).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })) }), MASKSEL);
  await L.unfreeze(p);
  shots.push({ key, f, ...g });
}

async function run(v, label) {
  const b = await L.launch({});
  const shots = [];
  try {
    const { p } = await L.open(b, v, { w: W, h: H, dpr: DPR, throttle: scen === 'throttle' ? 4 : 0 });
    if (scen === 'anchor') {
      for (const hsh of ['pricing', 'process', 'trust']) {
        await p.goto(L.BASE + '/#' + hsh, { waitUntil: 'load' });
        await L.settle(p, 3500);
        await shoot(p, label, hsh, shots);
      }
    } else if (scen === 'resize') {
      await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
      const y = await p.evaluate(() => Math.round(document.getElementById('pricing').getBoundingClientRect().top + scrollY - 40));
      await p.evaluate((y) => window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y), y);
      await L.w8(1300); await shoot(p, label, 'w0', shots);
      await p.setViewport({ width: 1400, height: H, deviceScaleFactor: DPR }); await L.w8(1500);
      const y2 = await p.evaluate(() => Math.round(document.getElementById('pricing').getBoundingClientRect().top + scrollY - 40));
      await p.evaluate((y) => window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y), y2);
      await L.w8(1300); await shoot(p, label, 'w1400', shots);
      await p.setViewport({ width: W, height: H, deviceScaleFactor: DPR }); await L.w8(1500);
      const y3 = await p.evaluate(() => Math.round(document.getElementById('pricing').getBoundingClientRect().top + scrollY - 40));
      await p.evaluate((y) => window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y), y3);
      await L.w8(1300); await shoot(p, label, 'wback', shots);
      // then scroll to bottom and back to top (footer --fp, nav pill after resize)
      await p.evaluate(() => window.lenis.scrollTo(document.documentElement.scrollHeight, { immediate: true, force: true })); await L.w8(1500);
      await shoot(p, label, 'bottom', shots);
      await p.evaluate(() => window.lenis.scrollTo(0, { immediate: true, force: true })); await L.w8(1500);
      await shoot(p, label, 'top', shots);
    } else { // wheel / throttle
      await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
      await p.mouse.move(W - 40, H / 2);
      for (let k = 1; k <= 10; k++) {
        for (let j = 0; j < 6; j++) { await p.mouse.wheel({ deltaY: 120 }); await L.w8(60); }
        await L.w8(2200);
        await p.mouse.move(W - 40, H / 2); // keep pointer off content
        await shoot(p, label, 'down' + k, shots);
      }
      for (let k = 1; k <= 4; k++) {
        for (let j = 0; j < 9; j++) { await p.mouse.wheel({ deltaY: -120 }); await L.w8(60); }
        await L.w8(2200);
        await shoot(p, label, 'up' + k, shots);
      }
    }
    const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
    return { shots, errs };
  } finally { await b.close(); }
}

async function maskCopy(src, ref, rects, dst) {
  const meta = await sharp(src).metadata();
  const comps = [];
  for (const r of rects) {
    const left = Math.max(0, Math.floor((r.x - 24) * DPR)), top = Math.max(0, Math.floor((r.y - 24) * DPR));
    const width = Math.min(meta.width - left, Math.ceil((r.w + 48) * DPR)), height = Math.min(meta.height - top, Math.ceil((r.h + 48) * DPR));
    if (width <= 0 || height <= 0) continue;
    comps.push({ input: await sharp(ref).ensureAlpha().extract({ left, top, width, height }).toBuffer(), left, top });
  }
  await sharp(src).ensureAlpha().composite(comps).png().toFile(dst);
}

(async () => {
  const R = { A: await run('baseline', 'A'), B: await run('baseline', 'B') };
  for (const v of vars) R[v] = await run(v, v);
  const out = { scen, vp, DPR, errs: Object.fromEntries(Object.entries(R).map(([k, x]) => [k, x.errs])), rows: [] };
  console.log('== ', scen, vp, 'DPR', DPR, 'errs', JSON.stringify(out.errs));
  const A = R.A.shots;
  console.log('lenis/hoverNone', A[0].lenis, A[0].hoverNone);
  for (let i = 0; i < A.length; i++) {
    const key = A[i].key;
    const rects = Object.values(R).flatMap((x) => (x.shots[i] ? x.shots[i].mk : []));
    const Bm = path.join(OUT, `mB_${key}.png`); await maskCopy(R.B.shots[i].f, A[i].f, rects, Bm);
    const noise = await L.diff(A[i].f, Bm);
    const row = { key, A: { sy: A[i].sy, docH: A[i].docH, sec: A[i].sec, contain: A[i].pricingContain }, noise };
    const parts = [`${key} sy=${A[i].sy} contain=${A[i].pricingContain} noise(masked) ${noise.mad}/${noise.pct}`];
    for (const v of vars) {
      const s = R[v].shots[i];
      const Cm = path.join(OUT, `m${v}_${key}.png`); await maskCopy(s.f, A[i].f, rects, Cm);
      const Cb = path.join(OUT, `mb${v}_${key}.png`); await maskCopy(s.f, R.B.shots[i].f, rects, Cb);
      const dA = await L.diff(A[i].f, Cm, path.join(OUT, `heat_${v}_${key}.png`));
      const dB = await L.diff(R.B.shots[i].f, Cb);
      const geo = (s.sy !== A[i].sy || s.docH !== A[i].docH || s.sec !== A[i].sec) ? { sy: [A[i].sy, s.sy], docH: [A[i].docH, s.docH], sec: [A[i].sec, s.sec] } : 'same';
      const geoB = (R.B.shots[i].sy !== A[i].sy || R.B.shots[i].sec !== A[i].sec) ? 'AB-geo-differs' : '';
      const flag = Math.min(dA.pct, dB.pct) > noise.pct + 0.02;
      row[v] = { vsA: dA, vsB: dB, geo, contain: s.pricingContain, flag };
      parts.push(`${v}: A ${dA.mad}/${dA.pct} B ${dB.mad}/${dB.pct} bb=${JSON.stringify(dA.bbox)} contain=${s.pricingContain}${geo === 'same' ? '' : ' GEO=' + JSON.stringify(geo)} ${geoB}${flag ? ' <<<' : ''}`);
    }
    out.rows.push(row);
    console.log(parts.join(' | '));
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
