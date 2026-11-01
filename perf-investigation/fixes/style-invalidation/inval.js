const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts&&e.name==='UpdateLayoutTree').map(e=>e.ts))-1;
const names={};for(const e of ev){if(/Invalidation/.test(e.name))names[e.name]=(names[e.name]||0)+1;}
console.log(names);
const inv=ev.filter(e=>/InvalidationTracking/.test(e.name)).sort((a,b)=>a.ts-b.ts);
const ult=ev.filter(e=>isMain(e)&&e.name==='UpdateLayoutTree'&&e.ph==='X').sort((a,b)=>a.ts-b.ts);
// For each recalc, summarize invalidations since previous recalc
let prev=0, i=0;
const maxShow=+process.argv[3]||60;
let shown=0;
for(const u of ult){
  const before=[];while(i<inv.length&&inv[i].ts<u.ts){before.push(inv[i]);i++;}
  const ec=u.args&&u.args.elementCount;
  const st=u.args&&u.args.beginData&&u.args.beginData.stackTrace;
  const top=st?st.slice(0,1).map(f=>(f.url||'').split('/').pop()+':'+f.lineNumber).join(''):'';
  const agg={};
  for(const e of before){const d=e.args&&e.args.data||{};const k=e.name.replace('InvalidationTracking','')+' | '+(d.reason||d.changedClass||d.changedAttribute||d.changedId||'')+(d.selectors?(' sel='+JSON.stringify(d.selectors).slice(0,160)):'')+(d.invalidationList?(' list='+JSON.stringify(d.invalidationList).slice(0,200)):'')+' | node='+(d.nodeName||'');agg[k]=(agg[k]||0)+1;}
  if((u.dur||0)/1000<2 && shown>5) continue;
  if(shown++>maxShow)break;
  console.log('\n'+String(Math.round((u.ts-t0)/1000)).padStart(5)+' ULT '+((u.dur||0)/1000).toFixed(1)+'ms elements='+ec+' '+top);
  Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,12).forEach(([k,v])=>console.log('     '+String(v).padStart(4)+'x '+k.slice(0,330)));
}
