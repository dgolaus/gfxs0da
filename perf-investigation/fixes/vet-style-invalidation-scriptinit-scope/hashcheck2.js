const path=require('path');const fs=require('fs');
const puppeteer=require('../node_modules/puppeteer');
const REPO='..';
const vs=JSON.parse(fs.readFileSync('v2.json','utf8'));
const types={'.js':'application/javascript','.css':'text/css','.json':'application/json','.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(let rep=0;rep<3;rep++)for(const url of ['/tos/#pricing','/#pricing'])for(const mob of [true,false])for(const v of vs){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(mob?{width:375,height:812,isMobile:true,hasTouch:true}:{width:1440,height:900});
 if(mob){const c=await p.target().createCDPSession();await c.send('Emulation.setEmulatedMedia',{features:[{name:'hover',value:'none'},{name:'pointer',value:'coarse'}]});}
 const over=Object.fromEntries(Object.entries(v.files||{}).map(([k,f])=>[k,fs.readFileSync(f)]));
 await p.setRequestInterception(true);
 p.on('request',(req)=>{const u=new URL(req.url());if(u.host!=='localhost:5173'){if(/cloudflareinsights/.test(u.host))return req.respond({status:204,body:''});return req.continue();}
  let k=decodeURIComponent(u.pathname);if(k.endsWith('/'))k+='index.html';const ct=types[path.extname(k)]||'application/octet-stream';
  if(over[k])return req.respond({status:200,contentType:ct,body:over[k]});const f=path.join(REPO,k);
  if(fs.existsSync(f)&&fs.statSync(f).isFile())return req.respond({status:200,contentType:ct,body:fs.readFileSync(f)});return req.respond({status:404,body:''});});
 await p.evaluateOnNewDocument(()=>{try{localStorage.setItem('s0da-lite','0')}catch(e){}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:5173'+url,{waitUntil:'load'});await new Promise(r=>setTimeout(r,2500));
 const r=await p.evaluate(()=>{const h=location.hash.slice(1);const t=h&&document.getElementById(h);const nav=document.getElementById('nav');const cs=getComputedStyle(nav);
  const vis=document.querySelector('[data-live="visits"]');
  return {y:Math.round(scrollY),tTop:t?Math.round(t.getBoundingClientRect().top):null,pill:nav.classList.contains('is-pill'),padT:cs.paddingTop,navBefore:getComputedStyle(nav,'::before').opacity,
   links:(()=>{const l=document.querySelector('.nav-links');return l?getComputedStyle(l).padding+' / '+getComputedStyle(l,'::before').opacity:null})(),
   brand:getComputedStyle(nav.querySelector('.brand')).opacity+' '+getComputedStyle(nav.querySelector('.brand')).transform,
   fades:[...document.querySelectorAll('.scroll-fade')].map(s=>s.id+':'+getComputedStyle(s).opacity).join(' '),visits:vis?vis.textContent.trim():null,lenis:!!window.lenis};});
 console.log(url.padEnd(14),mob?'mob ':'desk',v.name.padEnd(8),JSON.stringify(r),errs.length?'ERR '+errs.join(';'):'');
 await p.close();await ctx.close();}
await b.close();})();
