// Replays walk.js's mobile 'jump' stop order (bottom first, then up every half viewport) and reads the nav CTA
// transform and --nav-pill after the same freeze, to explain the nav diff seen in out/L_j390.
const L = require('./lib.js');
const VARS = (process.env.VARS || 'baseline,cvd_gh3').split(',');
(async () => {
  for (const v of VARS) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: 390, h: 844, mobile: true });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    let stops = []; for (let y = 0; y < maxY; y += 422) stops.push(y); stops.push(maxY); stops = [stops[stops.length - 1], ...stops.slice().reverse().slice(1)];
    const out = [];
    for (const y of stops.slice(-4)) {
      await p.evaluate((y) => scrollTo(0, y), y);
      await L.w8(1300);
      const pre = await p.evaluate(() => [scrollY, document.documentElement.style.getPropertyValue('--nav-pill'), getComputedStyle(document.querySelector('#nav > .btn')).transform, document.querySelector('#nav > .btn').getAnimations().map((a) => a.constructor.name + ':' + (a.transitionProperty || a.animationName) + ':' + a.playState + ':' + Math.round(a.currentTime)).join('|')]);
      await L.freeze(p);
      const post = await p.evaluate(() => getComputedStyle(document.querySelector('#nav > .btn')).transform);
      await L.unfreeze(p);
      out.push([...pre, post]);
    }
    console.log(v, 'maxY', maxY, JSON.stringify(out));
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
