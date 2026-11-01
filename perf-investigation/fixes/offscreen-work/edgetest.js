const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const fs=require('fs');const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const v of vs){const errs=[];const out=[];
 // reduced motion, desktop
 {const {p}=await openPage(b,v,{throttle:1});p.on('pageerror',e=>errs.push(e.message));await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await p.goto('http://localhost:5173/#pricing',{waitUntil:'load'});await w8(1500);
  out.push('RM hash#pricing '+await p.evaluate(()=>document.getElementById('pricing').getBoundingClientRect().top.toFixed(1)+'@'+Math.round(scrollY)));
  await p.evaluate(()=>scrollTo(0,0));await w8(300);
  await p.evaluate(()=>document.querySelector('.nav a[href="#trust"]').click());await w8(1200);
  out.push('RM click#trust '+await p.evaluate(()=>document.getElementById('trust').getBoundingClientRect().top.toFixed(1)+'@'+Math.round(scrollY)));
  out.push('RM tracks '+await p.evaluate(()=>[...document.querySelectorAll('.tcol-track')].map(t=>t.children.length).join('/')+' chat '+document.getElementById('chat-messages').children.length+' H '+document.documentElement.scrollHeight));
  await p.close();}
 // touch phone
 {const {p}=await openPage(b,v,{throttle:1});p.on('pageerror',e=>errs.push(e.message));await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await p.goto('http://localhost:5173/#pricing',{waitUntil:'load'});await w8(1500);
  out.push('TOUCH hash#pricing '+await p.evaluate(()=>document.getElementById('pricing').getBoundingClientRect().top.toFixed(1)+'@'+Math.round(scrollY)+' lenis='+!!window.lenis));
  await p.evaluate(()=>scrollTo(0,0));await w8(500);
  await p.evaluate(()=>{const a=document.querySelector('a[href="#trust"]');a.click();});await w8(1500);
  out.push('TOUCH click#trust '+await p.evaluate(()=>document.getElementById('trust').getBoundingClientRect().top.toFixed(1)+'@'+Math.round(scrollY)));
  await p.close();}
 console.log(v.name);out.forEach(x=>console.log('   ',x));console.log('    errors',errs.length?errs.join(';'):'none');}
await b.close();})();
