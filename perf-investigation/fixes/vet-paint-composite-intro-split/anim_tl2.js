const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const ms=ts=>Math.round((ts-t0)/1000);
const an=ev.filter(e=>e.name==='Animation');
console.log(JSON.stringify(an.slice(0,4),null,0));
const ids={};
for(const e of an){const id=e.id||JSON.stringify(e.id2);(ids[id]=ids[id]||[]).push(e);}
const out=[];
for(const [id,es] of Object.entries(ids)){
 const names=[...new Set(es.map(e=>e.args&&e.args.data&&e.args.data.displayName).filter(Boolean))];
 const nodes=[...new Set(es.map(e=>e.args&&e.args.data&&(e.args.data.nodeName||e.args.data.displayName)).filter(Boolean))];
 out.push([ms(es[0].ts),names.join('|'),nodes.join('|'),es.map(e=>e.ph+'@'+ms(e.ts)+(e.args&&e.args.data&&e.args.data.state?':'+e.args.data.state:'')+(e.args&&e.args.data&&e.args.data.compositeFailed!==undefined?':cf'+e.args.data.compositeFailed:'')).join(' ')]);
}
out.sort((a,b)=>a[0]-b[0]);
for(const o of out) console.log(o.join('  '));
