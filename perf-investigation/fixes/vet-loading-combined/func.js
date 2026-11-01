// Functional checks (no throttle): hero counter arm time vs boot.js, visits,
// /#pricing landing, /tos/, reduced motion, mobile width, testimonials pause state.
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./page.js');
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const PRE = `(() => {
  window.__log = []; const L = (k) => window.__log.push([k, +performance.now().toFixed(1)]);
  const _add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function (...c) {
    if (document.body && this === document.body.classList && c.includes('ready')) L('add(ready)' + (document.currentScript ? ':' + (document.currentScript.src || 'inline').split('/').pop() : ''));
    return _add.apply(this, c);
  };
  const _st = window.setTimeout; window.setTimeout = function (f, d, ...a) { if (d === 180) L('arm180'); return _st.call(this, f, d, ...a); };
  document.addEventListener('DOMContentLoaded', () => L('DCL'));
  new MutationObserver(() => { const c = document.querySelector('.hero-stats-strip .counter'); if (c && c.textContent !== '0' && !window.__cs) { window.__cs = 1; L('counterStart'); } }).observe(document, { subtree: true, childList: true, characterData: true });
})();`;
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const cases = [
    ['/', {}], ['/#pricing', {}], ['/#testimonials', {}], ['/tos/', {}], ['/slots/', {}],
    ['/', { reduced: true }], ['/', { mobile: true }],
  ];
  for (const [url, o] of cases) for (const v of variants) {
    const { p, log } = await openPage(browser, v, { extra: PRE, width: o.mobile ? 390 : 1440, height: o.mobile ? 844 : 900 });
    if (o.reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 100)); });
    await p.goto('http://localhost:5173' + url, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 4000));
    const r = await p.evaluate(() => {
      const c = document.querySelector('.counter[data-live="visits"]');
      const pr = document.getElementById('pricing'), te = document.getElementById('testimonials');
      const lg = window.__log || []; const dcl = (lg.find((x) => x[0] === 'DCL') || [0, 0])[1];
      const tr = document.querySelector('.tcol-track');
      return {
        log: lg.filter((x) => x[0] !== 'DCL').map(([k, t]) => `${k}@${(t - dcl).toFixed(0)}`).join(' '),
        counters: [...document.querySelectorAll('.hero-stats-strip .counter')].map((x) => x.textContent).join(','),
        live: c && c.textContent, liveVal: c && c.dataset.value,
        sub: (document.querySelector('.card[data-game] .card-sub') || {}).textContent,
        ready: document.body.className, s0da: !!window.s0daReady,
        y: Math.round(scrollY), prTop: pr ? Math.round(pr.getBoundingClientRect().top) : null, teTop: te ? Math.round(te.getBoundingClientRect().top) : null,
        tcolPS: tr ? getComputedStyle(tr).animationPlayState : null,
        heroBgPS: (() => { const t = document.querySelector('.bg-row-track'); return t ? getComputedStyle(t).animationPlayState : null; })(),
      };
    });
    console.log(`${(url + (o.reduced ? ' RM' : '') + (o.mobile ? ' MOB' : '')).padEnd(18)} ${v.name.padEnd(26)} ${JSON.stringify({ ...r, visitsReq: log.filter((x) => x.includes('visits.json')).length, gstatic: log.filter((x) => x.includes('gstatic')).length, errs: errs.slice(0, 3) })}`);
    await p.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
