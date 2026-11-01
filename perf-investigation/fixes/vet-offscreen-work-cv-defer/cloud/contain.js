// Same-page A/B for containment: variant page, every hoverable inside the cv sections hovered
// (element placed at viewport center, and again near the top and bottom edge of the viewport),
// frozen, screenshot with content-visibility:auto, then with it forced to visible. Zero-noise diff.
// Also compares the rect of every element in the 5 sections between the two modes.
// node contain.js <tag> <WxH[m]> [variant]
const fs = require('fs'); const path = require('path');
const L = require('./lib.js');
const [tag, sz, V0] = process.argv.slice(2);
const v = V0 || 'cvd';
const mobile = sz.endsWith('m'); const [W, H] = sz.replace('m', '').split('x').map(Number);
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
const SEL = '#main > section.about, #main > section.process, #main > section.trust, #main > section.pricing, #contact';
const OFF = `${SEL.split(',').map((s) => s.trim()).join(',')}{content-visibility:visible !important}`;
(async () => {
  const b = await L.launch();
  const { p } = await L.open(b, v, { w: W, h: H, mobile });
  await p.goto(L.BASE + '/', { waitUntil: 'load' });
  await L.settle(p, 2000);
  // render everything once
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
  await L.w8(1500);
  // layout comparison of every element (doc coordinates)
  const rects = async () => p.evaluate((SEL) => [...document.querySelectorAll(SEL)].flatMap((s) => [s, ...s.querySelectorAll('*')]).map((e) => { const r = e.getBoundingClientRect(); return [Math.round((r.left) * 100) / 100, Math.round((r.top + scrollY) * 100) / 100, Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100]; }), SEL);
  await p.evaluate(() => { window.__st = window.setTimeout; window.__q = []; window.setTimeout = (fn, ms, ...a) => { window.__q.push([fn, ms, a]); return 0; }; });
  await L.w8(1600);
  await L.freeze(p);
  const rA = await rects();
  await p.evaluate((css) => { const s = document.createElement('style'); s.id = '__off'; s.textContent = css; document.head.appendChild(s); }, OFF);
  await L.w8(200);
  const rB = await rects();
  await p.evaluate(() => document.getElementById('__off').remove());
  const rC = await rects();
  await p.evaluate(() => { window.setTimeout = window.__st; const q = window.__q; window.__q = []; q.forEach(([fn, ms, a]) => window.__st(fn, ms, ...a)); });
  await L.unfreeze(p);
  console.log(tag, 'rect control (auto again) diffs:', rA.filter((r, i) => r.join() !== rC[i].join()).length);
  const rectDiffs = []; rA.forEach((r, i) => { if (r.join() !== rB[i].join()) rectDiffs.push([i, r, rB[i]]); });
  console.log(tag, 'elements', rA.length, 'rect diffs cv vs visible:', rectDiffs.length, JSON.stringify(rectDiffs.slice(0, 5)));
  const targets = await p.evaluate((SEL) => {
    const out = [];
    document.querySelectorAll(SEL).forEach((s) => s.querySelectorAll('a, button, input, select, label, .quote, .price-card, .chat-card, .trust-stat, .studio-chip, [data-tip], .star, .stars').forEach((e) => {
      if (e.closest('[aria-hidden="true"]')) return;
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      if (getComputedStyle(e).visibility === 'hidden') return;
      const k = 'h' + out.length; e.setAttribute('data-hv', k);
      out.push({ k, sec: s.id, desc: e.tagName.toLowerCase() + '.' + [...e.classList].join('.'), docY: r.top + scrollY, h: r.height, x: r.left + r.width / 2 });
    }));
    return out;
  }, SEL);
  const res = { tag, sz, v, rectDiffs, shots: [] };
  for (const t of targets) for (const place of ['mid', 'top', 'bot']) {
    if (t.h > H * 0.8 && place !== 'mid') continue;
    const cy = place === 'mid' ? H / 2 : place === 'top' ? Math.min(H / 2, t.h / 2 + 6) : Math.max(H / 2, H - t.h / 2 - 6);
    const y = Math.max(0, Math.round(t.docY + t.h / 2 - cy));
    await p.evaluate((y) => { window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); }, y);
    await L.w8(250);
    const c = await p.evaluate((k) => { const r = document.querySelector(`[data-hv="${k}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + Math.min(r.height / 2, 30)]; }, t.k);
    if (c[1] < 0 || c[1] > H) continue;
    if (mobile) await p.touchscreen.tap(c[0], c[1]).catch(() => {}); else await p.mouse.move(c[0], c[1]);
    // hold JS timers (chat timeline, star flashes, counters): new setTimeout calls are queued, pending ones drain
    await p.evaluate(() => { if (!window.__st) { window.__st = window.setTimeout; window.__q = []; } window.setTimeout = (fn, ms, ...a) => { window.__q.push([fn, ms, a]); return 0; }; });
    await L.w8(1600);
    await L.freeze(p);
    const fa = path.join(OUT, `${t.k}_${place}_a.png`), fb = path.join(OUT, `${t.k}_${place}_b.png`);
    await p.screenshot({ path: fa });
    await p.evaluate((css) => { const s = document.createElement('style'); s.id = '__off'; s.textContent = css; document.head.appendChild(s); }, OFF);
    await L.w8(150);
    await p.screenshot({ path: fb });
    await p.evaluate(() => document.getElementById('__off').remove());
    const d = await L.diff(fa, fb, path.join(OUT, `heat_${t.k}_${place}.png`));
    res.shots.push({ ...t, place, d });
    if (d.bbox) console.log('DIFF', t.k, t.sec, t.desc, place, JSON.stringify(d));
    
    // control: same mode (auto) again, to catch anything that still moved between the two shots
    const fa2 = path.join(OUT, `${t.k}_${place}_a2.png`);
    await p.screenshot({ path: fa2 });
    const dn = await L.diff(fa, fa2);
    res.shots[res.shots.length - 1].noise = dn;
    if (!dn.bbox) fs.unlinkSync(fa2);
    if (!d.bbox) { fs.unlinkSync(fa); fs.unlinkSync(fb); }
    await p.evaluate(() => { window.setTimeout = window.__st; const q = window.__q; window.__q = []; q.forEach(([fn, ms, a]) => window.__st(fn, ms, ...a)); });
    await L.unfreeze(p);
    if (!mobile) await p.mouse.move(2, 2);
  }
  res.errs = await p.evaluate(() => window.__errs);
  await b.close();
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(res, null, 1));
  console.log(tag, 'targets', targets.length, 'shots', res.shots.length, 'with diff', res.shots.filter((s) => s.d.bbox).length, 'errs', JSON.stringify(res.errs));
})().catch((e) => { console.error(e); process.exit(1); });
