const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const fs=require('fs');const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const [W,H]=(process.argv[3]||'390x844').split('x').map(Number);const mode=process.argv[4]||'jump';
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const v of vs){const {p}=await openPage(b,v,{throttle:1});await p.setViewport({width:W,height:H});
await p.goto('http://localhost:5173/',{waitUntil:'load'});await w8(2000);
const y=await p.evaluate(()=>Math.round(document.getElementById('process').getBoundingClientRect().top+scrollY));
if(mode==='walk'){for(let s=0;s<y;s+=200){await p.evaluate(s=>scrollTo(0,s),s);await w8(60);}}
await p.evaluate(y=>scrollTo(0,y),y);
const seq=[];for(let i=0;i<16;i++){await w8(500);seq.push(await p.evaluate(()=>document.getElementById('chat-messages').children.length+'/'+Math.round(document.getElementById('process').getBoundingClientRect().height)));}
console.log(v.name.padEnd(28),mode,'processTop',y,seq.join(' '));await p.close();}
await b.close();})();
