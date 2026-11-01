const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const fs=require('fs');const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const v of vs){const errs=[];const {p}=await openPage(b,v,{throttle:1});
p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5173/tos/',{waitUntil:'load'});await p.waitForFunction(()=>!!window.lenis,{timeout:15000}).catch(()=>{});await w8(500);
const r=[];
for(const id of ['refunds','pricing','general']){await p.evaluate(id=>{const a=document.querySelector('#toc-list a[href="#'+id+'"]')||document.querySelector('a[href="#'+id+'"]');a&&a.click();},id);await w8(2200);
r.push(id+':'+await p.evaluate(id=>{const e=document.getElementById(id);const act=document.querySelector('#toc-list li.is-active');return e.getBoundingClientRect().top.toFixed(1)+'@'+Math.round(scrollY)+' active='+(act?act.textContent.trim().slice(0,18):'-')+' cv='+getComputedStyle(e).contentVisibility},id));}
const h=await p.evaluate(()=>({tosPricingCV:getComputedStyle(document.getElementById('pricing')).contentVisibility,settle:typeof window.__cvSettle}));
console.log(v.name.padEnd(30),r.join(' | '),JSON.stringify(h),'errors:',errs.length?errs.join(';'):'none');await p.close();}
await b.close();})();
