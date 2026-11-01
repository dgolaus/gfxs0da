// Counts elements restyled per UpdateLayoutTree (structural, not timing) for baseline vs variants.
const fs=require('fs'),path=require('path');
const puppeteer=require('../node_modules/puppeteer');
const REPO='..';
const TYPES={'.js':'application/javascript','.css':'text/css','.json':'application/json','.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2','.avif':'image/avif'};
const variants=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await puppeteer.launch({headless:'new'});
 const res={};
 for(let rep=0;rep<2;rep++)for(const v of variants){
  const p=await browser.newPage();await p.setViewport({width:1440,height:900});
  const c=await p.target().createCDPSession();
  await c.send('Emulation.setCPUThrottlingRate',{rate:+(process.env.THR||1)});
  const over=Object.fromEntries(Object.entries(v.files||{}).map(([k,f])=>[k,fs.readFileSync(f)]));
  await p.setRequestInterception(true);
  p.on('request',req=>{const u=new URL(req.url());if(u.host!=='localhost:5173')return req.continue();
   let k=decodeURIComponent(u.pathname);if(k.endsWith('/'))k+='index.html';const ct=TYPES[path.extname(k)]||'application/octet-stream';
   if(over[k])return req.respond({status:200,contentType:ct,body:over[k]});
   const f=path.join(REPO,k);if(fs.existsSync(f)&&fs.statSync(f).isFile())return req.respond({status:200,contentType:ct,body:fs.readFileSync(f)});
   return req.respond({status:404,body:''});});
  await p.evaluateOnNewDocument(()=>{try{localStorage.setItem('s0da-lite','0')}catch(e){}
   Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});
   const add=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}return add.apply(this,c);};});
  await p.goto('http://localhost:5173/',{waitUntil:'load'});
  await w8(4000);
  const file=path.join(__dirname,`ct_${v.name}_${rep}.json`);
  await p.tracing.start({path:file,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
  await w8(2500);
  await p.tracing.stop();
  await p.close();
  const ev=JSON.parse(fs.readFileSync(file,'utf8')).traceEvents;
  const mains=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
  const u=ev.filter(e=>e.name==='UpdateLayoutTree'&&mains.includes(e.pid+':'+e.tid)&&(e.ph==='X'||e.ph==='E'||e.ph==='B'));
  const counts=[];let dur=0,n=0;
  for(const e of u){const ec=e.args&&(e.args.elementCount!=null?e.args.elementCount:(e.args.endData&&e.args.endData.elementCount));if(ec!=null)counts.push(ec);if(e.ph==='X'){dur+=e.dur;n++;}}
  const big=counts.filter(x=>x>5).sort((a,b)=>a-b);
  (res[v.name]=res[v.name]||[]).push({recalcs:counts.length,medianBig:big[Math.floor(big.length/2)],sumElements:counts.reduce((a,b)=>a+b,0),ultMs:+(dur/1000).toFixed(1)});
  fs.unlinkSync(file);
 }
 await browser.close();
 console.log(JSON.stringify(res,null,1));
})();
