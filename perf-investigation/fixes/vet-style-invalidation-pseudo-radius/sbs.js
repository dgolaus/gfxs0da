const sharp=require('../node_modules/sharp');
const [,,dir,k,out,scale]=process.argv;
(async()=>{const a=dir+'/A2_'+k+'.png',b=dir+'/B_'+k+'.png';
const A=await sharp(a).ensureAlpha().raw().toBuffer({resolveWithObject:true});const B=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const w=Math.min(A.info.width,B.info.width),h=Math.min(A.info.height,B.info.height);const heat=Buffer.alloc(w*h*3);
let minx=1e9,miny=1e9,maxx=-1,maxy=-1;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ia=(y*A.info.width+x)*4,ib=(y*B.info.width+x)*4;const d=(Math.abs(A.data[ia]-B.data[ib])+Math.abs(A.data[ia+1]-B.data[ib+1])+Math.abs(A.data[ia+2]-B.data[ib+2]))/3;const o=(y*w+x)*3;heat[o]=Math.min(255,d*20);if(d>0){minx=Math.min(minx,x);miny=Math.min(miny,y);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);}}
console.log('diff bbox',minx,miny,maxx,maxy,'of',w,h);
const s=+(scale||1);
const H=await sharp(heat,{raw:{width:w,height:h,channels:3}}).png().toBuffer();
const parts=[await sharp(a).extract({left:0,top:0,width:w,height:h}).png().toBuffer(),await sharp(b).extract({left:0,top:0,width:w,height:h}).png().toBuffer(),H];
await sharp({create:{width:w*3+20,height:h,channels:3,background:'#fff'}}).composite(parts.map((p,i)=>({input:p,left:i*(w+10),top:0}))).resize(Math.round((w*3+20)*s)).png().toFile(out);})();
