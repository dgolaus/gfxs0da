// Behaviour vetting: node beh.js <test> [variants...]   (default variants: baseline combined)
// Writes out/<test>.json. ONE browser at a time, always closed.
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const [test, ...vargs] = process.argv.slice(2);
const VARS = vargs.length ? vargs : ['baseline', 'combined'];
const DESK = { w: 1440, h: 900 }, MOB = { w: 390, h: 844, mobile: true, touch: true };
const SECS = ['about', 'process', 'trust', 'pricing', 'contact'];

// In-page instrumentation (runs before any page script)
const PRE = `(() => {
  window.__fetches = [];
  const of = window.fetch; window.fetch = function (u, o) { try { window.__fetches.push(String(u && u.url || u)); } catch (e) {} return of.apply(this, arguments); };
  window.__samples = [];
  window.__sampleFor = (ms, every, fn) => new Promise((res) => { const out = []; const t0 = performance.now();
    const id = setInterval(() => { try { out.push(fn(performance.now() - t0)); } catch (e) { out.push({ err: String(e) }); } if (performance.now() - t0 >= ms) { clearInterval(id); res(out); } }, every); });
  window.addEventListener('load', () => { const h = location.hash.slice(1); if (!h) return; window.__anch = window.__sampleFor(3000, 100, () => { const t = document.getElementById(h);
    return [Math.round(scrollY * 10) / 10, t ? Math.round(t.getBoundingClientRect().top * 10) / 10 : null]; }); });
  window.__rec = null;
  window.__recStart = () => {
    window.__rec = [];
    const nav = document.getElementById('nav');
    const links = nav && nav.querySelector('.nav-links'), brand = nav && nav.querySelector('.brand'), cta = nav && nav.querySelector(':scope > .btn');
    const secs = ["about","process","trust","pricing","contact"].map((id) => document.getElementById(id));
    const acc = [...document.querySelectorAll('.hero-title .accent, .process-text h2 .accent-soft')];
    const f = () => {
      if (!window.__rec) return;
      const r = { t: performance.now(), sy: scrollY };
      if (nav) { const cs = getComputedStyle(nav);
        r.nav = [cs.getPropertyValue('--nav-pill').trim(), cs.getPropertyValue('--nav-bar-vis').trim(), cs.getPropertyValue('--nav-pill-vis').trim()];
        r.navLook = [cs.paddingTop, getComputedStyle(nav, '::before').opacity, links ? getComputedStyle(links, '::before').opacity : null, links ? getComputedStyle(links).paddingLeft + ' ' + getComputedStyle(links).paddingTop : null,
          brand ? getComputedStyle(brand).opacity + ' ' + getComputedStyle(brand).transform : null, cta ? getComputedStyle(cta).opacity + ' ' + getComputedStyle(cta).transform : null, nav.classList.contains('is-pill')]; }
      r.acc = acc.map((a) => { const t = a.querySelector(':scope > .accent-text'); return [t ? t.style.backgroundImage : null, a.getBoundingClientRect().top, a.style.backgroundImage, getComputedStyle(a).backgroundImage, t ? getComputedStyle(t).backgroundImage : null]; });
      r.sec = secs.map((s) => s ? [getComputedStyle(s).opacity, getComputedStyle(s).filter, getComputedStyle(s).transform] : null);
      window.__rec.push(r); requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };
  window.__recStop = () => { const r = window.__rec; window.__rec = null; return r; };
})();`;

async function withPage(vname, o, fn) {
  const b = await L.launch({ touch: !!o.touch });
  try {
    const { p, c } = await L.open(b, vname, { ...o, pre: PRE + (o.pre || '') });
    const reqs = []; p.on('request', (r) => reqs.push(r.url()));
    const cons = []; p.on('console', (m) => { if (m.type() === 'error') cons.push(m.text()); });
    const res = await fn(p, c, reqs);
    let werrs = []; try { werrs = await p.evaluate(() => window.__errs || []); } catch (e) { werrs = ['eval-failed ' + e.message]; }
    return { ...res, pageErrors: (p.__errs || []).concat(werrs), consoleErrors: cons };
  } finally { await b.close(); }
}
async function gotoReady(p, url, o = {}) {
  await p.goto(L.BASE + url, { waitUntil: 'load', timeout: 90000 });
  if (!o.touch && !o.reduced) { try { await p.waitForFunction(() => !!window.lenis, { timeout: 15000 }); } catch (e) {} }
}
const env = (p) => p.evaluate(() => ({ lenis: !!window.lenis, hoverNone: matchMedia('(hover: none)').matches, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, iw: innerWidth, ih: innerHeight }));
const scrollToY = (p, y) => p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
const save = (name, obj) => { fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(obj, null, 1)); console.log('wrote', name); };

const T = {};

// (1) anchor loads ---------------------------------------------------------
T.anchors = async () => {
  const hashes = ['work', 'about', 'process', 'trust', 'testimonials', 'pricing', 'contact'];
  const res = [];
  for (const [vpn, vp] of [['desk', DESK], ['mob', MOB]]) for (let rep = 0; rep < 3; rep++) for (const v of VARS) {
    const r = await withPage(v, vp, async (p) => {
      const rows = [];
      for (const h of hashes) {
        await p.goto('about:blank');
        // sampler (PRE) starts at the load event, 100ms for 3s
        await p.goto(L.BASE + '/#' + h, { waitUntil: 'load', timeout: 90000 });
        const s = await p.evaluate(() => window.__anch);
        await L.w8(300);
        const fin = await p.evaluate((h) => { const t = document.getElementById(h); const max = document.documentElement.scrollHeight - innerHeight;
          return { sy: scrollY, top: t.getBoundingClientRect().top, max, lenis: !!window.lenis, limit: window.lenis ? window.lenis.limit : null, hoverNone: matchMedia('(hover: none)').matches }; }, h);
        rows.push({ h, fin, samples: s });
      }
      return { rows };
    });
    res.push({ vpn, rep, v, ...r });
    console.log(vpn, rep, v, r.rows.map((x) => `${x.h}:${Math.round(x.fin.sy)}/${Math.round(x.fin.top)}${x.fin.lenis ? 'L' : ''}`).join(' '), 'errs', r.pageErrors.length);
  }
  save('anchors', res);
};

// (2) nav link clicks with Lenis ---------------------------------------------
T.navclicks = async () => {
  const res = [];
  const seq = ['#work', '#about', '#trust', '#pricing', '#about', '#work', '#top'];
  for (let rep = 0; rep < 2; rep++) for (const v of VARS) {
    const r = await withPage(v, DESK, async (p) => {
      await gotoReady(p, '/'); await L.settle(p, 3000);
      const e0 = await env(p);
      const initial = await p.evaluate(() => ({ html: [...['--nav-pill', '--nav-bar-vis', '--nav-pill-vis']].map((k) => document.documentElement.style.getPropertyValue(k)), nav: [...['--nav-pill', '--nav-bar-vis', '--nav-pill-vis']].map((k) => document.getElementById('nav').style.getPropertyValue(k)) }));
      const clicks = [];
      for (const href of seq) {
        const sel = href === '#top' ? '#nav a.brand' : `#nav .nav-links a[href="${href}"]`;
        const pre = await p.evaluate((href, sel) => { const id = href.slice(1); const d = document.getElementById(id); const a = document.querySelector(sel); const cs = a && getComputedStyle(a);
          return { expect: Math.min(window.lenis.limit, Math.max(0, d.getBoundingClientRect().top + scrollY - 80)), sy: scrollY, vis: a ? [cs.opacity, cs.visibility, cs.pointerEvents, a.getBoundingClientRect().width] : null }; }, href, sel);
        await p.evaluate(() => window.__recStart());
        const tc = await p.evaluate(() => performance.now());
        let clickErr = null;
        try { await p.click(sel); } catch (e) { clickErr = e.message; }
        await L.w8(2600);
        const rec = await p.evaluate(() => window.__recStop());
        let last = tc; for (let i = 1; i < rec.length; i++) if (Math.abs(rec[i].sy - rec[i - 1].sy) > 0.1) last = rec[i].t;
        const fin = await p.evaluate(() => ({ sy: scrollY, hash: location.hash, html: ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => document.documentElement.style.getPropertyValue(k)), navInline: ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => document.getElementById('nav').style.getPropertyValue(k)) }));
        const shot = path.join(OUT, 'navclicks', `${v}_r${rep}_${href.slice(1)}_${clicks.length}.png`);
        fs.mkdirSync(path.dirname(shot), { recursive: true });
        await L.freeze(p); await p.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1440, height: 110 } }); await L.unfreeze(p);
        clicks.push({ href, pre, clickErr, fin, durMs: Math.round(last - tc), frames: rec.length, rec, shot });
      }
      return { env: e0, initial, clicks };
    });
    res.push({ rep, v, ...r });
    console.log(rep, v, JSON.stringify(r.env), r.clicks.map((c) => `${c.href}->${Math.round(c.fin.sy)}(exp ${Math.round(c.pre.expect)}) ${c.durMs}ms`).join(' | '), 'errs', r.pageErrors);
  }
  save('navclicks', res);
};

// (2b) nav morph at rest for each scroll position 0..420 (vars, look, crop screenshot)
T.navmorph = async () => {
  const res = [];
  for (const v of [VARS[0], ...VARS]) {
    const r = await withPage(v, DESK, async (p) => {
      await gotoReady(p, '/'); await L.settle(p, 3000);
      const rows = [];
      fs.mkdirSync(path.join(OUT, 'navmorph'), { recursive: true });
      for (let y = 0; y <= 420; y += 15) {
        await scrollToY(p, y); await L.w8(700);
        const st = await p.evaluate(() => { const n = document.getElementById('nav'); const cs = getComputedStyle(n); const links = n.querySelector('.nav-links'), brand = n.querySelector('.brand'), cta = n.querySelector(':scope > .btn');
          return { sy: scrollY, vars: ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => cs.getPropertyValue(k).trim()), linksVars: ['--nav-pill', '--nav-pill-vis'].map((k) => getComputedStyle(links).getPropertyValue(k).trim()),
            look: [cs.paddingTop, cs.paddingBottom, getComputedStyle(n, '::before').opacity, getComputedStyle(links, '::before').opacity, getComputedStyle(links).padding, getComputedStyle(brand).opacity, getComputedStyle(brand).transform, getComputedStyle(cta).opacity, getComputedStyle(cta).transform, n.classList.contains('is-pill'), n.classList.contains('scrolled')],
            htmlInline: document.documentElement.style.cssText, navInline: n.style.cssText, bodyVar: getComputedStyle(document.body).getPropertyValue('--nav-pill').trim() }; });
        const f = path.join(OUT, 'navmorph', `${v}_${res.length}_${y}.png`);
        await L.freeze(p); await p.screenshot({ path: f, clip: { x: 0, y: 0, width: 1440, height: 110 } }); await L.unfreeze(p);
        rows.push({ y, f, ...st });
      }
      return { env: await env(p), rows };
    });
    res.push({ v, ...r }); console.log(v, JSON.stringify(r.env), 'errs', r.pageErrors);
  }
  const A = res[0], B = res[1], cmp = [];
  for (let i = 0; i < A.rows.length; i++) { const row = { y: A.rows[i].y, noise: await L.diff(A.rows[i].f, B.rows[i].f), vars: A.rows[i].vars.join(',') };
    for (const x of res.slice(2)) { const c = x.rows[i]; row[x.v] = { vsA: await L.diff(A.rows[i].f, c.f), vsB: await L.diff(B.rows[i].f, c.f), varsNumEq: c.vars.every((q, j) => Math.abs(+q - +A.rows[i].vars[j]) < 1e-9), lookEqA: JSON.stringify(c.look) === JSON.stringify(A.rows[i].look), lookEqAA: JSON.stringify(B.rows[i].look) === JSON.stringify(A.rows[i].look), vars: c.vars.join(','), htmlInline: c.htmlInline, navInline: c.navInline, bodyVar: c.bodyVar, baseHtmlInline: A.rows[i].htmlInline }; }
    cmp.push(row); console.log(JSON.stringify(row)); }
  save('navmorph', { res, cmp });
};

// (2c) accent gradient converged values at rest + parent never painted
T.accent = async () => {
  const res = [];
  for (const [vpn, vp] of [['desk', DESK], ['mob', MOB]]) for (const v of [VARS[0], ...VARS]) {
    const r = await withPage(v, vp, async (p) => {
      await gotoReady(p, '/', vp); await L.settle(p, 2000);
      const pos = await p.evaluate(() => { const pr = document.querySelector('.process-text h2 .accent-soft').getBoundingClientRect().top + scrollY; return [0, 150, Math.round(pr - innerHeight * 0.8), Math.round(pr - innerHeight * 0.5), Math.round(pr - innerHeight * 0.2), 0]; });
      const rows = [];
      for (const y of pos) { await scrollToY(p, y); await L.w8(7000);
        rows.push(await p.evaluate(() => ({ sy: scrollY, acc: [...document.querySelectorAll('.hero-title .accent, .process-text h2 .accent-soft')].map((a) => { const t = a.querySelector(':scope > .accent-text');
          return { child: t.style.backgroundImage, childComputed: getComputedStyle(t).backgroundImage, parentInline: a.style.backgroundImage, parentComputed: getComputedStyle(a).backgroundImage, orbs: getComputedStyle(a.querySelector('.accent-orbs')).backgroundImage.slice(0, 40) }; }) }))); }
      return { env: await env(p), rows };
    });
    res.push({ vpn, v, ...r });
    console.log(vpn, v, JSON.stringify(r.env), r.rows.map((x) => Math.round(x.sy) + ':' + x.acc.map((a) => (/at 50% (-?[\d.]+)vh/.exec(a.child) || [])[1] + (a.parentComputed === 'none' ? '' : '!PARENT')).join('/')).join(' '), 'errs', r.pageErrors);
  }
  save('accent', res);
};

// (3) Lenis limit, footer --fp, --leave per section, rail thumb (walk down then up) ----
T.walkvars = async () => {
  const res = [];
  for (const [vpn, vp] of [['desk', DESK], ['mob', MOB]]) for (const v of [VARS[0], ...VARS]) {
    const r = await withPage(v, vp, async (p) => {
      await gotoReady(p, '/', vp); await L.settle(p, 3000);
      const e0 = await env(p);
      const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const stops = []; for (let y = 0; y <= max; y += +(process.env.STEP || 60)) stops.push(y); stops.push(max);
      const walk = [...stops, ...stops.slice().reverse()];
      const rows = [];
      for (const y of walk) {
        await scrollToY(p, y); await L.w8(+(process.env.WAIT || 140));
        rows.push(await p.evaluate((ids) => {
          const f = document.querySelector('.cfooter'); const fc = getComputedStyle(f);
          const title = document.querySelector('.cfooter-title'), center = document.getElementById('cfooter-center');
          const fpEls = [...document.querySelectorAll('.cfooter-giant, .cfooter-center')].map((el) => { const c = getComputedStyle(el); return c.opacity + '|' + c.transform; });
          const th = document.querySelector('.rail__thumb');
          return { sy: Math.round(scrollY * 10) / 10, fp: fc.getPropertyValue('--fp').trim(), fpInline: f.style.getPropertyValue('--fp'), fpEls,
            leave: ids.map((id) => { const s = document.getElementById(id); if (!s) return null; const c = getComputedStyle(s); return [c.getPropertyValue('--leave').trim(), s.style.getPropertyValue('--leave'), c.opacity, c.filter, c.transform, Math.round(s.getBoundingClientRect().bottom)]; }),
            thumb: th ? th.style.cssText : null, scrolling: document.documentElement.classList.contains('is-scrolling') };
        }, SECS));
      }
      const bottom = await p.evaluate(async () => { const max = document.documentElement.scrollHeight - innerHeight;
        if (window.lenis) window.lenis.scrollTo(window.lenis.limit, { immediate: true, force: true }); else window.scrollTo(0, 1e9);
        await new Promise((r) => setTimeout(r, 400));
        return { limit: window.lenis ? window.lenis.limit : null, max, sh: document.documentElement.scrollHeight, ih: innerHeight, sy: scrollY, lenisScroll: window.lenis ? window.lenis.scroll : null,
          transitions: ["about","process","trust","pricing","contact"].map((id) => { const s = document.getElementById(id); return s ? getComputedStyle(s).transitionProperty : null; }),
          childLeave: ["about","process","trust","pricing","contact"].map((id) => { const s = document.getElementById(id); const c = s && s.querySelector('*'); return c ? getComputedStyle(c).getPropertyValue('--leave').trim() : null; }) }; });
      // wheel to the very bottom too (real Lenis input)
      let wheel = null;
      if (e0.lenis) { await scrollToY(p, 0); await L.w8(300); await p.mouse.move(700, 450); for (let i = 0; i < 80; i++) { await p.mouse.wheel({ deltaY: 400 }); await L.w8(30); } await L.w8(2500);
        wheel = await p.evaluate(() => ({ sy: scrollY, limit: window.lenis.limit, max: document.documentElement.scrollHeight - innerHeight, fp: getComputedStyle(document.querySelector('.cfooter')).getPropertyValue('--fp').trim() })); }
      return { env: e0, max, rows, bottom, wheel };
    });
    res.push({ vpn, v, ...r });
    console.log(vpn, v, JSON.stringify(r.env), 'rows', r.rows.length, 'bottom', JSON.stringify(r.bottom), 'wheel', JSON.stringify(r.wheel), 'errs', r.pageErrors);
  }
  save(process.env.NAME || 'walkvars', res);
};

// (4) testimonials ------------------------------------------------------------
T.testimonials = async () => {
  const res = [];
  const snap = (p) => p.evaluate(() => {
    const h = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; };
    return { paused: document.getElementById('testimonials').classList.contains('is-paused'),
      cols: [...document.querySelectorAll('.tcols .tcol')].map((c) => { const t = c.querySelector('.tcol-track'); const cs = getComputedStyle(t);
        return { kids: t.children.length, hidden: t.querySelectorAll('[aria-hidden="true"]').length, h: t.getBoundingClientRect().height, colH: c.getBoundingClientRect().height, display: getComputedStyle(c).display,
          tf: cs.transform, anim: cs.animationName, play: cs.animationPlayState, hash: h(t.innerHTML), order: [...t.children].map((q) => (q.textContent || '').trim().slice(0, 12)).join('/') }; }) }; });
  for (const [vpn, vp] of [['desk', DESK], ['mob', MOB]]) for (const v of VARS) {
    const r = await withPage(v, vp, async (p) => {
      await gotoReady(p, '/', vp); await L.settle(p, 2500);
      const e0 = await env(p);
      const atLoad = await snap(p);
      await p.evaluate(() => { const el = document.getElementById('testimonials'); const y = el.getBoundingClientRect().top + scrollY - 100; if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); });
      await L.w8(800); const v1 = await snap(p); await L.w8(1200); const v2 = await snap(p);
      await scrollToY(p, 0); await L.w8(800); const o1 = await snap(p); await L.w8(1200); const o2 = await snap(p);
      await p.evaluate(() => { const el = document.getElementById('testimonials'); const y = el.getBoundingClientRect().top + scrollY - 100; if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); });
      await L.w8(800); const b1 = await snap(p); await L.w8(1200); const b2 = await snap(p);
      return { env: e0, atLoad, v1, v2, o1, o2, b1, b2 };
    });
    res.push({ vpn, v, ...r });
    const mv = (a, b) => a.cols.map((c, i) => c.tf !== b.cols[i].tf ? 'M' : '-').join('');
    console.log(vpn, v, 'kids', r.atLoad.cols.map((c) => c.kids + '/' + Math.round(c.h)).join(' '), 'visible', mv(r.v1, r.v2), r.v1.paused, 'off', mv(r.o1, r.o2), r.o1.paused, 'back', mv(r.b1, r.b2), r.b1.paused, 'errs', r.pageErrors);
  }
  // direct loads of /#testimonials (the race HANDOFF flagged), desktop, 5 each at 1x and 4x
  const direct = [];
  for (const thr of [1, 4]) for (let i = 0; i < 5; i++) for (const v of VARS) {
    const r = await withPage(v, { ...DESK, throttle: thr }, async (p) => {
      await gotoReady(p, '/#testimonials'); await L.w8(2500);
      const a = await snap(p); await L.w8(1500); const b = await snap(p);
      return { lenis: await p.evaluate(() => !!window.lenis), moving: a.cols.map((c, j) => c.tf !== b.cols[j].tf), kids: a.cols.map((c) => c.kids), paused: a.paused };
    });
    direct.push({ thr, i, v, ...r }); console.log('direct', thr, i, v, JSON.stringify(r.moving), r.kids, r.paused, r.lenis, r.pageErrors);
  }
  save('testimonials', { res, direct });
};

// (5) Discord ticket loop on /#process, 10 loads at 4x ---------------------------
T.discord = async () => {
  const res = [];
  const N = +(process.env.N || 10);
  for (const [vpn, vp] of [['desk', DESK], ['mob', MOB]]) for (let i = 0; i < (vpn === 'desk' ? N : 4); i++) for (const v of VARS) {
    const r = await withPage(v, { ...vp, throttle: 4 }, async (p) => {
      await p.evaluateOnNewDocument(() => { document.addEventListener('DOMContentLoaded', () => { window.__chat = window.__sampleFor(16000, 100, (t) => { const m = document.getElementById('chat-messages'); const ty = document.getElementById('chat-typing');
        return [Math.round(t), m.children.length, ty ? (ty.classList.contains('is-on') || ty.classList.contains('is-visible') || getComputedStyle(ty).opacity) : null]; }); }); });
      await p.goto(L.BASE + '/#process', { waitUntil: 'load', timeout: 120000 });
      const s = await p.evaluate(() => window.__chat);
      const fin = await p.evaluate(() => ({ sy: scrollY, lenis: !!window.lenis, top: document.getElementById('process').getBoundingClientRect().top, kids: document.getElementById('chat-messages').children.length }));
      return { s, fin };
    });
    const firstIdx = r.s.findIndex((x) => x[1] > 0);
    const emptyAfter = firstIdx < 0 ? null : r.s.slice(firstIdx).filter((x) => x[1] === 0).length;
    const maxKids = Math.max(...r.s.map((x) => x[1]));
    res.push({ vpn, i, v, firstMsgMs: firstIdx < 0 ? null : r.s[firstIdx][0], emptyAfter, maxKids, ...r });
    console.log(vpn, i, v, 'first', firstIdx < 0 ? 'NEVER' : r.s[firstIdx][0], 'emptyAfter', emptyAfter, 'max', maxKids, 'final', JSON.stringify(r.fin), 'errs', r.pageErrors);
  }
  save('discord', res);
};

// (6) visits counter -------------------------------------------------------------
T.visits = async () => {
  const json = JSON.parse(fs.readFileSync(L.REPO + '/assets/visits.json', 'utf8'));
  const expectB = Math.floor((json.influenced / 1e9) * 10) / 10;
  const res = [];
  for (const [vpn, vp] of [['desk', DESK], ['mob', MOB], ['deskRM', { ...DESK, reduced: true }]]) for (let i = 0; i < 2; i++) for (const v of VARS) {
    const r = await withPage(v, vp, async (p, c, reqs) => {
      await gotoReady(p, '/', vp); await L.settle(p, 4500);
      const hero = await p.evaluate(() => [...document.querySelectorAll('.counter[data-live="visits"]')].map((e) => [e.textContent, e.dataset.value]));
      await p.evaluate(() => { const el = document.getElementById('trust-stats'); el.scrollIntoView({ block: 'center' }); if (window.lenis) window.lenis.scrollTo(el.getBoundingClientRect().top + scrollY - 300, { immediate: true, force: true }); });
      await L.w8(4500);
      const after = await p.evaluate(() => ({ live: [...document.querySelectorAll('.counter[data-live="visits"]')].map((e) => [e.textContent, e.dataset.value]), all: [...document.querySelectorAll('.counter')].map((e) => e.textContent), fetches: window.__fetches }));
      return { hero, after, visitsReq: reqs.filter((u) => /visits\.json/.test(u)).length, slotsReq: reqs.filter((u) => /slots\.json/.test(u)).length };
    });
    res.push({ vpn, i, v, expectB, ...r });
    console.log(vpn, i, v, 'expect', expectB, JSON.stringify(r.after.live), 'visitsReq', r.visitsReq, 'fetch', JSON.stringify(r.after.fetches), 'counters', r.after.all.join(','), 'errs', r.pageErrors);
  }
  save('visits', res);
};

// (7) lightbox + card variant arrows ------------------------------------------------
T.lightbox = async () => {
  const res = [];
  const st = (p) => p.evaluate(() => { const lb = document.getElementById('lightbox'); const img = lb.querySelector('.lightbox-img');
    return { open: lb.classList.contains('is-open'), aria: lb.getAttribute('aria-hidden'), hash: location.hash, overflow: document.body.style.overflow, lenisStopped: window.lenis ? !!(window.lenis.isStopped) : null,
      img: (img.getAttribute('src') || '').split('/').pop(), title: lb.querySelector('.lightbox-title').textContent, counter: (lb.querySelector('.lightbox-counter') || {}).textContent, sy: Math.round(scrollY) }; });
  for (const [vpn, vp] of [['desk', DESK], ['mob', MOB]]) for (const v of VARS) {
    const r = await withPage(v, vp, async (p) => {
      await gotoReady(p, '/', vp); await L.settle(p, 2500);
      const steps = [];
      await p.evaluate(() => { const el = document.getElementById('work'); const y = el.getBoundingClientRect().top + scrollY; if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); });
      await L.w8(1200);
      // card variant arrows (desktop hover-only arrows may be hidden; click via DOM element)
      const card = '.card.has-variants';
      const cardImg = () => p.evaluate((s) => { const c = document.querySelector(s); return [(c.querySelector('.card-img img').getAttribute('src') || '').split('/').pop(), (c.querySelector('.card-count') || {}).textContent]; }, card);
      steps.push(['card0', await cardImg()]);
      if (!vp.mobile) await p.hover(card);
      await L.w8(400);
      try { await p.click(card + ' .card-arrow-next'); } catch (e) { await p.evaluate((s) => document.querySelector(s + ' .card-arrow-next').click(), card); steps.push(['arrowFallback', e.message]); }
      await L.w8(700); steps.push(['cardNext', await cardImg(), await st(p)]);
      try { await p.click(card + ' .card-arrow-prev'); } catch (e) { await p.evaluate((s) => document.querySelector(s + ' .card-arrow-prev').click(), card); }
      await L.w8(700); steps.push(['cardPrev', await cardImg(), await st(p)]);
      // open lightbox by clicking the card image
      await p.click(card + ' .card-img'); await L.w8(900); steps.push(['open', await st(p)]);
      if (!vp.mobile) { await p.mouse.move(720, 450); for (let i = 0; i < 5; i++) { await p.mouse.wheel({ deltaY: 300 }); await L.w8(60); } await L.w8(800); steps.push(['wheelWhileOpen', await st(p)]); }
      await p.keyboard.press('ArrowRight'); await L.w8(500); steps.push(['kRight', await st(p)]);
      await p.keyboard.press('ArrowRight'); await L.w8(500); steps.push(['kRight2', await st(p)]);
      await p.keyboard.press('ArrowLeft'); await L.w8(500); steps.push(['kLeft', await st(p)]);
      try { await p.click('#lightbox .lightbox-nav-next'); } catch (e) { steps.push(['navNextErr', e.message]); } await L.w8(500); steps.push(['btnNext', await st(p)]);
      try { await p.click('#lightbox .lightbox-nav-prev'); } catch (e) { steps.push(['navPrevErr', e.message]); } await L.w8(500); steps.push(['btnPrev', await st(p)]);
      await p.keyboard.press('Escape'); await L.w8(900); steps.push(['esc', await st(p)]);
      if (!vp.mobile) { await p.mouse.wheel({ deltaY: 300 }); await L.w8(1200); steps.push(['wheelAfterClose', await st(p)]); }
      // reopen with keyboard on 2nd card, close via button
      await p.focus('.card:nth-of-type(2)').catch(() => {}); await p.evaluate(() => { const c = document.querySelectorAll('.card')[1]; c.focus(); });
      await p.keyboard.press('Enter'); await L.w8(900); steps.push(['enterOpen', await st(p)]);
      await p.click('#lightbox .lightbox-close'); await L.w8(900); steps.push(['closeBtn', await st(p)]);
      return { env: await env(p), steps };
    });
    // deep link
    const dl = await withPage(v, vp, async (p) => {
      const slug = await (async () => { await gotoReady(p, '/', vp); return p.evaluate(() => document.querySelector('.card.has-variants').dataset.game); })();
      await p.goto('about:blank'); await gotoReady(p, `/#work-${slug}-2`, vp); await L.settle(p, 2000);
      return { slug, st: await st(p) };
    });
    res.push({ vpn, v, ...r, deepLink: dl });
    console.log(vpn, v, JSON.stringify(r.env), JSON.stringify(r.steps), 'deep', JSON.stringify(dl.st), 'errs', r.pageErrors, dl.pageErrors);
  }
  save('lightbox', res);
};

// (8) hero pointer parallax -----------------------------------------------------------
T.parallax = async () => {
  const res = [];
  for (const v of [VARS[0], ...VARS]) {
    const r = await withPage(v, DESK, async (p) => {
      await gotoReady(p, '/'); await L.settle(p, 3000);
      const pts = [[100, 100], [1340, 800], [720, 450], [200, 700], [1200, 150]];
      const out = [];
      for (const [x, y] of pts) {
        await p.mouse.move(x, y, { steps: 8 });
        const mid = await p.evaluate(() => window.__sampleFor(600, 100, () => document.querySelector('.hero-bg').style.translate));
        await L.w8(+(process.env.PWAIT || 1500));
        out.push({ x, y, mid, fin: await p.evaluate(() => document.querySelector('.hero-bg').style.translate),
          target: await p.evaluate((x, y) => { const r = document.querySelector('.hero').getBoundingClientRect(); return [((x - r.left) / r.width - 0.5) * -14, ((y - r.top) / r.height - 0.5) * -8].map((v) => +v.toFixed(3)); }, x, y) });
      }
      await p.mouse.move(720, 899);
      await p.evaluate(() => document.querySelector('.hero').dispatchEvent(new PointerEvent('pointerleave')));
      await L.w8(+(process.env.PWAIT || 2000));
      return { env: await env(p), out, afterLeave: await p.evaluate(() => document.querySelector('.hero-bg').style.translate) };
    });
    res.push({ v, ...r }); console.log(v, JSON.stringify(r.env), r.out.map((o) => o.fin).join(' | '), 'leave', r.afterLeave, 'errs', r.pageErrors);
  }
  save(process.env.NAME || 'parallax', res);
};

// (9) rail thumb drag ---------------------------------------------------------------------
T.rail = async () => {
  const res = [];
  for (const v of [VARS[0], ...VARS]) {
    const r = await withPage(v, DESK, async (p) => {
      await gotoReady(p, '/'); await L.settle(p, 2500);
      const out = [];
      for (const [start, dy] of [[0, 200], [3000, 150], [0, 2000]]) {
        await scrollToY(p, start); await L.w8(800);
        const box = await p.evaluate(() => { const r = document.querySelector('.rail__thumb').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; });
        await p.mouse.move(box.x, box.y); await p.mouse.down();
        const tr = [];
        for (let i = 1; i <= 10; i++) { await p.mouse.move(box.x, box.y + dy * i / 10); await L.w8(50); tr.push(await p.evaluate(() => Math.round(scrollY))); }
        await p.mouse.up(); await L.w8(1800);
        out.push({ start, dy, box, tr, fin: await p.evaluate(() => ({ sy: Math.round(scrollY * 10) / 10, thumb: document.querySelector('.rail__thumb').style.cssText, us: document.body.style.userSelect, lenisScroll: window.lenis && Math.round(window.lenis.scroll) })) });
      }
      return { env: await env(p), out };
    });
    res.push({ v, ...r }); console.log(v, JSON.stringify(r.env), r.out.map((o) => `${o.start}+${o.dy}: tr ${o.tr.join(',')} fin ${JSON.stringify(o.fin)}`).join(' || '), 'errs', r.pageErrors);
  }
  save('rail', res);
};

// (10) /tos/ scroll spy, /slots/, 404 ----------------------------------------------------
T.pages = async () => {
  const res = [];
  for (const [vpn, vp] of [['desk', DESK], ['mob', MOB]]) for (const v of [VARS[0], ...VARS]) {
    const r = await withPage(v, vp, async (p) => {
      const out = {};
      await gotoReady(p, '/tos/', vp); await L.settle(p, 2500);
      out.tosEnv = await env(p);
      const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const spy = [];
      for (let y = 0; y <= max + 1; y += 150) { await scrollToY(p, Math.min(y, max)); await L.w8(150);
        spy.push(await p.evaluate(() => { const a = document.querySelector('#toc-list li.is-active'); const n = document.getElementById('nav'); const cs = n && getComputedStyle(n);
          return [Math.round(scrollY), a ? a.textContent.trim().slice(0, 20) : null, document.querySelectorAll('#toc-list li.is-active').length, cs ? [cs.getPropertyValue('--nav-pill').trim(), cs.getPropertyValue('--nav-pill-vis').trim(), n.classList.contains('is-pill')].join(',') : null]; })); }
      out.spy = spy;
      // click 4th TOC link
      await scrollToY(p, 0); await L.w8(500);
      const link = await p.evaluate(() => { const a = document.querySelectorAll('#toc-list a')[3]; return a ? a.getAttribute('href') : null; });
      if (link) { await p.click(`#toc-list a[href="${link}"]`).catch((e) => (out.tocClickErr = e.message)); await L.w8(2200);
        out.tocClick = await p.evaluate((h) => ({ h, sy: Math.round(scrollY), top: Math.round(document.getElementById(h.slice(1)).getBoundingClientRect().top), active: (document.querySelector('#toc-list li.is-active') || {}).textContent }), link); }
      const shots = {};
      for (const pg of ['/tos/', '/slots/', '/this-does-not-exist']) {
        await p.goto('about:blank'); await gotoReady(p, pg, vp); await L.settle(p, 2500);
        const key = pg.replace(/\W/g, '') || 'root';
        const f = path.join(OUT, 'pages', `${vpn}_${v}_${key}_${Math.random().toString(36).slice(2, 6)}.png`); fs.mkdirSync(path.dirname(f), { recursive: true });
        await L.freeze(p); await p.screenshot({ path: f });
        shots[key] = { f, env: await env(p), title: await p.title(), h: await p.evaluate(() => document.documentElement.scrollHeight) };
      }
      out.shots = shots;
      return out;
    });
    res.push({ vpn, v, ...r }); console.log(vpn, v, JSON.stringify(r.tosEnv), 'spy', r.spy.map((s) => s[1] && s[1].slice(0, 6)).join(','), 'toc', JSON.stringify(r.tocClick), 'errs', r.pageErrors, r.consoleErrors.length);
  }
  // pixel diffs: baseline A vs baseline B (noise) vs variants
  const diffs = [];
  for (const vpn of ['desk', 'mob']) { const rows = res.filter((x) => x.vpn === vpn); const A = rows[0], B = rows[1];
    for (const k of Object.keys(A.shots)) { const d = { vpn, k, noise: await L.diff(A.shots[k].f, B.shots[k].f) };
      for (const x of rows.slice(2)) { d[x.v] = { vsA: await L.diff(A.shots[k].f, x.shots[k].f, x.shots[k].f.replace('.png', '_heat.png')), vsB: await L.diff(B.shots[k].f, x.shots[k].f) }; }
      diffs.push(d); console.log(JSON.stringify(d)); } }
  save('pages', { res, diffs });
};

// (11) reduced motion ----------------------------------------------------------------------
T.reduced = async () => {
  const res = [];
  for (const [vpn, vp] of [['desk', { ...DESK, reduced: true }], ['mob', { ...MOB, reduced: true }]]) for (const v of VARS) {
    const r = await withPage(v, vp, async (p) => {
      await gotoReady(p, '/', vp); await L.settle(p, 3000);
      const s = async () => p.evaluate((ids) => ({ env: { lenis: !!window.lenis, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }, sy: scrollY,
        fp: getComputedStyle(document.querySelector('.cfooter')).getPropertyValue('--fp').trim(), fpInline: document.querySelector('.cfooter').style.getPropertyValue('--fp'),
        leave: ids.map((id) => { const e = document.getElementById(id); return e ? [e.style.getPropertyValue('--leave'), getComputedStyle(e).opacity, e.classList.contains('scroll-fade')] : null; }),
        nav: ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => getComputedStyle(document.getElementById('nav')).getPropertyValue(k).trim()),
        acc: [...document.querySelectorAll('.accent-text')].map((t) => t.style.backgroundImage),
        chat: document.getElementById('chat-messages').children.length, counters: [...document.querySelectorAll('.counter')].map((e) => e.textContent),
        tcols: [...document.querySelectorAll('.tcol-track')].map((t) => t.children.length + ':' + getComputedStyle(t).animationName) }), SECS);
      const top = await s();
      const walk = [];
      const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let y = 0; y <= max; y += 400) { await scrollToY(p, y); await L.w8(150); const x = await s(); walk.push([Math.round(x.sy), x.fp, x.leave.map((l) => l && l[0] + '/' + l[1]).join(' '), x.nav.join(','), x.acc.join(' ').length]); }
      await scrollToY(p, max); await L.w8(4000); const bottom = await s();
      await p.goto('about:blank'); await gotoReady(p, '/#pricing', vp); await L.w8(2000);
      const anchor = await p.evaluate(() => ({ sy: scrollY, top: document.getElementById('pricing').getBoundingClientRect().top }));
      return { top, walk, bottom, anchor };
    });
    res.push({ vpn, v, ...r }); console.log(vpn, v, JSON.stringify(r.top.env), 'chat', r.top.chat, 'fp', r.top.fp, r.top.fpInline, 'anchor', JSON.stringify(r.anchor), 'counters', r.bottom.counters.join(','), 'errs', r.pageErrors);
  }
  save('reduced', res);
};

// (12) pseudo radius vs host radius in rest / hover / keyboard focus, every page; #pricing contain side effects
T.pseudo = async () => {
  const res = [];
  const probe = (p) => p.evaluate(() => [...document.querySelectorAll('.btn, .price-card, .quote')].map((el, i) => { const a = getComputedStyle(el, '::after'), h = getComputedStyle(el);
    return [i, el.className.slice(0, 40), h.borderRadius, a.borderRadius, a.content, el.matches(':focus-visible'), el.matches(':hover'), Math.round(el.getBoundingClientRect().width)]; }));
  for (const [vpn, vp] of [['desk', DESK], ['desk1920', { w: 1920, h: 1080 }], ['mob', MOB]]) for (const v of VARS) {
    const r = await withPage(v, vp, async (p) => {
      const out = {};
      for (const pg of ['/', '/tos/', '/slots/', '/this-does-not-exist']) {
        await p.goto('about:blank'); await gotoReady(p, pg, vp); await L.settle(p, 1500);
        const rest = await probe(p);
        // keyboard focus walk (Tab) — record focused .btn/.price-card/.quote
        const foc = [];
        if (!vp.mobile) for (let k = 0; k < 60; k++) { await p.keyboard.press('Tab'); await L.w8(40);
          const f = await p.evaluate(() => { const el = document.activeElement; if (!el || !el.matches('.btn, .price-card, .quote')) return null; const a = getComputedStyle(el, '::after');
            return [el.className.slice(0, 40), getComputedStyle(el).borderRadius, a.borderRadius, el.matches(':focus-visible')]; }); if (f) foc.push(f); }
        // hover each element (desktop)
        const hov = [];
        if (!vp.mobile) { const n = await p.evaluate(() => document.querySelectorAll('.btn, .price-card, .quote').length);
          for (let i = 0; i < Math.min(n, 40); i++) { const ok = await p.evaluate((i) => { const el = document.querySelectorAll('.btn, .price-card, .quote')[i]; const r = el.getBoundingClientRect(); if (!r.width) return false;
              const y = r.top + scrollY - innerHeight / 2 + r.height / 2; if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); return true; }, i);
            if (!ok) continue; await L.w8(120);
            const box = await p.evaluate((i) => { const r = document.querySelectorAll('.btn, .price-card, .quote')[i].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, i);
            await p.mouse.move(box[0], box[1]); await L.w8(150);
            hov.push(await p.evaluate((i) => { const el = document.querySelectorAll('.btn, .price-card, .quote')[i]; const a = getComputedStyle(el, '::after'); return [i, el.className.slice(0, 30), el.matches(':hover'), getComputedStyle(el).borderRadius, a.borderRadius]; }, i)); } }
        // fixed / sticky descendants of #pricing, and its contain
        const pricing = await p.evaluate(() => { const s = document.getElementById('pricing'); if (!s) return null; const all = [...s.querySelectorAll('*')];
          return { contain: getComputedStyle(s).contain, fixedOrSticky: all.filter((e) => /fixed|sticky/.test(getComputedStyle(e).position)).map((e) => e.className), overflowBoxes: all.filter((e) => { const r = e.getBoundingClientRect(), q = s.getBoundingClientRect(); return r.width && (r.left < q.left - 1 || r.right > q.right + 1 || r.top < q.top - 1 || r.bottom > q.bottom + 1); }).map((e) => e.className.slice(0, 30)).slice(0, 20) }; });
        out[pg] = { rest, foc, hov, pricing };
      }
      return out;
    });
    res.push({ vpn, v, ...r });
    for (const pg in r) { if (!r[pg] || !r[pg].rest) continue; const mis = r[pg].rest.filter((x) => x[2] !== x[3]); const fm = r[pg].foc.filter((x) => x[1] !== x[2]); const hm = r[pg].hov.filter((x) => x[3] !== x[4]);
      console.log(vpn, v, pg, 'n', r[pg].rest.length, 'restMismatch', JSON.stringify(mis.slice(0, 5)), 'focus', r[pg].foc.length, 'focMismatch', JSON.stringify(fm.slice(0, 5)), 'hover', r[pg].hov.length, 'hovMismatch', JSON.stringify(hm.slice(0, 5)), 'pricing', JSON.stringify(r[pg].pricing)); }
    console.log('errs', r.pageErrors);
  }
  save('pseudo', res);
};

// (4b) /#testimonials direct-load freeze rate, with animation details
T.tdirect = async () => {
  const res = []; const N = +(process.env.N || 12);
  const snap = (p) => p.evaluate(() => ({ paused: document.getElementById('testimonials').classList.contains('is-paused'), hidden: document.documentElement.classList.contains('is-hidden'), vis: document.visibilityState,
    cols: [...document.querySelectorAll('.tcols .tcol-track')].map((t) => { const cs = getComputedStyle(t); const a = t.getAnimations()[0]; return [cs.transform, cs.animationPlayState, a ? a.playState : null, a ? Math.round(a.currentTime) : null]; }),
    sy: scrollY, top: document.getElementById('testimonials').getBoundingClientRect().top }));
  for (let i = 0; i < N; i++) for (const v of VARS) {
    const r = await withPage(v, DESK, async (p) => { await gotoReady(p, '/#testimonials'); await L.w8(2500); const a = await snap(p); await L.w8(1500); const b = await snap(p); return { a, b }; });
    const moving = r.a.cols.map((c, j) => c[0] !== r.b.cols[j][0]);
    res.push({ i, v, moving, ...r }); console.log(i, v, JSON.stringify(moving), JSON.stringify(r.a), '->', JSON.stringify(r.b.cols), r.pageErrors);
  }
  save('tdirect', res);
};

// (10b) /tos/ scroll spy repeatability with geometry
T.tosspy = async () => {
  const res = []; const N = +(process.env.N || 3);
  for (const [vpn, vp] of [['mob', MOB], ['desk', DESK]]) for (let i = 0; i < N; i++) for (const v of VARS) {
    const r = await withPage(v, vp, async (p) => {
      await gotoReady(p, '/tos/', vp); await L.settle(p, 2500);
      const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const rows = [];
      for (let y = 0; y <= max + 1; y += 150) { await scrollToY(p, Math.min(y, max)); await L.w8(+(process.env.WAIT || 300));
        rows.push(await p.evaluate(() => { const a = document.querySelector('#toc-list li.is-active');
          return { sy: Math.round(scrollY), ih: innerHeight, sh: document.documentElement.scrollHeight, active: a ? a.textContent.trim().slice(0, 14) : null, nActive: document.querySelectorAll('#toc-list li.is-active').length,
            tops: [...document.querySelectorAll('.tos-section')].map((s) => Math.round(s.getBoundingClientRect().top)), tf: [...document.querySelectorAll('.tos-section')].map((s) => getComputedStyle(s).transform).filter((t) => t !== 'none').length,
            expected: (() => { const secs = [...document.querySelectorAll('.tos-section')]; const items = document.querySelectorAll('#toc-list li'); const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
              let cur = 0; if (atBottom) cur = secs.length - 1; else secs.forEach((s, k) => { if (s.getBoundingClientRect().top <= innerHeight * 0.35) cur = k; }); return items[cur] ? items[cur].textContent.trim().slice(0, 14) : null; })() }; })); }
      return { env: await env(p), rows };
    });
    const mism = r.rows.filter((x) => x.active !== x.expected).length;
    res.push({ vpn, i, v, mism, ...r }); console.log(vpn, i, v, JSON.stringify(r.env), 'active!=expected', mism, '/', r.rows.length, r.rows.map((x) => (x.active || '-').slice(0, 5)).join(','), 'errs', r.pageErrors);
  }
  save(process.env.NAME || 'tosspy', res);
};

// (10c) /slots/ mobile repeatability (pixel + geometry)
T.slots = async () => {
  const res = []; const N = +(process.env.N || 4);
  fs.mkdirSync(path.join(OUT, 'slots'), { recursive: true });
  for (const [vpn, vp] of [['mob', MOB], ['desk', DESK]]) for (let i = 0; i < N; i++) for (const v of VARS) {
    const r = await withPage(v, vp, async (p) => {
      await gotoReady(p, '/slots/', vp); await L.settle(p, 3000);
      const geo = await p.evaluate(() => ({ fonts: [...document.fonts].map((f) => f.family + ':' + f.status).join(','), h: document.documentElement.scrollHeight,
        rects: [...document.querySelectorAll('main *')].slice(0, 40).map((e) => { const r = e.getBoundingClientRect(); return e.tagName + '.' + (e.className || '').toString().slice(0, 14) + '@' + r.top.toFixed(2) + ',' + r.height.toFixed(2); }),
        anims: document.getAnimations().map((a) => (a.animationName || a.transitionProperty || '?') + ':' + a.playState + ':' + Math.round(a.currentTime)) }));
      await L.freeze(p); const f = path.join(OUT, 'slots', `${vpn}_${v}_${i}.png`); await p.screenshot({ path: f });
      return { geo, f };
    });
    res.push({ vpn, i, v, ...r }); console.log(vpn, i, v, r.geo.fonts, r.geo.h, 'anims', r.geo.anims.length, 'errs', r.pageErrors);
  }
  const diffs = [];
  for (const vpn of ['mob', 'desk']) { const rows = res.filter((x) => x.vpn === vpn); const ref = rows[0];
    for (const x of rows.slice(1)) { const d = await L.diff(ref.f, x.f); const geoEq = JSON.stringify(ref.geo.rects) === JSON.stringify(x.geo.rects); diffs.push({ vpn, ref: ref.v + ref.i, x: x.v + x.i, d, geoEq }); console.log(vpn, ref.v + ref.i, 'vs', x.v + x.i, JSON.stringify(d), 'geoEq', geoEq); } }
  save('slots', { res, diffs });
};

(async () => { if (!T[test]) throw new Error('tests: ' + Object.keys(T)); await T[test](); })().catch((e) => { console.error(e); process.exit(1); });
