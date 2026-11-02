// probe: first End key after load (1440, Lenis), with rAF frame counting to see whether delays coincide with renderer stalls
const fs=require('fs'),path=require('path');const L=require('/home/user/gfxs0da/perf-investigation/fixes/combined/vet/lib.js');
const reps=+process.argv[2]||10;
(async()=>{const out=[];
for(let r=0;r<reps;r++)for(const v of (r%2?['combined','baseline']:['baseline','combined'])){
 const b=await L.launch();try{const {p}=await L.open(b,v,{w:1440,h:900});
 await p.goto(L.BASE+'/',{waitUntil:'load'});await p.waitForFunction(()=>!!window.lenis,{timeout:15000});await L.settle(p,2500);
 await p.mouse.move(700,500);
 await p.evaluate(()=>{window.__fr=[];const t0=performance.now();const f=()=>{window.__fr.push([Math.round(performance.now()-t0),Math.round(scrollY)]);if(performance.now()-t0<3500)requestAnimationFrame(f);};requestAnimationFrame(f);
   window.__keyAt=null;addEventListener('keydown',()=>{window.__keyAt=Math.round(performance.now()-t0);},{once:true});});
 await L.w8(300);
 await p.keyboard.press('End');
 await L.w8(3500);
 const fr=await p.evaluate(()=>({fr:window.__fr,keyAt:window.__keyAt}));
 const firstMove=fr.fr.find(x=>x[1]>0); const pre=fr.fr.filter(x=>x[0]<300).length; const gaps=[];for(let i=1;i<fr.fr.length;i++)if(fr.fr[i][0]-fr.fr[i-1][0]>100)gaps.push([fr.fr[i-1][0],fr.fr[i][0]]);
 const row={v,r,keyAt:fr.keyAt,firstMoveAt:firstMove?firstMove[0]:null,final:fr.fr[fr.fr.length-1][1],frames:fr.fr.length,gaps};out.push(row);console.log(JSON.stringify(row));
 }finally{await b.close();}}
fs.writeFileSync(path.join(__dirname,'out','probe4_end_frames.json'),JSON.stringify(out,null,1));})();
