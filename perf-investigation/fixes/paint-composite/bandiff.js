// re-diff saved screenshots within a horizontal band
const path=require('path');const sharp=require(path.join('../node_modules/sharp'));
(async()=>{const [a,b,y0,y1]=process.argv.slice(2);const ma=await sharp(a).metadata();
const ex=x=>sharp(x).extract({left:0,top:+y0,width:ma.width,height:+y1-+y0}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const A=await ex(a),B=await ex(b);const n=A.info.width*A.info.height;let s=0,c=0;for(let i=0;i<n;i++){const o=i*4;const d=(Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2]))/3;s+=d;if(d>8)c++;}
console.log(path.basename(b)+' band '+y0+'-'+y1+': meanAbsDiff='+(s/n).toFixed(3)+' changedPx='+c);})();
