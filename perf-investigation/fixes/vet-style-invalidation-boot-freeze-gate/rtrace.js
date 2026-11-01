/* Trace the first 4s at CPU 4x; report big UpdateLayoutTree events (elementCount) + where boot.js ran + snippet cost. Interleaved. */
const path=require('path');const fs=require('fs');
const {openPage}=require('./bench.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const vs=JSON.parse(fs.readFileSync(path.join(__dirname,'variants.json'),'utf8'));
const REPS=+(process.env.REPS||3);
(async()=>{const b=await puppeteer.launch({headless:'new'});const f=path.join(__dirname,'rt_tmp.json');const agg={};
 for(let r=0;r<REPS;r++)for(const v of vs){
  const {p}=await openPage(b,v,{throttle:4});
  await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline','v8.execute']});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});await new Promise(r=>setTimeout(r,4000));
  await p.tracing.stop();await p.close();
  const ev=JSON.parse(fs.readFileSync(f,'utf8')).traceEvents;
  const mains=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
  // pick the renderer main with most events
  const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;if(mains.includes(k))cnt[k]=(cnt[k]||0)+1;}
  const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
  const X=ev.filter(e=>e.ph==='X'&&(e.pid+':'+e.tid)===main&&e.dur);
  const t0=Math.min(...X.map(e=>e.ts));
  const ult=X.filter(e=>e.name==='UpdateLayoutTree');
  const big=ult.filter(e=>e.args&&e.args.elementCount>300).map(e=>`${Math.round((e.ts-t0)/1000)}ms:${Math.round(e.dur/1000)}ms/${e.args.elementCount}el`);
  const bootjs=X.filter(e=>e.name==='EvaluateScript'&&e.args&&e.args.data&&/boot\.js/.test(e.args.data.url||'')).map(e=>Math.round((e.ts-t0)/1000));
  const inl=X.filter(e=>e.name==='EvaluateScript'&&e.args&&e.args.data&&/index\.html|localhost:5173\/$/.test(e.args.data.url||'')&&e.dur>0).map(e=>{const kids=ult.filter(k=>k.ts>=e.ts&&k.ts<=e.ts+e.dur);return `L${e.args.data.lineNumber}:${(e.dur/1000).toFixed(1)}ms(style ${(kids.reduce((a,k)=>a+k.dur,0)/1000).toFixed(1)})`;});
  const ultSum=ult.filter(e=>e.ts-t0<3500000).reduce((a,e)=>a+e.dur,0)/1000;
  const lt=X.filter(e=>e.name==='RunTask'&&e.dur>50000&&e.ts-t0<3500000);
  console.log(v.name.padEnd(16),'rep',r,'| boot.js@',bootjs.join(','),'| big recalcs:',big.join(' '),'| ULT sum<3.5s',ultSum.toFixed(0),'ms | longtasks',lt.length,Math.round(lt.reduce((a,e)=>a+e.dur,0)/1000)+'ms','| inline:',inl.join(' '));
  (agg[v.name]=agg[v.name]||[]).push(ultSum);
 }
 for(const [k,a] of Object.entries(agg)){a.sort((x,y)=>x-y);console.log(k,'median ULT<3.5s',a[a.length>>1].toFixed(0));}
 await b.close();})();
