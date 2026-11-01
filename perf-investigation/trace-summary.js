/* Resume um trace: long tasks da thread principal e o que domina cada uma. */
const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
// thread principal do renderer = a que tem os eventos RunTask com mais duração total de Layout/Paint/FunctionCall
const nav=ev.find(e=>e.name==='navigationStart'||e.name==='TracingStartedInBrowser');
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const X=ev.filter(e=>e.ph==='X'&&isMain(e)&&e.dur);
const tasks=X.filter(e=>e.name==='RunTask'&&e.dur>50000).sort((a,b)=>a.ts-b.ts);
// para cada long task, soma o tempo por categoria de evento filho
const CAT=n=>/^(Layout|UpdateLayoutTree|RecalculateStyles|ParseAuthorStyleSheet|UpdateLayer|PrePaint|Paint|PaintImage|Layerize|Commit|ScheduleStyleRecalculation|InvalidateLayout|HitTest)$/.test(n)?n
 :/^(FunctionCall|EvaluateScript|v8\.compile|v8\.run|TimerFire|FireAnimationFrame|EventDispatch|v8\.callFunction|MajorGC|MinorGC|V8\.GC.*|CompileScript|ParseHTML|Decode Image|ImageDecodeTask|Decode LazyPixelRef|Rasterize.*|Animation)$/.test(n)?n:null;
console.log('long tasks (>50ms) na thread principal: '+tasks.length+'   total: '+Math.round(tasks.reduce((a,t)=>a+t.dur,0)/1000)+'ms');
console.log('');
const totCat={};
for(const t of tasks){
 const kids=X.filter(e=>e.ts>=t.ts&&e.ts+e.dur<=t.ts+t.dur&&e!==t);
 const by={};for(const k of kids){const c=CAT(k.name);if(c)by[c]=(by[c]||0)+k.dur;}
 // pega o script/funcao de topo pra JS
 const fc=kids.filter(k=>k.name==='FunctionCall'||k.name==='EvaluateScript').map(k=>(k.args&&k.args.data&&(k.args.data.url||'')).split('/').pop()+(k.args&&k.args.data&&k.args.data.functionName?'#'+k.args.data.functionName:'')+'@'+(k.args&&k.args.data&&k.args.data.lineNumber||'')).filter(Boolean);
 const top=Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>k+' '+Math.round(v/1000)+'ms').join(', ');
 for(const [k,v] of Object.entries(by)) totCat[k]=(totCat[k]||0)+v;
 console.log(String(Math.round((t.ts-t0)/1000)).padStart(5)+'ms  dur '+String(Math.round(t.dur/1000)).padStart(4)+'ms  | '+top+(fc.length?'  | js: '+[...new Set(fc)].slice(0,3).join(' ; '):''));
}
console.log('');
console.log('soma por tipo dentro das long tasks (ms):');
Object.entries(totCat).sort((a,b)=>b[1]-a[1]).slice(0,14).forEach(([k,v])=>console.log('  '+k.padEnd(28)+Math.round(v/1000)));
// raster/decode fora da main (compositor/raster threads)
const rast=ev.filter(e=>e.ph==='X'&&e.dur&&/RasterTask|ImageDecodeTask|Decode Image/.test(e.name));
const byName={};for(const r of rast){byName[r.name]=(byName[r.name]||0)+r.dur;}
console.log('');console.log('fora da main (raster/decode, todas as threads):');
Object.entries(byName).forEach(([k,v])=>console.log('  '+k.padEnd(28)+Math.round(v/1000)+'ms'));
