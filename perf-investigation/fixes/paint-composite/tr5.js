// busy time per thread per 250ms bucket (top-level X events only, by RunTask-like containment)
const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const tn={};for(const m of meta)tn[m.pid+':'+m.tid]=m.args.name;
const metas=meta.filter(e=>e.args.name==='CrRendererMain');
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;cnt[k]=(cnt[k]||0)+1;}
const MAIN=metas.map(m=>m.pid+':'+m.tid).sort((a,b)=>cnt[b]-cnt[a])[0];
const rpid=MAIN.split(':')[0];
const t0=Math.min(...ev.filter(e=>(e.pid+':'+e.tid)===MAIN&&e.ts).map(e=>e.ts));
// top-level intervals per thread
const byT={};
for(const e of ev){ if(e.ph!=='X'||!e.dur)continue; const k=e.pid+':'+e.tid; (byT[k]=byT[k]||[]).push(e);}
const B=250, NB=18;
const rows=[];
for(const [k,arr] of Object.entries(byT)){
  arr.sort((a,b)=>a.ts-b.ts||b.dur-a.dur);
  const top=[];let end=-1;
  for(const e of arr){ if(e.ts>=end){top.push(e);end=e.ts+e.dur;} }
  const buckets=new Array(NB).fill(0);
  const names={};
  for(const e of top){const s=(e.ts-t0)/1000, d=e.dur/1000; for(let b=0;b<NB;b++){const lo=b*B,hi=lo+B;const ov=Math.max(0,Math.min(hi,s+d)-Math.max(lo,s)); buckets[b]+=ov;} names[e.name]=(names[e.name]||0)+e.dur;}
  const total=buckets.reduce((a,b)=>a+b,0);
  if(total<30) continue;
  rows.push([k+' '+(tn[k]||'?'),buckets,total,Object.entries(names).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n,v])=>n+':'+Math.round(v/1000)).join(',')]);
}
console.log('bucket(ms) '+Array.from({length:NB},(_,i)=>String(i*B).padStart(5)).join(''));
for(const r of rows.sort((a,b)=>b[2]-a[2])){console.log(r[0].padEnd(42)+r[1].map(x=>String(Math.round(x)).padStart(5)).join('')+'  tot '+Math.round(r[2])+'  '+r[3]);}
