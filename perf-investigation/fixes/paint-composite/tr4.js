const fs=require('fs');
const file=process.argv[2];
const ranges=(process.argv[3]||'').split(',').map(r=>r.split('-').map(Number));
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const metas=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain');
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;cnt[k]=(cnt[k]||0)+1;}
const MAIN=metas.map(m=>m.pid+':'+m.tid).sort((a,b)=>cnt[b]-cnt[a])[0];
const isMain=e=>(e.pid+':'+e.tid)===MAIN;
const mainEv=ev.filter(e=>isMain(e));
const t0=Math.min(...mainEv.filter(e=>e.ts).map(e=>e.ts));
const X=mainEv.filter(e=>e.ph==='X'&&e.dur!=null).sort((a,b)=>a.ts-b.ts||b.dur-a.dur);
const P=X.filter(e=>e.name==='Paint'||e.name==='PaintImage');
// compute self time: subtract direct children Paint durations
for(let i=0;i<P.length;i++){const p=P[i];p.self=p.dur;}
const stack=[];
for(const p of P){
  while(stack.length&&stack[stack.length-1].ts+stack[stack.length-1].dur<=p.ts) stack.pop();
  if(stack.length){stack[stack.length-1].self-=p.dur;}
  stack.push(p);
}
for(const [a,b] of ranges){
  const ps=P.filter(e=>(e.ts-t0)/1000>=a&&(e.ts-t0)/1000<=b);
  const by={};
  for(const p of ps){const k=p.name+' '+(p.args.data.nodeName||'?')+(p.name==='PaintImage'?' '+(p.args.data.url||'').split('/').pop():''); by[k]=by[k]||{n:0,self:0,tot:0}; by[k].n++; by[k].self+=p.self; by[k].tot+=p.dur;}
  const tot=ps.reduce((s,p)=>s+p.self,0);
  console.log('==== range',a,b,'paint events',ps.length,'self total ms',(tot/1000).toFixed(1));
  Object.entries(by).sort((x,y)=>y[1].self-x[1].self).slice(0,25).forEach(([k,v])=>console.log('  '+(v.self/1000).toFixed(2).padStart(8)+' self '+(v.tot/1000).toFixed(2).padStart(8)+' tot  n='+v.n+'  '+k));
}
