// top-level (non-nested) sums of paint/composite phases per window on renderer main
const fs=require('fs');
const file=process.argv[2]; const wins=(process.argv[3]||'0-3500,3500-4500').split(',').map(r=>r.split('-').map(Number));
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const metas=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain');
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;cnt[k]=(cnt[k]||0)+1;}
const MAIN=metas.map(m=>m.pid+':'+m.tid).sort((a,b)=>cnt[b]-cnt[a])[0];
const mainEv=ev.filter(e=>(e.pid+':'+e.tid)===MAIN);
const t0=Math.min(...mainEv.filter(e=>e.ts).map(e=>e.ts));
const X=mainEv.filter(e=>e.ph==='X'&&e.dur!=null).sort((a,b)=>a.ts-b.ts||b.dur-a.dur);
const names=['LocalFrameView::RunPaintLifecyclePhase','PrePaint','Paint','Layerize','PaintArtifactCompositor::Update','LocalFrameView::RunCompositingInputsLifecyclePhase','Commit','LayerTreeHost::DoUpdateLayers','UpdateLayoutTree','Layout','FireAnimationFrame','ProxyMain::BeginMainFrame','RunTask','AnimationTimeline::serviceAnimations','Blink.Animate.UpdateTime','PaintImage','Decode Image','ImageDecodeTask'];
for(const [a,b] of wins){
  const tot={};
  for(const n of names){
    const arr=X.filter(e=>e.name===n&&(e.ts-t0)/1000>=a&&(e.ts-t0)/1000<b);
    let s=0,end=-1,c=0;for(const e of arr){if(e.ts>=end){s+=e.dur;end=e.ts+e.dur;c++;}}
    tot[n]=[Math.round(s/1000),c];
  }
  console.log('window',a,b); for(const n of names) console.log('  '+n.padEnd(52)+String(tot[n][0]).padStart(6)+' ms  n='+tot[n][1]);
}
