const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const X=ev.filter(e=>isMain(e)&&(e.name==='UpdateLayoutTree')&&(e.ph==='X'||e.ph==='B'||e.ph==='E'));
// pair B/E if needed
const out=[];const stack=[];
for(const e of X.sort((a,b)=>a.ts-b.ts)){
 if(e.ph==='X')out.push({ts:e.ts,dur:e.dur,args:e.args});
 else if(e.ph==='B')stack.push(e); else if(e.ph==='E'){const b=stack.pop();if(b)out.push({ts:b.ts,dur:e.ts-b.ts,args:Object.assign({},b.args,e.args)});}
}
let rows=[];
for(const u of out){const t=(u.ts-t0)/1000;if(t>4500)continue;
 const ec=(u.args&&(u.args.elementCount!=null?u.args.elementCount:(u.args.endData&&u.args.endData.elementCount)));
 const forced=!!(u.args&&u.args.beginData&&u.args.beginData.stackTrace);
 rows.push({t:Math.round(t),dur:+(u.dur/1000).toFixed(1),ec,forced});}
// histogram: element counts for non-forced recalcs between 0-3500
const nf=rows.filter(r=>!r.forced&&r.t<3500);
console.log('non-forced ULT 0-3500:',nf.length,'total ms',Math.round(nf.reduce((a,r)=>a+r.dur,0)));
const small=nf.filter(r=>r.ec!=null&&r.ec<400);
console.log('of which ec<400 (per-frame-ish):',small.length,'ms',Math.round(small.reduce((a,r)=>a+r.dur,0)),'median ec',small.map(r=>r.ec).sort((a,b)=>a-b)[Math.floor(small.length/2)]);
console.log(rows.filter(r=>r.t<3500).map(r=>`${r.t}:${r.dur}ms/${r.ec}${r.forced?'F':''}`).join('  '));
