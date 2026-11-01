const puppeteer=require('../node_modules/puppeteer');
const {openPage}=require('../../bench.js');
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const wh of process.argv[2].split(',')){const [w,h]=wh.split('x').map(Number);
const {p}=await openPage(b,{name:'baseline'},{throttle:1});await p.setViewport({width:w,height:h});
await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await p.evaluate(async()=>{await document.fonts.ready});await w8(800);
console.log(wh,await p.evaluate(()=>['about','process','trust','pricing'].map(id=>{const s=document.getElementById(id);const cs=getComputedStyle(s);return id+'='+(s.getBoundingClientRect().height-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom))+' (pad '+cs.paddingBottom+')'}).join('  ')));
await p.close();}
await b.close();})();
