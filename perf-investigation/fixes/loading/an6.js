const fs=require('fs');
const file=process.argv[2]; const a=+process.argv[3], b=+process.argv[4];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const cnt={};ev.forEach(e=>{const k=e.pid+':'+e.tid;if(mains.includes(k)&&e.name==='Layout')cnt[k]=(cnt[k]||0)+1});
const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
const isMain=e=>(e.pid+':'+e.tid)===main;
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const M=ev.filter(e=>isMain(e)&&e.ts&&(e.ts-t0)/1000>=a&&(e.ts-t0)/1000<=b).sort((x,y)=>x.ts-y.ts);
for(const e of M){ if(!/ScheduleStyleRecalculation|InvalidateLayout|StyleRecalcInvalidationTracking|StyleInvalidatorInvalidationTracking|UpdateLayoutTree|EvaluateScript|FunctionCall|Layout$|RemoteFontLoaded|EventDispatch|TimerFire|ParseHTML/.test(e.name)) continue;
  const d=e.args&&(e.args.data||e.args.beginData)||{};
  const st=(d.stackTrace||[]).slice(0,3).map(s=>(s.functionName||'?')+'@'+(s.url||'').split('/').pop()+':'+s.lineNumber).join('<');
  console.log(((e.ts-t0)/1000).toFixed(1),e.ph,(e.dur?(e.dur/1000).toFixed(1):''),e.name,(d.url||'').split('/').pop(),d.type||'',d.reason||'',d.elementCount||e.args.elementCount||'',st);
}
