const fs=require('fs');const path=require('path');
const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const b=await puppeteer.launch({headless:'new'});
 for(const v of vs){
  const {p}=await openPage(b,v);
  const file=path.join(__dirname,'sd_'+v.name+'.json');
  await p.tracing.start({path:file,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await w8(10000);
  await p.tracing.stop();await p.close();
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));const ev=raw.traceEvents||raw;
  const mains=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args&&e.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
  const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;if(mains.includes(k))cnt[k]=(cnt[k]||0)+1;}
  const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
  const M=ev.filter(e=>e.pid+':'+e.tid===main&&e.ts);const t0=Math.min(...M.map(e=>e.ts));
  const X=M.filter(e=>e.ph==='X');
  const load=M.find(e=>e.name==='MarkLoad'||e.name==='loadEventEnd'||e.name==='MarkDOMContent');
  const big=X.filter(e=>e.name==='RunTask'&&(e.tdur||0)>15000).map(t=>Math.round((t.ts-t0)/1000)+':'+Math.round(t.tdur/1000)+'cpu/'+Math.round(t.dur/1000)+'w');
  const fa=X.filter(e=>e.name==='FireAnimationFrame');
  const bucket=(a,b)=>fa.filter(e=>e.ts-t0>=a*1000&&e.ts-t0<b*1000).length;
  console.log(v.name.padEnd(30),'rAF/s 0-3.5:',(bucket(0,3500)/3.5).toFixed(1),'3.5-8.5:',(bucket(3500,8500)/5).toFixed(1),'| tasks>15ms cpu:',big.join(' '));
  fs.unlinkSync(file);
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
