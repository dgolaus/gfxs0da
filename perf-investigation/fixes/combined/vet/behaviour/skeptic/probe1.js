// probe: first nav click after load at 1440 with Lenis; per-rAF trace of nav vars, padding, CTA transform, running transitions
const fs=require('fs'),path=require('path');const L=require('/home/user/gfxs0da/perf-investigation/fixes/combined/vet/lib.js');
const reps=+process.argv[2]||3; const seq=(process.argv[3]||'baseline,combined').split(',');
(async()=>{const out={};
for(let r=0;r<reps;r++)for(const v of seq){
 const b=await L.launch();try{const {p}=await L.open(b,v,{w:1440,h:900});
 await p.goto(L.BASE+'/',{waitUntil:'load'});await p.waitForFunction(()=>!!window.lenis,{timeout:15000});await L.settle(p,2500);
 await p.evaluate(()=>{window.__t=[];const nav=document.getElementById('nav');const cta=nav.querySelector(':scope > .btn');const t0=performance.now();
  const f=()=>{const cs=getComputedStyle(nav);window.__t.push([Math.round(performance.now()-t0),scrollY,cs.getPropertyValue('--nav-pill').trim(),cs.paddingTop,getComputedStyle(cta).transform,
   nav.getAnimations({subtree:true}).map(a=>(a.transitionProperty||a.animationName)+'@'+Math.round(a.currentTime)).join(' ')]);if(window.__t.length<400)requestAnimationFrame(f);};requestAnimationFrame(f);});
 await p.click('.nav-links a[href="#work"]');
 await L.w8(5000);
 const t=await p.evaluate(()=>window.__t);
 // find settle point: last frame where scrollY changes
 let lastMove=0;for(let i=1;i<t.length;i++)if(t[i][1]!==t[i-1][1])lastMove=i;
 const fin=t[t.length-1];
 (out[v]=out[v]||[]).push({rep:r,frames:t.length,lastMoveT:t[lastMove][0],fin,afterStill:t.slice(lastMove,lastMove+40).map(x=>x.join('|')),pad16:t.filter(x=>x[3]==='16px'&&x[2]==='1').map(x=>x[0])});
 }finally{await b.close();}}
fs.writeFileSync(path.join(__dirname,'out','probe1.json'),JSON.stringify(out,null,1));
for(const v in out)for(const x of out[v])console.log(v,x.rep,'frames',x.frames,'lastMoveT',x.lastMoveT,'fin',JSON.stringify(x.fin),'pad16@pill1',x.pad16.length);
})();
