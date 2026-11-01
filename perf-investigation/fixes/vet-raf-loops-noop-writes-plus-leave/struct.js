/* Structural (element-count) probe of style recalcs during entry; durations reported but NOT a timing benchmark. */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./bench.js');
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const THR = +(process.argv[3] || 4);
const REPS = +(process.argv[4] || 2);
(async () => {
  const b = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000 });
  for (let r = 0; r < REPS; r++) for (const v of variants) {
    const { p } = await openPage(b, v, { throttle: THR });
    const file = path.join(__dirname, `st_${v.name}_${r}.json`);
    await p.tracing.start({ path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack'] });
    await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await new Promise((res) => setTimeout(res, 7500));
    await p.tracing.stop(); await p.close();
    const ev = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents;
    fs.unlinkSync(file);
    const meta = ev.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain').map((m) => m.pid + ':' + m.tid);
    const cnt = {}; for (const e of ev) { const k = e.pid + ':' + e.tid; if (meta.includes(k)) cnt[k] = (cnt[k] || 0) + 1; }
    const main = Object.entries(cnt).sort((a, c) => c[1] - a[1])[0][0];
    const X = ev.filter((e) => e.ph === 'X' && (e.pid + ':' + e.tid) === main && e.dur != null).sort((a, c) => a.ts - c.ts);
    const t0 = Math.min(...X.map((e) => e.ts));
    const ult = X.filter((e) => e.name === 'UpdateLayoutTree' && (e.ts - t0) / 1000 < 7000);
    const el = (a) => a.reduce((x, e) => x + ((e.args && e.args.elementCount) || 0), 0);
    const S = (a) => Math.round(a.reduce((x, e) => x + e.dur, 0) / 1000);
    const big = ult.filter((e) => (e.args && e.args.elementCount) >= 300).map((e) => {
      const st = e.args.beginData && e.args.beginData.stackTrace;
      return `${Math.round((e.ts - t0) / 1000)}ms:${e.args.elementCount}${st ? '@' + (st[0].url || '').split('/').pop() + ':' + (st[0].lineNumber + 1) : ''}`;
    });
    const evalTasks = X.filter((e) => e.name === 'EvaluateScript' && e.args && e.args.data && /script\.js/.test(e.args.data.url || '')).map((e) => Math.round(e.dur / 1000));
    const fs2 = ult.filter((e) => e.args.beginData && e.args.beginData.stackTrace && /script.js/.test(e.args.beginData.stackTrace[0].url || '')); console.log(v.name.padEnd(12), 'rep', r, 'scriptForcedN', fs2.length, 'scriptForcedElems', el(fs2), 'scriptForcedMs', S(fs2), 'recalcN', ult.length, 'elems', el(ult), 'recalcMs', S(ult), 'scriptEvalMs', JSON.stringify(evalTasks), 'big>=300', big.join(' '));
  }
  await b.close();
})().catch((e) => { console.error('FAIL', e.stack || e.message); process.exit(1); });
