const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{
  const v=JSON.parse(fs.readFileSync('variants.json','utf8')).find(x=>x.name===process.argv[2]);
  const js=`window.__log=[];(function(){function poll(){var t=document.querySelector('.hero-title');var as=t?t.getAnimations():[];window.__log.push(Math.round(performance.now())+':'+as.map(function(a){return a.animationName+'/'+a.playState+'/'+Math.round(a.currentTime||-1)}).join(','));if(window.__log.length<400)requestAnimationFrame(poll);} requestAnimationFrame(poll);})();`;
  const browser=await puppeteer.launch({headless:'new'});
  const {p}=await openPage(browser,Object.assign({},v,{js}),{throttle:1});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,3000));
  const log=await p.evaluate(()=>window.__log);
  console.log(log.filter((x,i)=>i%5===0).slice(0,40).join('\n'));
  await browser.close();
})();
