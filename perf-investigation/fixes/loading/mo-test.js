const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();
await p.setContent('<body class="a ready"><div></div></body>');
const r=await p.evaluate(async()=>{let n=0;const o=new MutationObserver(m=>{n+=m.length});o.observe(document.body,{attributes:true,attributeFilter:['class']});document.body.classList.add('ready');await Promise.resolve();await new Promise(r=>setTimeout(r,10));return {n, cls:document.body.className, ua:navigator.userAgent};});
console.log(r);await b.close();})();
