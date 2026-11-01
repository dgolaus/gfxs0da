const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const ev=(raw.traceEvents||raw).filter(e=>e.name==='Animation').sort((a,b)=>a.ts-b.ts);
const re=new RegExp(process.argv[3]||'.');
const cur={};const recs=[];
for(const e of ev){const id=e.pid+JSON.stringify(e.id2||e.id);
  if(e.ph==='b'){const d=e.args.data;const r={name:(d.displayName||d.name)+' '+d.nodeName,evs:[]};cur[id]=r;recs.push(r);}
  else if(cur[id]){cur[id].evs.push(e.ph+(e.args&&e.args.data?JSON.stringify(e.args.data):''));}}
const agg={};for(const r of recs){if(!re.test(r.name))continue;const k=r.name+' :: '+r.evs.filter(x=>/compositeFailed/.test(x)).join(',');agg[k]=(agg[k]||0)+1;}
Object.entries(agg).sort().forEach(([k,v])=>console.log(v+'  '+k));
