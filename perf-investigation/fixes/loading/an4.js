const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const tn={};meta.forEach(m=>tn[m.pid+':'+m.tid]=m.args.name);
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const cnt={};ev.forEach(e=>{const k=e.pid+':'+e.tid;if(mains.includes(k)&&e.name==='Layout')cnt[k]=(cnt[k]||0)+1});
const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
const pid=+main.split(':')[0];
const isMain=e=>(e.pid+':'+e.tid)===main;
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const T=ts=>((ts-t0)/1000).toFixed(0);
for(const e of ev.filter(e=>e.pid===pid&&/Decode|ImageDecodeTask|RemoteFontLoaded|BeginRemoteFontLoad|DecodeFont|InvalidateSubtreeForFontUpdates|LayoutImageUnsized|ImageResourceContent::updateImage/.test(e.name)).sort((a,b)=>a.ts-b.ts)){
  console.log(T(e.ts).padStart(5),(e.dur?(e.dur/1000).toFixed(1):'').padStart(6),tn[e.pid+':'+e.tid],e.name,JSON.stringify(e.args).slice(0,160));
}
// What's in the 1273 task
const M=ev.filter(e=>isMain(e)&&e.ts).sort((a,b)=>a.ts-b.ts);
const want=+process.argv[3]||1273;
const t=M.find(e=>e.name==='RunTask'&&e.ph==='X'&&Math.abs((e.ts-t0)/1000-want)<3);
if(t){console.log('--- task',T(t.ts),t.dur/1000);const kids=M.filter(e=>e.ts>=t.ts&&e.ts<=t.ts+t.dur&&e!==t&&(e.dur||0)>1000);const agg={};kids.forEach(k=>agg[k.name]=(agg[k.name]||0)+k.dur/1000);console.log(Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>k+' '+v.toFixed(1)).join('\n'));}
