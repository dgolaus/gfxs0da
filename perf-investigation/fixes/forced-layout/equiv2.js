// y3700 (depoimentos) e /#pricing repetidos: distribuição do ruído vs variantes + geometria exata dos cards.
const fs=require('fs'),path=require('path');
const { openPage } = require('./bench_local.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const sharp=require(path.join('../node_modules/sharp'));
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
async function diff(a,b){const A=await sharp(a).ensureAlpha().raw().toBuffer({resolveWithObject:true});const B=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});let s=0,c=0;const n=A.info.width*A.info.height;for(let i=0;i<n;i++){const o=i*4;const d=(Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2]))/3;s+=d;if(d>8)c++;}return +(s/n).toFixed(3)+'/'+(c/n*100).toFixed(2)+'%';}
async function run(b,v,url,y,file){const {p}=await openPage(b,v,{throttle:1});await p.goto(url,{waitUntil:'networkidle2'});await w8(1200);
 if(y!=null) await p.evaluate(y=>{window.lenis?window.lenis.scrollTo(y,{immediate:true}):scrollTo(0,y)},y);
 await w8(2500);
 await p.evaluate(()=>{for(const a of document.getAnimations()){try{a.pause();a.currentTime=5000}catch(e){}}});
 await w8(300);
 const geo=await p.evaluate(()=>JSON.stringify({q:[...document.querySelectorAll('.tcols .quote')].map(q=>{const r=q.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*64)/64).join(',')}),leave:['about','process','trust','pricing','contact'].map(id=>getComputedStyle(document.getElementById(id)).getPropertyValue('--leave').trim()),sy:scrollY}));
 await p.screenshot({path:file});await p.close();return JSON.parse(geo);}
(async()=>{
 const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const b=await puppeteer.launch({headless:'new',protocolTimeout:120000});
 for(const [id,url,y] of [['t3700','http://localhost:5173/',3700],['hash','http://localhost:5173/#pricing',null]]){
  const res={};
  for(let i=0;i<3;i++) for(const v of vs){const f=path.join(__dirname,'eq',`r_${id}_${v.name}_${i}.png`);(res[v.name]=res[v.name]||[]).push({f,g:await run(b,v,url,y,f)});}
  const b0=res.baseline[0];
  for(const v of vs){const out=[];for(const r of res[v.name]){if(r===b0)continue;out.push(await diff(b0.f,r.f)+(JSON.stringify(r.g.q)===JSON.stringify(b0.g.q)?' geoSame':' GEO-DIFF')+' leave='+r.g.leave.join(','));}console.log(id,v.name.padEnd(26),out.join(' | '));}
  console.log(id,'baseline[0] leave=',b0.g.leave.join(','),'sy',b0.g.sy);
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
