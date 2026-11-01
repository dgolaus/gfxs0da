/* Trace-based work accounting (thread time) for variants. NOT a frame-timing benchmark.
   node cvtrace.js variants.json [reps] [url] */
const fs=require('fs');const path=require('path');
const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const ENTRY=+(process.env.ENTRY||3500);
function summarize(file){
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));const ev=raw.traceEvents||raw;
  const mains=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args&&e.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
  // pick the renderer main that has most events
  const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;if(mains.includes(k))cnt[k]=(cnt[k]||0)+1;}
  const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
  const M=ev.filter(e=>e.pid+':'+e.tid===main&&e.ts);
  const t0=Math.min(...M.map(e=>e.ts));
  const inE=e=>e.ts-t0<=ENTRY*1000;
  const X=M.filter(e=>e.ph==='X'&&inE(e));
  const s={};
  const add=(k,e)=>{s[k]=s[k]||{n:0,dur:0,tdur:0};s[k].n++;s[k].dur+=(e.dur||0)/1000;s[k].tdur+=(e.tdur||0)/1000;};
  for(const e of X){
    if(['Layout','UpdateLayoutTree','Paint','PrePaint','Layerize','InlineNode::ShapeTextIncludingFirstLine','FunctionCall','EvaluateScript','FireAnimationFrame','HitTest'].includes(e.name)) add(e.name,e);
  }
  const lt=X.filter(e=>e.name==='RunTask'&&e.dur>50000);
  const out={};
  for(const [k,v] of Object.entries(s)) out[k.replace('InlineNode::ShapeTextIncludingFirstLine','Shape')]=`n${v.n} wall${Math.round(v.dur)} cpu${Math.round(v.tdur)}`;
  out.longTasks=lt.length+' / '+Math.round(lt.reduce((a,e)=>a+e.dur,0)/1000)+'ms wall / '+Math.round(lt.reduce((a,e)=>a+(e.tdur||0),0)/1000)+'ms cpu';
  const maxLayout=X.filter(e=>e.name==='Layout').sort((a,b)=>b.dur-a.dur)[0];
  const sh=maxLayout?X.filter(e=>e.name==='InlineNode::ShapeTextIncludingFirstLine'&&e.ts>=maxLayout.ts&&e.ts<=maxLayout.ts+maxLayout.dur):[];out.shapeInMax='n'+sh.length+' cpu'+Math.round(sh.reduce((a,e)=>a+(e.tdur||0),0)/1000)+' wall'+Math.round(sh.reduce((a,e)=>a+(e.dur||0),0)/1000);out.maxLayoutCpu=maxLayout?Math.round(maxLayout.tdur/1000):0;
  out.maxLayout=maxLayout?Math.round(maxLayout.dur/1000)+'ms@'+Math.round((maxLayout.ts-t0)/1000)+' dirty'+maxLayout.args.beginData.dirtyObjects+'/'+maxLayout.args.beginData.totalObjects:'';
  {const byCpu=X.filter(e=>e.name==="RunTask").sort((a,b)=>(b.tdur||0)-(a.tdur||0)).slice(0,6);out.topCpu=byCpu.map(t=>{const kids=X.filter(e=>e.ts>=t.ts&&e.ts+e.dur<=t.ts+t.dur&&e!==t);const by={};for(const k of kids){if(/^(Layout|UpdateLayoutTree|Paint|EvaluateScript|FireAnimationFrame|ParseHTML)$/.test(k.name))by[k.name]=(by[k.name]||0)+(k.tdur||0)/1000;}return Math.round((t.tdur||0)/1000)+"@"+Math.round((t.ts-t0)/1000)+"("+Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>k.replace("UpdateLayoutTree","ULT").replace("FireAnimationFrame","rAF").replace("EvaluateScript","JS")+Math.round(v)).join(",")+")";}).join(" ");}
  if(process.env.LT){out.lt=lt.map(t=>{const kids=X.filter(e=>e.ts>=t.ts&&e.ts+e.dur<=t.ts+t.dur&&e!==t);const by={};for(const k of kids){if(/^(Layout|UpdateLayoutTree|Paint|PrePaint|Layerize|EvaluateScript|FireAnimationFrame|FunctionCall|TimerFire|ParseHTML|InlineNode::ShapeTextIncludingFirstLine)$/.test(k.name))by[k.name]=(by[k.name]||0)+k.dur/1000;}const st=kids.filter(k=>(k.name==="Layout"||k.name==="UpdateLayoutTree")&&k.args&&k.args.beginData&&k.args.beginData.stackTrace).map(k=>k.name[0]+Math.round(k.dur/1000)+":"+k.args.beginData.stackTrace.slice(0,2).map(f=>(f.url||"").split("/").pop()+":"+f.lineNumber).join("<"));return Math.round((t.ts-t0)/1000)+"ms dur"+Math.round(t.dur/1000)+" | "+Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>k.replace("InlineNode::ShapeTextIncludingFirstLine","Shape")+" "+Math.round(v)).join(", ")+(st.length?" | forced: "+st.slice(0,4).join(" ; "):"");});}
  return out;
}
(async()=>{
  const variants=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const reps=+(process.argv[3]||1);
  const url=process.argv[4]||'http://localhost:5173/';
  const b=await puppeteer.launch({headless:'new'});
  {const w=await b.newPage();await w.goto(url,{waitUntil:'networkidle2'});await w.close();}
  for(let r=0;r<reps;r++) for(const v of variants){
    const {p}=await openPage(b,v);
    const file=path.join(__dirname,'tr_'+v.name+'.json');
    await p.tracing.start({path:file,categories:['devtools.timeline','disabled-by-default-devtools.timeline','blink','disabled-by-default-devtools.timeline.stack']});
    await p.goto(url,{waitUntil:'domcontentloaded'});
    await w8(ENTRY+800);
    await p.tracing.stop();await p.close();
    console.log(v.name, JSON.stringify(summarize(file),null,1));
    if(!process.env.KEEP)fs.unlinkSync(file);
  }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
