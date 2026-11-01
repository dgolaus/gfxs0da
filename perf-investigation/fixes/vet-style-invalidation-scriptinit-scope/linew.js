const path=require('path');const fs=require('fs');
const puppeteer=require('../node_modules/puppeteer');
const REPO='..';
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const vw of [1440,1200,1024,900,768,600,480,375]){
 const p=await b.newPage();await p.setViewport({width:vw,height:900});
 await p.setRequestInterception(true);
 p.on('request',(req)=>{const u=new URL(req.url());if(u.host!=='localhost:5173'){if(/cloudflareinsights/.test(u.host))return req.respond({status:204,body:''});return req.continue();}
  let k=decodeURIComponent(u.pathname);if(k.endsWith('/'))k+='index.html';const f=path.join(REPO,k);
  if(fs.existsSync(f))return req.respond({status:200,contentType:k.endsWith('.css')?'text/css':k.endsWith('.js')?'application/javascript':k.endsWith('.html')?'text/html':'application/octet-stream',body:fs.readFileSync(f)});return req.respond({status:404,body:''});});
 await p.evaluateOnNewDocument(()=>{try{localStorage.setItem('s0da-lite','0')}catch(e){}});
 await p.goto('http://localhost:5173/',{waitUntil:'load'});await p.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,2500));
 const r=await p.evaluate(()=>{document.getAnimations().forEach(a=>{try{a.finish()}catch(e){}});const h=document.querySelector('.hero-title');const cs=getComputedStyle(h);
  const tn=[...h.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());const rg=document.createRange();rg.selectNodeContents(tn);const l1=rg.getBoundingClientRect().width;
  const acc=h.querySelector('.accent');const rg2=document.createRange();rg2.setStartBefore(acc);rg2.setEnd(h,h.childNodes.length);const l2=rg2.getBoundingClientRect().width;
  const fs=parseFloat(cs.fontSize);
  return {fs, max:cs.maxWidth, w:h.getBoundingClientRect().width, parentW:h.parentElement.getBoundingClientRect().width, line1:l1.toFixed(1), line2:l2.toFixed(1), stale16ch:(920.312/100*fs).toFixed(1), h:h.getBoundingClientRect().height};});
 console.log(vw,JSON.stringify(r));await p.close();}
await b.close();})();
