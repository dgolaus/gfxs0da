const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const fs=require('fs');const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const [W,H]=(process.argv[3]||'390x844').split('x').map(Number);
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const v of vs){const {p}=await openPage(b,v,{throttle:1});const mobile=W<768;await p.setViewport({width:W,height:H,isMobile:mobile,hasTouch:mobile});
await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await w8(2500);
console.log(v.name, await p.evaluate(()=>{const n=document.querySelector('.nav .btn');const r=n.getBoundingClientRect();
 // find widest overflowing elements
 const wide=[];for(const el of document.querySelectorAll('body *')){const rc=el.getBoundingClientRect();if(rc.right>innerWidth+2&&rc.width>0){wide.push((el.id?'#'+el.id:el.className.toString().split(' ')[0]||el.tagName)+':'+Math.round(rc.right));}}
 return JSON.stringify({innerW:innerWidth,docSW:document.documentElement.scrollWidth,bodySW:document.body.scrollWidth,vv:visualViewport.width,scale:visualViewport.scale,clientW:document.documentElement.clientWidth,btnRight:r.right,ovx:getComputedStyle(document.documentElement).overflowX+'/'+getComputedStyle(document.body).overflowX,wide:wide.slice(0,12)});}));
await p.close();}
await b.close();})();
