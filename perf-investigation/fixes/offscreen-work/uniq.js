// pixels where a variant differs (>thr) from BOTH baseline runs: changes not explained by noise
const sharp=require('../node_modules/sharp');
const fs=require('fs');const path=require('path');
const [dir,mode,W,...names]=process.argv.slice(2);
const thr=16;
(async()=>{
 const files=fs.readdirSync(dir).filter(f=>f.startsWith(`${mode}_${W}_baseline_`));
 const ts=files.map(f=>+f.split('_').pop().replace('.png','')).sort((a,b)=>a-b);
 const load=async f=>{const r=await sharp(path.join(dir,f)).raw().toBuffer({resolveWithObject:true});return r;};
 for(const n of names){
  const out=[];
  for(const t of ts){
   const A=await load(`${mode}_${W}_baseline_${t}.png`),B=await load(`${mode}_${W}_baseline2_${t}.png`);
   let V;try{V=await load(`${mode}_${W}_${n}_${t}.png`);}catch(e){out.push(t+':-');continue;}
   const c=A.info.channels,N=A.info.width*A.info.height;let u=0,minY=1e9,maxY=-1,minX=1e9,maxX=-1;
   for(let i=0;i<N;i++){const o=i*c;const da=(Math.abs(V.data[o]-A.data[o])+Math.abs(V.data[o+1]-A.data[o+1])+Math.abs(V.data[o+2]-A.data[o+2]))/3;const db=(Math.abs(V.data[o]-B.data[o])+Math.abs(V.data[o+1]-B.data[o+1])+Math.abs(V.data[o+2]-B.data[o+2]))/3;if(da>thr&&db>thr){u++;const y=Math.floor(i/A.info.width),x=i%A.info.width;if(y<minY)minY=y;if(y>maxY)maxY=y;if(x<minX)minX=x;if(x>maxX)maxX=x;}}
   out.push(`${t}:${u}${u?`[x${minX}-${maxX},y${minY}-${maxY}]`:''}`);
  }
  console.log(n.padEnd(30),out.join('  '));
 }
})();
