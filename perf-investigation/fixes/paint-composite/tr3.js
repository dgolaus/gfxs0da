const fs=require('fs');
const file=process.argv[2];
const ranges=(process.argv[3]||'').split(',').map(r=>r.split('-').map(Number));
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const metas=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain');
// choose main with most events
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;cnt[k]=(cnt[k]||0)+1;}
const MAIN=metas.map(m=>m.pid+':'+m.tid).sort((a,b)=>cnt[b]-cnt[a])[0];
const isMain=e=>(e.pid+':'+e.tid)===MAIN;
const mainEv=ev.filter(e=>isMain(e));
const t0=Math.min(...mainEv.filter(e=>e.ts).map(e=>e.ts));
const X=mainEv.filter(e=>e.ph==='X'&&e.dur!=null).sort((a,b)=>a.ts-b.ts);
for(const [a,b] of ranges){
  console.log('==== range',a,b);
  const ps=X.filter(e=>(e.name==='Paint'||e.name==='PaintImage'||e.name==='Layerize'||e.name==='PrePaint'||e.name==='Commit'||e.name==='UpdateLayer'||e.name==='RasterTask')&&(e.ts-t0)/1000>=a&&(e.ts-t0)/1000<=b);
  for(const p of ps){ console.log(((p.ts-t0)/1000).toFixed(1), p.name, (p.dur/1000).toFixed(2), JSON.stringify(p.args).slice(0,300)); }
}
