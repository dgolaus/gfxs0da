const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openDisk}=require('./diskopen.js');
(async()=>{const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const N=+process.argv[3]||6;const thr=+process.argv[4]||1;
 const b=await puppeteer.launch({headless:'new'});const res={};
 for(let r=0;r<N;r++)for(const v of vs){const {p}=await openDisk(b,v,{throttle:thr});await p.goto('http://localhost:5173/',{waitUntil:'load'});
  await p.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,1500));
  const w=await p.evaluate(()=>getComputedStyle(document.querySelector('.hero-title')).maxWidth);
  (res[v.name]=res[v.name]||[]).push(w);await p.close();}
 for(const [k,a] of Object.entries(res))console.log(k.padEnd(14),'stale(920) in',a.filter(x=>x!=='1048.44px').length,'of',a.length);
 await b.close();})();
