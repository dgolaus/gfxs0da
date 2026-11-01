function bez(x1,y1,x2,y2){const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
 const X=t=>((ax*t+bx)*t+cx)*t,Y=t=>((ay*t+by)*t+cy)*t;
 return x=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1;for(let i=0;i<60;i++){const m=(lo+hi)/2;if(X(m)<x)lo=m;else hi=m;}return Y((lo+hi)/2);};}
const e=bez(0.16,1,0.3,1);
const A={badge:{d:0,dur:900,blur:5,ty:-12},title:{d:150,dur:1000,blur:12,ty:20},sub:{d:300,dur:1000,blur:8,ty:12},cta:{d:450,dur:1000,blur:8,ty:12},strip:{d:600,dur:1000,blur:8,ty:12},scroll:{d:900,dur:1000,blur:8,ty:12}};
const val=(a,t)=>{const p=Math.max(0,Math.min(1,(t-a.d)/a.dur));const k=e(p);return {op:+k.toFixed(2),blur:+(a.blur*(1-k)).toFixed(2),ty:+(a.ty*(1-k)).toFixed(1)};};
// Warm trace: compositor start ~S; main frames committed at given intro times
const frozenBlurAt=+process.argv[2]||294, compT=+process.argv[3]||764;
console.log('split during stall: blur frozen at t='+frozenBlurAt+', compositor at t='+compT);
for(const [k,a] of Object.entries(A)){const f=val(a,frozenBlurAt),c=val(a,compT);console.log(k.padEnd(7),'baseline-frozen',JSON.stringify(f),' split shows op/ty',c.op,c.ty,'blur',f.blur,' design@t',JSON.stringify(c));}
