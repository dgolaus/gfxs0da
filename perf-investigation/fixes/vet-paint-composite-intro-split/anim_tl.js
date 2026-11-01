const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const ms=ts=>Math.round((ts-t0)/1000);
// animation events
const an=ev.filter(e=>e.name==='Animation');
const byId={};
for(const e of an){const id=e.id2?JSON.stringify(e.id2):e.id; (byId[id]=byId[id]||[]).push(e);}
const rows=[];
for(const [id,es] of Object.entries(byId)){
  const b=es.find(e=>e.ph==='b');const n=es.find(e=>e.ph==='n'||e.ph==='e');
  const nm=(b&&b.args&&b.args.data&&(b.args.data.name||b.args.data.id))||'';
  const states=es.map(e=>e.ph+'@'+ms(e.ts)+(e.args&&e.args.data&&e.args.data.state?':'+e.args.data.state:'')+(e.args&&e.args.data&&e.args.data.compositeFailed!==undefined?':cf'+e.args.data.compositeFailed:'')).join(' ');
  rows.push([b?ms(b.ts):0,nm,states]);
}
rows.sort((a,b)=>a[0]-b[0]);
for(const r of rows) if(/hero|nav|Block/i.test(r[1])) console.log(r[0],r[1],r[2]);
console.log('total anim events',an.length, 'distinct',rows.length);
// main frames: BeginMainThreadFrame / Commit events
const commits=ev.filter(e=>isMain(e)&&(e.name==='Commit'||e.name==='BeginMainThreadFrame'));
console.log('commits', commits.filter(e=>e.name==='Commit').map(e=>ms(e.ts)).slice(0,40).join(' '));
const fcp=ev.filter(e=>/firstContentfulPaint|firstPaint|FirstMeaningful/.test(e.name)).map(e=>e.name+'@'+ms(e.ts));
console.log(fcp.join(' '));
const tasks=ev.filter(e=>e.ph==='X'&&isMain(e)&&e.name==='RunTask'&&e.dur>50000).map(e=>ms(e.ts)+'+'+Math.round(e.dur/1000));
console.log('long', tasks.join(' '));
