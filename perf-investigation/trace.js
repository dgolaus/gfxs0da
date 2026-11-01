/* Grava trace da entrada (0-4s) com CPU 4x, lite bloqueado, e resume as long tasks. */
const path=require('path');const fs=require('fs');
const puppeteer=require('puppeteer');
const OUT=__dirname;
const PRE=`try{localStorage.setItem('s0da-lite','0')}catch(e){};Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});const _a=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}return _a.apply(this,c);};`;
(async()=>{
 for(const [nome,frio] of [['cold',true],['warm',false]]){
  const b=await puppeteer.launch({headless:'new'});
  if(!frio){const w=await b.newPage();await w.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await w.close();}
  const p=await b.newPage();await p.setViewport({width:1440,height:900});
  const c=await p.target().createCDPSession();await c.send('Emulation.setCPUThrottlingRate',{rate:4});
  await p.evaluateOnNewDocument(PRE);
  const file=path.join(OUT,'trace_'+nome+'.json');
  await p.tracing.start({path:file,categories:['devtools.timeline','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.frame','v8.execute','disabled-by-default-v8.cpu_profiler','blink.user_timing','loading','latencyInfo','disabled-by-default-devtools.timeline.stack','cc','gpu','blink','benchmark','viz']});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,4500));
  await p.tracing.stop();await b.close();
  console.log(nome+': '+(fs.statSync(file).size/1048576).toFixed(1)+' MB -> '+file);
 }
})().catch(e=>{console.error(e);process.exit(1)});
