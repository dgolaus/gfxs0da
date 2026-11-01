const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const tn={};meta.forEach(m=>tn[m.pid+':'+m.tid]=m.args.name);
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const T=e=>Math.round((e.ts-t0)/1000);
// names histogram
const h={};ev.forEach(e=>{h[e.name]=(h[e.name]||0)+1});
console.log(Object.entries(h).filter(([k])=>/Resource|Decode|Image|Parse|Font|Layout|Navigation|navigation|Mark|load|Load|Commit|Paint|FirstContentful|LCP|largest/i.test(k)).sort((a,b)=>b[1]-a[1]).map(x=>x.join(':')).join('\n'));
console.log('mains',mains, 't0',t0);
