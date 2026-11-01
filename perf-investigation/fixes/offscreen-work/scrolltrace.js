/* Work during the first scroll through the page (after the intro), thread-CPU based. */
const fs=require('fs');const path=require('path');
const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const idleMs=+(process.argv[3]||9000);
 const b=await puppeteer.launch({headless:'new'});
 for(const v of vs){
  const {p}=await openPage(b,v);
  await p.goto('http://localhost:5173/',{waitUntil:'load'});
  await w8(idleMs);
  const file=path.join(__dirname,'st_'+v.name+'.json');
  await p.tracing.start({path:file,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
  await p.evaluate(()=>{window.__f=[];const t=(n)=>{__f.push(n);requestAnimationFrame(t)};requestAnimationFrame(t);});
  const H=await p.evaluate(()=>document.documentElement.scrollHeight-innerHeight);
  for(let y=0;y<=H;y+=60){await p.evaluate(y=>scrollTo(0,y),y);await w8(16);}
  await w8(500);
  const fr=await p.evaluate(()=>{const f=__f,d=[];for(let i=1;i<f.length;i++)d.push(f[i]-f[i-1]);d.sort((a,b)=>b-a);return {n:f.length,worst:d.slice(0,5).map(Math.round),over50:d.filter(x=>x>50).length,over100:d.filter(x=>x>100).length}});
  await p.tracing.stop();await p.close();
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));const ev=raw.traceEvents||raw;
  const mains=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args&&e.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
  const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;if(mains.includes(k))cnt[k]=(cnt[k]||0)+1;}
  const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
  const X=ev.filter(e=>e.pid+':'+e.tid===main&&e.ph==='X');
  const rt=X.filter(e=>e.name==='RunTask').sort((a,b)=>(b.tdur||0)-(a.tdur||0));
  const sum=(n)=>Math.round(X.filter(e=>e.name===n).reduce((a,e)=>a+(e.tdur||0),0)/1000);
  console.log(v.name.padEnd(30),'frames',JSON.stringify(fr),'| top task cpu',rt.slice(0,5).map(t=>Math.round(t.tdur/1000)).join(','),'| cpu Layout',sum('Layout'),'ULT',sum('UpdateLayoutTree'),'Paint',sum('Paint'));
  fs.unlinkSync(file);
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
