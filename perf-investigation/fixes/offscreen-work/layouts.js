const fs=require('fs');
const file=process.argv[2];
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const ev=raw.traceEvents||raw;
const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
const isMain=e=>mains.includes(e.pid+':'+e.tid);
const t0=Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
const M=ev.filter(e=>isMain(e));
// Layout events: X or B/E
const lay=M.filter(e=>(e.name==='Layout'||e.name==='UpdateLayoutTree'||e.name==='Paint'||e.name==='PrePaint') && (e.ph==='X'||e.ph==='B'));
const ends=M.filter(e=>(e.name==='Layout'||e.name==='UpdateLayoutTree') && e.ph==='E');
for(const e of lay){
  let dur=e.dur;
  let endArgs=null;
  if(e.ph==='B'){const en=ends.find(x=>x.name===e.name&&x.ts>=e.ts); if(en){dur=en.ts-e.ts;endArgs=en.args;}}
  if(e.name==='Layout') endArgs = endArgs || e.args;
  if(!dur||dur<8000) continue;
  const bd=e.args&&e.args.beginData||{};
  const st=(bd.stackTrace||[]).slice(0,4).map(f=>(f.url||'').split('/').pop()+':'+f.lineNumber+':'+(f.functionName||'')).join(' <- ');
  let extra='';
  if(e.name==='Layout') extra=' dirty='+bd.dirtyObjects+' total='+bd.totalObjects+' partial='+bd.partialLayout+' frame='+(bd.frame||'').slice(-4);
  if(e.name==='UpdateLayoutTree') extra=' elementCount='+(endArgs&&endArgs.elementCount||e.args&&e.args.elementCount||(e.args&&e.args.endData&&e.args.endData.elementCount)||'?');
  console.log(String(Math.round((e.ts-t0)/1000)).padStart(6)+'ms '+e.name.padEnd(17)+' '+String(Math.round(dur/1000)).padStart(4)+'ms'+extra+(st?'  STACK '+st:''));
}
