const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const fs=require('fs');const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const [W,H]=(process.argv[3]||'390x844').split('x').map(Number);
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const v of vs){const {p}=await openPage(b,v,{throttle:1});const mobile=W<768;await p.setViewport({width:W,height:H,isMobile:mobile,hasTouch:mobile});
await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await w8(4000);
const probe=()=>p.evaluate(()=>{const n=document.querySelector('.nav .btn');const r=n.getBoundingClientRect();const nv=document.querySelector('.nav').getBoundingClientRect();return JSON.stringify({sy:Math.round(scrollY),sx:scrollX,vvx:visualViewport.offsetLeft,vvs:visualViewport.scale,vvw:visualViewport.width,iw:innerWidth,btnL:r.left,btnR:r.right,navL:nv.left,navR:nv.right,navW:nv.width,pill:getComputedStyle(document.documentElement).getPropertyValue('--nav-pill'),cls:document.querySelector('.nav').className})});
console.log(v.name,'rest',await probe());
for(let y=0;y<760;y+=120){await p.evaluate(y=>scrollTo(0,y),y);await w8(16);}await p.evaluate(()=>scrollTo(0,760));await w8(4000);
console.log(v.name,'760 ',await probe());
await p.close();}
await b.close();})();
