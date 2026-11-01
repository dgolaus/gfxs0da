// Extra identity checks: mobile viewport and prefers-reduced-motion, frozen at fixed animation times.
const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const sharp=require(path.join('../node_modules/sharp'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
async function shot(browser,v,{w,h,reduced,t,scrollTo},file){
  const {p}=await openPage(browser,v,{throttle:1});
  await p.setViewport({width:w,height:h});
  if(reduced) await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await p.goto('http://localhost:5173/'+(v.path||''),{waitUntil:'networkidle2'});
  await p.evaluate(async()=>{await Promise.race([Promise.all([...document.images].filter(i=>!i.complete).map(i=>new Promise(r=>{i.onload=i.onerror=r}))),new Promise(r=>setTimeout(r,4000))]);if(document.fonts)await document.fonts.ready;});
  await w8(300);
  await p.evaluate((t)=>{document.querySelectorAll('.counter').forEach(el=>{const v=parseFloat(el.dataset.value),d=parseInt(el.dataset.decimals||'0',10);el.textContent=`${el.dataset.prefix||''}${v.toFixed(d)}${el.dataset.suffix||''}`;});const bg=document.querySelector('.hero-bg');if(bg)bg.style.translate='0px 0px';window.scrollTo(0,0);for(const a of document.getAnimations()){try{a.pause();a.currentTime=t;}catch(e){}}},t);
  await w8(250);
  await p.screenshot({path:file,clip:{x:0,y:0,width:w,height:h}});
  await p.close();
}
async function diff(a,b){const A=await sharp(a).ensureAlpha().raw().toBuffer({resolveWithObject:true});const B=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});const n=A.info.width*A.info.height;let s=0,c=0;for(let i=0;i<n;i++){const o=i*4;const d=(Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2]))/3;s+=d;if(d>8)c++;}return {meanAbsDiff:+(s/n).toFixed(3),pctChanged:+(c/n*100).toFixed(3)};}
(async()=>{
  const [vfile,...names]=process.argv.slice(2);
  const variants=JSON.parse(fs.readFileSync(vfile,'utf8'));
  const base=variants.find(v=>v.name==='baseline');
  const browser=await puppeteer.launch({headless:'new'});
  const cases=[{tag:'mobile390',w:390,h:844,t:500},{tag:'mobile390',w:390,h:844,t:5000},{tag:'reduced',w:1440,h:900,reduced:true,t:5000},{tag:'reduced',w:1440,h:900,reduced:true,t:100}];
  for(const cs of cases){
    const bf=`v2_base_${cs.tag}_${cs.t}.png`, bf2=`v2_base2_${cs.tag}_${cs.t}.png`;
    await shot(browser,base,cs,bf);await shot(browser,base,cs,bf2);
    const out={noise:await diff(bf,bf2)};
    for(const n of names){const v=variants.find(x=>x.name===n);const f=`v2_${n}_${cs.tag}_${cs.t}.png`;await shot(browser,v,cs,f);out[n]=await diff(bf,f);}
    console.log(cs.tag+' t='+cs.t+' '+JSON.stringify(out));
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
