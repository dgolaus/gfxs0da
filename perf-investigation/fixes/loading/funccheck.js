const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const REPO='..';
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.gif':'image/gif'};
const variants=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const v of variants) for(const url of ['http://localhost:5173/','http://localhost:5173/#pricing','http://localhost:5173/tos/']){
  const p=await b.newPage();await p.setViewport({width:1440,height:900});
  const map=Object.fromEntries(Object.entries(v.files||{}).map(([k,f])=>[k,fs.readFileSync(f)]));
  const reqs=[];const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='warning'||m.type()==='error')errs.push(m.text().slice(0,140))});
  await p.setRequestInterception(true);
  p.on('request',req=>{const u=new URL(req.url());reqs.push(u.host+u.pathname);if(!u.host.startsWith('localhost'))return req.continue();let k=decodeURIComponent(u.pathname);if(k==='/')k='/index.html';else if(k.endsWith('/'))k+='index.html';if(map[k])return req.respond({status:200,contentType:MIME[path.extname(k)]||'text/html',body:map[k]});const f=path.join(REPO,k);try{if(fs.statSync(f).isFile())return req.respond({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})}catch(e){}req.respond({status:404,body:'nf'});});
  await p.evaluateOnNewDocument(()=>{try{localStorage.setItem('s0da-lite','0')}catch(e){}});
  await p.goto(url,{waitUntil:'load'});await new Promise(r=>setTimeout(r,4500));
  const r=await p.evaluate(()=>{const c=document.querySelector('.counter[data-live="visits"]');const pr=document.getElementById('pricing');const t=document.querySelector('.tos-page');
    return {counter:c&&c.textContent,counterValue:c&&c.dataset.value,counters:[...document.querySelectorAll('.hero-stats-strip .counter')].map(x=>x.textContent).join(','),cardSub:(document.querySelector('.card[data-game] .card-sub')||{}).textContent,ready:document.body.classList.contains('ready'),s0daReady:!!window.s0daReady,scrollY:Math.round(scrollY),pricingTop:pr?Math.round(pr.getBoundingClientRect().top):null,lenis:!!window.lenis,fonts:['Inter Tight','Inter','JetBrains Mono'].map(f=>document.fonts.check('600 16px "'+f+'"')).join(','),tos:!!t};});
  console.log(v.name,url.replace('http://localhost:5173',''),JSON.stringify({...r,visitsReq:reqs.filter(x=>x.includes('visits.json')).length,gstatic:reqs.filter(x=>x.includes('gstatic')).length,errs:errs.slice(0,4)}));
  await p.close();}
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
