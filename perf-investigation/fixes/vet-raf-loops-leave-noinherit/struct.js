/* Structural probe: per-variant trace, counts style-recalc elements (deterministic) and
   reports forced recalcs from script.js init, plus script.js evaluation duration. */
const path = require('path'); const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./bench.js');
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const REPS = +(process.argv[3] || 3);
const THR = +(process.argv[4] || 4);
const URL = process.env.URL || 'http://localhost:5173/';
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const agg = {};
  for (let r = 0; r < REPS; r++) for (const v of variants) {
    const { p } = await openPage(b, v, { throttle: THR });
    const file = path.join(__dirname, `st_${v.name}_${r}.json`);
    await p.tracing.start({ path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'v8.execute'] });
    await p.goto(URL, { waitUntil: 'domcontentloaded' });
    await new Promise((res) => setTimeout(res, +(process.env.WIN || 3500) + 1000));
    await p.tracing.stop(); await p.close();
    const ev = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents;
    fs.unlinkSync(file);
    const mains = new Set(ev.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain').map((m) => m.pid + ':' + m.tid));
    const cnt = {}; for (const e of ev) { const k = e.pid + ':' + e.tid; if (mains.has(k)) cnt[k] = (cnt[k] || 0) + 1; }
    const main = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    const X = ev.filter((e) => e.ph === 'X' && (e.pid + ':' + e.tid) === main && e.dur != null);
    const nav = ev.find((e) => e.name === 'navigationStart' && (e.pid + ':' + e.tid) === main);
    const t0 = nav ? nav.ts : Math.min(...X.map((e) => e.ts));
    const W = X.filter((e) => (e.ts - t0) / 1000 < +(process.env.WIN || 3500));
    const ult = W.filter((e) => e.name === 'UpdateLayoutTree');
    const lay = W.filter((e) => e.name === 'Layout');
    const sum = (a) => a.reduce((x, e) => x + e.dur, 0) / 1000;
    const elems = (a) => a.reduce((x, e) => x + ((e.args && e.args.elementCount) || 0), 0);
    const top = (e) => { const st = e.args && e.args.beginData && e.args.beginData.stackTrace; if (!st || !st.length) return null; const f = st[0]; return `${(f.url || '').split('/').pop()}:${f.lineNumber + 1}:${f.functionName}`; };
    const forced = ult.filter((e) => top(e) && top(e).startsWith('script.js'));
    const evals = W.filter((e) => e.name === 'EvaluateScript' && e.args && e.args.data && /\/script\.js/.test(e.args.data.url || ''));
    const res = {
      recalcN: ult.length, recalcElems: elems(ult), recalcMs: +sum(ult).toFixed(1), layoutMs: +sum(lay).toFixed(1),
      scriptEvalMs: +sum(evals).toFixed(1),
      forcedScript: forced.map((e) => `${top(e)} elems=${e.args.elementCount} ${(e.dur / 1000).toFixed(1)}ms @${Math.round((e.ts - t0) / 1000)}`),
    };
    (agg[v.name] = agg[v.name] || []).push(res);
    console.log(`\n== ${v.name} rep ${r}: recalcN=${res.recalcN} recalcElems=${res.recalcElems} recalcMs=${res.recalcMs} layoutMs=${res.layoutMs} scriptEvalMs=${res.scriptEvalMs}`);
    for (const f of res.forcedScript) if (/script\.js:(9[6-9]\d|1000)/.test(f)) console.log('   ', f);
  }
  await b.close();
  console.log('\nSUMMARY');
  for (const [k, rs] of Object.entries(agg)) {
    const med = (f) => { const s = rs.map(f).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    console.log(k, JSON.stringify({ recalcElems: med((x) => x.recalcElems), recalcMs: med((x) => x.recalcMs), layoutMs: med((x) => x.layoutMs), scriptEvalMs: med((x) => x.scriptEvalMs), all: rs.map((x) => [x.recalcElems, x.recalcMs, x.scriptEvalMs]) }));
  }
})().catch((e) => { console.error(e); process.exit(1); });
