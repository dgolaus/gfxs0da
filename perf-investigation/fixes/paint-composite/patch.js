const fs=require('fs');let s=fs.readFileSync('vtrace.js','utf8');
const a="const top=(n)=>{let s=0,end=-1,c=0;for(const e of X){if(e.name!==n)continue;if(e.ts>=end){s+=e.dur;end=e.ts+e.dur;c++;}}return [Math.round(s/1000),c];};";
const b="const top=(n)=>{let s=0,end=-1,c=0;const ds=[];for(const e of X){if(e.name!==n)continue;if(e.ts>=end){s+=e.dur;end=e.ts+e.dur;c++;ds.push(e.dur/1000);}}ds.sort((a,b)=>a-b);return [Math.round(s/1000),c,ds.length?+ds[Math.floor(ds.length/2)].toFixed(2):0];};";
if(!s.includes(a)) throw new Error('nf'); s=s.replace(a,b); fs.writeFileSync('vtrace.js',s); console.log('ok');
