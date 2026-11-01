/* Conta trabalho de estilo/layout (determinístico) na entrada, por variante.
   uso: node measure.js <variants.json> [reps]
   Mede em trace (CPU 4x, cache quente): eventos UpdateLayoutTree/Layout na
   thread principal de 0 a 3500ms, separando os FORÇADOS (com stackTrace).
   As durações sofrem com contenção de CPU; contagens de elementos não. */
const fs = require('fs');
const path = require('path');
const SP = path.join(__dirname, '..', '..');
const { openPage } = require(path.join(__dirname, 'bench_local.js'));
const puppeteer = require(path.join('../node_modules/puppeteer'));
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));

function summarize(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ev = raw.traceEvents || raw;
  const mains = ev.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain').map((m) => m.pid + ':' + m.tid);
  // a aba testada é o renderer com mais eventos Layout
  const cnt = {};
  for (const e of ev) { const k = e.pid + ':' + e.tid; if (mains.includes(k) && e.name === 'Layout') cnt[k] = (cnt[k] || 0) + 1; }
  const main = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
  const isMain = (e) => e.pid + ':' + e.tid === main;
  const nav = ev.find((e) => isMain(e) && e.name === 'navigationStart') || ev.find((e) => isMain(e) && e.ts);
  const t0 = nav.ts;
  const se = ev.filter((e) => isMain(e) && e.ph === 'X' && e.name === 'EvaluateScript' && e.args && e.args.data && /\/script\.js/.test(e.args.data.url || ''))[0];
  const inInit = (e) => se && e.ts >= se.ts && e.ts + e.dur <= se.ts + se.dur;
  const r = { initRecalcElems: 0, initRecalcMs: 0, initLayoutObjs: 0, initLayoutMs: 0, initForcedN: 0, recalcMs: 0, recalcElems: 0, layoutMs: 0, layoutObjs: 0, forcedRecalcMs: 0, forcedRecalcElems: 0, forcedRecalcN: 0, forcedLayoutMs: 0, forcedLayoutN: 0, scriptEvalMs: 0, longTaskMs: 0, byFn: {} };
  for (const e of ev) {
    if (!isMain(e) || e.ph !== 'X' || !e.dur) continue;
    const t = (e.ts - t0) / 1000;
    if (t < 0 || t > 3500) continue;
    const st = e.args && e.args.beginData && e.args.beginData.stackTrace;
    const ms = e.dur / 1000;
    if (e.name === 'UpdateLayoutTree') {
      const n = (e.args && e.args.elementCount) || 0;
      r.recalcMs += ms; r.recalcElems += n;
      if (inInit(e)) { r.initRecalcElems += n; r.initRecalcMs += ms; if (st) r.initForcedN++; }
      if (st) { r.forcedRecalcMs += ms; r.forcedRecalcElems += n; r.forcedRecalcN++; const k = (st[0].url || '').split('/').pop() + '#' + st[0].functionName + '@' + st[0].lineNumber; r.byFn[k] = (r.byFn[k] || 0) + ms; }
    } else if (e.name === 'Layout') {
      const n = (e.args && e.args.beginData && e.args.beginData.dirtyObjects) || 0;
      r.layoutMs += ms; r.layoutObjs += n;
      if (inInit(e)) { r.initLayoutObjs += n; r.initLayoutMs += ms; if (st) r.initForcedN++; }
      if (st) { r.forcedLayoutMs += ms; r.forcedLayoutN++; }
    } else if (e.name === 'EvaluateScript' && e.args && e.args.data && /\/script\.js/.test(e.args.data.url || '')) {
      r.scriptEvalMs += ms;
    } else if (e.name === 'RunTask' && e.dur > 50000) {
      r.longTaskMs += ms;
    }
  }
  for (const k of Object.keys(r)) if (typeof r[k] === 'number') r[k] = Math.round(r[k]);
  for (const k of Object.keys(r.byFn)) r.byFn[k] = Math.round(r.byFn[k]);
  return r;
}

(async () => {
  const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const reps = +(process.argv[3] || 2);
  const out = {};
  for (let i = 0; i < reps; i++) for (const v of variants) {
    const browser = await puppeteer.launch({ headless: 'new' });
    // aquece o cache com a mesma variante
    { const { p } = await openPage(browser, v, { throttle: 1 }); await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await p.close(); }
    const { p } = await openPage(browser, v, { throttle: 4 });
    const file = path.join(__dirname, `trace_${v.name}_${i}.json`);
    await p.tracing.start({ path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'v8.execute', 'blink.user_timing', 'loading'] });
    await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await w8(4000);
    await p.tracing.stop();
    await browser.close();
    (out[v.name] = out[v.name] || []).push(summarize(file));
    fs.unlinkSync(file);
  }
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
