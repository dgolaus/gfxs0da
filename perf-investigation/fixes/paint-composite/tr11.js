const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const ev=raw.traceEvents||raw;
const re=new RegExp(process.argv[3]||'price');
const metas=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain');
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;cnt[k]=(cnt[k]||0)+1;}
const MAIN=metas.map(m=>m.pid+':'+m.tid).sort((a,b)=>cnt[b]-cnt[a])[0];
const t0=Math.min(...ev.filter(e=>(e.pid+':'+e.tid)===MAIN&&e.ts).map(e=>e.ts));
const an=ev.filter(e=>e.name==='Animation');
const byId={};for(const e of an){const id=JSON.stringify(e.id2||e.id);(byId[id]=byId[id]||[]).push(e);}
for(const [id,arr] of Object.entries(byId)){const b=arr.find(e=>e.ph==='b');if(!b)continue;const d=b.args.data;const label=(d.displayName||d.name)+' '+d.nodeName;if(!re.test(label))continue;
 console.log(label+' :: '+arr.map(e=>e.ph+'@'+((e.ts-t0)/1000).toFixed(0)+(e.args&&e.args.data&&e.ph!=='b'?JSON.stringify(e.args.data):'')).join(' | ').slice(0,600));}
