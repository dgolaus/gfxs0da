// Deterministic-ish work accounting during entry: style recalcs (elementCount)
// and layouts (dirty/total objects) on the main thread, first 3.5s, CPU 4x.
// Also logs gstatic request start times and the counter-arm time.
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./page.js');
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const reps = +(process.argv[3] || 1);
const ua = process.argv[4] || null;
const OUT = __dirname;
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (let r = 0; r < reps; r++) for (const v of variants) {
    // prime cache (warm run)
    { const { p } = await openPage(browser, v); if (ua) await p.setUserAgent(ua); await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await p.close(); }
    const { p, log } = await openPage(browser, v, { throttle: 4 });
    if (ua) await p.setUserAgent(ua);
    const reqT = [];
    p.on('request', (q) => { if (q.url().includes('gstatic')) reqT.push([Date.now(), q.url().split('/').pop().slice(-12)]); });
    const tf = path.join(OUT, `tr_${v.name}.json`);
    await p.tracing.start({ path: tf, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'loading'] });
    const t0 = Date.now();
    await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await new Promise((res) => setTimeout(res, 3500));
    await p.tracing.stop();
    await p.close();
    const ev = JSON.parse(fs.readFileSync(tf, 'utf8')).traceEvents || JSON.parse(fs.readFileSync(tf, 'utf8'));
    const names = ev.filter((e) => e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain');
    // pick the renderer main thread that has the most UpdateLayoutTree events
    let best = null, bestN = -1;
    for (const n of names) { const k = ev.filter((e) => e.pid === n.pid && e.tid === n.tid && e.name === 'UpdateLayoutTree').length; if (k > bestN) { bestN = k; best = n; } }
    const main = ev.filter((e) => e.pid === best.pid && e.tid === best.tid);
    const nav = main.find((e) => e.name === 'navigationStart' || e.name === 'markAsMainFrame') || main.find((e) => e.ph === 'X');
    const ns = (ev.find((e) => e.name === 'navigationStart' && e.pid === best.pid) || nav).ts;
    const rel = (ts) => Math.round((ts - ns) / 1000);
    const recalcs = main.filter((e) => e.name === 'UpdateLayoutTree' && e.ph === 'X');
    const layouts = main.filter((e) => e.name === 'Layout' && e.ph === 'X');
    const bigR = recalcs.filter((e) => (e.args.elementCount || 0) > 200).map((e) => `${rel(e.ts)}:${e.args.elementCount}el/${Math.round(e.dur / 1000)}ms${e.args.beginData && e.args.beginData.stackTrace ? '*F' : ''}`);
    const bigL = layouts.filter((e) => (e.dur || 0) > 15000).map((e) => `${rel(e.ts)}:${(e.args.beginData || {}).dirtyObjects}/${(e.args.beginData || {}).totalObjects}obj/${Math.round(e.dur / 1000)}ms${e.args.beginData && e.args.beginData.stackTrace ? '*F' : ''}`);
    const sumEl = recalcs.reduce((a, e) => a + (e.args.elementCount || 0), 0);
    const sumRms = Math.round(recalcs.reduce((a, e) => a + (e.dur || 0), 0) / 1000);
    const sumLms = Math.round(layouts.reduce((a, e) => a + (e.dur || 0), 0) / 1000);
    const sumDirty = layouts.reduce((a, e) => a + ((e.args.beginData || {}).dirtyObjects || 0), 0);
    const fontReq = main.length ? ev.filter((e) => e.name === 'ResourceSendRequest' && e.args && e.args.data && /gstatic/.test(e.args.data.url)).map((e) => `${rel(e.ts)}:${e.args.data.url.split('/').pop().slice(-10)}`) : [];
    console.log(`${v.name.padEnd(18)} recalc: n=${recalcs.length} elements=${sumEl} ms=${sumRms} | layout: n=${layouts.length} dirtyObjs=${sumDirty} ms=${sumLms}`);
    console.log(`   big recalcs: ${bigR.join(' ')}`);
    console.log(`   big layouts: ${bigL.join(' ')}`);
    console.log(`   gstatic send: ${fontReq.join(' ')}  | gstatic reqs seen: ${log.filter((x) => x.includes('gstatic')).length}`);
    fs.unlinkSync(tf);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
