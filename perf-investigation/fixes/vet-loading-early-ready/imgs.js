const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();await p.setViewport({width:1440,height:900});
const miss=[];await require('./serve.js').attach(p,{});p.on('requestfinished',()=>{});p.on('response',r=>{if(r.status()>=400)miss.push(r.status()+' '+r.url())});
const t=Date.now();await p.goto('http://localhost:5173/',{waitUntil:'networkidle2',timeout:120000});console.log('nav',Date.now()-t);
const r=await p.evaluate(()=>[...document.images].filter(i=>!i.complete).map(i=>i.loading+' '+i.currentSrc.slice(-40)+' '+i.getAttribute('src')));
console.log(r.length,r.slice(0,10),miss.slice(0,10));await b.close();})();
