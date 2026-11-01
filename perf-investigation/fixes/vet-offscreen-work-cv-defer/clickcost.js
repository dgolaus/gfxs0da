/* Cost of the FIRST in-page anchor click (hero CTA #work, brand #top, nav #pricing)
   at CPU 4x, baseline vs variant: synchronous handler time + worst frame gap in
   the next 600ms. Also the first wheel-scroll frames toward the deferred sections.
   node clickcost.js reps */
const fs = require('fs');
const puppeteer = require('../node_modules/puppeteer');
const SP = 'scratchpad';
const OW = SP + '/fixes/offscreen-work';
const RUNS = [{ name: 'base' }, { name: 'cv', files: { '/styles.css': OW + '/styles.css', '/script.js': OW + '/script.c1.js', '/smooth-scroll.js': OW + '/smooth-scroll.js' } }];
const REPS = +(process.argv[2] || 3);
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
async function one(b, v, sel) {
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  const c = await p.target().createCDPSession();
  await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const map = v.files ? Object.fromEntries(Object.entries(v.files).map(([k, f]) => [k, fs.readFileSync(f)])) : {};
  await p.setRequestInterception(true);
  p.on('request', (req) => { const u = new URL(req.url()); let k = u.pathname; if (k === '/' || k === '') k = '/index.html';
    if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: k.endsWith('.js') ? 'application/javascript' : 'text/css', body: map[k] }); req.continue(); });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    const add = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...c) { if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; } return add.apply(this, c); }; });
  await p.goto('http://localhost:5173/', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.lenis, { timeout: 30000 });
  await w8(6000);
  const r = await p.evaluate(async (sel) => {
    const a = document.querySelector(sel);
    const frames = [];
    let stop = false;
    const tick = (t) => { frames.push(t); if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const t0 = performance.now();
    a.click();
    const sync = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 900));
    stop = true;
    const after = frames.filter((t) => t >= t0 - 1);
    let worst = 0; for (let i = 1; i < after.length; i++) worst = Math.max(worst, after[i] - after[i - 1]);
    const firstFrameAfter = after.length ? after[0] - t0 : null;
    return { sync: Math.round(sync), worstGap: Math.round(worst), firstFrame: Math.round(firstFrameAfter), y: Math.round(scrollY) };
  }, sel);
  await p.close();
  return r;
}
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  for (const sel of ['.hero-cta a[href="#work"]', '.nav a[href="#pricing"]']) {
    for (let i = 0; i < REPS; i++) for (const v of RUNS) {
      const r = await one(b, v, sel);
      console.log(sel.padEnd(30), v.name.padEnd(5), JSON.stringify(r));
    }
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
