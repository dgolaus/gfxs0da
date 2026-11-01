/* Functional checks for the offscreen-work candidates vs baseline (desktop, Lenis on).
   node -r ./diskserve-hook.js functest.js variants.json [WxH] */
const fs = require('fs');
const { openPage } = require('../../bench.js');
const puppeteer = require('../node_modules/puppeteer');
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const vs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const [W, H] = (process.argv[3] || '1440x900').split('x').map(Number);
const BASE = 'http://localhost:5173';

async function page(b, v, url, errs) {
  const { p } = await openPage(b, v, { throttle: 1 });
  await p.setViewport({ width: W, height: H });
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|cloudflareinsights|ERR_/.test(m.text())) errs.push('console ' + m.text()); });
  await p.goto(url, { waitUntil: 'load' });
  return p;
}
const topOf = (p, id) => p.evaluate((id) => { const e = document.getElementById(id); return e ? +e.getBoundingClientRect().top.toFixed(1) : null; }, id);

(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  for (const v of vs) {
    const errs = [], out = {};
    // 1) load with hash
    for (const id of ['work', 'about', 'process', 'trust', 'pricing', 'contact']) {
      const p = await page(b, v, `${BASE}/#${id}`, errs);
      await w8(1800);
      out['hash#' + id] = `${await topOf(p, id)}@${await p.evaluate(() => Math.round(scrollY))}`;
      await p.close();
    }
    // 2) in-page link click shortly after load (before any warm-up), Lenis 1.2s scroll
    for (const id of ['pricing', 'trust', 'about']) {
      const p = await page(b, v, `${BASE}/`, errs);
      await p.waitForFunction(() => !!window.lenis, { timeout: 15000 }).catch(() => {});
      await w8(300);
      await p.evaluate((id) => document.querySelector(`.nav a[href="#${id}"]`).click(), id);
      await w8(2600);
      out['click#' + id] = `${await topOf(p, id)}@${await p.evaluate(() => Math.round(scrollY))}`;
      if (id === 'pricing') {
        // 3) Lenis limit vs real max scroll; 5) footer --fp at the very bottom
        out.limit = await p.evaluate(() => `${window.lenis ? Math.round(window.lenis.limit) : 'nolenis'}/${document.documentElement.scrollHeight - innerHeight}`);
        await p.evaluate(() => window.lenis.scrollTo('bottom', { immediate: true }));
        await w8(600);
        out.fpBottom = await p.evaluate(() => getComputedStyle(document.querySelector('.cfooter')).getPropertyValue('--fp').trim() + '@' + Math.round(scrollY));
      }
      await p.close();
    }
    // 4) walk the page: reveals, testimonial clones, chat started, trust counters
    {
      const p = await page(b, v, `${BASE}/`, errs);
      await w8(1500);
      const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let y = 0; y <= total; y += 200) { await p.evaluate((y) => window.scrollTo(0, y), y); await w8(60); }
      await w8(3000);
      out.walk = await p.evaluate(() => {
        const rev = document.querySelectorAll('.reveal'), inn = document.querySelectorAll('.reveal.is-in');
        const tracks = [...document.querySelectorAll('.tcol-track')].map((t) => t.children.length).join('/');
        const lit = document.querySelectorAll('#trust-stats .star.lit').length;
        const ctr = [...document.querySelectorAll('#trust-stats .counter')].map((c) => c.textContent).join(',');
        const chat = document.getElementById('chat-messages').children.length;
        return `reveal ${inn.length}/${rev.length} tracks ${tracks} stars ${lit} counters ${ctr} chatMsgs>0 ${chat > 0} H ${document.documentElement.scrollHeight}`;
      });
      await p.close();
    }
    console.log(v.name);
    for (const [k, x] of Object.entries(out)) console.log('   ', k.padEnd(14), x);
    console.log('    errors', errs.length ? errs.slice(0, 5).join(' | ') : 'none');
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
