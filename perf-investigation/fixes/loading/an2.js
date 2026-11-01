const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
// choose main with most Layout events
const cnt={};ev.forEach(e=>{const k=e.pid+':'+e.tid;if(mains.includes(k)&&e.name==='Layout')cnt[k]=(cnt[k]||0)+1});
const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
const pid=+main.split(':')[0];
const isMain=e=>(e.pid+':'+e.tid)===main;
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const T=ts=>((ts-t0)/1000).toFixed(0);
console.log('main',main,cnt);
// marks
for(const e of ev.filter(e=>e.pid===pid&&/^(navigationStart|firstPaint|firstContentfulPaint|largestContentfulPaint::Candidate|MarkDOMContent|MarkLoad|domContentLoadedEventStart|loadEventStart|firstImagePaint|LargestImagePaint::Candidate|LargestTextPaint::Candidate|domLoading)$/.test(e.name))) console.log('MARK',T(e.ts),e.name, JSON.stringify(e.args&&e.args.data||{}).slice(0,200));
// resources
const req={};
for(const e of ev){ if(!e.args||!e.args.data) continue; const d=e.args.data;
 if(e.name==='ResourceSendRequest'){req[d.requestId]={url:d.url,prio:d.priority,start:e.ts,pid:e.pid,renderBlocking:d.renderBlocking,from:d.initiator&&d.initiator.type}}
 else if(e.name==='ResourceReceiveResponse'&&req[d.requestId]){req[d.requestId].resp=e.ts;req[d.requestId].fromCache=d.fromCache;req[d.requestId].fromServiceWorker=d.fromServiceWorker;req[d.requestId].encoded=d.encodedDataLength;req[d.requestId].mime=d.mimeType}
 else if(e.name==='ResourceFinish'&&req[d.requestId]){req[d.requestId].fin=e.ts;req[d.requestId].len=d.decodedBodyLength;req[d.requestId].enc=d.encodedDataLength}
 else if(e.name==='ResourceChangePriority'&&req[d.requestId]){req[d.requestId].newPrio=d.priority}
}
const rs=Object.values(req).sort((a,b)=>a.start-b.start);
for(const r of rs) console.log('RES',T(r.start).padStart(5),(r.resp?T(r.resp):'-').padStart(5),(r.fin?T(r.fin):'-').padStart(5),(r.prio||'')+(r.newPrio?'->'+r.newPrio:''),r.renderBlocking||'',r.fromCache?'cache':'',String(r.len||'').padStart(8),r.url.replace('http://localhost:5173/','').slice(0,90));
// parse html
for(const e of ev.filter(e=>isMain(e)&&e.name==='ParseHTML'&&e.ph==='X')) console.log('PARSE',T(e.ts),'dur',(e.dur/1000).toFixed(1),JSON.stringify(e.args.beginData||{}).slice(0,120), JSON.stringify(e.args.endData||{}).slice(0,80));
for(const e of ev.filter(e=>isMain(e)&&(e.name==='EvaluateScript'||e.name==='v8.compile'||e.name==='CompileScript')&&e.ph==='X'&&e.dur>2000)) console.log('EVAL',T(e.ts),'dur',(e.dur/1000).toFixed(1),e.name,(e.args.data&&e.args.data.url||'').slice(-40));
