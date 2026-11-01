// Analyze orchestrator traces for font timing vs layouts.
const fs=require('fs');
const file=process.argv[2];
const ev=JSON.parse(fs.readFileSync(file,'utf8')).traceEvents;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const cnt={};ev.forEach(e=>{const k=e.pid+':'+e.tid;if(mains.includes(k)&&e.name==='Layout')cnt[k]=(cnt[k]||0)+1});
const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];const pid=+main.split(':')[0];
const isMain=e=>(e.pid+':'+e.tid)===main;
const nav=ev.find(e=>e.name==='navigationStart'&&e.pid===pid&&e.args&&e.args.data&&/localhost/.test(e.args.data.documentLoaderURL||''));
const t0=nav?nav.ts:Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const T=ts=>Math.round((ts-t0)/1000);
const sorted=ev.filter(e=>e.pid===pid).sort((a,b)=>a.ts-b.ts);
const reqId={};
for(const e of sorted){
  if(e.name==='ResourceSendRequest'){const u=e.args.data.url;if(/gstatic|googleapis|styles\.css|boot\.css|script\.js/.test(u)){reqId[e.args.data.requestId]=u.split('/').pop().slice(0,30);console.log(T(e.ts),'SEND',e.args.data.priority,u.slice(0,90));}}
  if(e.name==='ResourceFinish'&&reqId[e.args.data.requestId]) console.log(T(e.ts),'FINISH',reqId[e.args.data.requestId]);
  if(e.name==='RemoteFontLoaded') console.log(T(e.ts),'RemoteFontLoaded',JSON.stringify(e.args).slice(0,120));
  if(e.name==='firstContentfulPaint'||e.name==='firstPaint') console.log(T(e.ts),e.name);
  if(!isMain(e)||e.ph!=='X') continue;
  if(e.name==='LayoutObject::InvalidateSubtreeForFontUpdates') console.log(T(e.ts),'FontInval',Math.round(e.dur/1000)+'ms');
  if(e.name==='Layout'&&e.dur>15000){const d=e.args.beginData||{};const st=d.stackTrace?(' FORCED by '+d.stackTrace.slice(0,2).map(s=>s.functionName+'@'+(s.url||'').split('/').pop()+':'+s.lineNumber).join('<')):'';console.log(T(e.ts),'Layout',Math.round(e.dur/1000)+'ms',(d.dirtyObjects||'?')+'/'+(d.totalObjects||'?')+st);}
  if(e.name==='UpdateLayoutTree'&&e.dur>15000) console.log(T(e.ts),'Recalc',Math.round(e.dur/1000)+'ms','el',e.args.elementCount);
}
