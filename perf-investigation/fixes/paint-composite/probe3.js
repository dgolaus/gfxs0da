const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{
  const browser=await puppeteer.launch({headless:'new'});
  const {p}=await openPage(browser,{name:'baseline'},{throttle:1});
  const t=Date.now();
  await p.goto('http://localhost:5173/',{waitUntil:'networkidle2',timeout:60000}).catch(e=>console.log('goto',e.message));
  console.log('loaded in',Date.now()-t);
  const r=await p.evaluate(()=>[...document.images].filter(i=>!i.complete).map(i=>i.getAttribute('src')+' '+i.loading));
  console.log(r.length, r.slice(0,10));
  await browser.close();
})();
