// Same method as bench.js visual (freeze all animations at t, counters final,
// diff vs baseline, baseline-vs-baseline noise) but served from disk (server down).
const fs=require('fs'),path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const sharp=require(path.join('../node_modules/sharp'));
const {openPage}=require('./page.js');
const variants=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const urlPath=process.argv[3]||'/';
const w8=(ms)=>new Promise(r=>setTimeout(r,ms));
async function shot(b,v,t,file){const {p}=await openPage(b,v);await p.goto('http://localhost:5173'+urlPath,{waitUntil:'networkidle2'});
await p.evaluate(async()=>{await Promise.race([new Promise(r=>setTimeout(r,8000)),Promise.all([...document.images].filter(i=>!i.complete).map(i=>new Promise(r=>{i.onload=i.onerror=r})))]);window.__pending=[...document.images].filter(i=>!i.complete).length;if(document.fonts&&document.fonts.ready)await document.fonts.ready;});
await w8(300);
await p.evaluate((t)=>{document.querySelectorAll('.counter').forEach(el=>{const v=parseFloat(el.dataset.value),d=parseInt(el.dataset.decimals||'0',10);el.textContent=`${el.dataset.prefix||''}${v.toFixed(d)}${el.dataset.suffix||''}`});const bg=document.querySelector('.hero-bg');if(bg)bg.style.translate='0px 0px';if(location.hash==='')window.scrollTo(0,0);for(const a of document.getAnimations()){try{a.pause();a.currentTime=t}catch(e){}}},t);
await w8(250);await p.screenshot({path:file,clip:{x:0,y:0,width:1440,height:900}});await p.close();}
async function diff(a,b){const A=await sharp(a).ensureAlpha().raw().toBuffer({resolveWithObject:true});const B=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});const n=A.info.width*A.info.height;let s=0,c=0,big=0;for(let i=0;i<n;i++){const o=i*4;const d=(Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2]))/3;s+=d;if(d>8)c++;if(d>32)big++;}return {meanAbsDiff:+(s/n).toFixed(3),pctChanged:+(c/n*100).toFixed(3),pctBig:+(big/n*100).toFixed(3)};}
(async()=>{const b=await puppeteer.launch({headless:'new'});const out={};const tag=urlPath.replace(/[^a-z]/gi,'')||'root';
for(const t of [150,500,900,1400,5000]){const bf=path.join(__dirname,`v_${tag}_baseline_${t}.png`);await shot(b,{name:'baseline'},t,bf);const bf2=path.join(__dirname,`v_${tag}_baseline2_${t}.png`);await shot(b,{name:'baseline'},t,bf2);(out.__noise=out.__noise||{})[t]=await diff(bf,bf2);
for(const v of variants){if(v.name==='baseline')continue;const vf=path.join(__dirname,`v_${tag}_${v.name}_${t}.png`);await shot(b,v,t,vf);(out[v.name]=out[v.name]||{})[t]=await diff(bf,vf);}}
for(const k of Object.keys(out))console.log(k.padEnd(18),Object.entries(out[k]).map(([t,r])=>`${t}:${r.meanAbsDiff}/${r.pctChanged}%`).join('  '));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
