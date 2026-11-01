const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openPage}=require('./bench.js');const vs=JSON.parse(fs.readFileSync('variants.json','utf8'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({headless:'new'});const res={};
for(let r=0;r<6;r++)for(const v of vs){const {p}=await openPage(b,v,{throttle:1});await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await w8(2500);
 const out=[];for(const [id,f] of [['about',0.15],['about',0.5],['about',0.85],['process',0.5],['process',0.85]]){
 const y=await p.evaluate((id,f)=>{const s=document.getElementById(id);return Math.round(s.getBoundingClientRect().bottom+scrollY-0.3*innerHeight*(1-f));},id,f);
 await p.evaluate(y=>{if(window.lenis)lenis.scrollTo(y,{immediate:true});else scrollTo(0,y);},y);await w8(900);
 out.push(id+'='+await p.evaluate(id=>document.getElementById(id).style.getPropertyValue('--leave'),id));}
 (res[v.name]=res[v.name]||[]).push(out.join(' '));await p.close();}
console.log(JSON.stringify(res,null,1));await b.close();})();
