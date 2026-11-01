// Layerization cost, unthrottled, per variant, interleaved reps. Windows: entry 0-3.5s, steady at top, steady with
// #pricing in view, steady with the chat (pulseGreen) in view. Counts PaintArtifactCompositor::Update and Layerize on
// the renderer main thread (thread CPU time when available). node trace.js <reps> <variant...>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [repsS, ...vars] = process.argv.slice(2);
const OUT = path.join(__dirname, 'out', 'trace'); fs.mkdirSync(OUT, { recursive: true });
const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'cc', 'disabled-by-default-devtools.timeline.frame'];
function summarize(file, from, to) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')); const ev = raw.traceEvents || raw;
  const metas = ev.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain');
  const cnt = {}; for (const e of ev) { const k = e.pid + ':' + e.tid; cnt[k] = (cnt[k] || 0) + 1; }
  const MAIN = metas.map((m) => m.pid + ':' + m.tid).sort((a, b) => cnt[b] - cnt[a])[0];
  const nav = ev.find((e) => e.name === 'navigationStart' || e.name === 'TracingStartedInBrowser');
  const X = ev.filter((e) => (e.pid + ':' + e.tid) === MAIN && e.ph === 'X' && e.dur != null);
  const t0 = Math.min(...X.map((e) => e.ts));
  const inW = (e) => { const t = (e.ts - t0) / 1000; return t >= from && t <= to; };
  const stat = (n) => { const a = X.filter((e) => e.name === n && inW(e)); const d = a.map((e) => (e.tdur != null ? e.tdur : e.dur) / 1000).sort((x, y) => x - y); const s = d.reduce((x, y) => x + y, 0); return { n: d.length, sum: +s.toFixed(1), med: d.length ? +d[d.length >> 1].toFixed(3) : 0, p90: d.length ? +d[Math.floor(d.length * 0.9)].toFixed(3) : 0 }; };
  const o = {}; for (const n of ['ProxyMain::BeginMainFrame', 'PaintArtifactCompositor::Update', 'Layerize', 'Paint', 'PrePaint', 'Commit', 'UpdateLayoutTree', 'Layout']) o[n] = stat(n);
  const lyr = ev.filter((e) => e.name === 'UpdateLayerTree' || e.name === 'LayerTreeHost::UpdateLayers'); o._layerTreeEvents = lyr.length;
  return o;
}
async function one(v, rep, scene) {
  const b = await L.launch(); const { p } = await L.open(b, v, { w: 1440, h: 900 });
  const file = path.join(OUT, `${scene}_${v}_${rep}.json`); let res;
  if (scene === 'entry') {
    await p.tracing.start({ path: file, categories: CATS }); await p.goto(L.BASE + '/', { waitUntil: 'domcontentloaded' }); await L.w8(3600); await p.tracing.stop();
    res = summarize(file, 0, 3500);
  } else {
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 3000);
    if (scene === 'pricing') await p.evaluate(() => { const r = document.getElementById('pricing').getBoundingClientRect(); window.scrollTo(0, r.top + scrollY - 200); });
    if (scene === 'chat') await p.evaluate(() => document.querySelector('.chat-status').scrollIntoView({ block: 'center' }));
    await L.w8(1500);
    await p.tracing.start({ path: file, categories: CATS }); await L.w8(4000); await p.tracing.stop();
    res = summarize(file, 0, 1e9);
  }
  await b.close(); fs.unlinkSync(file); return res;
}
(async () => {
  const reps = +repsS; const all = {};
  for (const scene of ['entry', 'top', 'pricing', 'chat']) for (let r = 0; r < reps; r++) for (const v of vars) {
    const s = await one(v, r, scene); ((all[scene] = all[scene] || {})[v] = all[scene][v] || []).push(s);
    const f = s['ProxyMain::BeginMainFrame'], u = s['PaintArtifactCompositor::Update'], l = s.Layerize;
    console.log(`${scene.padEnd(8)} ${v.padEnd(12)} r${r} frames=${f.n} PAC::Update n=${u.n} sum=${u.sum}ms med=${u.med} | Layerize n=${l.n} sum=${l.sum}ms med=${l.med} p90=${l.p90} | Paint ${s.Paint.n}/${s.Paint.sum}ms Commit ${s.Commit.sum}ms`);
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(all, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
