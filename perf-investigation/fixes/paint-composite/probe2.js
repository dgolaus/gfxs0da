const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{
  const v=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).find(x=>x.name===process.argv[3]);
  const browser=await puppeteer.launch({headless:'new'});
  const {p}=await openPage(browser,v,{throttle:1});
  await p.goto('http://localhost:5173/',{waitUntil:'load'});
  const r=await p.evaluate(()=>{
    const nodes=[...document.head.children].map(n=>n.tagName+(n.id?'#'+n.id:'')+(n.href?' '+n.getAttribute('href'):''));
    return {n:document.querySelectorAll('#__bench_css').length, order:nodes.filter(x=>/STYLE|LINK.*css/.test(x))};
  });
  console.log(JSON.stringify(r));
  await browser.close();
})();
