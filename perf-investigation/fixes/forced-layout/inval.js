const fs=require('fs');
const [file,from,to]=[process.argv[2],+process.argv[3],+process.argv[4]];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const names={};
for(const e of ev){ if(!isMain(e)) continue; const t=(e.ts-t0)/1000; if(t<from||t>to) continue;
  if(/Invalidat|ScheduleStyle|FontLoad|Font|ResourceFinish|StyleRecalcInvalidation|LayoutInvalidation|ParseAuthorStyleSheet|ResourceReceiveResponse/.test(e.name)){
    const d=e.args&&e.args.data||{};
    const st=(d.stackTrace||[]).slice(0,2).map(f=>(f.url||'').split('/').pop()+'#'+f.functionName+'@'+f.lineNumber).join('<');
    console.log(t.toFixed(1).padStart(8),e.ph,e.name,(d.reason||'')+' '+(d.nodeName||'')+' '+(d.url||'').split('/').pop()+' '+st);
  }
}
