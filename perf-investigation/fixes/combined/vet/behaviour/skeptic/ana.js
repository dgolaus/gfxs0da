// node ana.js <test...>: per step, C-only state diffs (excluding the intended #pricing contain at >=1440) and screenshot diffs vs A/A
const fs=require('fs');
for(const t of process.argv.slice(2)){const f=__dirname+'/out/'+t+'.json'; if(!fs.existsSync(f)){console.log('missing',t);continue;}
 const r=require(f); console.log('=====',t);
 for(const k in r.runs) console.log(' run',k,'errs',JSON.stringify(r.runs[k].pageErrors),r.runs[k].env?JSON.stringify(r.runs[k].env):'', r.frameModel?JSON.stringify(r.frameModel[k]):'');
 r.cmp.forEach((c,i)=>{const s=r.shots.find(x=>x.i===c.i); const label=c.h||c.k||c.name||c.w||'';
  const cn=c.CnotAB.filter(x=>!/\.sec\.3\.5 A="none" B="none" C="paint"/.test(x));
  const flag=s&&Math.min(s.AC.pct,s.BC.pct)>s.AB.pct+0.02?' <<<SHOT':'';
  console.log(` ${c.i} ${label} AB#${c.AB.length} CnotAB#${cn.length}${s?` shot AB ${s.AB.pct} AC ${s.AC.pct} BC ${s.BC.pct} bbAC=${JSON.stringify(s.AC.bbox)}`:''}${flag}`);
  for(const x of cn) console.log('     ',x);
 });}
