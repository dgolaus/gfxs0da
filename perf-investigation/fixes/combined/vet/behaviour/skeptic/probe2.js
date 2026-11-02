// probe: first End key press after load (1440, Lenis). Records scrollY trace and focus state.
const fs=require('fs'),path=require('path');const L=require('/home/user/gfxs0da/perf-investigation/fixes/combined/vet/lib.js');
const reps=+process.argv[2]||4; const seq=(process.argv[3]||'baseline,combined').split(','); const settleMs=+(process.argv[4]||2500);
(async()=>{const out=[];
for(let r=0;r<reps;r++)for(const v of seq){
 const b=await L.launch();try{const {p}=await L.open(b,v,{w:1440,h:900});
 await p.goto(L.BASE+'/',{waitUntil:'load'});await p.waitForFunction(()=>!!window.lenis,{timeout:15000});await L.settle(p,settleMs);
 await p.mouse.move(700,500);
 const pre=await p.evaluate(()=>({hasFocus:document.hasFocus(),ae:document.activeElement&&document.activeElement.tagName,sy:scrollY,lenisStopped:window.lenis.isStopped,ov:getComputedStyle(document.documentElement).overflow+'|'+getComputedStyle(document.body).overflow,cls:document.documentElement.className}));
 const t0=Date.now();await p.keyboard.press('End');
 const tr=[];for(let i=0;i<12;i++){await L.w8(250);tr.push(Math.round(await p.evaluate(()=>scrollY)));}
 // second press
 await p.keyboard.press('Home');await L.w8(2500);const afterHome=await p.evaluate(()=>scrollY);
 await p.keyboard.press('End');await L.w8(3000);const end2=await p.evaluate(()=>scrollY);
 out.push({v,r,pre,tr,afterHome,end2});console.log(v,r,JSON.stringify(pre),tr.join(','),'home',afterHome,'end2',end2);
 }finally{await b.close();}}
fs.writeFileSync(path.join(__dirname,'out',process.env.OUTN||'probe2_end.json'),JSON.stringify(out,null,1));})();
