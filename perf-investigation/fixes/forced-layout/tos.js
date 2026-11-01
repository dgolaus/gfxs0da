const fs=require('fs'),path=require('path');
const { openPage } = require('./bench_local.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const sharp=require(path.join('../node_modules/sharp'));
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
async function diff(a,b){const A=await sharp(a).ensureAlpha().raw().toBuffer({resolveWithObject:true});const B=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});let s=0,c=0;const n=A.info.width*A.info.height;for(let i=0;i<n;i++){const o=i*4;const d=(Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2]))/3;s+=d;if(d>8)c++;}return +(s/n).toFixed(3)+'/'+(c/n*100).toFixed(2)+'%';}
(async()=>{
 const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const b=await puppeteer.launch({headless:'new',protocolTimeout:120000});
 for(const [id,url,y] of [['tosTop','http://localhost:5173/tos/',null],['tosY1500','http://localhost:5173/tos/',1500],['tosHash','http://localhost:5173/tos/#pricing',null],['homeY400','http://localhost:5173/',400]]){
  const files={};
  for(const v of [vs[0],...vs]){
   const {p}=await openPage(b,v,{throttle:1});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
   await p.goto(url,{waitUntil:'networkidle2'});await w8(1200);
   if(y!=null) await p.evaluate(y=>{window.lenis?window.lenis.scrollTo(y,{immediate:true}):scrollTo(0,y)},y);
   await w8(2000);
   const st=await p.evaluate(()=>({root:document.documentElement.getAttribute('style'),nav:document.getElementById('nav')&&document.getElementById('nav').className,pad:document.getElementById('nav')&&getComputedStyle(document.getElementById('nav')).paddingTop,sy:scrollY}));
   await p.evaluate(()=>{const bg=document.querySelector('.hero-bg');if(bg)bg.style.translate='0px 0px';for(const a of document.getAnimations()){try{a.pause();a.currentTime=5000}catch(e){}}});await w8(300);
   const k=files[v.name]?v.name+'2':v.name;const f=path.join(__dirname,'eq',`tos_${id}_${k}.png`);await p.screenshot({path:f});files[k]=f;await p.close();
   console.log(id,k.padEnd(26),JSON.stringify(st),'errors:',errs.filter(e=>!/beacon|cloudflare|favicon|ERR_|net::|404/.test(e)).join(' ; ')||'none');
  }
  console.log(id,'noise',await diff(files.baseline,files.baseline2),...await Promise.all(vs.slice(1).map(async v=>v.name+' '+await diff(files.baseline,files[v.name]))));
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
