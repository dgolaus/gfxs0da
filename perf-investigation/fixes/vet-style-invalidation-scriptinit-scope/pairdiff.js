const sharp=require('../node_modules/sharp');const fs=require('fs');
(async()=>{const [tag,a,b]=process.argv.slice(2);const files=fs.readdirSync('.').filter(f=>f.startsWith('sc_'+tag+'_'+a+'_')&&f.endsWith('.png'));
for(const f of files.sort((x,y)=>parseInt(x.split('_').pop())-parseInt(y.split('_').pop()))){const g=f.replace('_'+a+'_','_'+b+'_');if(!fs.existsSync(g))continue;
const A=await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});const B=await sharp(g).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let ch=0,sum=0;const n=A.info.width*A.info.height;let bb=[1e9,1e9,-1,-1];for(let i=0;i<n;i++){const o=i*4;const d=(Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2]))/3;sum+=d;if(d>8){ch++;const x=i%A.info.width,y=(i/A.info.width)|0;bb=[Math.min(bb[0],x),Math.min(bb[1],y),Math.max(bb[2],x),Math.max(bb[3],y)];}}
console.log(f.split('_').pop(),'mean',(sum/n).toFixed(3),'pct',(ch/n*100).toFixed(3),ch?bb.join(','):'');}})();
