/* Structural (not timing) check: forced style recalcs / layouts triggered from script.js
   during load, baseline vs variant. Warm cache (one untraced load first), CPU 4x. */
const path = require('path'); const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./bench.js');
const VAR = path.join(__dirname, 'script.variant.js').replace(/\\/g, '/');
const variants = [{ name: 'baseline' }, { name: 'variant', files: { '/script.js': VAR } }];
const REPS = +(process.argv[2] || 2);
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

function analyze(file) {
  const ev = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents;
  const meta = ev.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain').map((m) => m.pid + ':' + m.tid);
  const cnt = {}; for (const e of ev) { const k = e.pid + ':' + e.tid; if (meta.includes(k)) cnt[k] = (cnt[k] || 0) + 1; }
  const main = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
  const M = ev.filter((e) => (e.pid + ':' + e.tid) === main);
  const X = M.filter((e) => e.ph === 'X' && e.dur != null);
  const nav = M.find((e) => e.name === 'navigationStart') || ev.find((e) => e.name === 'navigationStart');
  const t0 = nav ? nav.ts : Math.min(...X.map((e) => e.ts));
  const W = X.filter((e) => (e.ts - t0) / 1000 < 3500);
  // script.js evaluation task(s)
  const evals = W.filter((e) => e.name === 'EvaluateScript' && e.args && e.args.data && /\/script\.js/.test(e.args.data.url || ''));
  const inside = (e, p) => e.ts >= p.ts && e.ts + e.dur <= p.ts + p.dur;
  const ult = W.filter((e) => e.name === 'UpdateLayoutTree');
  const lay = W.filter((e) => e.name === 'Layout');
  const sum = (a) => Math.round(a.reduce((x, e) => x + e.dur, 0) / 1000);
  const elems = (a) => a.reduce((x, e) => x + ((e.args && (e.args.elementCount || (e.args.endData && e.args.endData.elementCount) || (e.args.beginData && e.args.beginData.elementCount))) || 0), 0);
  const ec = (e) => (e.args && (e.args.elementCount || (e.args.endData && e.args.endData.elementCount))) || 0;
  const evalDetail = evals.map((p) => {
    const u = ult.filter((e) => inside(e, p)), l = lay.filter((e) => inside(e, p));
    const list = u.map((e) => {
      const st = e.args && e.args.beginData && e.args.beginData.stackTrace;
      const fr = st && st[0] ? `${(st[0].url || '').split('/').pop()}:${st[0].lineNumber}:${st[0].functionName}` : '-';
      return `${ec(e)}el/${(e.dur / 1000).toFixed(1)}ms@${fr}`;
    });
    return { evalMs: Math.round(p.dur / 1000), recalcN: u.length, recalcMs: sum(u), recalcElems: elems(u), layoutN: l.length, layoutMs: sum(l), recalcs: list };
  });
  const forcedU = ult.filter((e) => e.args && e.args.beginData && e.args.beginData.stackTrace);
  return {
    scriptEval: evalDetail,
    entry: { recalcN: ult.length, recalcMs: sum(ult), recalcElems: elems(ult), forcedRecalcN: forcedU.length, forcedRecalcElems: elems(forcedU), forcedRecalcMs: sum(forcedU), layoutN: lay.length, layoutMs: sum(lay) },
  };
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (let r = 0; r < REPS; r++) for (const v of variants) {
    const { p } = await openPage(browser, v, { throttle: 4 });
    await p.goto('http://localhost:5173/', { waitUntil: 'load' }); await w8(1500);
    await p.goto('about:blank');
    const file = path.join(__dirname, `st_${v.name}_${r}.json`);
    await p.tracing.start({ path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack'] });
    await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await w8(4000);
    await p.tracing.stop(); await p.close();
    const a = analyze(file); fs.unlinkSync(file);
    console.log(`${v.name} rep${r} ENTRY ${JSON.stringify(a.entry)}`);
    for (const s of a.scriptEval) console.log(`   script.js eval ${s.evalMs}ms recalc ${s.recalcN}x ${s.recalcMs}ms ${s.recalcElems}el layout ${s.layoutN}x ${s.layoutMs}ms :: ${s.recalcs.join(' | ')}`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
