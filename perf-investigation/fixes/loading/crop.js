const path=require('path');const sharp=require(path.join('../node_modules/sharp'));
(async()=>{
 const A=await sharp('vis_baseline_900.png').raw().toBuffer({resolveWithObject:true});const B=await sharp('vis_baseline2_900.png').raw().toBuffer({resolveWithObject:true});
 let x0=1e9,y0=1e9,x1=-1,y1=-1,n=0;const c=A.info.channels;for(let i=0;i<A.info.width*A.info.height;i++){const d=(Math.abs(A.data[i*c]-B.data[i*c])+Math.abs(A.data[i*c+1]-B.data[i*c+1])+Math.abs(A.data[i*c+2]-B.data[i*c+2]))/3;if(d>8){n++;const x=i%A.info.width,y=(i/A.info.width)|0;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
 console.log('noise 900 bbox',x0,x1,y0,y1,n);
 const rg={left:300,top:640,width:700,height:110};
 const imgs=[['vis_baseline_900.png','b900'],['vis_baseline2_900.png','b2_900'],['vis_loading-combined_900.png','c900'],['vis_loading-early-ready_900.png','e900'],['vis_baseline_1400.png','b1400'],['vis_loading-font-preload_1400.png','f1400']];
 const parts=await Promise.all(imgs.map(([f])=>sharp(f).extract(rg).png().toBuffer()));
 await sharp({create:{width:700,height:110*parts.length,channels:3,background:'#000'}}).composite(parts.map((b,i)=>({input:b,top:i*110,left:0}))).png().toFile('crops_counters.png');
 console.log('order:',imgs.map(x=>x[1]).join(', '));
})();
