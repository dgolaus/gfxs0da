/* Which elements get style-invalidated per frame, and why (structural, not timing). */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openPage}=require('../../bench.js');
const v=JSON.parse(process.argv[2]||'{"name":"baseline"}');
const FROM=+(process.argv[3]||0), TO=+(process.argv[4]||3500);
(async()=>{const b=await puppeteer.launch({headless:'new'});
 const {p}=await openPage(b,v,{throttle:4});
 const file=path.join(__dirname,'inv_'+v.name+'.json');
 await p.tracing.start({path:file,categories:['devtools.timeline','disabled-by-default-devtools.timeline.invalidationTracking','disabled-by-default-devtools.timeline.stack']});
 await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
 await new Promise(r=>setTimeout(r,TO+200));
 await p.tracing.stop();await b.close();
 const ev=JSON.parse(fs.readFileSync(file,'utf8')).traceEvents;fs.unlinkSync(file);
 const nav=ev.find(e=>e.name==='navigationStart'||e.name==='TracingStartedInBrowser');const t0=nav?nav.ts:Math.min(...ev.filter(e=>e.ts).map(e=>e.ts));
 const I=ev.filter(e=>/InvalidationTracking/.test(e.name)&&(e.ts-t0)/1000>=FROM&&(e.ts-t0)/1000<TO);
 const by={};
 for(const e of I){const d=e.args&&e.args.data||{};const k=e.name.replace('InvalidationTracking','')+' | '+(d.reason||d.invalidationList&&JSON.stringify(d.invalidationList).slice(0,80)||'')+' | '+(d.nodeName||'')+(d.stackTrace?' | js '+(d.stackTrace[0].url||'').split('/').pop()+':'+(d.stackTrace[0].lineNumber+1):'');by[k]=(by[k]||0)+1;}
 Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,45).forEach(([k,n])=>console.log(String(n).padStart(5),k.slice(0,190)));
})().catch(e=>{console.error(e);process.exit(1)});
