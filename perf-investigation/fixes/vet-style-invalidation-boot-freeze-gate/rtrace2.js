/* Where does the snippet's time go, and does baseline pay it later? List main-thread events from nav to first paint. */
const path=require('path');const fs=require('fs');
const {openPage}=require('./bench.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const vs=JSON.parse(fs.readFileSync(path.join(__dirname,'variants.json'),'utf8'));
const REPS=+(process.env.REPS||3);
(async()=>{const b=await puppeteer.launch({headless:'new'});const f=path.join(__dirname,'rt_tmp.json');
 for(let r=0;r<REPS;r++)for(const v of vs){
  const {p}=await openPage(b,v,{throttle:4});
  await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline','blink','blink.user_timing','loading']});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});await new Promise(r=>setTimeout(r,3000));
  await p.tracing.stop();await p.close();
  const ev=JSON.parse(fs.readFileSync(f,'utf8')).traceEvents;
  const mains=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
  const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;if(mains.includes(k))cnt[k]=(cnt[k]||0)+1;}
  const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
  const M=ev.filter(e=>(e.pid+':'+e.tid)===main);
  const X=M.filter(e=>e.ph==='X'&&e.dur);
  const fcp=ev.find(e=>e.name==='firstContentfulPaint');const fp=ev.find(e=>e.name==='firstPaint');
  const navs=ev.find(e=>e.name==='navigationStart'&&e.args&&e.args.data&&e.args.data.isLoadingMainFrame&&/localhost/.test(e.args.data.documentLoaderURL||''));
  const t0=navs?navs.ts:Math.min(...X.map(e=>e.ts));
  const lim=fcp?fcp.ts:t0+3e6;
  const ult=X.filter(e=>e.name==='UpdateLayoutTree'&&e.ts<lim);
  const sumBy=(n)=>X.filter(e=>e.name===n&&e.ts<lim).reduce((a,e)=>a+e.dur,0)/1000;
  const firstULT=ult.slice(0,4).map(e=>`${Math.round((e.ts-t0)/1000)}:${(e.dur/1000).toFixed(1)}ms/${e.args&&e.args.elementCount}`);
  console.log(v.name.padEnd(16),'rep',r,'FCP',fcp?Math.round((fcp.ts-t0)/1000):'?','| before FCP: ULT',sumBy('UpdateLayoutTree').toFixed(1),'Layout',sumBy('Layout').toFixed(1),'ParseHTML',sumBy('ParseHTML').toFixed(1),'| first ULTs',firstULT.join(' '));
 }
 await b.close();})();
