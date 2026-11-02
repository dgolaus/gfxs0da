// Skeptic behaviour checks: node sk.js <test>   -> out/<test>.json (+ png). ONE browser at a time, always closed.
// Each test runs baseline twice (A, B = A/A noise) then combined (C).
const fs = require('fs'); const path = require('path');
const L = require('/home/user/gfxs0da/perf-investigation/fixes/combined/vet/lib.js');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const test = process.argv[2];
const RUNS = [['A', 'baseline'], ['B', 'baseline'], ['C', 'combined']];
const save = (n, o) => { fs.writeFileSync(path.join(OUT, n + '.json'), JSON.stringify(o, null, 1)); console.log('wrote', n); };

async function withPage(vname, o, fn) {
  const b = await L.launch({ touch: !!o.mobile });
  try {
    const { p, c } = await L.open(b, vname, o);
    const res = await fn(p, c);
    let werrs = []; try { werrs = await p.evaluate(() => window.__errs || []); } catch (e) { werrs = ['eval-failed ' + e.message]; }
    return { ...res, pageErrors: (p.__errs || []).concat(werrs) };
  } finally { await b.close(); }
}
async function ready(p, url, o = {}) {
  await p.goto(L.BASE + url, { waitUntil: 'load', timeout: 90000 });
  if (!o.mobile && !o.reduced) { try { await p.waitForFunction(() => !!window.lenis, { timeout: 15000 }); } catch (e) {} }
}
// wait until scrollY unchanged for `still` ms (max `max`)
async function waitStill(p, still = 700, max = 8000) {
  await p.evaluate((still, max) => new Promise((res) => { let last = scrollY, t = performance.now(); const t0 = t;
    const f = () => { const n = performance.now(); if (scrollY !== last) { last = scrollY; t = n; } if (n - t >= still || n - t0 > max) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), still, max);
  await L.w8(150);
}
const STATE = () => {
  const r2 = (x) => Math.round(x * 10) / 10;
  const nav = document.getElementById('nav'); const cs = nav ? getComputedStyle(nav) : null;
  const links = nav && nav.querySelector('.nav-links'), brand = nav && nav.querySelector(':scope > .brand'), cta = nav && nav.querySelector(':scope > .btn');
  const num = (s) => (s === '' ? '' : String(+parseFloat(s).toFixed(3)));
  const secs = ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => document.getElementById(id)).filter(Boolean);
  const footer = document.querySelector('.cfooter');
  return {
    sy: r2(scrollY), docH: document.documentElement.scrollHeight, iw: innerWidth, lenis: !!window.lenis,
    limitOk: window.lenis ? Math.abs(window.lenis.limit - (document.documentElement.scrollHeight - innerHeight)) < 1 : null,
    navVars: cs ? ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => num(cs.getPropertyValue(k).trim())) : null,
    navLook: cs ? [cs.paddingTop, getComputedStyle(nav, '::before').opacity, links && getComputedStyle(links, '::before').opacity,
      links && getComputedStyle(links).padding, brand && getComputedStyle(brand).opacity + ' ' + getComputedStyle(brand).transform,
      cta && getComputedStyle(cta).opacity + ' ' + getComputedStyle(cta).transform, nav.classList.contains('is-pill'), nav.classList.contains('scrolled')] : null,
    sec: secs.map((s) => { const c = getComputedStyle(s); return [s.id, c.opacity, c.filter, c.transform, r2(s.getBoundingClientRect().top), c.contain]; }),
    fp: footer ? num(getComputedStyle(footer).getPropertyValue('--fp').trim()) : null,
    tcols: [...document.querySelectorAll('.tcols .tcol-track')].map((t) => t.children.length + ':' + t.querySelectorAll('[aria-hidden]').length),
    focus: document.activeElement ? (document.activeElement.tagName + (document.activeElement.id ? '#' + document.activeElement.id : '') + '.' + (document.activeElement.className || '').toString().slice(0, 30) + ' ' + (document.activeElement.getAttribute('href') || '')) : null,
    spy: [...document.querySelectorAll('.is-active')].map((e) => e.tagName + ':' + (e.getAttribute('href') || e.textContent.trim().slice(0, 20))).slice(0, 5),
    hash: location.hash, overflow: document.documentElement.style.overflow + '|' + document.body.style.overflow,
  };
};
const state = (p) => p.evaluate(STATE);
const freezeShot = async (p, file, clip) => { await L.freeze(p); await p.screenshot({ path: file, clip }); await L.unfreeze(p); return file; };

// compare objects: list keys where C differs from both A and B, and where A differs from B
function cmp(a, b, c, pre = '') {
  const out = { AB: [], AC: [], CnotAB: [] };
  const walk = (x, y, z, k) => {
    if (x && typeof x === 'object') { for (const kk of new Set([...Object.keys(x), ...Object.keys(z || {})])) walk(x[kk], y ? y[kk] : undefined, z ? z[kk] : undefined, k + '.' + kk); return; }
    const sx = JSON.stringify(x), sy = JSON.stringify(y), sz = JSON.stringify(z);
    if (sx !== sy) out.AB.push(k + ' A=' + sx + ' B=' + sy);
    if (sx !== sz) out.AC.push(k + ' A=' + sx + ' C=' + sz);
    if (sz !== sx && sz !== sy) out.CnotAB.push(k + ' A=' + sx + ' B=' + sy + ' C=' + sz);
  };
  walk(a, b, c, pre);
  return out;
}
async function shotCmp(files) { // files: {A,B,C}
  return { AB: await L.diff(files.A, files.B), AC: await L.diff(files.A, files.C), BC: await L.diff(files.B, files.C) };
}
const T = {};

// (R) RE-RUN: nav clicks with Lenis at 1440 (the vetter's key desktop-Lenis check), real mouse clicks
const NAVSEQ = ['#work', '#about', '#trust', '#pricing', '#contact', '#process', '#about', '#work'];
async function navclicks(tag, o) {
  const runs = {};
  for (const [lab, v] of RUNS) {
    runs[lab] = await withPage(v, o, async (p) => {
      await ready(p, '/', o); await L.settle(p, 2500);
      const env = await p.evaluate(() => ({ lenis: !!window.lenis, hoverNone: matchMedia('(hover: none)').matches }));
      const steps = [];
      for (const h of NAVSEQ) {
        const sel = `.nav-links a[href="${h}"]`;
        const exists = await p.$(sel);
        if (!exists) { steps.push({ h, missing: true }); continue; }
        const t0 = Date.now();
        try { await p.click(sel); } catch (e) { await p.evaluate((sel) => document.querySelector(sel).click(), sel); }
        await L.w8(100); await waitStill(p, 800, 9000);
        const dur = Date.now() - t0;
        const s = await state(p);
        const f = await freezeShot(p, path.join(OUT, `${tag}_${lab}_${h.slice(1)}_${steps.length}.png`));
        steps.push({ h, dur, s, f });
      }
      return { env, steps };
    });
  }
  const res = { tag, o, runs: {}, cmp: [], shots: [] };
  for (const k of Object.keys(runs)) res.runs[k] = { env: runs[k].env, pageErrors: runs[k].pageErrors, steps: runs[k].steps.map((s) => ({ h: s.h, dur: s.dur, s: s.s })) };
  for (let i = 0; i < NAVSEQ.length; i++) {
    const [a, b, c] = ['A', 'B', 'C'].map((k) => runs[k].steps[i]);
    if (!a || !a.s) continue;
    res.cmp.push({ i, h: a.h, ...cmp(a.s, b.s, c.s) });
    res.shots.push({ i, h: a.h, ...(await shotCmp({ A: a.f, B: b.f, C: c.f })) });
  }
  save(tag, res);
}
T.navclicks1440 = () => navclicks('navclicks1440', { w: 1440, h: 900 });
// NEW widths / DPR (desktop with Lenis)
T.navclicks1024 = () => navclicks('navclicks1024', { w: 1024, h: 768 });
T.navclicks1920 = () => navclicks('navclicks1920', { w: 1920, h: 1080 });
T.navclicks2560 = () => navclicks('navclicks2560', { w: 2560, h: 1440 });
T.navclicks1440dpr2 = () => navclicks('navclicks1440dpr2', { w: 1440, h: 900, dpr: 2 });
T.navclicks1440cpu4 = () => navclicks('navclicks1440cpu4', { w: 1440, h: 900, throttle: 4 });
T.navclicks768touch = () => navclicks('navclicks768touch', { w: 768, h: 1024, mobile: true });

// NEW: live resize sequence across the 1440 contain boundary and testimonial/Lenis limit
T.resize = async () => {
  const SIZES = [[1440, 900], [1439, 900], [1441, 900], [1920, 1080], [1280, 800], [1440, 900], [900, 900], [1440, 900]];
  const runs = {};
  for (const [lab, v] of RUNS) {
    runs[lab] = await withPage(v, { w: 1440, h: 900 }, async (p) => {
      await ready(p, '/#pricing'); await L.settle(p, 2500); await waitStill(p);
      const steps = [];
      for (const [w, h] of SIZES) {
        await p.setViewport({ width: w, height: h });
        await L.w8(1200);
        // re-anchor to pricing with lenis like a user who keeps reading
        await p.evaluate(() => { const t = document.getElementById('pricing'); const y = t.getBoundingClientRect().top + scrollY - 80; if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); });
        await L.w8(1300);
        const s = await state(p);
        const f = await freezeShot(p, path.join(OUT, `resize_${lab}_${steps.length}_${w}.png`));
        steps.push({ w, h, s, f });
      }
      return { steps };
    });
  }
  const res = { runs: {}, cmp: [], shots: [] };
  for (const k of Object.keys(runs)) res.runs[k] = { pageErrors: runs[k].pageErrors, steps: runs[k].steps.map((s) => ({ w: s.w, s: s.s })) };
  for (let i = 0; i < SIZES.length; i++) {
    const [a, b, c] = ['A', 'B', 'C'].map((k) => runs[k].steps[i]);
    res.cmp.push({ i, w: a.w, ...cmp(a.s, b.s, c.s) });
    res.shots.push({ i, w: a.w, ...(await shotCmp({ A: a.f, B: b.f, C: c.f })) });
  }
  save('resize', res);
};

// NEW: keyboard navigation with Lenis: End, Home, PageDown x6, Space, Shift+Space, Tab x25
T.keys = async () => {
  const SEQ = [['End'], ['Home'], ['PageDown'], ['PageDown'], ['PageDown'], ['PageDown'], ['PageDown'], ['PageDown'], ['Space'], ['Shift+Space'], ['Home']];
  for (let i = 0; i < 25; i++) SEQ.push(['Tab']);
  SEQ.push(['Home']);
  const runs = {};
  for (const [lab, v] of RUNS) {
    runs[lab] = await withPage(v, { w: 1440, h: 900 }, async (p) => {
      await ready(p, '/'); await L.settle(p, 2500);
      await p.mouse.move(700, 500);
      const steps = [];
      for (const [k] of SEQ) {
        if (k === 'Shift+Space') { await p.keyboard.down('Shift'); await p.keyboard.press('Space'); await p.keyboard.up('Shift'); }
        else await p.keyboard.press(k);
        await L.w8(100); await waitStill(p, 700, 8000);
        const s = await state(p);
        let f = null;
        if (k !== 'Tab' || steps.length % 5 === 0) f = await freezeShot(p, path.join(OUT, `keys_${lab}_${steps.length}.png`));
        steps.push({ k, s, f });
      }
      return { steps };
    });
  }
  const res = { runs: {}, cmp: [], shots: [] };
  for (const k of Object.keys(runs)) res.runs[k] = { pageErrors: runs[k].pageErrors, steps: runs[k].steps.map((s) => ({ k: s.k, s: s.s })) };
  for (let i = 0; i < SEQ.length; i++) {
    const [a, b, c] = ['A', 'B', 'C'].map((k) => runs[k].steps[i]);
    res.cmp.push({ i, k: a.k, ...cmp(a.s, b.s, c.s) });
    if (a.f && b.f && c.f) res.shots.push({ i, k: a.k, ...(await shotCmp({ A: a.f, B: b.f, C: c.f })) });
  }
  save('keys', res);
};

// NEW: wheel scrolling at CPU 4x with Lenis: per-frame consistency of nav look / section fade vs scrollY, then rest states
T.wheel4x = async () => {
  const runs = {};
  const REC = () => {
    window.__rec = []; const nav = document.getElementById('nav'); const links = nav.querySelector('.nav-links');
    const secs = ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => document.getElementById(id));
    const f = () => { if (!window.__rec) return; const cs = getComputedStyle(nav);
      window.__rec.push([scrollY, cs.paddingTop, getComputedStyle(nav, '::before').opacity, getComputedStyle(links, '::before').opacity,
        ...secs.map((s) => [getComputedStyle(s).opacity, s.getBoundingClientRect().bottom, innerHeight])]); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  };
  for (const [lab, v] of RUNS) {
    runs[lab] = await withPage(v, { w: 1440, h: 900, throttle: 4 }, async (p) => {
      await ready(p, '/'); await L.settle(p, 3000);
      await p.mouse.move(700, 450);
      const rests = [];
      await p.evaluate(REC);
      for (const [dir, n] of [[1, 25], [1, 40], [-1, 20], [1, 80], [-1, 200]]) {
        for (let i = 0; i < n; i++) { await p.mouse.wheel({ deltaY: 100 * dir }); await L.w8(16); }
        await waitStill(p, 900, 15000);
        const s = await state(p);
        const f = await freezeShot(p, path.join(OUT, `wheel4x_${lab}_${rests.length}.png`));
        rests.push({ dir, n, s, f });
      }
      const rec = await p.evaluate(() => { const r = window.__rec; window.__rec = null; return r; });
      return { rests, rec };
    });
  }
  // per-frame model check: nav look must be a function of scrollY (with <=2 frame lag); section opacity = 1-leave(bottom)
  const navF = (sy) => { const c = (v) => Math.max(0, Math.min(1, v)); const t = c(sy / 360); const p = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return [16 - p * 6, c(1 - p * 1.5), c((p - 0.3) / 0.5)]; };
  const res = { runs: {}, cmp: [], shots: [], frameModel: {} };
  for (const k of Object.keys(runs)) {
    const rec = runs[k].rec; let navBad = 0, secBad = 0;
    for (let i = 2; i < rec.length; i++) {
      const got = [parseFloat(rec[i][1]), +rec[i][2], +rec[i][3]];
      const ok = [0, 1, 2].some((lag) => { const e = navF(rec[i - lag][0]); return Math.abs(e[0] - got[0]) < 0.02 && Math.abs(e[1] - got[1]) < 0.002 && Math.abs(e[2] - got[2]) < 0.002; });
      if (!ok) navBad++;
      for (let j = 4; j < rec[i].length; j++) {
        const okS = [0, 1, 2, 3].some((lag) => { if (!rec[i - lag] || !rec[i - lag][j]) return false; const [, bot, vh] = rec[i - lag][j]; const fs0 = vh * 0.3; const lv = bot < fs0 ? Math.min(1, (fs0 - bot) / fs0) : 0; return Math.abs((1 - +lv.toFixed(3)) - +rec[i][j][0]) < 0.002; });
        if (!okS) secBad++;
      }
    }
    res.frameModel[k] = { frames: rec.length, navBad, secBad };
    res.runs[k] = { pageErrors: runs[k].pageErrors, rests: runs[k].rests.map((r) => ({ dir: r.dir, n: r.n, s: r.s })) };
  }
  for (let i = 0; i < runs.A.rests.length; i++) {
    const [a, b, c] = ['A', 'B', 'C'].map((k) => runs[k].rests[i]);
    res.cmp.push({ i, ...cmp(a.s, b.s, c.s) });
    res.shots.push({ i, ...(await shotCmp({ A: a.f, B: b.f, C: c.f })) });
  }
  save('wheel4x', res);
};

// NEW: history: reload mid-page (scroll restoration), navigate to /tos/ and back, and live reduced-motion toggle
T.history = async () => {
  const runs = {};
  for (const [lab, v] of RUNS) {
    runs[lab] = await withPage(v, { w: 1440, h: 900 }, async (p) => {
      const steps = [];
      const snap = async (name) => { await L.w8(1500); await waitStill(p, 700, 8000); steps.push({ name, s: await state(p), f: await freezeShot(p, path.join(OUT, `history_${lab}_${steps.length}.png`)) }); };
      await ready(p, '/'); await L.settle(p, 2500);
      await p.evaluate(() => window.lenis ? window.lenis.scrollTo(2600, { immediate: true, force: true }) : scrollTo(0, 2600));
      await snap('at2600');
      await p.reload({ waitUntil: 'load' }); try { await p.waitForFunction(() => !!window.lenis, { timeout: 15000 }); } catch (e) {}
      await L.settle(p, 1500); await snap('reload');
      await p.goto(L.BASE + '/tos/', { waitUntil: 'load' }); await L.settle(p, 1500); await snap('tos');
      await p.goBack({ waitUntil: 'load' }); await L.settle(p, 1500); await snap('back');
      await p.evaluate(() => window.lenis ? window.lenis.scrollTo(4300, { immediate: true, force: true }) : scrollTo(0, 4300));
      await snap('at4300');
      await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await snap('rm-on');
      await p.evaluate(() => window.lenis ? window.lenis.scrollTo(300, { immediate: true, force: true }) : scrollTo(0, 300));
      await snap('rm-on-300');
      await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      await p.evaluate(() => window.lenis ? window.lenis.scrollTo(5000, { immediate: true, force: true }) : scrollTo(0, 5000));
      await snap('rm-off-5000');
      await p.evaluate(() => window.lenis ? window.lenis.scrollTo(0, { immediate: true, force: true }) : scrollTo(0, 0));
      await snap('top');
      return { steps };
    });
  }
  const res = { runs: {}, cmp: [], shots: [] };
  for (const k of Object.keys(runs)) res.runs[k] = { pageErrors: runs[k].pageErrors, steps: runs[k].steps.map((s) => ({ name: s.name, s: s.s })) };
  for (let i = 0; i < runs.A.steps.length; i++) {
    const [a, b, c] = ['A', 'B', 'C'].map((k) => runs[k].steps[i]);
    res.cmp.push({ i, name: a.name, ...cmp(a.s, b.s, c.s) });
    res.shots.push({ i, name: a.name, ...(await shotCmp({ A: a.f, B: b.f, C: c.f })) });
  }
  save('history', res);
};

// NEW: mobile 390 page-height timeline (tests the vetter's "Discord chat timeline" explanation of the 70px offset)
T.mobheight = async () => {
  const res = {};
  for (const v of ['baseline', 'combined']) {
    res[v] = [];
    for (let rep = 0; rep < 3; rep++) {
      res[v].push(await withPage(v, { w: 390, h: 844, mobile: true }, async (p) => {
        await p.goto(L.BASE + '/', { waitUntil: 'load' });
        const t0 = Date.now(); const samples = [];
        for (const t of [500, 1500, 3000, 5000, 8000, 12000, 16000]) {
          await L.w8(Math.max(0, t - (Date.now() - t0)));
          samples.push(await p.evaluate(() => { const g = (id) => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().height) : null; };
            const chat = document.querySelector('#process [class*="chat"], #process [class*="discord"]');
            return { t: 0, docH: document.documentElement.scrollHeight, process: g('process'), trust: g('trust'), pricing: g('pricing'), testimonials: g('testimonials'),
              chatH: chat ? Math.round(chat.getBoundingClientRect().height) : null, chatCls: chat ? chat.className : null,
              msgs: document.querySelectorAll('#process [class*="msg"]').length }; }));
          samples[samples.length - 1].t = t;
        }
        return { samples };
      }));
    }
  }
  save('mobheight', res);
};

// raster-state check: fresh load, Lenis jump to Y, frozen shot; N reps per variant interleaved; md5 clusters
T.rasterY = async () => {
  const crypto = require('crypto'); const Y = +(process.env.Y || 4300), N = +(process.env.N || 4); const tag = 'rasterY_' + Y + (process.env.TAGX || '');
  const rows = [];
  for (let r = 0; r < N; r++) for (const v of ['baseline', 'combined']) {
    const x = await withPage(v, { w: 1440, h: 900 }, async (p) => {
      await ready(p, '/'); await L.settle(p, 2500);
      if (process.env.HIST) { await p.reload({ waitUntil: 'load' }); await L.settle(p, 1500); await p.goto(L.BASE + '/tos/', { waitUntil: 'load' }); await L.settle(p, 1500); await p.goBack({ waitUntil: 'load' }); await L.settle(p, 1500); }
      await p.evaluate((Y) => window.lenis ? window.lenis.scrollTo(Y, { immediate: true, force: true }) : scrollTo(0, Y), Y);
      await L.w8(1500); await waitStill(p);
      const f = path.join(OUT, `${tag}_${v}_${r}.png`); await freezeShot(p, f);
      return { f, s: await state(p) };
    });
    rows.push({ v, r, f: x.f, md5: crypto.createHash('md5').update(fs.readFileSync(x.f)).digest('hex').slice(0, 8), sy: x.s.sy, errs: x.pageErrors });
  }
  const pair = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) pair.push([rows[i].v[0] + rows[i].r, rows[j].v[0] + rows[j].r, (await L.diff(rows[i].f, rows[j].f)).pct]);
  save(tag, { rows, pair });
  console.log(rows.map((x) => x.v + x.r + ':' + x.md5 + '@' + x.sy).join(' '));
};

(async () => { if (!T[test]) throw new Error('unknown test ' + test + ' (' + Object.keys(T).join(',') + ')'); await T[test](); })().catch((e) => { console.error(e); process.exit(1); });
