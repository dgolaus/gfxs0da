const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const MAIN='9600:16248';
const isMain=e=>(e.pid+':'+e.tid)===MAIN;
const mainEv=ev.filter(e=>isMain(e));
const t0=Math.min(...mainEv.filter(e=>e.ts).map(e=>e.ts));
const X=mainEv.filter(e=>e.ph==='X'&&e.dur!=null).sort((a,b)=>a.ts-b.ts);
const frames=X.filter(e=>e.name==='ProxyMain::BeginMainFrame');
const want=['Paint','Layerize','PrePaint','Commit','UpdateLayoutTree','Layout','FireAnimationFrame','PaintImage','Blink.Animate.UpdateTime','LocalFrameView::RunCompositingInputsLifecyclePhase','LayerTreeHost::DoUpdateLayers','IntersectionObserverController::computeIntersections'];
console.log('t(ms) dur | '+want.map(w=>w.replace(/.*::/,'').slice(0,10)).join(' | '));
for(const f of frames){
  const kids=X.filter(e=>e.ts>=f.ts&&e.ts+e.dur<=f.ts+f.dur);
  const by={};for(const k of kids){if(want.includes(k.name)){ // avoid nested double count for Paint: only count top-level Paint
    by[k.name]=(by[k.name]||0)+k.dur;}}
  if(f.dur<8000) continue;
  console.log(String(Math.round((f.ts-t0)/1000)).padStart(5)+' '+String(Math.round(f.dur/1000)).padStart(4)+' | '+want.map(w=>String(Math.round((by[w]||0)/1000)).padStart(4)).join(' | '));
}
