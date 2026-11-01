const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openDisk}=require('./diskopen.js');
async function step(p,f,fn){await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});await p.evaluate(fn);await p.tracing.stop();
  return JSON.parse(fs.readFileSync(f,'utf8')).traceEvents.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X'&&e.args.elementCount>0).map(e=>e.args.elementCount).reduce((a,b)=>a+b,0);}
(async()=>{const vs=JSON.parse(fs.readFileSync('eq_vars2.json','utf8')).slice(0,2);
 const b=await puppeteer.launch({headless:'new'});const f=path.join(__dirname,'rc_tmp.json');
 for(const v of vs){const {p}=await openDisk(b,v,{throttle:1});await p.goto('http://localhost:5173/',{waitUntil:'load'});await new Promise(r=>setTimeout(r,1500));
  await p.evaluate(()=>document.getAnimations().forEach(a=>a.pause()));
  const cls=await p.evaluate(()=>document.documentElement.className);
  const r1=await step(p,f,()=>{document.body.classList.remove('ready');document.body.offsetTop;});
  const r2=await step(p,f,()=>{document.body.classList.add('ready');document.body.offsetTop;});
  console.log(v.name.padEnd(12),'html class="'+cls+'"','elements restyled: remove ready',r1,' add ready',r2);await p.close();}
 await b.close();})();
