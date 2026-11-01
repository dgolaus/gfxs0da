const puppeteer=require('../node_modules/puppeteer');
const fs=require('fs');
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const PRE=`try{localStorage.setItem('s0da-lite','0')}catch(e){};Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});
const add=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}return add.apply(this,c)};`;
(async()=>{
  const widths=(process.argv[2]).split(',');
  const variantFile=process.argv[3];
  const v=variantFile?JSON.parse(fs.readFileSync(variantFile,'utf8')):{};
  const b=await puppeteer.launch({headless:'new'});
  const rows=[];
  for(const wh of widths){
    const [w,h]=wh.split('x').map(Number);
    const p=await b.newPage();
    const mobile=w<768;
    await p.setViewport({width:w,height:h,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
    await p.evaluateOnNewDocument(PRE);
    if(v.js) await p.evaluateOnNewDocument(v.js);
    if(v.css) await p.evaluateOnNewDocument((css)=>{document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);});},v.css);
    await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});
    await p.evaluate(async()=>{await document.fonts.ready;});
    await w8(1500);
    const r=await p.evaluate(()=>{
      const o={};
      for(const id of ['work','about','process','trust','pricing','contact']){
        const s=document.getElementById(id);const cs=getComputedStyle(s);
        const H=s.getBoundingClientRect().height;
        o[id]={border:+H.toFixed(1),content:+(H-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)).toFixed(1),pad:cs.paddingTop+'/'+cs.paddingBottom, top:Math.round(s.getBoundingClientRect().top+scrollY)};
      }
      o.scrollHeight=document.documentElement.scrollHeight;
      o.hoverNone=matchMedia('(hover: none)').matches;
      return o;
    });
    rows.push([wh,r]);
    console.log(wh,'scrollH',r.scrollHeight,'hoverNone',r.hoverNone,Object.entries(r).filter(([k])=>!['scrollHeight','hoverNone'].includes(k)).map(([k,x])=>`${k}:${x.content}(+${x.pad})@${x.top}`).join('  '));
    await p.close();
  }
  await b.close();
})();
