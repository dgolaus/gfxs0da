/* Diagnostic: per-variant trace of entry (0-3.5s, CPU 4x, warm), sums UpdateLayoutTree/Layout. usage: node entrytrace.js variants.json reps */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openDisk}=require('./diskopen.js');const bench={openPage:openDisk};
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1];};
(async()=>{
  const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const reps=+process.argv[3]||3;
  const b=await puppeteer.launch({headless:'new'});
  
  const res={};
  for(let r=0;r<reps;r++)for(const v of vs){
    const {p}=await bench.openPage(b,v,{throttle:4});
    const f=path.join(__dirname,'et_tmp.json');
    await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
    await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
    await new Promise(r=>setTimeout(r,3700));
    await p.tracing.stop();await p.close();
    const ev=JSON.parse(fs.readFileSync(f,'utf8')).traceEvents;
    const mains=new Set(ev.filter(m=>m.ph==='M'&&m.name==='thread_name'&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid));
    const nav=ev.find(e=>e.name==='navigationStart'&&mains.has(e.pid+':'+e.tid))||ev.find(e=>e.name==='navigationStart');
    const t0=nav?nav.ts:Math.min(...ev.filter(e=>mains.has(e.pid+':'+e.tid)&&e.ts).map(e=>e.ts));
    const M=ev.filter(e=>e.ph==='X'&&mains.has(e.pid+':'+e.tid)&&e.ts>=t0&&e.ts<=t0+3500e3);
    const sum=(n)=>M.filter(e=>e.name===n).reduce((a,e)=>a+e.dur,0)/1000;
    const ult=M.filter(e=>e.name==='UpdateLayoutTree');
    const long=M.filter(e=>e.name==='RunTask'&&e.dur>50e3);
    const o={ult:sum('UpdateLayoutTree'),layout:sum('Layout'),paint:sum('Paint'),elements:ult.reduce((a,e)=>a+(e.args.elementCount||0),0),maxUlt:Math.max(...ult.map(e=>e.dur/1000)),bigUlt:ult.filter(e=>e.args.elementCount>300).map(e=>e.args.elementCount+'/'+(e.dur/1000).toFixed(0)).join(' '),longMs:long.reduce((a,e)=>a+e.dur,0)/1000,nLong:long.length};
    (res[v.name]=res[v.name]||[]).push(o);
    console.error(v.name,r,JSON.stringify(o));
  }
  await b.close();
  for(const [k,a] of Object.entries(res)){
    console.log(k.padEnd(40),'ULT',med(a.map(x=>x.ult)).toFixed(0),'ms  elements',med(a.map(x=>x.elements)),' Layout',med(a.map(x=>x.layout)).toFixed(0),' Paint',med(a.map(x=>x.paint)).toFixed(0),' long',med(a.map(x=>x.longMs)).toFixed(0)+'ms/'+med(a.map(x=>x.nLong)),' big:',a.map(x=>x.bigUlt).join(' | '));
  }
})().catch(e=>{console.error(e);process.exit(1)});
