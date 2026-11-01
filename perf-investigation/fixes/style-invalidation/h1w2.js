const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openDisk}=require('./diskopen.js');
(async()=>{const vs=JSON.parse(fs.readFileSync('eq_vars2.json','utf8')).slice(0,2);
 const b=await puppeteer.launch({headless:'new'});
 for(let r=0;r<4;r++)for(const v of vs){const {p}=await openDisk(b,v,{throttle:1});await p.goto('http://localhost:5173/',{waitUntil:'load'});
  await p.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,800));
  const res=await p.evaluate(()=>{const h=document.querySelector('.hero-title');const w0=getComputedStyle(h).maxWidth;
    // nudge: inherited custom prop on html => full recalc
    document.documentElement.style.setProperty('--nudge','1');document.body.offsetTop;const w1=getComputedStyle(h).maxWidth;
    const lines=Math.round(h.getBoundingClientRect().height/parseFloat(getComputedStyle(h).lineHeight));
    return {before:w0,afterFullRecalc:w1,h1Height:h.getBoundingClientRect().height};});
  console.log(v.name.padEnd(12),JSON.stringify(res));await p.close();}
 await b.close();})();
