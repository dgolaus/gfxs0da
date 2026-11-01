const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openPage}=require('./bench.js');const vs=JSON.parse(fs.readFileSync('variants.json','utf8'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({headless:'new'});const res={};
for(let r=0;r<6;r++)for(const v of vs){const {p}=await openPage(b,v,{throttle:+(process.argv[2]||1)});await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await w8(2500);
 const geo=await p.evaluate(()=>Object.fromEntries(['about','process'].map(id=>[id,document.getElementById(id).getBoundingClientRect().bottom+scrollY])));
 const out=[];for(const [id,f] of [['about',0.15],['about',0.5],['about',0.85],['about',1],['process',0.15],['process',0.5],['process',0.85]]){
 const y=Math.round(geo[id]-0.3*900*(1-f));
 await p.evaluate(y=>{if(window.lenis)lenis.scrollTo(y,{immediate:true});else scrollTo(0,y);},y);await w8(900);
 out.push(id+f+'='+await p.evaluate(id=>document.getElementById(id).style.getPropertyValue('--leave'),id));}
 (res[v.name]=res[v.name]||[]).push(out.join(' '));await p.close();}
console.log(JSON.stringify(res,null,1));await b.close();})();
