const {openPage}=require('../../bench.js');
const puppeteer=require('../node_modules/puppeteer');
const sharp=require('../node_modules/sharp');
const fs=require('fs');const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const [W,H]=(process.argv[3]||'390x844').split('x').map(Number);
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(const v of vs){const {p}=await openPage(b,v,{throttle:1});const mobile=W<768;await p.setViewport({width:W,height:H,isMobile:mobile,hasTouch:mobile});
await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});
await p.evaluate(async()=>{await document.fonts.ready;const s=document.createElement('style');s.textContent='.chat-messages, .chat-typing { visibility: hidden !important; }';document.head.appendChild(s);});
await w8(4000);
for(let y=760-760;y<760;y+=120){await p.evaluate(y=>scrollTo(0,y),y);await w8(16);}await p.evaluate(()=>scrollTo(0,760));await w8(4000);
await p.evaluate(()=>{for(const a of document.getAnimations()){try{a.pause();a.currentTime=5000;}catch(e){}}});
await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const info=await p.evaluate(()=>{const n=document.querySelector('.nav .btn');const r=n.getBoundingClientRect();return [r.left,r.right,innerWidth,document.documentElement.clientWidth,visualViewport.width,visualViewport.offsetLeft,visualViewport.pageLeft]});
const f='svis/navshot_'+v.name+'.png';await p.screenshot({path:f});
const {data,info:ii}=await sharp(f).raw().toBuffer({resolveWithObject:true});
// find leftmost bright text pixel in rows 20-40, x>200
let lx=-1;for(let x=200;x<ii.width&&lx<0;x++)for(let y=20;y<40;y++){const o=(y*ii.width+x)*ii.channels;if(data[o]+data[o+1]+data[o+2]>500){lx=x;break;}}
console.log(v.name,JSON.stringify(info),'img',ii.width+'x'+ii.height,'firstTextX',lx);await p.close();}
await b.close();})();
