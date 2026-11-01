/* Trace the entry (4.5s, CPU 4x) for baseline and variant; report style recalcs
   inside the script.js evaluation task and the task's duration. Warm cache. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('../node_modules/puppeteer');
const REPO = '..';
const OUT = __dirname;
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const all = JSON.parse(fs.readFileSync(path.join(OUT, 'v2.json'), 'utf8'));
const N = +process.argv[2] || 2;
const PRELUDE = `(() => {
  try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  const add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function (...c) {
    if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; }
    return add.apply(this, c);
  };
})();`;
const types = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function analyze(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ev = raw.traceEvents || raw;
  const mains = ev.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain').map((m) => m.pid + ':' + m.tid);
  // pick the main thread that has the script.js EvaluateScript
  const evals = ev.filter((e) => e.name === 'EvaluateScript' && e.ph === 'X' && e.args && e.args.data && /\/script\.js/.test(e.args.data.url || ''));
  const ev0 = evals[0];
  if (!ev0) return { err: 'no script.js eval' };
  const key = ev0.pid + ':' + ev0.tid;
  const same = (e) => e.pid + ':' + e.tid === key;
  const t0 = Math.min(...ev.filter((e) => same(e) && e.ts).map((e) => e.ts));
  const task = ev.filter((e) => same(e) && e.ph === 'X' && e.name === 'RunTask' && e.ts <= ev0.ts && e.ts + e.dur >= ev0.ts + ev0.dur)[0];
  const inTask = (e) => e.ts >= ev0.ts && e.ts + (e.dur || 0) <= ev0.ts + ev0.dur;
  const ult = ev.filter((e) => same(e) && e.name === 'UpdateLayoutTree' && e.ph === 'X' && inTask(e));
  const lay = ev.filter((e) => same(e) && e.name === 'Layout' && e.ph === 'X' && inTask(e));
  const longTasks = ev.filter((e) => same(e) && e.ph === 'X' && e.name === 'RunTask' && e.dur > 50000 && e.ts - t0 < 3500000);
  const ultAll = ev.filter((e) => same(e) && e.name === 'UpdateLayoutTree' && e.ph === 'X' && e.ts - t0 < 3500000);
  const totElems = ultAll.reduce((a, e) => a + ((e.args && e.args.elementCount) || 0), 0);
  const totUlt = Math.round(ultAll.reduce((a, e) => a + e.dur, 0) / 1000);
  return {
    totElems, totUlt,
    evalAt: Math.round((ev0.ts - t0) / 1000), evalMs: Math.round(ev0.dur / 1000), taskMs: task ? Math.round(task.dur / 1000) : null,
    recalcMs: Math.round(ult.reduce((a, e) => a + e.dur, 0) / 1000), recalcElems: ult.map((e) => e.args && e.args.elementCount).join(','),
    layoutMs: Math.round(lay.reduce((a, e) => a + e.dur, 0) / 1000),
    longTasks0to3500: longTasks.length, longTaskMs: Math.round(longTasks.reduce((a, e) => a + e.dur, 0) / 1000),
  };
}
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const ctx = await browser.createBrowserContext();
  // warm the cache once
  for (let r = -1; r < N; r++) for (const v of all) {
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    const c = await p.target().createCDPSession();
    await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const over = Object.fromEntries(Object.entries(v.files || {}).map(([k, f]) => [k, fs.readFileSync(f)]));
    await p.setRequestInterception(true);
    p.on('request', (req) => {
      const u = new URL(req.url());
      if (u.host !== 'localhost:5173') { if (/cloudflareinsights/.test(u.host)) return req.respond({ status: 204, body: '' }); return req.continue(); }
      let k = decodeURIComponent(u.pathname); if (k.endsWith('/')) k += 'index.html';
      const ct = types[path.extname(k)] || 'application/octet-stream';
      if (over[k]) return req.respond({ status: 200, contentType: ct, body: over[k] });
      const f = path.join(REPO, k);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return req.respond({ status: 200, contentType: ct, body: fs.readFileSync(f) });
      return req.respond({ status: 404, body: '' });
    });
    await p.evaluateOnNewDocument(PRELUDE);
    const file = path.join(OUT, `tr_${v.name}_${r}.json`);
    if (r >= 0) await p.tracing.start({ path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'v8.execute', 'blink.user_timing', 'toplevel'] });
    await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await w8(4500);
    if (r >= 0) { await p.tracing.stop(); console.log(v.name.padEnd(9), 'rep', r, JSON.stringify(analyze(file))); fs.unlinkSync(file); }
    await p.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
