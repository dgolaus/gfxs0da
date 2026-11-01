// Behaviour checks, baseline vs variants (one browser at a time, one page at a time).
// node behave.js <out.json> <WxH[m]> [reduced] ; VARS env
const fs = require('fs');
const L = require('./lib.js');
const [OUT, SZ, RED] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,base_i,cvd,cvw').split(',');
const mobile = SZ.endsWith('m'); const [W, H] = SZ.replace('m', '').split('x').map(Number); const reduced = RED === 'reduced';
const to = (p, y) => p.evaluate((y) => { window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); }, y);
(async () => {
  const all = {};
  for (const v of VARS) {
    const r = {};
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: W, h: H, mobile, reduced });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    r.top = await p.evaluate(() => ({ docH: document.documentElement.scrollHeight, limit: window.lenis && window.lenis.limit, visits: [...document.querySelectorAll('[data-live="visits"]')].map((e) => e.textContent + '|' + e.dataset.value) }));
    // reveal bookkeeping: record scrollY when each .reveal gets is-in
    await p.evaluate(() => {
      window.__rv = {}; const els = [...document.querySelectorAll('.reveal')];
      els.forEach((e, i) => { e.dataset.ri = i; if (e.classList.contains('is-in')) window.__rv[i] = -1; });
      new MutationObserver((ms) => { for (const m of ms) { const e = m.target; if (e.classList.contains('is-in') && !(e.dataset.ri in window.__rv)) window.__rv[e.dataset.ri] = Math.round(scrollY); } })
        .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
      window.__tp = []; const m = document.getElementById('testimonials');
      if (m) new MutationObserver(() => window.__tp.push([Math.round(scrollY), m.classList.contains('is-paused')])).observe(m, { attributes: true, attributeFilter: ['class'] });
    });
    // deterministic step walk down, 40px steps
    const fp = [];
    const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0; y <= maxY + 40; y += 40) {
      await to(p, Math.min(y, maxY));
      await L.w8(90);
      const s = await p.evaluate(() => [Math.round(scrollY), getComputedStyle(document.querySelector('.cfooter')).getPropertyValue('--fp').trim(), document.documentElement.scrollHeight]);
      fp.push(s);
    }
    r.fp = fp.filter((x) => x[1] !== '0.000' && x[1] !== '0');
    r.docHs = [...new Set(fp.map((x) => x[2]))];
    await L.w8(800);
    r.bottom = await p.evaluate(() => ({ sy: scrollY, max: document.documentElement.scrollHeight - innerHeight, limit: window.lenis && window.lenis.limit,
      fp: getComputedStyle(document.querySelector('.cfooter')).getPropertyValue('--fp').trim(),
      reveals: document.querySelectorAll('.reveal').length, revealed: document.querySelectorAll('.reveal.is-in').length, rv: window.__rv, tp: window.__tp }));
    // testimonials
    await p.evaluate(() => document.getElementById('testimonials').scrollIntoView({ block: 'center' }));
    if (await p.evaluate(() => !!window.lenis)) await p.evaluate(() => { const t = document.getElementById('testimonials'); window.lenis.scrollTo(t.getBoundingClientRect().top + scrollY - innerHeight / 2 + t.offsetHeight / 2, { immediate: true, force: true }); });
    await L.w8(1200);
    const tr = async () => p.evaluate(() => [...document.querySelectorAll('.tcol-track')].map((t) => ({ n: t.children.length, hid: t.querySelectorAll('[aria-hidden]').length, h: Math.round(t.getBoundingClientRect().height), tf: getComputedStyle(t).transform, an: t.getAnimations().map((a) => a.playState).join() })));
    const t1 = await tr(); await L.w8(700); const t2 = await tr();
    r.tracks = { t1, moving: t1.map((x, i) => x.tf !== t2[i].tf), paused: await p.evaluate(() => document.getElementById('testimonials').classList.contains('is-paused')) };
    if (!mobile) { const box = await p.evaluate(() => { const q = document.querySelector('.tcol .quote'); const r = q.getBoundingClientRect(); return [r.left + 20, r.top + 20]; }); await p.mouse.move(box[0], box[1]); await L.w8(300); const a = await tr(); await L.w8(500); const bb = await tr(); r.tracks.hoverMoving = a.map((x, i) => x.tf !== bb[i].tf); await p.mouse.move(2, 2); }
    // process chat on the way
    await p.evaluate(() => { const s = document.getElementById('process'); const y = s.getBoundingClientRect().top + scrollY; window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); });
    await L.w8(9000);
    r.chat = await p.evaluate(() => ({ msgs: document.querySelectorAll('#chat-messages > *').length }));
    // lightbox
    await to(p, 0); await L.w8(300);
    await p.evaluate(() => { const c = document.querySelector('#work .card'); const y = c.getBoundingClientRect().top + scrollY - 200; window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); });
    await L.w8(500);
    await p.evaluate(() => document.querySelector('#work .card .card-img').click());
    await L.w8(800);
    r.lightbox = await p.evaluate(() => ({ open: !!document.querySelector('.lightbox.is-open'), hash: location.hash, lenisStopped: window.lenis ? window.lenis.isStopped : null }));
    r.errs = (await p.evaluate(() => window.__errs)).concat(p.__errs || []);
    await b.close();
    all[v] = r;
    console.log(v, JSON.stringify({ top: r.top, bottom: { ...r.bottom, rv: undefined, tp: r.bottom.tp }, docHs: r.docHs, fpN: r.fp.length, tracks: r.tracks, chat: r.chat, lightbox: r.lightbox, errs: r.errs }));
  }
  // compare against baseline
  const B = all[VARS[0]];
  for (const v of VARS.slice(1)) {
    const R = all[v];
    const rvDiff = Object.keys({ ...B.bottom.rv, ...R.bottom.rv }).filter((k) => B.bottom.rv[k] !== R.bottom.rv[k]).map((k) => [k, B.bottom.rv[k], R.bottom.rv[k]]);
    const fpB = Object.fromEntries(B.fp.map((x) => [x[0], x[1]])); const fpDiff = R.fp.filter((x) => fpB[x[0]] !== undefined && fpB[x[0]] !== x[1]);
    const fpMissing = B.fp.filter((x) => !R.fp.some((y) => y[0] === x[0])).length + R.fp.filter((x) => !B.fp.some((y) => y[0] === x[0])).length;
    console.log('CMP', v, 'revealPosDiffs', JSON.stringify(rvDiff), 'fpDiffs', JSON.stringify(fpDiff), 'fpPosMismatch', fpMissing, 'tp', JSON.stringify(B.bottom.tp), JSON.stringify(R.bottom.tp));
  }
  fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
