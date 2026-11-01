const path=require('path');const fs=require('fs');
const sharp=require(path.join('../node_modules/sharp'));
const dir=process.argv[2];
async function d(a,b){const A=await sharp(a).ensureAlpha().raw().toBuffer({resolveWithObject:true});const B=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const n=A.info.width*A.info.height;let s=0,c=0,g=0;for(let i=0;i<n;i++){const o=i*4;const x=(Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2]))/3;s+=x;if(x>8)c++;if(x>32)g++;}
return {meanAbsDiff:+(s/n).toFixed(3),pctChanged:+(c/n*100).toFixed(3),pctBigChange:+(g/n*100).toFixed(3)};}
(async()=>{const files=fs.readdirSync(dir).filter(f=>/^vis_.*_\d+\.png$/.test(f));
const times=[...new Set(files.map(f=>f.match(/_(\d+)\.png$/)[1]))].sort((a,b)=>a-b);
const names=[...new Set(files.map(f=>f.replace(/^vis_/,'').replace(/_\d+\.png$/,'')))].filter(n=>n!=='baseline'&&n!=='baseline2');
const out={__noise:{}};
for(const t of times){const b=path.join(dir,`vis_baseline_${t}.png`);if(!fs.existsSync(b))continue;
 if(fs.existsSync(path.join(dir,`vis_baseline2_${t}.png`)))out.__noise[t]=await d(b,path.join(dir,`vis_baseline2_${t}.png`));
 for(const n of names){const f=path.join(dir,`vis_${n}_${t}.png`);if(fs.existsSync(f))(out[n]=out[n]||{})[t]=await d(b,f);}}
console.log(JSON.stringify(out,null,1));})();
