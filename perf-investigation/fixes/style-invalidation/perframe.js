/* steady-state per-frame recalc elementCount for variants (diagnostic). usage: node perframe.js variants.json */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const bench=require('../../bench.js');
(async()=>{
  const vs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const b=await puppeteer.launch({headless:'new'});
  for(const v of vs){
    const {p}=await bench.openPage(b,v,{throttle:1});
    await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});
    await new Promise(r=>setTimeout(r,3500));
    const f=path.join(__dirname,'pf_tmp.json');
    await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
    await new Promise(r=>setTimeout(r,1500));
    await p.tracing.stop();
    const ev=JSON.parse(fs.readFileSync(f,'utf8')).traceEvents;
    const mains=ev.filter(m=>m.ph==='M'&&m.name==='thread_name'&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
    const u=ev.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X'&&mains.includes(e.pid+':'+e.tid));
    const big=u.filter(e=>e.args.elementCount>5);
    const ec=big.map(e=>e.args.elementCount).sort((a,b)=>a-b);
    const dur=big.map(e=>e.dur/1000).sort((a,b)=>a-b);
    console.log(v.name.padEnd(30),'n',big.length,'elements median',ec[ec.length>>1],'min',ec[0],'max',ec[ec.length-1],'dur median',dur[dur.length>>1].toFixed(2)+'ms');
    await p.close();
  }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
