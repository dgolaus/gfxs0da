const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const S='fixes/loading/';
const V=__dirname.split(String.fromCharCode(92)).join('/')+'/';const variants=[{name:'baseline'},{name:'early',files:{'/index.html':S+'index.earlyready.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'}},{name:'cssom',files:{'/index.html':V+'index.cssom.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'}}];
const thr=+(process.argv[2]||4), reps=+(process.argv[3]||2);
const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  for(let rep=0;rep<reps;rep++)for(const v of variants){
    const p=await b.newPage();await p.setViewport({width:1440,height:900});
    const c=await p.target().createCDPSession();if(thr>1)await c.send('Emulation.setCPUThrottlingRate',{rate:thr});
    await require('./serve.js').attach(p,v.files);
    await p.evaluateOnNewDocument(()=>{try{localStorage.setItem('s0da-lite','0')}catch(e){};Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});});
    await p.goto('about:blank');
    const f=`tr_${v.name}_${rep}.json`;
    await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline','blink.user_timing','loading']});
    await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});await w8(3500);
    await p.tracing.stop();await p.close();
    const ev=JSON.parse(fs.readFileSync(f,'utf8')).traceEvents;
    const tn=ev.filter(e=>e.name==='thread_name'&&e.args.name==='CrRendererMain');
    // pick renderer main with most events
    const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;cnt[k]=(cnt[k]||0)+1;}
    const main=tn.map(e=>e.pid+':'+e.tid).sort((a,b)=>cnt[b]-cnt[a])[0];
    const M=ev.filter(e=>e.pid+':'+e.tid===main);
    const nav=M.find(e=>e.name==='ParseHTML')||M[0];const t0=nav.ts;
    const ult=M.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X');
    const big=ult.filter(e=>(e.args&&e.args.elementCount||0)>300).map(e=>`@${((e.ts-t0)/1000)|0}ms el=${e.args.elementCount} ${(e.dur/1000).toFixed(0)}ms`);
    const tot=ult.reduce((a,e)=>a+(e.args&&e.args.elementCount||0),0), totd=ult.reduce((a,e)=>a+e.dur,0)/1000;
    const tasks=M.filter(e=>e.name==='RunTask'&&e.ph==='X'&&e.dur>50000&&e.ts>=t0);
    const lay=M.filter(e=>e.name==='Layout'&&e.ph==='X').reduce((a,e)=>a+e.dur,0)/1000;
    console.log(v.name.padEnd(9),'rep',rep,`ULT n=${ult.length} elems=${tot} dur=${totd.toFixed(0)}ms layout=${lay.toFixed(0)}ms longtasks=${tasks.length}/${(tasks.reduce((a,e)=>a+e.dur,0)/1000).toFixed(0)}ms`);
    console.log('   big recalcs:',big.join(' | '));
    fs.unlinkSync(f);
  }
  await b.close();
})();
