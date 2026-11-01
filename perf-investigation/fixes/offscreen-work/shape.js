const fs=require('fs');
const [file]=process.argv.slice(2);
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const S=ev.filter(e=>isMain(e)&&e.name==='InlineNode::ShapeTextIncludingFirstLine');
console.log('count',S.length);
console.log(JSON.stringify(S.slice(0,3)));
// bucket by 100ms
const b={};for(const s of S){const k=Math.floor((s.ts-t0)/100000)*100;b[k]=b[k]||{n:0,d:0};b[k].n++;b[k].d+=s.dur||0;}
Object.entries(b).forEach(([k,v])=>console.log(k,v.n,Math.round(v.d/1000)));
// top durations
S.sort((x,y)=>(y.dur||0)-(x.dur||0)).slice(0,15).forEach(s=>console.log(Math.round((s.ts-t0)/1000),Math.round((s.dur||0)/1000),JSON.stringify(s.args)));
// font events
const F=ev.filter(e=>/Font/.test(e.name)&&isMain(e));
const fb={};for(const f of F){fb[f.name]=(fb[f.name]||0)+1}
console.log(fb);
F.filter(f=>f.name==='BeginRemoteFontLoad'||/RemoteFontLoad|FontFace|webfont/i.test(f.name)).slice(0,20).forEach(f=>console.log(Math.round((f.ts-t0)/1000),f.name,JSON.stringify(f.args).slice(0,200)));
