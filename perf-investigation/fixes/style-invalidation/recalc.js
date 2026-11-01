const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
// name census
const names={};for(const e of ev){if(isMain(e)){names[e.name]=(names[e.name]||0)+1;}}
console.log(Object.entries(names).filter(([k])=>/Style|Layout|Invalid|Recalc|Schedule|Parse|Selector/i.test(k)).map(([k,v])=>k+':'+v).join('  '));
const X=ev.filter(e=>isMain(e)&&(e.name==='UpdateLayoutTree'||e.name==='Layout'||e.name==='ParseAuthorStyleSheet')).sort((a,b)=>a.ts-b.ts);
for(const e of X){
  if(e.ph!=='X'&&e.ph!=='B')continue;
  const d=(e.dur||0)/1000;
  if(d<3)continue;
  const st=e.args&&e.args.beginData&&e.args.beginData.stackTrace;
  const top=st?st.slice(0,3).map(f=>(f.url||'').split('/').pop()+':'+f.lineNumber+'#'+f.functionName).join(' < '):'';
  const ec=e.args&&(e.args.elementCount!=null?e.args.elementCount:(e.args.endData&&e.args.endData.elementCount));
  const lay=e.name==='Layout'&&e.args&&e.args.beginData?(' dirty='+e.args.beginData.dirtyObjects+'/'+e.args.beginData.totalObjects+' partial='+e.args.beginData.partialLayout):'';
  console.log(String(Math.round((e.ts-t0)/1000)).padStart(5),e.name.padEnd(17),d.toFixed(1).padStart(6)+'ms', ec!=null?'elements='+ec:'', lay, top?' STACK '+top:'', e.name==='ParseAuthorStyleSheet'?JSON.stringify(e.args.data||e.args.beginData).slice(0,120):'');
}
