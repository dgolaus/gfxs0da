const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const ev=raw.traceEvents||raw;
const mains=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args&&e.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;if(mains.includes(k))cnt[k]=(cnt[k]||0)+1;}
const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
const M=ev.filter(e=>e.pid+':'+e.tid===main&&e.ts);const t0=Math.min(...M.map(e=>e.ts));
const X=M.filter(e=>e.ph==='X');
const lt=X.filter(e=>e.name==='RunTask'&&e.dur>50000&&e.ts-t0<3600000);
for(const t of lt){
  const kids=X.filter(e=>e.ts>=t.ts&&e.ts+e.dur<=t.ts+t.dur&&e!==t);
  const by={};for(const k of kids){by[k.name]=(by[k.name]||0)+k.dur/1000;}
  console.log('\n'+Math.round((t.ts-t0)/1000)+'ms dur'+Math.round(t.dur/1000)+' :: '+Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>k+' '+Math.round(v)).join(', '));
  for(const k of kids.filter(k=>(k.name==='Layout'||k.name==='UpdateLayoutTree')&&k.dur>3000)){
    const bd=k.args&&k.args.beginData||{};const st=(bd.stackTrace||[]).slice(0,3).map(f=>(f.url||'').split('/').pop()+':'+f.lineNumber+':'+f.functionName).join(' < ');
    console.log('   '+k.name+' '+Math.round(k.dur/1000)+'ms '+(k.name==='Layout'?'dirty'+bd.dirtyObjects+'/'+bd.totalObjects:'el'+((k.args&&k.args.elementCount)||''))+' '+st);
  }
}
