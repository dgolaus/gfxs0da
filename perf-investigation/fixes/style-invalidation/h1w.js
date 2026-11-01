const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openDisk}=require('./diskopen.js');
(async()=>{const vs=JSON.parse(fs.readFileSync('eq_vars2.json','utf8')).slice(0,2);
 const b=await puppeteer.launch({headless:'new'});
 for(let r=0;r<3;r++)for(const v of vs){const {p}=await openDisk(b,v,{throttle:1});await p.goto('http://localhost:5173/',{waitUntil:'load'});
  const early=await p.evaluate(()=>({w:getComputedStyle(document.querySelector('.hero-title')).width,fonts:document.fonts.status}));
  await p.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,1500));
  const late=await p.evaluate(()=>({w:getComputedStyle(document.querySelector('.hero-title')).width,fonts:document.fonts.status,ff:getComputedStyle(document.querySelector('.hero-title')).fontFamily}));
  console.log(v.name.padEnd(12),'at load',JSON.stringify(early),' after fonts.ready',JSON.stringify(late));await p.close();}
 await b.close();})();
