const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const X=ev.filter(e=>isMain(e)&&(e.name==='UpdateLayoutTree'||e.name==='Layout'||e.name==='ScheduleStyleRecalculation'));
// pair B/E or X
const out=[];
for(const e of X){
  if(e.ph==='X'&&e.name==='UpdateLayoutTree'){
    const st=(e.args&&e.args.beginData&&e.args.beginData.stackTrace)||[];
    out.push({t:Math.round((e.ts-t0)/1000),dur:+(e.dur/1000).toFixed(1),n:e.args&&e.args.elementCount,st:st.slice(0,3).map(f=>(f.url||'').split('/').pop()+':'+f.lineNumber+' '+f.functionName).join(' < ')});
  }
}
// also handle B/E
const Bs=ev.filter(e=>isMain(e)&&e.name==='UpdateLayoutTree'&&(e.ph==='B'||e.ph==='E')).sort((a,b)=>a.ts-b.ts);
let stack=[];
for(const e of Bs){ if(e.ph==='B') stack.push(e); else { const b=stack.pop(); if(!b) continue; const st=(b.args&&b.args.beginData&&b.args.beginData.stackTrace)||[]; out.push({t:Math.round((b.ts-t0)/1000),dur:+((e.ts-b.ts)/1000).toFixed(1),n:(e.args&&e.args.elementCount)||(b.args&&b.args.elementCount),st:st.slice(0,3).map(f=>(f.url||'').split('/').pop()+':'+f.lineNumber+' '+f.functionName).join(' < ')}); } }
out.sort((a,b)=>a.t-b.t);
const lo=+process.argv[3]||0, hi=+process.argv[4]||5000;
for(const o of out) if(o.t>=lo&&o.t<=hi&&o.dur>=0.5) console.log(String(o.t).padStart(5),String(o.dur).padStart(6)+'ms','n='+o.n,o.st);
