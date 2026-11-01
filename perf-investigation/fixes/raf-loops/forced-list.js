const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;if(meta.includes(k))cnt[k]=(cnt[k]||0)+1;}
const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
const X=ev.filter(e=>e.ph==='X'&&(e.pid+':'+e.tid)===main&&e.dur!=null).sort((a,b)=>a.ts-b.ts);
const t0=Math.min(...X.map(e=>e.ts));
const nav=ev.find(e=>e.name==='navigationStart');console.log('navStart offset ms',nav?((nav.ts-t0)/1000).toFixed(0):'?');
const lim=+(process.argv[3]||2600);
for(const e of X){const t=(e.ts-t0)/1000;if(t>lim)break;
 if(!(e.name==='UpdateLayoutTree'||e.name==='Layout'))continue;
 const st=e.args&&e.args.beginData&&e.args.beginData.stackTrace;
 const a=e.args||{};
 console.log(t.toFixed(0).padStart(6),(e.dur/1000).toFixed(1).padStart(7),e.name.padEnd(17),'elems='+(a.elementCount!=null?a.elementCount:'-'),st?('FORCED '+st.slice(0,3).map(s=>(s.url||'').split('/').pop()+':'+(s.lineNumber+1)+' '+s.functionName).join(' < ')):'', a.endData&&a.endData.layoutRoots?('roots='+a.endData.layoutRoots.map(r=>r.nodeName).join(',')):'' , a.beginData&&a.beginData.dirtyObjects!=null?('dirty='+a.beginData.dirtyObjects+'/'+a.beginData.totalObjects):'');}
