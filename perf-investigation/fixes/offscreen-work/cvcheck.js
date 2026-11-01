const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const fs=require('fs');
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const widths=process.argv[3].split(',');
const name=process.argv[4];
(async()=>{
 const b=await puppeteer.launch({headless:'new'});
 const measure=async(v,w,h)=>{
   const {p}=await openPage(b,v,{throttle:1});
   const mobile=w<768;
   await p.setViewport({width:w,height:h,isMobile:mobile,hasTouch:mobile});
   await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});
   await p.evaluate(async()=>{await document.fonts.ready});
   await w8(1200);
   const m=()=>p.evaluate(()=>['work','about','process','trust','pricing','contact'].map(id=>{const s=document.getElementById(id);const c=s.firstElementChild;return Math.round(s.getBoundingClientRect().height)+(c&&!c.checkVisibility({contentVisibilityAuto:true})?'s':'')}).join(' ')+' | H='+document.documentElement.scrollHeight);
   const atRest=await m();
   // scroll through like a user
   const H=await p.evaluate(()=>document.documentElement.scrollHeight);
   for(let y=0;y<=H;y+=Math.round(h*0.6)){await p.evaluate(y=>window.scrollTo(0,y),y);await w8(120);}
   await w8(500);
   const after=await m();
   await p.close();
   return {atRest,after};
 };
 for(const wh of widths){
   const [w,h]=wh.split('x').map(Number);
   const base=await measure(vs[0],w,h);
   const v=vs.find(x=>x.name===name);
   const r=await measure(v,w,h);
   console.log([wh, '  BASE rest  '+base.atRest, '  BASE after '+base.after, '  VAR rest   '+r.atRest, '  VAR after  '+r.after].join('\n'));
 }
 await b.close();
})();
