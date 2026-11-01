/* Computed-style equivalence check (whole page, incl. ::before/::after, all elements, several scroll positions).
   usage: node equiv.js variants.json   (first variant = reference) */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openDisk}=require('./diskopen.js');
const PROPS=['border-radius','border-top-left-radius','box-sizing','opacity','filter','transform','translate','scale','rotate','padding-top','padding-bottom','padding-left','padding-right','animation-play-state','animation-name','visibility','display','width','height','background-image','backdrop-filter','z-index','pointer-events','color','content','will-change','transition-duration'];
const PAGES=['/','/tos/','/slots/'];
const SCROLLS=[0,120,240,400,1600,3200,5200,7000,99999];
async function dump(b,v,pg){
  const {p}=await openDisk(b,v,{throttle:1});
  await p.goto('http://localhost:5173'+pg,{waitUntil:'load'});
  await new Promise(r=>setTimeout(r,2500));
  const out={};
  for(const y of SCROLLS){
    await p.evaluate((y)=>{ if(window.lenis) window.lenis.scrollTo(Math.min(y,document.documentElement.scrollHeight),{immediate:true}); else window.scrollTo(0,y); window.dispatchEvent(new Event('scroll')); },y);
    await new Promise(r=>setTimeout(r,900));
    out[y]=await p.evaluate((PROPS)=>{
      for(const a of document.getAnimations()){try{a.pause();a.currentTime=4321;}catch(e){}}
      const res={};const els=[...document.querySelectorAll('body *')];
      els.forEach((el,i)=>{const id=i+':'+el.tagName+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).join('.'):'');
        for(const ps of ['',':: before'.replace(' ',''),'::after'].map((x,j)=>j===1?'::before':x)){const cs=getComputedStyle(el,ps||null);
          if(ps&&cs.content==='none')continue;
          res[id+ps]=PROPS.map(pr=>cs.getPropertyValue(pr)).join('|');}});
      for(const a of document.getAnimations()){try{a.play();}catch(e){}}
      return res;},PROPS);
  }
  await p.close();return out;
}
(async()=>{
  const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const b=await puppeteer.launch({headless:'new'});
  for(const pg of PAGES){
    const ref=await dump(b,vs[0],pg);
    for(const v of vs.slice(1)){
      const d=await dump(b,v,pg);let n=0,tot=0;const ex=[];
      for(const y of SCROLLS){const A=ref[y],B=d[y];
        const keys=new Set([...Object.keys(A),...Object.keys(B)]);
        for(const k of keys){tot++;if(A[k]!==B[k]){n++;if(ex.length<8){const a=(A[k]||'MISSING').split('|'),bb=(B[k]||'MISSING').split('|');const diffs=PROPS.map((pr,i)=>a[i]!==bb[i]?pr+': '+a[i]+' -> '+bb[i]:null).filter(Boolean);ex.push('y='+y+' '+k.slice(0,70)+' :: '+diffs.join(' ; ').slice(0,300));}}}}
      console.log(pg.padEnd(8),v.name.padEnd(28),'differing (element|pseudo)@scroll entries:',n,'of',tot); ex.forEach(e=>console.log('     ',e));
    }
  }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
