const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const S='fixes/loading/';
const variants=[{name:'baseline'},{name:'early',files:{'/index.html':S+'index.earlyready.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'}}];
const thr=+(process.argv[2]||1);
const PRE=function(){try{localStorage.setItem('s0da-lite','0')}catch(e){}
Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});
window.__log=[];const L=(k)=>window.__log.push([k,+performance.now().toFixed(1)]);
const _add=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(document.body&&this===document.body.classList&&c.includes('ready'))L('add-ready '+(document.currentScript&&document.currentScript.src?'boot':'inline'));if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}return _add.apply(this,c);};
let n=0;const rf=()=>{if(n<4){n++;L('raf#'+n+' els='+document.getElementsByTagName('*').length+' hero='+!!document.querySelector('.hero-inner')+' rdy='+(document.body&&document.body.classList.contains('ready')));requestAnimationFrame(rf);}};requestAnimationFrame(rf);
let seen=0;new MutationObserver(()=>{if(!seen&&document.querySelector('.hero-inner')){seen=1;L('hero-inner parsed');}}).observe(document,{childList:true,subtree:true});
try{new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__log.push([e.name,+e.startTime.toFixed(1)]))).observe({type:'paint',buffered:true});}catch(e){}
document.addEventListener('DOMContentLoaded',()=>L('DCL'));};
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(let rep=0;rep<3;rep++)for(const v of variants){const p=await b.newPage();await p.setViewport({width:1440,height:900});
const c=await p.target().createCDPSession();if(thr>1)await c.send('Emulation.setCPUThrottlingRate',{rate:thr});
await require('./serve.js').attach(p,v.files);await p.evaluateOnNewDocument(PRE);
await p.goto('http://localhost:5173/',{waitUntil:'load'});await new Promise(r=>setTimeout(r,800));
const log=(await p.evaluate(()=>window.__log.concat(performance.getEntriesByType('resource').filter(e=>/boot.css|styles.css|css2/.test(e.name)).map(e=>[e.name.split('/').pop().slice(0,12)+' end',+e.responseEnd.toFixed(1)])))).sort((a,b)=>a[1]-b[1]);
console.log(v.name.padEnd(9),log.map(([k,t])=>`${k}@${t.toFixed(0)}`).join(' | '));await p.close();}
await b.close();})();
