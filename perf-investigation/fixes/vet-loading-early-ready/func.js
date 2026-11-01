const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const S='fixes/loading/';
const variants=[{name:'baseline'},{name:'early',files:{'/index.html':S+'index.earlyready.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'}}];
const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const cases=[['/',{width:1440,height:900},false],['/#pricing',{width:1440,height:900},false],['/#process',{width:390,height:844,isMobile:true,hasTouch:true},false],['/',{width:1440,height:900},true],['/tos/',{width:1440,height:900},false],['/slots/',{width:1440,height:900},false],['/nope-404',{width:1440,height:900},false]];
  for(const [u,vp,rm] of cases) for(const v of variants){
    const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);
    if(rm) await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80))});
    await require('./serve.js').attach(p,v.files);
    await p.evaluateOnNewDocument(()=>{try{localStorage.setItem('s0da-lite','0')}catch(e){}});
    await p.goto('http://localhost:5173'+u,{waitUntil:'load'});await w8(3500);
    const r=await p.evaluate(()=>{const t=document.getElementById(location.hash.slice(1));return{
      ready:document.body.classList.contains('ready'),s0da:window.s0daReady,lenis:!!window.lenis,
      top:t?Math.round(t.getBoundingClientRect().top):null,
      ctr:[...document.querySelectorAll('.hero-stats-strip .counter')].map(e=>e.textContent).join(' '),
      live:[...document.querySelectorAll('[data-live="visits"]')].map(e=>e.textContent.trim()).slice(0,3).join(' '),
      boot:(document.getElementById('boot')?getComputedStyle(document.getElementById('boot')).display:'-'),
      title:document.title}});
    console.log(u.padEnd(10),(rm?'RM ':'')+(vp.isMobile?'mob ':'')+v.name.padEnd(9),JSON.stringify(r),errs.length?'ERR '+errs.join(' / '):'');
    await ctx.close();
  }
  await b.close();
})();
