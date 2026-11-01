const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const fs=require('fs');const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const [W,H]=(process.argv[3]||'390x844').split('x').map(Number);
const PROBE=`window.__ev=[];addEventListener('DOMContentLoaded',()=>{
 const ts=document.getElementById('trust-stats');
 new IntersectionObserver((es)=>es.forEach(e=>__ev.push(['io35',Math.round(performance.now()),Math.round(scrollY),e.isIntersecting,+e.intersectionRatio.toFixed(2)])),{threshold:0.35}).observe(ts);
 new MutationObserver((ms)=>{for(const m of ms){if(m.target.classList&&m.target.classList.contains('lit')&&!m.target.__l){m.target.__l=1;__ev.push(['lit',Math.round(performance.now()),Math.round(scrollY)]);}}}).observe(ts,{attributes:true,subtree:true,attributeFilter:['class']});
 const pr=document.getElementById('process');new IntersectionObserver((es)=>es.forEach(e=>__ev.push(['proc20',Math.round(performance.now()),Math.round(scrollY),e.isIntersecting])),{threshold:0.2}).observe(pr);
 const cm=document.getElementById('chat-messages');new MutationObserver(()=>{if(!cm.__f&&cm.children.length){cm.__f=1;__ev.push(['chat1',Math.round(performance.now()),Math.round(scrollY)]);}}).observe(cm,{childList:true});
});`;
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const v of vs){const {p}=await openPage(b,{...v,js:PROBE},{throttle:1});const mobile=W<768;await p.setViewport({width:W,height:H,isMobile:mobile,hasTouch:mobile});
await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await w8(4000);
const t0=await p.evaluate(()=>performance.now());
for(let y=0;y<6000;y+=120){await p.evaluate(y=>scrollTo(0,y),y);await w8(16);}
await w8(1500);
const ev=await p.evaluate(()=>__ev);console.log(v.name.padEnd(28),'walkStart',Math.round(t0),JSON.stringify(ev.filter(e=>e[0]!=='io35'||e[3])));await p.close();}
await b.close();})();
