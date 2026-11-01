const path=require('path');
const puppeteer=require('../node_modules/puppeteer');
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const PRE=`try{localStorage.setItem('s0da-lite','0')}catch(e){};Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});
const add=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}return add.apply(this,c)};`;
(async()=>{
  const widths=(process.argv[2]||'1440x900').split(',');
  const css=process.argv[3]||'';
  const b=await puppeteer.launch({headless:'new'});
  for(const wh of widths){
    const [w,h]=wh.split('x').map(Number);
    const p=await b.newPage();
    const mobile=w<768;
    await p.setViewport({width:w,height:h,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
    await p.evaluateOnNewDocument(PRE);
    if(css) await p.evaluateOnNewDocument((css)=>{document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);});},css);
    await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});
    await p.evaluate(async()=>{await document.fonts.ready;});
    await w8(2500);
    const r=await p.evaluate(()=>{
      const out={};
      const sels=['#top','#work','#about','#process','#trust','#pricing','#contact','main','.section-rule'];
      for(const s of document.querySelectorAll('main > *, #contact')){const rc=s.getBoundingClientRect();out[(s.id?'#'+s.id:'.'+s.className.split(' ')[0])+'@'+Math.round(rc.top+scrollY)]=Math.round(rc.height*100)/100;}
      out.scrollHeight=document.documentElement.scrollHeight;
      // animations
      const anims={};
      for(const a of document.getAnimations()){const t=a.effect&&a.effect.target; if(!t)continue; const sec=t.closest&&(t.closest('section,#contact,.site-bg,.nav,#boot,.rail,body > *'));const k=(sec?(sec.id||sec.className.split(' ')[0]):'?')+' | '+(a.animationName||a.transitionProperty||'anim')+' | '+a.playState;anims[k]=(anims[k]||0)+1;}
      out.anims=anims;
      out.elements=document.querySelectorAll('*').length;
      const perSec={};for(const s of document.querySelectorAll('main > section, #contact')) perSec[s.id]=s.querySelectorAll('*').length;
      out.perSec=perSec;
      return out;
    });
    console.log(wh, JSON.stringify(r,null,1));
    await p.close();
  }
  await b.close();
})();
