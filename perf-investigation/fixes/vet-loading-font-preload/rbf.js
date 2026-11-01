/* Is a <link rel=preload as=font> render-blocking in this Chrome?
   Serve a tiny page (and the real index.html baseline/variant) via interception,
   delay every gstatic font response by DELAY ms, and compare FCP. No CPU throttle. */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const REPO='..';
const VAR='fixes/loading/index.fontpreload.html';
const TYPE=k=>({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4'})[path.extname(k)]||'application/octet-stream';
const F='https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2';
const tiny=pre=>`<!doctype html><html><head><meta charset=utf-8>${pre?`<link rel=preload href="${F}" as=font type="font/woff2" crossorigin>`:''}
<style>@font-face{font-family:X;src:url(${F}) format('woff2');font-display:swap}body{font-family:X,sans-serif;background:#fff}</style></head><body><h1>Hello world</h1></body></html>`;
const DELAY=+(process.argv[2]||2500);
async function run(name,html,ua){
  const b=await puppeteer.launch({headless:'new'});
  const p=await b.newPage();await p.setViewport({width:1440,height:900});
  if(ua) await p.setUserAgent(ua);
  await p.evaluateOnNewDocument(`try{localStorage.setItem('s0da-lite','0')}catch(e){};Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});`);
  await p.setRequestInterception(true);
  const gs=[];const msgs=[];
  p.on('console',m=>{if(/preload/i.test(m.text()))msgs.push(m.text().slice(0,140))});
  p.on('request',req=>{const u=new URL(req.url());
    if(u.host==='fonts.gstatic.com'){gs.push(u.pathname.split('/').slice(2).join('/').slice(-26));return setTimeout(()=>req.continue(),DELAY);}
    if(!u.host.startsWith('localhost'))return req.continue();
    let k=decodeURIComponent(u.pathname);if(k.endsWith('/'))k+='index.html';
    let body=null;
    if(k==='/index.html') body=html; else if(fs.existsSync(path.join(REPO,k))) body=fs.readFileSync(path.join(REPO,k));
    if(body==null)return req.respond({status:404,body:''});
    return req.respond({status:200,contentType:TYPE(k),body});});
  const t=Date.now();
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,DELAY+2500));
  const r=await p.evaluate(()=>{const e=performance.getEntriesByName('first-contentful-paint')[0];
    const fr=performance.getEntriesByType('resource').filter(x=>/gstatic/.test(x.name)).map(x=>Math.round(x.responseEnd));
    return {fcp:e?Math.round(e.startTime):null,fontEnds:fr,dcl:Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd)}});
  await b.close();
  console.log(JSON.stringify({name,delay:DELAY,ua:ua?ua.slice(13,40):'default',...r,gstaticReqs:gs.length,gs,preloadWarnings:msgs}));
}
(async()=>{
  const mode=process.argv[3]||'all';
  if(mode==='all'||mode==='tiny'){
    await run('tiny-nopreload',tiny(false));
    await run('tiny-preload',tiny(true));
  }
  if(mode==='all'||mode==='real'){
    const base=fs.readFileSync(path.join(REPO,'index.html')),v=fs.readFileSync(VAR);
    await run('real-baseline',base);
    await run('real-preload',v);
  }
  if(mode==='mobile'){
    const UA='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36';
    const base=fs.readFileSync(path.join(REPO,'index.html')),v=fs.readFileSync(VAR);
    await run('mobileUA-baseline',base,UA);
    await run('mobileUA-preload',v,UA);
    const MAC='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
    await run('macUA-preload',v,MAC);
  }
})().catch(e=>{console.error(e);process.exit(1)});
