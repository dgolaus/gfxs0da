const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openDisk}=require('./diskopen.js');
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const {p}=await openDisk(b,{name:'baseline'},{throttle:1});
  await p.goto('http://localhost:5173/',{waitUntil:'load'});
  await new Promise(r=>setTimeout(r,4000));
  const groups=await p.evaluate(()=>{
    window.__anims=document.getAnimations();
    const key=(a)=>{const t=a.effect&&a.effect.target;const ps=a.effect&&a.effect.pseudoElement||'';return (t?(t.tagName.toLowerCase()+(t.className&&typeof t.className==='string'?'.'+t.className.trim().split(/\s+/).join('.'):'')):'?')+ps+' ['+a.animationName+']';};
    const g={};window.__anims.forEach((a,i)=>{const k=key(a);(g[k]=g[k]||[]).push(i);});
    window.__groups=g;
    return Object.fromEntries(Object.entries(g).map(([k,v])=>[k,v.length]));
  });
  const f=path.join(__dirname,'ag_tmp.json');
  async function measure(label){
    await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
    await new Promise(r=>setTimeout(r,500));
    await p.tracing.stop();
    const ev=JSON.parse(fs.readFileSync(f,'utf8')).traceEvents;
    const u=ev.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X'&&e.args.elementCount>2).map(e=>e.args.elementCount).sort((a,b)=>a-b);
    console.log(label.padEnd(60),'median elements/frame',u[u.length>>1],'n',u.length);
  }
  await measure('ALL running');
  for(const k of Object.keys(groups)){
    await p.evaluate((k)=>{window.__anims.forEach((a,i)=>{ if(window.__groups[k].includes(i)) a.play(); else a.pause(); });},k);
    await measure(k+' x'+groups[k]);
  }
  await p.evaluate(()=>window.__anims.forEach(a=>a.pause()));
  await measure('NONE running');
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
