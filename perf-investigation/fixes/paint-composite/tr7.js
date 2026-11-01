const fs=require('fs');
const [file]=process.argv.slice(2);
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const an=ev.filter(e=>e.name==='Animation');
console.log('Animation events',an.length);
const byId={};
for(const e of an){ const id=e.id2?JSON.stringify(e.id2):e.id; (byId[id]=byId[id]||[]).push(e);}
const res=[];
for(const [id,arr] of Object.entries(byId)){
  const start=arr.find(e=>e.ph==='b');
  const steps=arr.filter(e=>e.ph==='n');
  const name=start&&start.args&&start.args.data&&(start.args.data.displayName||start.args.data.name);
  const nodeName=start&&start.args&&start.args.data&&start.args.data.nodeName;
  const fails=steps.map(s=>s.args&&s.args.data&&JSON.stringify(s.args.data)).filter(Boolean);
  res.push([name,nodeName,fails.slice(0,2).join(' ; ')]);
}
const agg={};
for(const r of res){const k=r[0]+' | '+r[1]+' | '+r[2]; agg[k]=(agg[k]||0)+1;}
Object.entries(agg).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(4)+'  '+k.slice(0,400)));
