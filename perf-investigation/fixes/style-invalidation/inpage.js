const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const bench=require('../../bench.js');
async function step(p,f,fn,arg){await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});await p.evaluate(fn,arg);await p.tracing.stop();
  return JSON.parse(fs.readFileSync(f,'utf8')).traceEvents.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X'&&e.args.elementCount>0).map(e=>e.args.elementCount+'/'+(e.dur/1000).toFixed(2)+'ms').join(',');}
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const f=path.join(__dirname,'inpage_tmp.json');
  const vs=[{name:'baseline'},{name:'leave-prop',css:"@property --leave { syntax: '<number>'; inherits: false; initial-value: 0; }"}];
  for(const v of vs){
    const {p}=await bench.openPage(b,v,{throttle:1});
    await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});
    await new Promise(r=>setTimeout(r,1500));
    // stop rAF-driven noise: freeze animations
    await p.evaluate(()=>{document.getAnimations().forEach(a=>a.pause());});
    const r1=await step(p,f,()=>{const t=document.getElementById('trust');t.classList.remove('scroll-fade');t.style.removeProperty('--leave');document.body.offsetTop;});
    const r2=await step(p,f,()=>{const t=document.getElementById('trust');t.classList.add('scroll-fade');document.body.offsetTop;});
    const r3=await step(p,f,()=>{const t=document.getElementById('trust');t.style.setProperty('--leave','0.000');document.body.offsetTop;});
    const r4=await step(p,f,()=>{document.documentElement.style.setProperty('--nav-pill','0.001');document.body.offsetTop;});
    const r5=await step(p,f,()=>{document.getElementById('nav').style.setProperty('--nav-pill','0.002');document.body.offsetTop;});
    const r6=await step(p,f,()=>{document.body.classList.remove('ready');document.body.offsetTop;});
    const r7=await step(p,f,()=>{document.body.classList.add('ready');document.body.offsetTop;});
    console.log(v.name,'\n  trust remove class:',r1,'\n  trust add class:',r2,'\n  trust inline --leave:',r3,'\n  root --nav-pill:',r4,'\n  #nav --nav-pill:',r5,'\n  body remove ready:',r6,'\n  body add ready:',r7);
    await p.close();
  }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
