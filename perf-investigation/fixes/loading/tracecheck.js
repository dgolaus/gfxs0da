/* Mechanism check (ordering, not timing): trace baseline vs a variant, cold and warm,
   CPU 4x, and report font arrival vs big layouts, whole-doc recalcs after boot.js,
   and hero counter start relative to readyState=interactive. */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const OUT=__dirname;
const variants=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const PRE=`try{localStorage.setItem('s0da-lite','0')}catch(e){};Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});const _a=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}return _a.apply(this,c);};
window.__m={};document.addEventListener('readystatechange',()=>{window.__m[document.readyState]=performance.now()});
new MutationObserver((ms,o)=>{for(const m of ms){const t=m.target.nodeType===3?m.target.parentNode:m.target;if(t&&t.classList&&t.classList.contains('counter')&&t.closest('.hero-stats-strip')&&t.textContent!=='0'&&!window.__m.counter){window.__m.counter=performance.now();}}}).observe(document,{subtree:true,childList:true,characterData:true});`;
async function one(v,cold){
  const b=await puppeteer.launch({headless:'new'});
  const setup=async(p)=>{
    if(v.files){const map=Object.fromEntries(Object.entries(v.files).map(([k,f])=>[k,fs.readFileSync(f)]));
      const type=k=>k.endsWith('.js')?'application/javascript':k.endsWith('.css')?'text/css':'text/html; charset=utf-8';
      await p.setRequestInterception(true);
      p.on('request',req=>{const u=new URL(req.url());let k=u.pathname;if(k==='/'||k==='')k='/index.html';if(map[k]&&u.host.startsWith('localhost'))return req.respond({status:200,contentType:type(k),body:map[k]});req.continue();});}
  };
  if(!cold){const w=await b.newPage();await setup(w);await w.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await w.close();}
  const p=await b.newPage();await p.setViewport({width:1440,height:900});await setup(p);
  const c=await p.target().createCDPSession();await c.send('Emulation.setCPUThrottlingRate',{rate:4});
  await p.evaluateOnNewDocument(PRE);
  const file=path.join(OUT,`tc_${v.name}_${cold?'cold':'warm'}.json`);
  await p.tracing.start({path:file,categories:['devtools.timeline','disabled-by-default-devtools.timeline','loading','blink','disabled-by-default-devtools.timeline.stack']});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,4500));
  const m=await p.evaluate(()=>window.__m);
  await p.tracing.stop();await b.close();
  return {file,m};
}
function analyze(file){
  const ev=JSON.parse(fs.readFileSync(file,'utf8')).traceEvents;
  const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
  const mains=meta.filter(m=>m.args&&m.args.name==='CrRendererMain').map(m=>m.pid+':'+m.tid);
  const cnt={};ev.forEach(e=>{const k=e.pid+':'+e.tid;if(mains.includes(k)&&e.name==='Layout')cnt[k]=(cnt[k]||0)+1});
  const main=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];const pid=+main.split(':')[0];
  const isMain=e=>(e.pid+':'+e.tid)===main;
  const nav=ev.find(e=>e.name==='navigationStart'&&e.pid===pid&&e.args&&e.args.data&&/localhost/.test(e.args.data.documentLoaderURL||''));
  const t0=nav?nav.ts:Math.min(...ev.filter(e=>isMain(e)&&e.ts).map(e=>e.ts));
  const T=ts=>Math.round((ts-t0)/1000);
  const out={fonts:[],fontInval:[],bigLayouts:[],bigRecalcs:[],bootEval:null,fontReq:[]};
  for(const e of ev.filter(e=>e.pid===pid).sort((a,b)=>a.ts-b.ts)){
    if(e.name==='RemoteFontLoaded') out.fonts.push(T(e.ts)+':'+((e.args.data||e.args).name||(e.args.data||e.args).url||'?'));
    if(e.name==='LayoutObject::InvalidateSubtreeForFontUpdates'&&isMain(e)) out.fontInval.push(T(e.ts));
    if(e.name==='ResourceSendRequest'&&/gstatic/.test(e.args.data.url)) out.fontReq.push(T(e.ts)+':'+e.args.data.url.split('/')[4]+':'+e.args.data.priority);
    if(e.name==='Layout'&&isMain(e)&&e.ph==='X'&&e.args.beginData&&e.args.beginData.dirtyObjects>500) out.bigLayouts.push(`${T(e.ts)}:${Math.round(e.dur/1000)}ms:${e.args.beginData.dirtyObjects}/${e.args.beginData.totalObjects}`);
    if(e.name==='UpdateLayoutTree'&&isMain(e)&&e.ph==='X'&&(e.args.elementCount||0)>500) out.bigRecalcs.push(`${T(e.ts)}:${Math.round(e.dur/1000)}ms:el${e.args.elementCount}`);
    if(e.name==='EvaluateScript'&&isMain(e)&&/boot\.js/.test(e.args.data&&e.args.data.url||'')) out.bootEval=T(e.ts);
  }
  return out;
}
(async()=>{
  for(const cold of [true,false]) for(const v of variants){
    const {file,m}=await one(v,cold);
    const a=analyze(file);
    console.log(JSON.stringify({variant:v.name,cache:cold?'cold':'warm',counterMinusInteractive:m.counter&&m.interactive?Math.round(m.counter-m.interactive):null,interactive:Math.round(m.interactive||0),counter:Math.round(m.counter||0),...a}));
    fs.unlinkSync(file);
  }
})().catch(e=>{console.error(e);process.exit(1)});
