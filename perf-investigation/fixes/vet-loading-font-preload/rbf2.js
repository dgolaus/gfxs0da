// Repeated paired FCP test, tiny page, font delayed by DELAY ms. One browser, fresh context per load.
const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const F='https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2';
const tiny=pre=>`<!doctype html><html><head><meta charset=utf-8>${pre?`<link rel=preload href="${F}" as=font type="font/woff2" crossorigin>`:''}
<style>@font-face{font-family:X;src:url(${F}) format('woff2');font-display:swap}body{font-family:X,sans-serif;background:#fff}</style></head><body><h1>Hello world</h1></body></html>`;
const DELAY=+(process.argv[2]||2000), N=+(process.argv[3]||6);
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const res={no:[],pre:[]};
  for(let i=0;i<N;i++) for(const pre of (i%2?[true,false]:[false,true])){
    const ctx=await b.createBrowserContext();const p=await ctx.newPage();
    await p.setRequestInterception(true);
    p.on('request',req=>{const u=new URL(req.url());
      if(u.host==='fonts.gstatic.com')return setTimeout(()=>req.continue().catch(()=>{}),DELAY);
      if(u.host.startsWith('localhost'))return req.respond({status:200,contentType:'text/html; charset=utf-8',body:tiny(pre)});
      req.continue();});
    await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>performance.getEntriesByName('first-contentful-paint').length>0,{timeout:DELAY+4000}).catch(()=>{});
    const r=await p.evaluate(()=>{const e=performance.getEntriesByName('first-contentful-paint')[0];return {fcp:e?Math.round(e.startTime):null,dcl:Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd)}});
    res[pre?'pre':'no'].push(r.fcp-r.dcl);
    await ctx.close();
  }
  await b.close();
  const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
  console.log(JSON.stringify({DELAY,fcpMinusDcl_nopreload:res.no,median_no:med(res.no),fcpMinusDcl_preload:res.pre,median_pre:med(res.pre)}));
})().catch(e=>{console.error(e);process.exit(1)});
