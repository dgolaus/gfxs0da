/* Structural probe (not timing): records a short trace and counts style-recalc element counts per frame. */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openPage}=require('./vis/bench.js');
const variants=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const THR=+(process.argv[3]||1);
(async()=>{
 const b=await puppeteer.launch({headless:'new'});
 for(const v of variants){
  const {p,c}=await openPage(b,v,{throttle:THR});
  const file=path.join(__dirname,'st_'+v.name+'.json');
  await p.tracing.start({path:file,categories:['devtools.timeline','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.stack']});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,+(process.argv[4]||4500)));
  await p.tracing.stop();await p.close();
  const ev=JSON.parse(fs.readFileSync(file,'utf8')).traceEvents;
  const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
  const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;if(meta.includes(k))cnt[k]=(cnt[k]||0)+1;}
  const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
  const X=ev.filter(e=>e.ph==='X'&&(e.pid+':'+e.tid)===main&&e.dur!=null);
  const nav=ev.find(e=>e.name==='navigationStart'&&(e.pid+':'+e.tid)===main);
  const t0=nav?nav.ts:Math.min(...X.map(e=>e.ts));
  const win=(a,z)=>X.filter(e=>{const t=(e.ts-t0)/1000;return t>=a&&t<z;});
  const summarize=(a,z)=>{const W=win(a,z);
   const ult=W.filter(e=>e.name==='UpdateLayoutTree');
   const forced=ult.filter(e=>e.args&&e.args.beginData&&e.args.beginData.stackTrace);
   const lay=W.filter(e=>e.name==='Layout');const flay=lay.filter(e=>e.args&&e.args.beginData&&e.args.beginData.stackTrace);
   const bmf=W.filter(e=>e.name==='ProxyMain::BeginMainFrame');
   const paint=W.filter(e=>e.name==='Paint');
   const faf=W.filter(e=>e.name==='FireAnimationFrame');
   const S=a=>Math.round(a.reduce((x,e)=>x+e.dur,0)/1000);
   const el=a=>a.reduce((x,e)=>x+(e.args&&e.args.elementCount||0),0);
   return {frames:bmf.length,recalcN:ult.length,recalcMs:S(ult),recalcElems:el(ult),forcedRecalcN:forced.length,forcedRecalcMs:S(forced),layoutN:lay.length,layoutMs:S(lay),forcedLayoutN:flay.length,paintN:paint.length,paintMs:S(paint),fafMs:S(faf),bmfMs:S(bmf)};};
  console.log(v.name,'ENTRY 0-3500',JSON.stringify(summarize(0,3500)));
  console.log(v.name,'LATE 3500-4500',JSON.stringify(summarize(3500,4500)));
  if(!process.env.KEEP) fs.unlinkSync(file);
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
