const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();await p.setViewport({width:1440,height:900});
await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1500));
const r=await p.evaluate(()=>[...document.querySelectorAll('.hero-title .accent, .process-text h2 .accent-soft')].map(el=>({inline:el.style.backgroundImage.slice(0,60),computed:getComputedStyle(el).backgroundImage.slice(0,60),child:getComputedStyle(el.querySelector(':scope > .accent-text')).backgroundImage.slice(0,60)})));
console.log(JSON.stringify(r,null,1));
const v=await p.evaluate(()=>({root:document.documentElement.getAttribute('style'),secs:['about','process','trust','pricing','contact'].map(id=>{const e=document.getElementById(id);return e&&e.getAttribute('style')}),foot:document.querySelector('.cfooter').getAttribute('style')}));
console.log(JSON.stringify(v));
await b.close();})();
