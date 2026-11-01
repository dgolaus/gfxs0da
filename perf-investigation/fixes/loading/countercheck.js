/* Checks that the hero count-up is armed at the same moment (relative to boot.js
   execution and to DOMContentLoaded) in baseline and variant. No throttling. */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const variants=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const PRE=function(){
try{localStorage.setItem('s0da-lite','0')}catch(e){}
window.__log=[];const L=(k)=>window.__log.push([k,+performance.now().toFixed(1)]);
const _add=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(document.body&&this===document.body.classList&&c.includes('ready')){const st=(new Error().stack||'').split(String.fromCharCode(10))[2]||'';L('body.add(ready) by '+st.slice(st.lastIndexOf('/')+1,st.lastIndexOf('/')+20));}if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}return _add.apply(this,c);};
const _st=window.setTimeout;window.setTimeout=function(f,d,...a){if(d===180)L('setTimeout(180) armed');return _st.call(this,f,d,...a);};
document.addEventListener('DOMContentLoaded',()=>L('DOMContentLoaded'));
new MutationObserver(()=>{const c=document.querySelector('.hero-stats-strip .counter');if(c&&c.textContent!=='0'&&!window.__cs){window.__cs=1;L('first counter text');}}).observe(document,{subtree:true,childList:true,characterData:true});
};
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  for(let rep=0;rep<2;rep++) for(const v of variants){
    const p=await b.newPage();await p.setViewport({width:1440,height:900});
    if(v.files){const map=Object.fromEntries(Object.entries(v.files).map(([k,f])=>[k,fs.readFileSync(f)]));
      const type=k=>k.endsWith('.js')?'application/javascript':k.endsWith('.css')?'text/css':'text/html; charset=utf-8';
      await p.setRequestInterception(true);
      p.on('request',req=>{const u=new URL(req.url());let k=u.pathname;if(k==='/'||k==='')k='/index.html';if(map[k]&&u.host.startsWith('localhost'))return req.respond({status:200,contentType:type(k),body:map[k]});req.continue();});}
    await p.evaluateOnNewDocument(PRE);
    await p.goto('http://localhost:5173/',{waitUntil:'load'});await new Promise(r=>setTimeout(r,1500));
    const log=await p.evaluate(()=>window.__log);
    const ref=(log.find(x=>x[0]==='DOMContentLoaded')||[0,0])[1];
    console.log(v.name.padEnd(18),log.map(([k,t])=>`${k} @${(t-ref).toFixed(1)}`).join(' | '));
    await p.close();
  }
  await b.close();
})();
