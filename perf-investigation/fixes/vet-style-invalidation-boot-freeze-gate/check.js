/* Functional + computed-style equivalence: baseline vs freeze-gate, splash OFF and ON, on /, /tos/, /slots/, /404.html */
const path=require('path');const fs=require('fs');
const {openPage}=require('./bench.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const F='fixes/style-invalidation/';
const X=process.env.EXTRA_404?{'/404.html':process.env.EXTRA_404}:{};
const varFiles={'/boot.js':F+'boot.freezegate.js','/index.html':F+'index.freezegate.html','/tos/index.html':F+'tos.freezegate.html','/slots/index.html':F+'slots.freezegate.html',...X};
const V={
 baseOFF:{name:'baseOFF',files:{}},
 varOFF:{name:'varOFF',files:{...varFiles,'/boot.css':F+'boot.freezegate.css'}},
 baseOFF2:{name:'baseOFF2',files:{}},
 varOFF2:{name:'varOFF2',files:{...varFiles,'/boot.css':F+'boot.freezegate.css'}},
 baseON:{name:'baseON',files:{'/boot.css':F+'boot.ORIGINAL.ON.css'}},
 varON:{name:'varON',files:{...varFiles,'/boot.css':F+'boot.freezegate.ON.css'}},
};
const HOOK=`(()=>{window.__ev=[];const add=DOMTokenList.prototype.add;
 const ps=()=>{const an=document.getAnimations();let p=0,r=0;const pl=[];for(const a of an){if(a.playState==='paused'){p++;}else r++;}return {p,r,n:an.length};};
 window.__ps=ps;
 const t0=setInterval(()=>{if(performance.now()>600&&document.body){clearInterval(t0);window.__ev.push(['t600',document.documentElement.className,document.body.className,ps()]);}},20);
 DOMTokenList.prototype.add=function(...c){ if(document.body&&this===document.body.classList&&c.includes('ready')){window.__ev.push(['before-ready',document.documentElement.className,ps()]);const r=add.apply(this,c);window.__ev.push(['after-ready',document.documentElement.className,ps()]);return r;} return add.apply(this,c);};
})();`;
const SNAP=()=>{ // pause all at fixed time, then dump computed style of every element + pseudos
  for(const a of document.getAnimations()){try{a.pause();a.currentTime=5000;}catch(e){}}
  const out={};let i=0;
  const props=null;
  for(const el of document.querySelectorAll('*')){
    const key=(i++)+':'+el.tagName+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).slice(0,3).join('.'):'');
    for(const pe of [null,'::before','::after']){
      const cs=getComputedStyle(el,pe);
      if(pe&&cs.content==='none'&&cs.animationName==='none') {out[key+(pe||'')]=cs.animationPlayState; continue;}
      let s='';for(let k=0;k<cs.length;k++){const n=cs[k];s+=n+':'+cs.getPropertyValue(n)+';';}
      out[key+(pe||'')]=s;
    }
  }
  return {out,html:document.documentElement.className,body:document.body.className,sy:scrollY};
};
(async()=>{
 const b=await puppeteer.launch({headless:'new'});
 const pages=(process.env.PAGES||'/,/tos/,/slots/,/404.html,/#pricing,/#trust').split(',');
 const pairs=(process.env.PAIRS||'baseOFF:varOFF,baseON:varON').split(',').map(x=>x.split(':'));
 const vw=+(process.env.VW||1440),vh=+(process.env.VH||900);
 for(const pg of pages) for(const [a,bn] of pairs){
   const res={};
   for(const n of [a,bn]){
     const {p}=await openPage(b,Object.assign({},V[n],{js:HOOK}),{throttle:1});
     if(process.env.RM) await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
     if(vw!==1440) await p.setViewport({width:vw,height:vh,isMobile:vw<768,hasTouch:vw<768});
     await p.goto('http://localhost:5173'+pg,{waitUntil:'load'});await new Promise(r=>setTimeout(r,3000));
     const ev=await p.evaluate(()=>window.__ev);
     const visits=await p.evaluate(()=>[...document.querySelectorAll('[data-live]')].map(e=>e.dataset.live+'='+e.textContent.trim()).join(' | '));
     const snap=await p.evaluate(SNAP);
     // repeat view in same tab (sessionStorage persists)
     await p.goto('http://localhost:5173'+pg,{waitUntil:'load'});await new Promise(r=>setTimeout(r,1500));
     const ev2=await p.evaluate(()=>window.__ev);
     const snap2=await p.evaluate(SNAP);
     res[n]={ev,visits,snap,ev2,snap2};await p.close();
   }
   const A=res[a],B=res[bn];
   const toMap=(v)=>{const m=new Map();for(const kv of v.split(";")){const i=kv.indexOf(":");if(i>0)m.set(kv.slice(0,i),kv.slice(i+1));}return m;};
   const cmp=(x,y)=>{let d=[];for(const k of new Set([...Object.keys(x.out),...Object.keys(y.out)])){const X=x.out[k],Y=y.out[k];if(X===Y)continue;
      if(typeof X==="string"&&typeof Y==="string"&&X.includes(";")&&Y.includes(";")){const mx=toMap(X),my=toMap(Y);const dd=[];for(const p of new Set([...mx.keys(),...my.keys()]))if(mx.get(p)!==my.get(p))dd.push(p+": "+mx.get(p)+" => "+my.get(p));if(dd.length)d.push(k+" :: "+dd.slice(0,4).join(" , "));}
      else d.push(k+" :: "+String(X).slice(0,80)+" => "+String(Y).slice(0,80));}return d;};
   const d1=cmp(A.snap,B.snap),d2=cmp(A.snap2,B.snap2);
   console.log(`\n=== ${pg} ${a} vs ${bn} @${vw}x${vh}`);
   console.log(' first view html:',JSON.stringify(A.snap.html),'|',JSON.stringify(B.snap.html),' body:',JSON.stringify(A.snap.body),'|',JSON.stringify(B.snap.body),' scrollY',A.snap.sy,B.snap.sy);
   console.log(' events A:',JSON.stringify(A.ev));console.log(' events B:',JSON.stringify(B.ev));
   console.log(' visits A:',A.visits,'\n visits B:',B.visits);
   console.log(' computed-style diffs first view:',d1.length);d1.slice(0,12).forEach(x=>console.log('   ',x.slice(0,300)));
   console.log(' repeat html:',JSON.stringify(A.snap2.html),'|',JSON.stringify(B.snap2.html),' scrollY',A.snap2.sy,B.snap2.sy);
   console.log(' repeat events A:',JSON.stringify(A.ev2));console.log(' repeat events B:',JSON.stringify(B.ev2));
   console.log(' computed-style diffs repeat view:',d2.length);d2.slice(0,12).forEach(x=>console.log('   ',x.slice(0,300)));
 }
 await b.close();})();
