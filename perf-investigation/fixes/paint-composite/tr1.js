const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
console.log('mains',mains);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
// names histogram on main
const names={};for(const e of ev){if(isMain(e)&&e.ph==='X'&&e.dur){names[e.name]=(names[e.name]||0)+e.dur;}}
console.log(Object.entries(names).sort((a,b)=>b[1]-a[1]).slice(0,60).map(([k,v])=>k+':'+Math.round(v/1000)).join('\n'));
// thread names
console.log(meta.map(m=>m.pid+':'+m.tid+' '+m.args.name).join('\n'));
