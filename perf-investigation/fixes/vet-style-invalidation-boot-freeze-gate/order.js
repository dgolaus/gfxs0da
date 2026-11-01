/* When do .tcols/.hero-bg get is-paused vs when body.ready is added? and which anims are paused right before ready */
const path=require('path');const fs=require('fs');
const {openPage}=require('./bench.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const HOOK=`(()=>{window.__ev=[];const add=DOMTokenList.prototype.add, tog=DOMTokenList.prototype.toggle;
 const snap=(lbl)=>{try{const an=document.getAnimations();const paused=an.filter(a=>a.playState==='paused').map(a=>(a.effect&&a.effect.target&&(a.effect.target.className||a.effect.target.tagName))+'|'+a.animationName);window.__ev.push({t:performance.now(),lbl,html:document.documentElement.className,n:an.length,paused});}catch(e){window.__ev.push({t:performance.now(),lbl,err:String(e)})}};
 window.__snap=snap;
 DOMTokenList.prototype.add=function(...c){ if(document.body&&this===document.body.classList&&c.includes('ready')){snap('before-ready');const r=add.apply(this,c);snap('after-ready');return r;} return add.apply(this,c);};
 DOMTokenList.prototype.toggle=function(c,f){const r=tog.apply(this,arguments); if(c==='is-paused'){window.__ev.push({t:performance.now(),lbl:'is-paused '+(this.value||'').split(' ')[0]+' '+r});} return r;};
})();`;
(async()=>{const vs=JSON.parse(fs.readFileSync(path.join(__dirname,'variants.json'),'utf8'));
 const b=await puppeteer.launch({headless:'new'});
 for(const hash of ['', '#trust', '#pricing']) for(const thr of [1,4]) for(const v of vs){
  const vv=Object.assign({},v,{js:HOOK});
  const {p}=await openPage(b,vv,{throttle:thr});
  await p.goto('http://localhost:5173/'+hash,{waitUntil:'load'});await new Promise(r=>setTimeout(r,2500));
  const ev=await p.evaluate(()=>{window.__snap('t+2.5s');return window.__ev;});
  console.log('==',hash||'/', 'cpu'+thr, v.name);
  for(const e of ev){ if(e.paused) console.log('  ',e.t.toFixed(0),e.lbl,'html="'+e.html+'"','anims',e.n,'paused',e.paused.length, e.paused.slice(0,8).join(', ')); else console.log('  ',e.t.toFixed(0),e.lbl,e.err||''); }
  await p.close();}
 await b.close();})();
