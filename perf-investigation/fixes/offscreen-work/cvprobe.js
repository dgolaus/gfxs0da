const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const fs=require('fs');
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const v=JSON.parse(fs.readFileSync(process.argv[2],'utf8'))[+(process.argv[3]||1)];
 const b=await puppeteer.launch({headless:'new'});
 const {p}=await openPage(b,v,{throttle:1});
 await p.evaluateOnNewDocument(()=>{window.__cvev=[];document.addEventListener('contentvisibilityautostatechange',(e)=>window.__cvev.push([Math.round(performance.now()),e.target.id,e.skipped]),true);});
 await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});
 await w8(1500);
 const r=await p.evaluate(async()=>{
   const raf=()=>new Promise(r=>requestAnimationFrame(()=>r()));
   const ids=['work','about','process','trust','pricing','contact'];
   const state=()=>ids.map(id=>{const s=document.getElementById(id);const c=s.firstElementChild;return id+':'+Math.round(s.getBoundingClientRect().height)+(c?(c.checkVisibility({contentVisibilityAuto:true})?'R':'S'):'')}).join(' ');
   const out={ev:window.__cvev.slice(),s0:state(),cs:getComputedStyle(document.getElementById('about')).containIntrinsicHeight};
   // forced layout test: read a descendant rect of trust while skipped
   const t=document.querySelector('#trust .tcols');const h0=document.getElementById('trust').getBoundingClientRect().height;t.getBoundingClientRect();await raf();await raf();
   out.afterForced=state();
   // warm-up test: visible for 2 frames then back to auto
   for(const id of ['about','process','trust','pricing','contact']){const s=document.getElementById(id);s.style.contentVisibility='visible';}
   await raf();await raf();
   out.whileVisible=state();
   for(const id of ['about','process','trust','pricing','contact']){const s=document.getElementById(id);s.style.contentVisibility='';}
   await raf();await raf();
   out.afterWarm=state();
   out.scrollH=document.documentElement.scrollHeight;
   out.ev2=window.__cvev.slice();
   return out;
 });
 console.log(JSON.stringify(r,null,1));
 await b.close();
})();
