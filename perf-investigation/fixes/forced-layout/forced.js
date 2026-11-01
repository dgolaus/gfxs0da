const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const X=ev.filter(e=>isMain(e)&&(e.name==='Layout'||e.name==='UpdateLayoutTree'));
// Layout may be B/E pairs or X
const out=[];
for(const e of X){
  if(e.ph==='X'){
    const st=e.args&&e.args.beginData&&e.args.beginData.stackTrace;
    out.push({name:e.name,ts:(e.ts-t0)/1000,dur:e.dur/1000,st,args:e.args});
  } else if(e.ph==='B'){
    const end=ev.find(x=>x.ph==='E'&&x.name===e.name&&x.pid===e.pid&&x.tid===e.tid&&x.ts>=e.ts);
    const st=e.args&&e.args.beginData&&e.args.beginData.stackTrace;
    out.push({name:e.name,ts:(e.ts-t0)/1000,dur:end?(end.ts-e.ts)/1000:-1,st,args:Object.assign({},e.args,end&&end.args)});
  }
}
out.sort((a,b)=>a.ts-b.ts);
let tot={};
for(const o of out){
  if(o.dur<1 && !o.st) continue;
  const s=o.st?o.st.slice(0,4).map(f=>(f.url||'').split('/').pop()+'#'+f.functionName+'@'+(f.lineNumber+1)+':'+(f.columnNumber+1)).join(' < '):'';
  const extra=o.name==='Layout'&&o.args&&o.args.beginData?(' dirty='+o.args.beginData.dirtyObjects+'/'+o.args.beginData.totalObjects):(o.name==='UpdateLayoutTree'&&o.args&&o.args.elementCount!=null?' elems='+o.args.elementCount:'');
  if(o.ts<5000) console.log(o.ts.toFixed(0).padStart(6)+' '+o.name.padEnd(17)+o.dur.toFixed(1).padStart(7)+extra.padEnd(22)+(s?' FORCED '+s:''));
  if(o.st){const k=o.name+' '+s.split(' < ')[0];tot[k]=tot[k]||{n:0,ms:0};tot[k].n++;tot[k].ms+=o.dur;}
}
console.log('\nFORCED totals:');
Object.entries(tot).sort((a,b)=>b[1].ms-a[1].ms).forEach(([k,v])=>console.log(v.ms.toFixed(1).padStart(8)+'ms n='+v.n+'  '+k));
