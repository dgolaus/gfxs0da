const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const S='fixes/loading/';
const V='fixes/vet-loading-early-ready/';
const all={baseline:{},early:{'/index.html':S+'index.earlyready.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'},
 noop:{'/index.html':V+'index.noop.html'},cssom:{'/index.html':V+'index.cssom.html','/boot.js':V+'boot.js','/script.js':V+'script.earlyready.js'},nogcs:{'/index.html':V+'index.nogcs.html'},static:{'/index.html':V+'index.staticready.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'}};
const names=(process.argv[3]||'baseline,early,noop,nogcs,static').split(',');const thr=+(process.argv[2]||1);const reps=+(process.argv[4]||4);
const PRE=function(){try{localStorage.setItem('s0da-lite','0')}catch(e){}
const _a=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(document.body&&this===document.body.classList&&c.includes('ready')&&!window.__r.inl)window.__r.inl=document.getElementsByTagName('*').length;return _a.apply(this,c);};
Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});
window.__r={frames:[]};const els=()=>document.getElementsByTagName('*').length;
let n=0;const rf=(t)=>{window.__r.frames.push([+performance.now().toFixed(0),els(),!!document.querySelector('.hero-inner')]);if(++n<40)requestAnimationFrame(rf);};requestAnimationFrame(rf);
let seen=0;new MutationObserver(()=>{if(!seen&&document.querySelector('.hero-inner')){seen=1;window.__r.hero=+performance.now().toFixed(0);}}).observe(document,{childList:true,subtree:true});
try{new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(e.name==='first-paint')window.__r.fp=+e.startTime.toFixed(0)})).observe({type:'paint',buffered:true});}catch(e){}};
(async()=>{const b=await puppeteer.launch({headless:'new'});const agg={};
for(let rep=0;rep<reps;rep++)for(const nm of names){const p=await b.newPage();await p.setViewport({width:1440,height:900});
const c=await p.target().createCDPSession();if(thr>1)await c.send('Emulation.setCPUThrottlingRate',{rate:thr});
await require('./serve.js').attach(p,all[nm]);await p.evaluateOnNewDocument(PRE);
await p.goto('http://localhost:5173/',{waitUntil:'load'});await new Promise(r=>setTimeout(r,300));
const r=await p.evaluate(()=>window.__r);
const before=r.frames.filter(f=>!f[2]&&f[0]>=r.fp-1).length; // frames after first paint w/o hero
const fpBeforeHero=r.fp<r.hero;
(agg[nm]=agg[nm]||[]).push(fpBeforeHero);
console.log(nm.padEnd(8),`inl=${r.inl} fp=${r.fp} hero=${r.hero} fpBeforeHero=${fpBeforeHero} frames:`,r.frames.slice(0,6).map(f=>f[0]+':'+f[1]+(f[2]?'H':'')).join(' '));await p.close();}
console.log(Object.entries(agg).map(([k,v])=>k+' fpBeforeHero '+v.filter(Boolean).length+'/'+v.length).join(' | '));
await b.close();})();
