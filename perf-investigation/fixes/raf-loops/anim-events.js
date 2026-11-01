const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ev=raw.traceEvents||raw;
const A=ev.filter(e=>e.name==='Animation');
console.log('Animation events',A.length);
const by={};
for(const e of A){const d=e.args&&e.args.data||{};const k=JSON.stringify({name:d.name,state:d.state,cf:d.compositeFailed,up:d.unsupportedProperties,nodeName:d.nodeName,id:d.id});}
const ids={};
for(const e of A){const d=(e.args&&e.args.data)||{};const id=e.id2?JSON.stringify(e.id2):e.id;ids[id]=ids[id]||{};Object.assign(ids[id],d);}
const sum={};
for(const [id,d] of Object.entries(ids)){const k=(d.name||'?')+' | '+(d.nodeName||'')+' | cf='+(d.compositeFailed||0)+' | '+(d.unsupportedProperties||[]).join(',');sum[k]=(sum[k]||0)+1;}
Object.entries(sum).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(4),k));
