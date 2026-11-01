/* Functional probe: page errors + key state on /, /#pricing, /tos/, /slots/ for baseline vs variants. */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./bench.js');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const URLS = ['/', '/#pricing', '/tos/', '/slots/'];
(async () => {
  const b = await puppeteer.launch({ headless: 'new', protocolTimeout: 600000 });
  for (const v of variants) {
    for (const u of URLS) {
      const { p } = await openPage(b, v, { throttle: 1 });
      const errs = [];
      p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
      p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
      await p.goto('http://localhost:5173' + u, { waitUntil: 'load', timeout: 120000 });
      await w8(3500);
      const st = await p.evaluate(() => {
        const nav = document.getElementById('nav');
        const links = document.querySelector('.nav-links');
        const pr = document.getElementById('pricing');
        return {
          y: Math.round(scrollY),
          pricingTop: pr ? Math.round(pr.getBoundingClientRect().top) : null,
          isPill: nav ? nav.classList.contains('is-pill') : null,
          navPillVis: links ? getComputedStyle(links).getPropertyValue('--nav-pill-vis').trim() : null,
          navBeforeOpacity: links ? getComputedStyle(links, '::before').opacity : null,
          barOpacity: nav ? getComputedStyle(nav, '::before').opacity : null,
          navPadTop: nav ? getComputedStyle(nav).paddingTop : null,
          rootStyle: document.documentElement.getAttribute('style'),
          navStyle: nav ? nav.getAttribute('style') : null,
          heroCounters: [...document.querySelectorAll('.hero-stats-strip .counter')].map((c) => c.textContent),
          accentChild: (() => { const t = document.querySelector('.hero-title .accent .accent-text'); return t ? t.style.backgroundImage.slice(0, 40) : null; })(),
          lenis: !!window.lenis,
        };
      });
      console.log(v.name.padEnd(28), u.padEnd(10), JSON.stringify(st), errs.length ? 'ERRORS ' + JSON.stringify(errs) : 'no-errors');
      await p.close();
    }
  }
  await b.close();
})().catch((e) => { console.error('FAIL', e.stack || e.message); process.exit(1); });
