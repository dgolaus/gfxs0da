const fs=require('fs'),path=require('path');const sharp=require('../node_modules/sharp');
const dir=process.argv[2];
async function diff(a,b){const A=await sharp(a).ensureAlpha().raw().toBuffer({resolveWithObject:true});const B=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(A.info.width!==B.info.width||A.info.height!==B.info.height)return {size:1};let ch=0,mx=0;for(let i=0;i<A.data.length;i+=4){const d=(Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]))/3;if(d>0)ch++;if(d>mx)mx=d;}return {ch,mx:+mx.toFixed(1)};}
(async()=>{const fl=fs.readdirSync(dir).filter(f=>f.startsWith('B_'));let s={AA2zero:0,A2Bzero:0,ABzero:0,n:0};const odd=[];
for(const f of fl){const k=f.slice(2);const a=path.join(dir,'A_'+k),a2=path.join(dir,'A2_'+k),b=path.join(dir,f);if(!fs.existsSync(a)||!fs.existsSync(a2))continue;s.n++;
 const aa2=await diff(a,a2),a2b=await diff(a2,b),ab=await diff(a,b);
 const z=x=>!x.size&&x.ch===0;if(z(aa2))s.AA2zero++;if(z(a2b))s.A2Bzero++;if(z(ab))s.ABzero++;
 // variant differs from BOTH baselines while baselines agree with each other => suspicious
 if(!z(a2b)&&!z(ab)) odd.push({k,aa2,a2b,ab});}
console.log(JSON.stringify(s));odd.forEach(o=>console.log(JSON.stringify(o)));})();
