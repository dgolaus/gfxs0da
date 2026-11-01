const fs=require('fs');
const [file,fromMs,toMs]=process.argv.slice(2);
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const a=t0+fromMs*1000,b=t0+toMs*1000;
const M=ev.filter(e=>isMain(e)&&e.ts>=a&&e.ts<=b);
const by={};
for(const e of M){const k=e.name+'/'+e.ph+'/'+(e.cat||''); by[k]=(by[k]||{n:0,d:0}); by[k].n++; by[k].d+=(e.dur||0);}
Object.entries(by).sort((x,y)=>y[1].d-x[1].d||y[1].n-x[1].n).slice(0,40).forEach(([k,v])=>console.log(k.padEnd(90),v.n,Math.round(v.d/1000)+'ms'));
// print the Layout event full args
const L=M.filter(e=>e.name==='Layout');
for(const l of L) console.log(JSON.stringify(l).slice(0,1500));
