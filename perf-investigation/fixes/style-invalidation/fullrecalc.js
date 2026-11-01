/* cost of one full-document style recalc (same DOM), baseline vs variants; isolates selector-matching cost */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openDisk}=require('./diskopen.js');
(async()=>{const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const b=await puppeteer.launch({headless:'new'});const pages=[];
 for(const v of vs){const {p}=await openDisk(b,v,{throttle:1});await p.goto('http://localhost:5173/',{waitUntil:'load'});await new Promise(r=>setTimeout(r,1500));
   await p.evaluate(()=>{document.getAnimations().forEach(a=>a.pause());});pages.push([v.name,p]);}
 const res={};
 for(let r=0;r<6;r++)for(const [n,p] of pages){
   const t=await p.evaluate(()=>{const ts=[];for(let i=0;i<15;i++){document.documentElement.style.setProperty('--probe',String(i+Math.random()));const t0=performance.now();document.body.offsetTop;ts.push(performance.now()-t0);}ts.sort((a,b)=>a-b);return ts[7];});
   (res[n]=res[n]||[]).push(t);}
 for(const [n,a] of Object.entries(res)){a.sort((x,y)=>x-y);console.log(n.padEnd(40),'full recalc median ms (1x):',a[a.length>>1].toFixed(2),' all:',a.map(x=>x.toFixed(1)).join(' '));}
 await b.close();})();
