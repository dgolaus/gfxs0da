const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
// choose main with most events
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;if(mains.includes(k))cnt[k]=(cnt[k]||0)+1;}
const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
const isMain=e=>(e.pid+':'+e.tid)===main;
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const X=ev.filter(e=>e.ph==='X'&&isMain(e)&&e.dur!=null).sort((a,b)=>a.ts-b.ts);
const ms=t=>((t-t0)/1000).toFixed(0);
// FireAnimationFrame events
const fafs=X.filter(e=>e.name==='FireAnimationFrame');
console.log('FireAnimationFrame count',fafs.length,'total ms',(fafs.reduce((a,e)=>a+e.dur,0)/1000).toFixed(1));
// group by function call inside
const byFn={};
const rows=[];
for(const f of fafs){
  const kids=X.filter(e=>e.ts>=f.ts&&e.ts+e.dur<=f.ts+f.dur&&e!==f);
  const fc=kids.filter(k=>k.name==='FunctionCall');
  const fn=fc.map(k=>{const d=k.args&&k.args.data||{};return (d.url||'').split('/').pop()+'#'+(d.functionName||'')+'@'+d.lineNumber}).join(',')||'?';
  const lay=kids.filter(k=>k.name==='Layout').reduce((a,k)=>a+k.dur,0);
  const rs=kids.filter(k=>k.name==='UpdateLayoutTree'||k.name==='RecalculateStyles').reduce((a,k)=>a+k.dur,0);
  const id=f.args&&f.args.data&&f.args.data.id;
  const key=fn;
  byFn[key]=byFn[key]||{n:0,dur:0,lay:0,rs:0,self:0};
  byFn[key].n++;byFn[key].dur+=f.dur;byFn[key].lay+=lay;byFn[key].rs+=rs;
  rows.push({t:ms(f.ts),dur:(f.dur/1000).toFixed(2),lay:(lay/1000).toFixed(1),rs:(rs/1000).toFixed(1),fn,id});
}
console.log('\nBy callback:');
for(const [k,v] of Object.entries(byFn).sort((a,b)=>b[1].dur-a[1].dur)) console.log(k.padEnd(60),'n',v.n,'dur',(v.dur/1000).toFixed(1),'forcedLayout',(v.lay/1000).toFixed(1),'forcedRecalc',(v.rs/1000).toFixed(1));
console.log('\nTop 30 FAF by dur:');
rows.sort((a,b)=>b.dur-a.dur).slice(0,30).forEach(r=>console.log(r.t.padStart(5),'dur',r.dur,'lay',r.lay,'rs',r.rs,r.fn));
// forced layouts with stack traces
const forced=X.filter(e=>(e.name==='Layout'||e.name==='UpdateLayoutTree')&&e.args&&e.args.beginData&&e.args.beginData.stackTrace&&e.args.beginData.stackTrace.length);
const fb={};
for(const e of forced){const s=e.args.beginData.stackTrace[0];const k=e.name+' '+(s.url||'').split('/').pop()+':'+(s.lineNumber+1)+' '+s.functionName;fb[k]=fb[k]||{n:0,dur:0,first:ms(e.ts)};fb[k].n++;fb[k].dur+=e.dur;}
console.log('\nForced (JS-triggered) Layout/UpdateLayoutTree by top frame:');
for(const [k,v] of Object.entries(fb).sort((a,b)=>b[1].dur-a[1].dur).slice(0,40)) console.log(k.padEnd(70),'n',v.n,'ms',(v.dur/1000).toFixed(1),'first@',v.first);
