// Exact-pixel identity checks for below-the-fold areas affected by #pricing{contain:paint} and pulse rings.
const path=require('path');const fs=require('fs');
const { openPage } = require('../../bench.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const sharp=require(path.join('../node_modules/sharp'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
const OUT=__dirname;
async function shot(browser,v,cs,file){
  const {p}=await openPage(browser,v,{throttle:1});
  await p.setViewport({width:cs.w,height:cs.h});
  if(cs.reduced) await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await p.goto('http://localhost:5173/'+(cs.hash||''),{waitUntil:'networkidle2'});
  await p.evaluate(async()=>{if(document.fonts)await document.fonts.ready;});
  if(cs.sel){
    await p.evaluate((sel,anchor,at)=>{ if(window.lenis) window.lenis.stop(); const el=document.querySelector(sel); const r=el.getBoundingClientRect(); const docY=(anchor==='bottom'?r.bottom:r.top)+window.scrollY; document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0,Math.round(docY-at)); },cs.sel,cs.anchor||'top',cs.at||0);
  }
  await w8(cs.settle||1800);
  await p.evaluate(async()=>{await Promise.race([Promise.all([...document.images].filter(i=>!i.complete&&i.getBoundingClientRect().top<innerHeight*2&&i.getBoundingClientRect().bottom>-innerHeight).map(i=>new Promise(r=>{i.onload=i.onerror=r}))),new Promise(r=>setTimeout(r,3000))]);});
  if(cs.hover){ await p.hover(cs.hover); await w8(900); }
  if(cs.retrigger){ // re-run the section-head reveal transition from scratch, then freeze at retrigger ms
    await p.evaluate((sel)=>{const el=document.querySelector(sel); el.classList.remove('is-in'); el.style.transition='none'; void el.offsetWidth; el.style.transition=''; void el.offsetWidth; el.classList.add('is-in');},cs.retriggerSel);
    await w8(30);
  }
  const info=await p.evaluate((t)=>{document.querySelectorAll('.counter').forEach(el=>{const v=parseFloat(el.dataset.value),d=parseInt(el.dataset.decimals||'0',10);el.textContent=`${el.dataset.prefix||''}${v.toFixed(d)}${el.dataset.suffix||''}`;});
    for(const a of document.getAnimations()){try{a.pause(); if(t!=null){ if(a instanceof CSSTransition) {} else a.currentTime=t;}}catch(e){}}
    const pr=document.getElementById('pricing').getBoundingClientRect(); return {prTop:pr.top,prBottom:pr.bottom,scrollY:window.scrollY,docH:document.documentElement.scrollHeight};},cs.t);
  if(cs.trans!=null){ await p.evaluate((tt)=>{for(const a of document.getAnimations()){ if(a instanceof CSSTransition){ try{a.pause(); a.currentTime=tt;}catch(e){} } }},cs.trans); }
  await w8(300);
  await p.screenshot({path:file});
  await p.close();
  return info;
}
async function diff(a,b,heat){const A=await sharp(a).ensureAlpha().raw().toBuffer({resolveWithObject:true});const B=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(A.info.width!==B.info.width||A.info.height!==B.info.height)return{error:'size'};const W=A.info.width,n=W*A.info.height;let any=0,max=0,gt8=0;let y0=1e9,y1=-1,x0=1e9,x1=-1;const H=Buffer.alloc(n*3);for(let i=0;i<n;i++){const o=i*4;const d=Math.max(Math.abs(A.data[o]-B.data[o]),Math.abs(A.data[o+1]-B.data[o+1]),Math.abs(A.data[o+2]-B.data[o+2]));if(d>0){any++;const y=Math.floor(i/W),x=i%W;y0=Math.min(y0,y);y1=Math.max(y1,y);x0=Math.min(x0,x);x1=Math.max(x1,x);}if(d>8)gt8++;if(d>max)max=d;H[i*3]=d?Math.min(255,60+d*20):0;}if(heat&&any)await sharp(H,{raw:{width:W,height:A.info.height,channels:3}}).png().toFile(heat);return {anyDiffPx:any,maxDiff:max,gt8,box:any?`x${x0}-${x1} y${y0}-${y1}`:''};}
(async()=>{
  const [vfile,casesFile]=process.argv.slice(2);
  const variants=JSON.parse(fs.readFileSync(vfile,'utf8'));
  const cases=JSON.parse(fs.readFileSync(casesFile,'utf8'));
  const base=variants.find(v=>v.name==='baseline');
  const browser=await puppeteer.launch({headless:'new'});
  for(const cs of cases){
    const bf=path.join(OUT,`b1_${cs.tag}.png`),bf2=path.join(OUT,`b2_${cs.tag}.png`);
    const i1=await shot(browser,base,cs,bf);await shot(browser,base,cs,bf2);
    const out={geom:i1,noise:await diff(bf,bf2)};
    for(const v of variants){ if(v.name==='baseline')continue; const f=path.join(OUT,`v_${v.name}_${cs.tag}.png`); out.vgeom=await shot(browser,v,cs,f); out[v.name]=await diff(bf,f,path.join(OUT,`h_${v.name}_${cs.tag}.png`)); }
    console.log(cs.tag.padEnd(18)+JSON.stringify(out));
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
