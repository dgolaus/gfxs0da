const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const fs=require('fs');const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const [W,H]=(process.argv[3]||'390x844').split('x').map(Number);
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const v of vs){const {p}=await openPage(b,v,{throttle:1});const mobile=W<768;await p.setViewport({width:W,height:H,isMobile:mobile,hasTouch:mobile});
await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await w8(4000);
for(let y=0;y<760;y+=120){await p.evaluate(y=>scrollTo(0,y),y);await w8(16);}await p.evaluate(()=>scrollTo(0,760));await w8(3000);
const r=await p.evaluate(()=>{const n=document.querySelector('.nav .btn');const out={};
 out.anims=document.getAnimations().filter(a=>{const t=a.effect&&a.effect.target;return t&&(t===n||n.contains(t)||t.contains&&t.contains(n))}).map(a=>(a.animationName||a.transitionProperty)+':'+a.playState+':'+Math.round(a.currentTime));
 for(const a of document.getAnimations()){try{a.pause();a.currentTime=5000;}catch(e){}}
 const r=n.getBoundingClientRect();out.after=[r.left,r.right,getComputedStyle(n).transform,getComputedStyle(document.querySelector('.nav')).transform];return out;});
console.log(v.name,JSON.stringify(r));await p.close();}
await b.close();})();
