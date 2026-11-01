// FCP-DCL for: no preload / parser preload / script-inserted preload / fonts.load-on-css. Font delayed by DELAY.
const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const F='https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2';
const head={
 none:'',
 parser:`<link rel=preload href="${F}" as=font type="font/woff2" crossorigin>`,
 script:`<script>var l=document.createElement('link');l.rel='preload';l.as='font';l.type='font/woff2';l.crossOrigin='anonymous';l.href='${F}';document.head.appendChild(l);</script>`,
 fontsload:`<script>document.fonts.load('400 1em X')</script>`};
const page=k=>`<!doctype html><html><head><meta charset=utf-8><style>@font-face{font-family:X;src:url(${F}) format('woff2');font-display:swap}body{font-family:X,sans-serif;background:#fff}</style>${head[k]}</head><body><h1>Hello world</h1></body></html>`;
const DELAY=+(process.argv[2]||2000), N=+(process.argv[3]||5);
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const keys=Object.keys(head);const res=Object.fromEntries(keys.map(k=>[k,[]]));
  for(let i=0;i<N;i++) for(const k of (i%2?[...keys].reverse():keys)){
    const ctx=await b.createBrowserContext();const p=await ctx.newPage();
    await p.setRequestInterception(true);
    p.on('request',req=>{const u=new URL(req.url());
      if(u.host==='fonts.gstatic.com')return setTimeout(()=>req.continue().catch(()=>{}),DELAY);
      if(u.host.startsWith('localhost'))return req.respond({status:200,contentType:'text/html; charset=utf-8',body:page(k)});
      req.continue();});
    await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>performance.getEntriesByName('first-contentful-paint').length>0,{timeout:DELAY+4000}).catch(()=>{});
    const r=await p.evaluate(()=>{const e=performance.getEntriesByName('first-contentful-paint')[0];return {fcp:e?Math.round(e.startTime):null,dcl:Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd)}});
    res[k].push(r.fcp-r.dcl);await ctx.close();
  }
  await b.close();
  const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
  for(const k of keys) console.log(k.padEnd(10),'median FCP-DCL',med(res[k]),JSON.stringify(res[k]));
})().catch(e=>{console.error(e);process.exit(1)});
