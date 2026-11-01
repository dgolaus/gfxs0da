const path=require('path');
const sharp=require(path.join('../node_modules/sharp'));
(async()=>{
  const [a,b,out]=process.argv.slice(2);
  const A=await sharp(a).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const B=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const W=A.info.width,H=A.info.height,n=W*H;const heat=Buffer.alloc(n*3);
  let minx=W,miny=H,maxx=0,maxy=0;
  for(let i=0;i<n;i++){const o=i*4;const d=(Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2]))/3;
    const g=(A.data[o]+A.data[o+1]+A.data[o+2])/9; heat[i*3]=Math.min(255,g+d*6);heat[i*3+1]=g;heat[i*3+2]=g;
    if(d>8){const x=i%W,y=(i/W)|0;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);}}
  await sharp(heat,{raw:{width:W,height:H,channels:3}}).png().toFile(out);
  console.log('bbox changed>8:',minx,miny,maxx,maxy);
})();
