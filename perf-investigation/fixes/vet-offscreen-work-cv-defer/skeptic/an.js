const fs=require('fs');const L=require('../cloud/lib.js');
(async()=>{const r=JSON.parse(fs.readFileSync(process.argv[2]));const base=process.argv[2].replace(/\.json$/,'');
for(const x of r){const big=x.shifts.filter(s=>Math.abs(s.vis)>1.5);console.log(x.sz,x.v,'land',x.g1.sy,'secs',x.g1.secs.map(s=>s[1]+'/'+s[2]).join(' '),'| vis>1.5:',JSON.stringify(big));}
const sizes=[...new Set(r.map(x=>x.sz))];
for(const sz of sizes){const vs=r.filter(x=>x.sz===sz).map(x=>x.v);for(const v of vs.slice(1)){const d=await L.diff(`${base}_${sz}_${vs[0]}_land.png`,`${base}_${sz}_${v}_land.png`,`${base}_${sz}_${v}_landheat.png`);console.log('land diff',sz,vs[0],'vs',v,JSON.stringify(d));}}})();
