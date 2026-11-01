const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const S='fixes/loading/';
const variants=[{name:'baseline'},{name:'early',files:{'/index.html':S+'index.earlyready.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'}}];
const hash=process.argv[2]||'';const thr=+(process.argv[3]||1);
const PRE=function(){
try{localStorage.setItem('s0da-lite','0')}catch(e){}
Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});
window.__log=[];const L=(k)=>window.__log.push([k,+performance.now().toFixed(1)]);
const snap=()=>document.getAnimations().map(a=>{const t=a.effect&&a.effect.target;const n=t?(t.className&&t.className.baseVal===undefined?t.className:'')+'|'+(a.effect.pseudoElement||''):'';return [a.animationName||a.id,String(n).slice(0,40),a.playState];});
const _add=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){
 if(document.body&&this===document.body.classList&&c.includes('ready')){L('add(ready) had='+this.contains('ready'));
   const before=snap();const r=_add.apply(this,c);getComputedStyle(document.body).color;document.body.offsetTop;const after=snap();
   const ch=[];for(let i=0;i<Math.min(before.length,after.length);i++){if(before[i][2]!==after[i][2])ch.push(before[i][0]+'@'+before[i][1]+':'+before[i][2]+'->'+after[i][2]);}
   window.__ch=(window.__ch||[]).concat([[before.length,after.length,ch]]);return r;}
 if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}
 if(c.includes('is-paused'))L('is-paused on '+(this.value||'').slice(0,20));
 return _add.apply(this,c);};
const _tg=DOMTokenList.prototype.toggle;DOMTokenList.prototype.toggle=function(n,f){if(n==='is-paused')L('toggle is-paused '+f);return _tg.apply(this,arguments);};
const _st=window.setTimeout;window.setTimeout=function(f,d,...a){if(d===180)L('armed180');return _st.call(this,f,d,...a);};
document.addEventListener('DOMContentLoaded',()=>L('DCL'));
};
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  for(let rep=0;rep<3;rep++) for(const v of variants){
    const p=await b.newPage();await p.setViewport({width:1440,height:900});
    const c=await p.target().createCDPSession(); if(thr>1) await c.send('Emulation.setCPUThrottlingRate',{rate:thr});
    await require('./serve.js').attach(p,v.files);
    await p.evaluateOnNewDocument(PRE);
    const t0=Date.now();
    await p.goto('http://localhost:5173/'+hash,{waitUntil:'domcontentloaded'});
    await new Promise(r=>setTimeout(r,Math.max(0,4000-(Date.now()-t0))));
    const r=await p.evaluate(()=>{
      const pick=(sel)=>[...document.querySelectorAll(sel)].map(e=>e.getAnimations().map(a=>a.animationName+':'+Math.round(a.currentTime)+':'+a.playState).join(',')).slice(0,3);
      return {log:window.__log,ch:window.__ch,tcol:pick('.tcol-track'),bg:pick('.bg-row-track').slice(0,1),tilt:pick('.hero-bg-tilt'),now:performance.now()|0,y:scrollY};
    });
    const ref=(r.log.find(x=>x[0]==='DCL')||[0,0])[1];
    console.log(`${v.name.padEnd(9)} rep${rep} y=${r.y} now=${r.now}`);
    console.log('   log:',r.log.map(([k,t])=>`${k}@${(t-ref).toFixed(0)}`).join(' | '));
    console.log('   playState changes at add(ready):',JSON.stringify(r.ch));
    console.log('   tcol:',r.tcol.join(' ; '));
    console.log('   bg/tilt:',r.bg.join(';'),'/',r.tilt.join(';'));
    await p.close();
  }
  await b.close();
})();
