const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openPage}=require('../../bench.js');
(async()=>{const b=await puppeteer.launch({headless:'new'});const {p}=await openPage(b,{name:'baseline'},{throttle:1});
const t=Date.now();await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});console.log('networkidle2 after',Date.now()-t,'ms');
const r=await p.evaluate(()=>[...document.images].filter(i=>!i.complete).map(i=>(i.currentSrc||i.src).split('/').slice(-2).join('/')+' lazy='+i.loading));
console.log('incomplete',r.length,r.slice(0,10));await b.close();})();
