const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{
  const variants=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const browser=await puppeteer.launch({headless:'new'});
  for(const v of variants){ for(const [w,h] of [[1440,900],[390,844]]){
    const {p}=await openPage(browser,v,{throttle:1});await p.setViewport({width:w,height:h});
    await p.goto('http://localhost:5173/#pricing',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
    const r=await p.evaluate(()=>{const s=document.getElementById('pricing');const q=[...document.querySelectorAll('section,[id]')].slice(0,30).map(e=>e.id+':'+Math.round(e.getBoundingClientRect().top+scrollY)+'/'+Math.round(e.offsetHeight)).join(' ');return {docH:document.documentElement.scrollHeight,scrollY:Math.round(scrollY),pricing:[s.offsetTop,s.offsetHeight],ids:q};});
    console.log(v.name.padEnd(34)+w+' '+JSON.stringify(r).slice(0,400));
    await p.close();}}
  await browser.close();
})();
