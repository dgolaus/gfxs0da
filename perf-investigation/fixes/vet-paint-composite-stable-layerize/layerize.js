const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const X=ev.filter(e=>e.ph==='X'&&isMain(e)&&e.dur);
const names={};
for(const e of X){const t=(e.ts-t0)/1000; if(t>3500) continue; names[e.name]=(names[e.name]||{n:0,d:0}); names[e.name].n++; names[e.name].d+=e.dur;}
const rows=Object.entries(names).sort((a,b)=>b[1].d-a[1].d).slice(0,45);
for(const [k,v] of rows) console.log(k.padEnd(45), String(v.n).padStart(6), String(Math.round(v.d/1000)).padStart(7)+'ms');
// Layerize events detail
const L=X.filter(e=>/Layerize|PaintArtifactCompositor|UpdateLayer$/.test(e.name));
const byBucket={};
for(const e of L){const t=(e.ts-t0)/1000; const b=Math.floor(t/500)*500; const k=e.name+'@'+b; byBucket[k]=(byBucket[k]||0)+e.dur;}
console.log(byBucket);
const lz=L.filter(e=>e.name==='Layerize').map(e=>e.dur/1000).sort((a,b)=>a-b);
console.log('Layerize count',lz.length,'median',lz[Math.floor(lz.length/2)],'max',lz[lz.length-1],'sum',lz.reduce((a,b)=>a+b,0));
