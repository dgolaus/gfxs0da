// Paired FCP test on the REAL page: baseline vs font-preload variant. Fresh context per load (cold cache
// unless WARM=1 -> one priming load in the same context first). Optional gstatic delay and CPU throttle.
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const REPO='..';
const VAR='fixes/loading/index.fontpreload.html';
const TYPE=k=>({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4'})[path.extname(k)]||'application/octet-stream';
const DELAY=+(process.argv[2]||0), N=+(process.argv[3]||4), CPU=+(process.argv[4]||1), WARM=process.argv[5]==='warm';
const VARHTML=process.argv[6]||VAR;
const html={base:fs.readFileSync(path.join(REPO,'index.html')),pre:fs.readFileSync(VARHTML)};
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const res={base:[],pre:[]};
  for(let i=0;i<N;i++) for(const k of (i%2?['pre','base']:['base','pre'])){
    const ctx=await b.createBrowserContext();
    const mk=async()=>{const p=await ctx.newPage();await p.setViewport({width:1440,height:900});
      await p.evaluateOnNewDocument(`try{localStorage.setItem('s0da-lite','0')}catch(e){};Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});`);
      await p.setRequestInterception(true);await p.setCacheEnabled(true);
      p.on('request',req=>{const u=new URL(req.url());
        if(u.host==='fonts.gstatic.com')return DELAY?setTimeout(()=>req.continue().catch(()=>{}),DELAY):req.continue();
        if(!u.host.startsWith('localhost'))return req.continue();
        let f=decodeURIComponent(u.pathname);if(f.endsWith('/'))f+='index.html';
        const body=f==='/index.html'?html[k]:(fs.existsSync(path.join(REPO,f))?fs.readFileSync(path.join(REPO,f)):null);
        if(body==null)return req.respond({status:404,body:''});
        req.respond({status:200,contentType:TYPE(f),body});});
      return p;};
    if(WARM){const w=await mk();await w.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await w.close();}
    const p=await mk();
    if(CPU>1){const c=await p.target().createCDPSession();await c.send('Emulation.setCPUThrottlingRate',{rate:CPU});}
    await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>performance.getEntriesByName('first-contentful-paint').length>0,{timeout:20000}).catch(()=>{});
    await new Promise(r=>setTimeout(r,500));
    const r=await p.evaluate(()=>{const e=performance.getEntriesByName('first-contentful-paint')[0];const n=performance.getEntriesByType('navigation')[0];
      const css=performance.getEntriesByType('resource').filter(x=>/styles\.css|css2/.test(x.name)).map(x=>Math.round(x.responseEnd));
      return {fcp:e?Math.round(e.startTime):null,cssEnd:Math.max(...css)}});
    res[k].push(r.fcp+'(css'+r.cssEnd+')');
    await ctx.close();
  }
  await b.close();
  const med=a=>{const s=a.map(x=>parseInt(x)).sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
  console.log(JSON.stringify({DELAY,CPU,WARM,base:res.base,median_base:med(res.base),pre:res.pre,median_pre:med(res.pre)}));
})().catch(e=>{console.error(e);process.exit(1)});
