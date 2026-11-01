// Invariant check, every animation frame from first rAF to the end of a long real-input interaction script:
// for every .btn / .quote / .price-card host, ::after 4 corner radii must equal the host's 4 corner radii
// (that is exactly what baseline `inherit` guarantees). Any frame where they differ is a divergence.
// Unlike forced pseudo-state dumps, this covers mid-intro frames, mid-transition frames, real Tab/Shift+Tab,
// real mouse hover/press, scroll-driven class changes, lightbox open/close focus return, and emulated media.
// usage: node inv.js <variant> <page> <WxH> <flags: mobile,reduced,print,forced,dpr2,light> <outTag>
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [vname, pg, vp, flags = '', tag = 'x'] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const F = new Set(flags.split(',').filter(Boolean));
const OUT = path.join(__dirname, 'inv'); fs.mkdirSync(OUT, { recursive: true });

const SAMPLER = `(() => {
  window.__inv = { frames: 0, checks: 0, mism: [], hostRs: {}, phases: [] , phase: 'load'};
  const C = ['borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius'];
  function tick() {
    const I = window.__inv; I.frames++;
    const els = document.querySelectorAll('.btn, .quote, .price-card');
    for (let i = 0; i < els.length; i++) {
      const el = els[i]; const h = getComputedStyle(el), a = getComputedStyle(el, '::after');
      const hv = C.map((k) => h[k]).join(' '), av = C.map((k) => a[k]).join(' ');
      I.checks++;
      const key = (el.className || '').replace(/\\s+/g, '.') ;
      I.hostRs[hv] = (I.hostRs[hv] || 0) + 1;
      if (hv !== av && I.mism.length < 400) I.mism.push({ f: I.frames, ph: I.phase, t: Math.round(performance.now()), el: key + '#' + i, host: hv, after: av, fv: el.matches(':focus-visible'), hov: el.matches(':hover'), content: a.content });
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();`;

(async () => {
  const b = await L.launch();
  const { p, c } = await L.open(b, vname, { w: W, h: H, mobile: F.has('mobile'), reduced: F.has('reduced'), dpr: F.has('dpr2') ? 2 : 1, pre: SAMPLER });
  if (F.has('print')) await p.emulateMediaType('print');
  const feats = [];
  if (F.has('forced')) feats.push({ name: 'forced-colors', value: 'active' });
  if (F.has('light')) feats.push({ name: 'prefers-color-scheme', value: 'light' });
  if (F.has('contrast')) feats.push({ name: 'prefers-contrast', value: 'more' });
  if (feats.length) await c.send('Emulation.setEmulatedMedia', { features: feats.concat(F.has('reduced') ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : []) });
  const ph = (s) => p.evaluate((s) => { window.__inv.phase = s; }, s);
  await p.goto(L.BASE + pg, { waitUntil: 'load' });
  await ph('intro');
  await L.w8(4000);
  // scroll progressively through the page (wheel = real input; smooth-scroll may own it)
  await ph('scroll');
  const docH = await p.evaluate(() => document.documentElement.scrollHeight);
  if (!F.has('mobile')) { await p.mouse.move(W / 2, H / 2); for (let y = 0; y < docH; y += H / 3) { await p.mouse.wheel({ deltaY: H / 3 }); await L.w8(140); } }
  else { for (let y = 0; y < docH; y += H / 3) { await p.evaluate((d) => scrollBy(0, d), H / 3); await L.w8(140); } }
  await L.w8(800);
  // real mouse hover / move / press-release-elsewhere on every host
  await ph('hover');
  const n = await p.evaluate(() => document.querySelectorAll('.btn, .quote, .price-card').length);
  for (let i = 0; i < n; i++) {
    const r = await p.evaluate((i) => {
      const el = document.querySelectorAll('.btn, .quote, .price-card')[i]; let r = el.getBoundingClientRect(); if (!r.width) return null;
      const y = r.top + scrollY - innerHeight / 2;
      if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
      r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    }, i);
    if (!r || r.y < 0 || r.y > H) continue;
    await L.w8(120);
    await p.mouse.move(r.x - r.w / 3, r.y, { steps: 4 }); await L.w8(150);
    await p.mouse.move(r.x + r.w / 3, r.y, { steps: 6 }); await L.w8(250);
    if (!F.has('mobile')) { await p.mouse.down(); await L.w8(120); await p.mouse.move(2, 2, { steps: 3 }); await p.mouse.up(); }
    await L.w8(150);
  }
  // keyboard: Tab forward through the page while the mouse sits over whatever is there, then Shift+Tab back
  await ph('tab');
  await p.evaluate(() => { if (window.lenis) window.lenis.scrollTo(0, { immediate: true, force: true }); else scrollTo(0, 0); document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
  await L.w8(300);
  for (let i = 0; i < 70; i++) { await p.keyboard.press('Tab'); await L.w8(i % 3 ? 40 : 260); }
  await ph('shifttab');
  for (let i = 0; i < 40; i++) { await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); await L.w8(i % 3 ? 40 : 220); }
  // focus a .btn with the keyboard, then hover it with the mouse mid-focusPop, then click elsewhere (blur) mid-sheen
  await ph('tab+hover');
  const bn = await p.evaluate(() => document.querySelectorAll('.btn').length);
  for (let i = 0; i < bn; i++) {
    const r = await p.evaluate((i) => {
      const el = document.querySelectorAll('.btn')[i]; if (!el.getBoundingClientRect().width) return null;
      el.blur(); const y = el.getBoundingClientRect().top + scrollY - innerHeight / 2;
      if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
      // put keyboard focus on the previous focusable so one Tab lands on the button with :focus-visible
      const all = [...document.querySelectorAll('a[href],button,[tabindex]:not([tabindex="-1"]),input,select,textarea')].filter((e) => e.getBoundingClientRect().width || e === el);
      const k = all.indexOf(el); if (k > 0) all[k - 1].focus({ preventScroll: true }); else document.body.focus();
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, i);
    if (!r) continue;
    await L.w8(100);
    await p.keyboard.press('Tab'); await L.w8(90);
    if (r.y > 0 && r.y < H) { await p.mouse.move(r.x, r.y, { steps: 3 }); await L.w8(300); await p.mouse.move(2, H - 2, { steps: 3 }); await L.w8(120); await p.mouse.move(r.x, r.y, { steps: 2 }); await L.w8(80); await p.mouse.click(2, H - 2); }
    await L.w8(500);
  }
  // lightbox open via keyboard on a card, close with Escape (focus return), index only
  await ph('lightbox');
  const hasCard = await p.evaluate(() => { const c = document.querySelector('.card[tabindex="0"]'); if (!c) return false; c.focus(); return true; });
  if (hasCard) { await p.keyboard.press('Enter'); await L.w8(900); await p.keyboard.press('Tab'); await L.w8(200); await p.keyboard.press('Escape'); await L.w8(900); await p.keyboard.press('Tab'); await L.w8(400); }
  await ph('end'); await L.w8(300);
  const res = await p.evaluate(() => window.__inv);
  res.errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
  res.n = n; res.bn = bn;
  await b.close();
  const sumPh = {}; for (const m of res.mism) { const k = m.ph + ' ' + m.el.split('#')[0] + ' host=' + m.host + ' after=' + m.after + (m.fv ? ' fv' : '') + (m.hov ? ' hov' : ''); sumPh[k] = (sumPh[k] || 0) + 1; }
  res.summary = sumPh;
  fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(res, null, 1));
  console.log(`${tag} ${vname} ${pg} ${vp} [${flags}] frames=${res.frames} checks=${res.checks} hosts=${n} btns=${bn} mismatches=${res.mism.length} hostRadii=${JSON.stringify(res.hostRs)} errs=${res.errs.length}`);
  for (const [k, v] of Object.entries(sumPh)) console.log('   MISMATCH', v, k);
})().catch((e) => { console.error(e); process.exit(1); });
