const fs = require('fs');
const puppeteer = require('../node_modules/puppeteer');
const { serve } = require('./disk.js');
const FIX = 'fixes/forced-layout';
const V = { base: {}, var: { '/script.js': FIX + '/script.js', '/index.html': FIX + '/index.html' }, js: { '/script.js': FIX + '/script.js' } };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const vn of ['base', 'js', 'var', 'base', 'js', 'var']) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await serve(p, V[vn]);
    await p.evaluateOnNewDocument(`try{localStorage.setItem('s0da-lite','0')}catch(e){}; Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8}); Object.defineProperty(navigator,'deviceMemory',{get:()=>8}); (()=>{const add=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}return add.apply(this,c);};})();`);
    const file = `trace_${vn}.json`;
    await p.tracing.start({ path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink'] });
    await p.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 60000 });
    await w8(2500);
    await p.tracing.stop();
    await ctx.close();
    const ev = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents;
    const tn = ev.filter((e) => e.name === 'thread_name' && e.args.name === 'CrRendererMain');
    // pick the renderer main thread with most Layout events
    let best = null, bc = -1;
    for (const t of tn) { const n = ev.filter((e) => e.pid === t.pid && e.tid === t.tid && e.name === 'Layout').length; if (n > bc) { bc = n; best = t; } }
    const M = ev.filter((e) => e.pid === best.pid && e.tid === best.tid);
    const evals = M.filter((e) => e.name === 'EvaluateScript' && e.ph === 'X' && /script\.js/.test(JSON.stringify(e.args)) && !/smooth/.test(JSON.stringify(e.args)));
    const win = evals.map((e) => [e.ts, e.ts + e.dur]);
    const inW = (e) => win.some(([a, b]) => e.ts >= a && e.ts < b);
    const ult = M.filter((e) => e.name === 'UpdateLayoutTree' && e.ph === 'X');
    const lay = M.filter((e) => e.name === 'Layout' && (e.ph === 'X' || e.ph === 'B'));
    const sumEl = (xs) => xs.reduce((a, e) => a + ((e.args && e.args.elementCount) || (e.args && e.args.beginData && e.args.beginData.elementCount) || 0), 0);
    const sumDur = (xs) => Math.round(xs.reduce((a, e) => a + (e.dur || 0), 0) / 1000);
    const inside = ult.filter(inW), lin = lay.filter(inW);
    const forced = ult.filter((e) => e.args && e.args.beginData && e.args.beginData.stackTrace);
    console.log(vn.padEnd(5), 'scriptEval', win.map(([a, b]) => Math.round((b - a) / 1000) + 'ms').join(','),
      '| in-eval recalc n', inside.length, 'els', sumEl(inside), 'dur', sumDur(inside), 'ms; layouts', lin.length, sumDur(lin) + 'ms',
      '| whole trace recalc n', ult.length, 'els', sumEl(ult), 'dur', sumDur(ult), 'ms; forced recalcs', forced.length, 'els', sumEl(forced), '; layouts', lay.length, sumDur(lay) + 'ms');
    fs.unlinkSync(file);
  }
  await browser.close();
})();
