process.env.BENCH_DISK = '1';
const fs = require('fs'), path = require('path');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./rerun/bench.js');
const S = 'scratchpad';
const VARIANT = { name: 'v', files: { '/script.js': S + '/fixes/forced-layout/script.js' } };
const BASE = { name: 'base' };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
function analyze(file) {
  const ev = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents;
  const mains = ev.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain').map((m) => m.pid + ':' + m.tid);
  const isMain = (e) => mains.includes(e.pid + ':' + e.tid);
  const X = ev.filter((e) => isMain(e) && e.ph === 'X' && e.dur);
  // script.js evaluation window
  const evs = X.filter((e) => e.name === 'EvaluateScript' && e.args && e.args.data && /\/script\.js/.test(e.args.data.url || ''));
  const win = evs[0];
  const inWin = (e) => win && e.ts >= win.ts && e.ts + e.dur <= win.ts + win.dur;
  const ul = X.filter((e) => e.name === 'UpdateLayoutTree' && inWin(e));
  const lay = X.filter((e) => e.name === 'Layout' && inWin(e));
  const fr = X.filter((e) => e.name === 'FireAnimationFrame');
  const fl = (arr) => arr.filter((e) => e.args && e.args.beginData && e.args.beginData.stackTrace);
  const forcedInRaf = fl(X.filter((e) => (e.name === 'UpdateLayoutTree' || e.name === 'Layout') && fr.some((f) => e.ts >= f.ts && e.ts <= f.ts + f.dur)));
  return {
    scriptEvalMs: win ? +(win.dur / 1000).toFixed(1) : null,
    recalcN: ul.length, recalcElems: ul.reduce((a, e) => a + ((e.args && e.args.elementCount) || 0), 0), recalcMs: +(ul.reduce((a, e) => a + e.dur, 0) / 1000).toFixed(1),
    layoutN: lay.length, layoutMs: +(lay.reduce((a, e) => a + e.dur, 0) / 1000).toFixed(1),
    forcedInRafN: forcedInRaf.length, forcedInRafMs: +(forcedInRaf.reduce((a, e) => a + e.dur, 0) / 1000).toFixed(1),
  };
}
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (let i = 0; i < 3; i++) for (const v of [BASE, VARIANT]) {
    const { p } = await openPage(browser, v, { throttle: 4 });
    const f = path.join(__dirname, `tr_${v.name}_${i}.json`);
    await p.tracing.start({ path: f, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'v8.execute'] });
    await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await w8(4000);
    await p.tracing.stop();
    await p.close();
    console.log(v.name, i, JSON.stringify(analyze(f)));
    fs.unlinkSync(f);
  }
  await browser.close();
})();
