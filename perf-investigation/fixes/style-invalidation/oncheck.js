/* Splash-ON equivalence: animation-play-state of every element/pseudo before and after the reveal. */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openDisk}=require('./diskopen.js');
const F=__dirname.split(String.fromCharCode(92)).join('/');
async function run(b,v,pg){
  const {p}=await openDisk(b,v,{throttle:1});
  await p.goto('http://localhost:5173'+pg,{waitUntil:'domcontentloaded'});
  const dump=()=>p.evaluate(()=>{const r={};[...document.querySelectorAll('body *')].forEach((el,i)=>{for(const ps of ['','::before','::after']){const cs=getComputedStyle(el,ps||null);if(ps&&cs.content==='none')continue;r[i+el.tagName+ps]=cs.animationPlayState;}});return {r,html:document.documentElement.className,body:document.body.className,bootDisplay:getComputedStyle(document.getElementById('boot')).display};});
  const before=await dump();
  await p.waitForFunction(()=>document.body.classList.contains('ready'),{timeout:10000});
  await new Promise(r=>setTimeout(r,300));
  const after=await dump();
  // second view in the same tab session (sessionStorage now has the key)
  await p.reload({waitUntil:'domcontentloaded'});
  const repeat=await dump();
  await p.close();return {before,after,repeat};
}
const cmp=(A,B)=>{let n=0,ex=[];for(const k of new Set([...Object.keys(A.r),...Object.keys(B.r)]))if(A.r[k]!==B.r[k]){n++;if(ex.length<5)ex.push(k+':'+A.r[k]+'->'+B.r[k]);}return n+' diffs '+ex.join(', ')+' | html:"'+A.html+'" vs "'+B.html+'" body:"'+A.body+'" vs "'+B.body+'" boot:'+A.bootDisplay+'/'+B.bootDisplay;};
const summary=(X)=>{const c={};Object.values(X.r).forEach(v=>c[v]=(c[v]||0)+1);return JSON.stringify(c);};
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  for(const [pg,html] of [['/','index'],['/tos/','tos'],['/slots/','slots']]){
    const key=pg==='/'?'/index.html':pg+'index.html';
    const base={name:'orig-ON',files:{'/boot.css':F+'/boot.ORIGINAL.ON.css'}};
    const cand={name:'gate-ON',files:{'/boot.css':F+'/boot.freezegate.ON.css','/boot.js':F+'/boot.freezegate.js',[key]:F+'/'+html+'.freezegate.html'}};
    const A=await run(b,base,pg),B=await run(b,cand,pg);
    console.log(pg,'ON before-reveal   orig',summary(A.before),' gate',summary(B.before),'\n    ',cmp(A.before,B.before));
    console.log(pg,'ON after-reveal    orig',summary(A.after),' gate',summary(B.after),'\n    ',cmp(A.after,B.after));
    console.log(pg,'ON repeat-view     orig',summary(A.repeat),' gate',summary(B.repeat),'\n    ',cmp(A.repeat,B.repeat));
  }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
