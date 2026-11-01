const fs=require('fs');
const file=process.argv[2]; const until=+(process.argv[3]||2600);
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const cnt={};ev.forEach(e=>{const k=e.pid+':'+e.tid;if(mains.includes(k)&&e.name==='Layout')cnt[k]=(cnt[k]||0)+1});
const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
const isMain=e=>(e.pid+':'+e.tid)===main;
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const T=ts=>((ts-t0)/1000).toFixed(0);
const M=ev.filter(e=>isMain(e)&&e.ts).sort((a,b)=>a.ts-b.ts);
const tasks=M.filter(e=>e.name==='RunTask'&&e.ph==='X'&&e.dur>8000&&(e.ts-t0)/1000<until);
let ki=0;
for(const t of tasks){
  const end=t.ts+t.dur;
  const kids=M.filter(e=>e.ts>=t.ts&&e.ts<=end&&e!==t);
  const parts=[];
  for(const k of kids){
    const d=k.dur?(k.dur/1000).toFixed(0):'';
    if(k.name==='ParseHTML'&&k.ph==='X') parts.push(`ParseHTML(${d}ms L${k.args.beginData.startLine}-${k.args.endData&&k.args.endData.endLine})`);
    else if(k.name==='Layout'&&k.ph==='X'){const b=k.args.beginData||{};const st=b.stackTrace?(' FORCED by '+b.stackTrace.slice(0,2).map(s=>s.functionName+'@'+(s.url||'').split('/').pop()+':'+s.lineNumber).join('<')):'';parts.push(`Layout(${d}ms dirty ${b.dirtyObjects}/${b.totalObjects} partial=${b.partialLayout}${st})`)}
    else if(k.name==='UpdateLayoutTree'&&k.ph==='X'&&k.dur>3000){const b=k.args.beginData||{};const st=b.stackTrace?(' FORCED by '+b.stackTrace.slice(0,2).map(s=>s.functionName+'@'+(s.url||'').split('/').pop()+':'+s.lineNumber).join('<')):'';parts.push(`Recalc(${d}ms el=${k.args.elementCount}${st})`)}
    else if(k.name==='Paint'&&k.ph==='X'&&k.dur>3000) parts.push(`Paint(${d}ms)`);
    else if(k.name==='RemoteFontLoaded') parts.push(`FONT(${k.args.data&&k.args.data.url&&k.args.data.url.slice(-30)})`);
    else if(k.name==='EvaluateScript'&&k.ph==='X') parts.push(`Eval(${d}ms ${(k.args.data.url||'').split('/').pop()})`);
    else if(k.name==='FunctionCall'&&k.ph==='X'&&k.dur>3000) parts.push(`Fn(${d}ms ${k.args.data.functionName}@${(k.args.data.url||'').split('/').pop()}:${k.args.data.lineNumber})`);
    else if((k.name==='TimerFire'||k.name==='FireAnimationFrame'||k.name==='EventDispatch')&&k.ph==='X'&&k.dur>3000) parts.push(`${k.name}(${d}ms ${k.args.data&&(k.args.data.type||k.args.data.timerId||k.args.data.id)})`);
    else if(k.name==='ResourceFinish') parts.push(`fin:${(k.args.data.url||'').split('/').pop().slice(0,25)}`);
    else if(k.name==='ResourceSendRequest') parts.push(`req:${(k.args.data.url||'').split('/').pop().slice(0,25)}`);
    else if(k.name==='ResourceReceiveResponse') parts.push(`resp`);
  }
  // collapse repeated
  const col=[];for(const p of parts){const l=col[col.length-1];if(l&&l.p===p)l.n++;else col.push({p,n:1});}
  console.log(`${T(t.ts).padStart(5)} dur ${(t.dur/1000).toFixed(0).padStart(4)} | `+col.map(c=>c.n>1?c.p+'x'+c.n:c.p).join(' ; '));
}
