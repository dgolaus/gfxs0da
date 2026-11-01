const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const S='fixes/loading/';
const V=__dirname.split(String.fromCharCode(92)).join('/')+'/';
const on={'/boot.css':V+'boot.splashon.css'};
const all={baseline:{...on},early:{...on,'/index.html':S+'index.earlyready.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'},
 cssom:{...on,'/index.html':V+'index.cssom.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'}};
const PRE=function(){try{localStorage.setItem('s0da-lite','0')}catch(e){}
window.__log=[];const L=(k)=>window.__log.push(k+'@'+Math.round(performance.now()));
const _a=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(document.body&&this===document.body.classList&&c.includes('ready'))L('ready('+(document.currentScript?(document.currentScript.src?'boot':'inline'):'timer')+')');return _a.apply(this,c);};
const _st=window.setTimeout;window.setTimeout=function(f,d,...a){if(d===180)L('armed');return _st.call(this,f,d,...a);};
document.addEventListener('DOMContentLoaded',()=>L('DCL'));
window.addEventListener('load',()=>{const b=document.getElementById('boot');L('boot.display='+getComputedStyle(b).display+' paused-hero='+getComputedStyle(document.querySelector('.hero-inner')).animationPlayState)});};
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const nm of Object.keys(all)){const p=await b.newPage();await p.setViewport({width:1440,height:900});
await require('./serve.js').attach(p,all[nm]);await p.evaluateOnNewDocument(PRE);
for(const visit of ['first','second']){
await p.goto('http://localhost:5173/',{waitUntil:'load'});
const mid=await p.evaluate(()=>({op:getComputedStyle(document.getElementById('boot')).opacity,ready:document.body.classList.contains('ready'),ctr:document.querySelector('.hero-stats-strip .counter').textContent}));
await new Promise(r=>setTimeout(r,3500));
const r=await p.evaluate(()=>({log:window.__log,ctr:[...document.querySelectorAll('.hero-stats-strip .counter')].map(e=>e.textContent).join(' '),bootDisp:document.getElementById('boot').style.display||getComputedStyle(document.getElementById('boot')).display,noboot:document.documentElement.classList.contains('no-boot')}));
console.log(nm.padEnd(8),visit.padEnd(6),'atLoad:',JSON.stringify(mid),'|',r.log.join(' '),'| final',r.ctr,'boot',r.bootDisp,'noboot',r.noboot);}
await p.close();}
await b.close();})();
