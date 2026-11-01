const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();await p.setViewport({width:1440,height:900});
const t=Date.now();await p.goto('http://localhost:5173/',{waitUntil:'networkidle2',timeout:60000});console.log('networkidle2 after',Date.now()-t,'ms');
const r=await p.evaluate(()=>[...document.images].filter(i=>!i.complete).map(i=>(i.currentSrc||i.src||'(nosrc)').split('/').slice(-2).join('/')+' lazy='+i.loading+' y='+Math.round(i.getBoundingClientRect().top)));
console.log('incomplete:',r.length,r.slice(0,20));await b.close();})().catch(e=>{console.error(e.message);process.exit(1)});
