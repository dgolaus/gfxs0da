const path=require('path');const sharp=require(path.join('../node_modules/sharp'));
(async()=>{for(const [a,b] of [['vis_baseline_5000.png','vis_uagated_5000.png'],['vis_baseline_5000.png','vis_baseline2_5000.png'],['vis_baseline_5000.png','vis_loading-font-preload_5000.png']]){
 const A=await sharp(a).raw().toBuffer({resolveWithObject:true});const B=await sharp(b).raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h,channels:c}=A.info;const boxes=[];let n=0;
 const grid={};for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*c;const d=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);if(d>30){n++;const k=Math.floor(x/120)+','+Math.floor(y/100);grid[k]=(grid[k]||0)+1;}}
 console.log(b,'px>30:',n,'cells(120x100):',JSON.stringify(Object.entries(grid).sort((p,q)=>q[1]-p[1]).slice(0,8)));}})();
