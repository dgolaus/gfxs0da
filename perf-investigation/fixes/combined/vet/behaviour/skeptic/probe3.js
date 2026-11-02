// probe: mobile 390, jump to #process, sample page/process height while the Discord chat plays
const fs=require('fs'),path=require('path');const L=require('/home/user/gfxs0da/perf-investigation/fixes/combined/vet/lib.js');
(async()=>{const out=[];
for(let r=0;r<2;r++)for(const v of ['baseline','combined']){
 const b=await L.launch({touch:true});try{const {p}=await L.open(b,v,{w:390,h:844,mobile:true});
 await p.goto(L.BASE+'/',{waitUntil:'load'});await L.settle(p,1500);
 await p.evaluate(()=>{const t=document.getElementById('process');scrollTo(0,t.getBoundingClientRect().top+scrollY-80);});
 const s=[];for(let i=0;i<=20;i++){s.push(await p.evaluate(()=>[document.documentElement.scrollHeight,Math.round(document.getElementById('process').getBoundingClientRect().height),document.querySelectorAll('#process .dc-msg, #process [class*="msg"]').length]));await L.w8(1000);}
 out.push({v,r,s});console.log(v,r,s.map(x=>x.join('/')).join(' '));
 }finally{await b.close();}}
fs.writeFileSync(path.join(__dirname,'out','probe3_mobprocess.json'),JSON.stringify(out,null,1));})();
