const fs=require('fs');
const [file,thr,lo,hi]=process.argv.slice(2);
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const metas=meta.filter(e=>e.args.name==='CrRendererMain');
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;cnt[k]=(cnt[k]||0)+1;}
const MAIN=metas.map(m=>m.pid+':'+m.tid).sort((a,b)=>cnt[b]-cnt[a])[0];
const t0=Math.min(...ev.filter(e=>(e.pid+':'+e.tid)===MAIN&&e.ts).map(e=>e.ts));
const L=+(lo||0),H=+(hi||99999);
const arr=ev.filter(e=>(e.pid+':'+e.tid)===thr&&e.ph==='X'&&e.dur&&(e.ts-t0)/1000>=L&&(e.ts-t0)/1000<=H);
const names={};for(const e of arr){names[e.name]=(names[e.name]||0)+e.dur;}
console.log(Object.entries(names).sort((a,b)=>b[1]-a[1]).slice(0,45).map(([k,v])=>String(Math.round(v/1000)).padStart(6)+'  '+k).join('\n'));
