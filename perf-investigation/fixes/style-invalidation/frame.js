const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts&&e.name==='UpdateLayoutTree').map(e=>e.ts))-1;
const inv=ev.filter(e=>e.name==='StyleRecalcInvalidationTracking').sort((a,b)=>a.ts-b.ts);
const ult=ev.filter(e=>isMain(e)&&e.name==='UpdateLayoutTree'&&e.ph==='X').sort((a,b)=>a.ts-b.ts);
const target=+process.argv[3];
let prevTs=0;
for(const u of ult){ const t=(u.ts-t0)/1000; if(t<target){prevTs=u.ts;continue;}
  const b=inv.filter(e=>e.ts>prevTs&&e.ts<u.ts);
  const agg={};for(const e of b){const d=e.args.data;const k=d.reason+' | '+d.nodeName;agg[k]=(agg[k]||0)+1;}
  console.log('ULT at',Math.round(t),'elements',u.args.elementCount,'roots',b.length);
  Object.entries(agg).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('  ',v,k));
  break;}
