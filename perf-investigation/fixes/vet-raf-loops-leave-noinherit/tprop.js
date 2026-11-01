const path=require('path');const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openPage}=require('./bench.js');const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const [u,vp] of [['http://localhost:5173/',{width:1440,height:900}],['http://localhost:5173/',{width:390,height:844,isMobile:true,hasTouch:true}],['http://localhost:5173/tos/',{width:1440,height:900}]]){
const {p}=await openPage(b,{name:'variant',files:{'/styles.css':path.join(__dirname,'styles.variant.css')}},{throttle:1});await p.setViewport(vp);await p.goto(u,{waitUntil:'networkidle2'});await w8(1500);
console.log(u,vp.width,JSON.stringify(await p.evaluate(()=>({secs:[...document.querySelectorAll('.scroll-fade')].map(s=>s.id+':'+getComputedStyle(s).transitionProperty+'|anim='+getComputedStyle(s).animationName),
 allTransitionAllInsideFade:[...document.querySelectorAll('.scroll-fade *')].filter(e=>getComputedStyle(e).transitionProperty.split(',').map(x=>x.trim()).includes('all')).length,
 leaveAnimsOrTransitions:document.getAnimations().filter(a=>(a.transitionProperty||'')==='--leave').length}))));await p.close();}
await b.close();})();
