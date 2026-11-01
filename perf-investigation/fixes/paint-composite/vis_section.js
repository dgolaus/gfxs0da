// Identity check for below-the-fold changes: scroll a section into view, let reveal transitions start,
// freeze every animation/transition at time t, screenshot; optional hover on a selector first.
const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const sharp=require(path.join('../node_modules/sharp'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
async function shot(browser,v,cs,file){
  const {p}=await openPage(browser,v,{throttle:1});
  await p.setViewport({width:cs.w,height:cs.h});
  await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});
  await p.evaluate(async()=>{if(document.fonts)await document.fonts.ready;});
  await p.evaluate((sel,off)=>{ if(window.lenis) window.lenis.stop(); const el=document.querySelector(sel); const y=el.getBoundingClientRect().top+window.scrollY+off; document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0,y); },cs.sel,cs.off||0);
  if(cs.waitSel){ await p.waitForSelector(cs.waitSel,{timeout:10000}); await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))); }
  await w8(cs.settle||1500);
  if(!cs.waitSel) await p.evaluate(async()=>{await Promise.race([Promise.all([...document.images].filter(i=>!i.complete&&i.getBoundingClientRect().top<innerHeight*2&&i.getBoundingClientRect().bottom>-innerHeight).map(i=>new Promise(r=>{i.onload=i.onerror=r}))),new Promise(r=>setTimeout(r,3000))]);});
  if(cs.hover){ await p.hover(cs.hover); await w8(900); }
  await p.evaluate((t)=>{document.querySelectorAll('.counter').forEach(el=>{const v=parseFloat(el.dataset.value),d=parseInt(el.dataset.decimals||'0',10);el.textContent=`${el.dataset.prefix||''}${v.toFixed(d)}${el.dataset.suffix||''}`;});for(const a of document.getAnimations()){try{a.pause(); if(t!=null) a.currentTime=t;}catch(e){}}},cs.t);
  await w8(300);
  await p.screenshot({path:file});
  await p.close();
}
async function diff(a,b,heat,band){const crop=x=>band?sharp(x).extract({left:0,top:band[0],width:1440>0?undefined:0,height:band[1]-band[0]}):sharp(x);const A=await sharp(a).ensureAlpha().raw().toBuffer({resolveWithObject:true});const B=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(A.info.width!==B.info.width||A.info.height!==B.info.height)return{error:'size'};const n=A.info.width*A.info.height;let s=0,c=0,big=0;const H=Buffer.alloc(n*3);let minY=1e9,maxY=-1;for(let i=0;i<n;i++){const o=i*4;const d=(Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2]))/3;s+=d;if(d>8){c++;const y=Math.floor(i/A.info.width);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(d>32)big++;H[i*3]=Math.min(255,d*4);}if(heat)await sharp(H,{raw:{width:A.info.width,height:A.info.height,channels:3}}).png().toFile(heat);return {meanAbsDiff:+(s/n).toFixed(3),pctChanged:+(c/n*100).toFixed(3),pctBig:+(big/n*100).toFixed(3),rows:c?minY+'-'+maxY:''};}
(async()=>{
  const [vfile,casesFile,...names]=process.argv.slice(2);
  const variants=JSON.parse(fs.readFileSync(vfile,'utf8'));
  const cases=JSON.parse(fs.readFileSync(casesFile,'utf8'));
  const base=variants.find(v=>v.name==='baseline');
  const browser=await puppeteer.launch({headless:'new'});
  for(const cs of cases){
    const bf=`vs_base_${cs.tag}.png`,bf2=`vs_base2_${cs.tag}.png`;
    await shot(browser,base,cs,bf);await shot(browser,base,cs,bf2);
    const out={noise:await diff(bf,bf2)};
    for(const n of names){const v=variants.find(x=>x.name===n);const f=`vs_${n}_${cs.tag}.png`;await shot(browser,v,cs,f);out[n]=await diff(bf,f,`vs_${n}_${cs.tag}_heat.png`);}
    console.log(cs.tag.padEnd(22)+JSON.stringify(out));
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
