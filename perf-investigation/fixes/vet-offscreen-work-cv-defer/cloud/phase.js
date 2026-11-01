// Phase of infinite ambient loops inside the deferred sections at the moment the visitor arrives.
// Load '/', stay at top ARRIVE ms, jump into the section (immediate), read every animation in that section.
// node phase.js <out.json> <arriveMs> [sections] ; VARS env
const fs = require('fs');
const L = require('./lib.js');
const [OUT, ARR, SECS] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,cvd,cvw').split(',');
const SEC = (SECS || 'about,process,trust,pricing,contact').split(',');
(async () => {
  const res = {};
  const b = await L.launch();
  for (const v of VARS) for (const s of SEC) {
    const { p } = await L.open(b, v, { w: 1440, h: 900 });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.w8(+ARR);
    const out = await p.evaluate((id) => {
      const sec = document.getElementById(id);
      const y = sec.getBoundingClientRect().top + scrollY - 80;
      window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y);
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const now = document.timeline.currentTime;
        r(document.getAnimations().filter((a) => a.effect && a.effect.target && sec.contains(a.effect.target)).map((a) => {
          const t = a.effect.getComputedTiming(); const tg = a.effect.target;
          return { name: a.animationName || a.transitionProperty || 'anim', el: tg.tagName + '.' + [...tg.classList].slice(0, 2).join('.') + (a.effect.pseudoElement || ''),
            inf: t.iterations === Infinity, dur: t.duration, ct: a.currentTime == null ? null : Math.round(a.currentTime), ps: a.playState, age: a.startTime == null ? null : Math.round(now - a.startTime) };
        }).filter((x) => x.inf));
      })));
    }, s);
    res[v + ':' + s] = out;
    await p.close();
  }
  await b.close();
  // summarise per section: median currentTime delta variant - baseline (same order of animations)
  for (const s of SEC) {
    const B = res[VARS[0] + ':' + s];
    for (const v of VARS.slice(1)) {
      const R = res[v + ':' + s];
      const d = B.map((a, i) => R[i] && R[i].name === a.name && a.ct != null && R[i].ct != null ? { name: a.name, el: a.el, dur: a.dur, base: a.ct, varr: R[i].ct, ps: a.ps + '/' + R[i].ps, delta: a.ct - R[i].ct } : null).filter(Boolean);
      const byName = {};
      d.forEach((x) => { const k = x.name + ' ' + x.el; (byName[k] = byName[k] || []).push(x); });
      console.log(`${s} ${v}: n=${B.length}/${R.length}`);
      Object.entries(byName).forEach(([k, xs]) => console.log('   ', k, 'dur', xs[0].dur, 'ps', xs[0].ps, 'ct base/var', xs[0].base, xs[0].varr, 'delta ms', xs.map((x) => x.delta).slice(0, 4).join(',')));
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
