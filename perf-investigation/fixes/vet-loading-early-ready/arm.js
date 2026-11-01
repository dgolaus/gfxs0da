const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const S='fixes/loading/';
const variants=[{name:'baseline'},{name:'early',files:{'/index.html':S+'index.earlyready.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'}}];
const thr=+(process.argv[2]||1);
const PRE=function(){try{localStorage.setItem('s0da-lite','0')}catch(e){}
window.__log=[];const L=(k)=>window.__log.push([k,performance.now()]);
const _add=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(document.body&&this===document.body.classList&&c.includes('ready'))L(document.currentScript?('add@'+(document.currentScript.src||'inline').split('/').pop()):'add');if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}return _add.apply(this,c);};
const _st=window.setTimeout;window.setTimeout=function(f,d,...a){if(d===180)L('armed');return _st.call(this,f,d,...a);};
let first=0;const _raf=window.requestAnimationFrame;
document.addEventListener('DOMContentLoaded',()=>L('DCL'));
new MutationObserver(()=>{const c=document.querySelector('.hero-stats-strip .counter');if(c&&c.textContent!=='0'&&!first){first=1;L('count');}}).observe(document,{subtree:true,childList:true,characterData:true});};
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(let rep=0;rep<3;rep++)for(const v of variants){const p=await b.newPage();await p.setViewport({width:1440,height:900});
const c=await p.target().createCDPSession();if(thr>1)await c.send('Emulation.setCPUThrottlingRate',{rate:thr});
await require('./serve.js').attach(p,v.files);await p.evaluateOnNewDocument(PRE);
await p.goto('http://localhost:5173/',{waitUntil:'load'});await new Promise(r=>setTimeout(r,1500));
const log=await p.evaluate(()=>window.__log);const boot=log.filter(x=>x[0].includes('boot.js')).pop();const ref=boot?boot[1]:0;
console.log(v.name.padEnd(9),log.map(([k,t])=>`${k} ${(t-ref).toFixed(1)}`).join(' | '));await p.close();}
await b.close();})();
