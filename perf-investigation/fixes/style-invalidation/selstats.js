const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const bench=require('../../bench.js');
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const {p}=await bench.openPage(b,{name:'baseline'},{throttle:1});
  const f=path.join(__dirname,'sel_tmp.json');
  await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline','disabled-by-default-blink.debug']});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,3000));
  await p.tracing.stop();
  await b.close();
  const ev=JSON.parse(fs.readFileSync(f,'utf8')).traceEvents;
  const ss=ev.filter(e=>/SelectorStats/.test(e.name));
  console.log('SelectorStats events',ss.length, ss[0]&&Object.keys(ss[0].args||{}), ss[0]&&JSON.stringify(ss[0].args).slice(0,400));
  const agg={};
  for(const e of ss){const d=e.args&&(e.args.selector_stats||e.args.data&&e.args.data.selector_stats);const list=d&&(d.selector_timings||d);if(!Array.isArray(list))continue;
    for(const s of list){const k=s.selector;const a=agg[k]||(agg[k]={t:0,att:0,m:0,fr:0});a.t+=s.elapsed||s['elapsed (us)']||0;a.att+=s.match_attempts||0;a.m+=s.match_count||0;a.fr+=s.fast_reject_count||0;}}
  const rows=Object.entries(agg).sort((a,b)=>b[1].t-a[1].t);
  const tot=rows.reduce((s,[,a])=>s+a.t,0);
  console.log('total selector time (us)',Math.round(tot),'selectors',rows.length);
  rows.slice(0,40).forEach(([k,a])=>console.log(String(Math.round(a.t)).padStart(7),String(a.att).padStart(7),String(a.m).padStart(6),String(a.fr).padStart(6),' ',k.slice(0,140)));
})().catch(e=>{console.error(e);process.exit(1)});
