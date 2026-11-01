const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;if(mains.includes(k))cnt[k]=(cnt[k]||0)+1;}
const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
const isMain=e=>(e.pid+':'+e.tid)===main;
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const X=ev.filter(e=>e.ph==='X'&&isMain(e)&&e.dur!=null).sort((a,b)=>a.ts-b.ts);
const ms=t=>((t-t0)/1000).toFixed(1);
const from=+process.argv[3]||2500, to=+process.argv[4]||2700;
const INT=/^(RunTask|FireAnimationFrame|FunctionCall|UpdateLayoutTree|Layout|PrePaint|Paint|Layerize|Commit|UpdateLayer|ScheduleStyleRecalculation|InvalidateLayout|ParseAuthorStyleSheet|Animation|BeginMainThreadFrame|EventDispatch|TimerFire|HitTest|IntersectionObserverController::computeIntersections|ProxyMain::BeginMainFrame::commit|UpdateLifecycle|PaintImage|ComputeIntersections)$/;
for(const e of X){const t=(e.ts-t0)/1000;if(t<from||t>to)continue;if(!INT.test(e.name)&&e.dur<500)continue;
 let extra='';const a=e.args||{};
 if(a.elementCount!=null)extra+=' elems='+a.elementCount;
 if(a.data&&a.data.functionName)extra+=' fn='+a.data.functionName+'@'+a.data.lineNumber;
 if(a.beginData&&a.beginData.stackTrace)extra+=' FORCED@'+a.beginData.stackTrace[0].lineNumber;
 if(a.endData)extra+=' end='+JSON.stringify(a.endData).slice(0,120);
 if(e.name==='UpdateLayoutTree'&&a.elementCount==null)extra+=' args='+JSON.stringify(a).slice(0,200);
 console.log(ms(e.ts).padStart(7),(e.dur/1000).toFixed(2).padStart(7),e.name,extra);}
