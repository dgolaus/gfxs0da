/* Vet: trace baseline vs font-preload variant (cold+warm, CPU 4x) and report
   font requests, RemoteFontLoaded, font invalidations, FCP, big layouts and
   every Layout > 20ms after the first font arrival. Ordering, not timing. */
const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const OUT=__dirname;const REPO='..';const TYPE=k=>({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4'})[path.extname(k)]||'application/octet-stream';
const VAR='fixes/loading/index.fontpreload.html';
const V=__dirname.split(path.sep).join('/');const ALL=[{name:'baseline'},{name:'preload',files:{'/index.html':VAR}},{name:'fontsload',files:{'/index.html':V+'/index.fontsload.html'}},{name:'uagated',files:{'/index.html':V+'/index.uagated.html'}}];const pick=(process.argv[3]||'baseline,preload').split(',');const variants=ALL.filter(v=>pick.includes(v.name));
const PRE=`try{localStorage.setItem('s0da-lite','0')}catch(e){};Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});const _a=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(...c){if(this===document.documentElement.classList&&c.includes('lite')){c=c.filter(x=>x!=='lite');if(!c.length)return;}return _a.apply(this,c);};`;
const ROUNDS=+(process.argv[2]||1);
async function one(v,cold){
  const b=await puppeteer.launch({headless:'new'});
  const ver=await b.version();
  const setup=async(p)=>{
    const map=v.files?Object.fromEntries(Object.entries(v.files).map(([k,f])=>[k,fs.readFileSync(f)])):{};
    await p.setRequestInterception(true);await p.setCacheEnabled(true);
    p.on('request',req=>{const u=new URL(req.url());if(!u.host.startsWith('localhost'))return req.continue();
      let k=decodeURIComponent(u.pathname);if(k.endsWith('/'))k+='index.html';
      const body=map[k]||(fs.existsSync(path.join(REPO,k))?fs.readFileSync(path.join(REPO,k)):null);
      if(!body)return req.respond({status:404,body:''});
      return req.respond({status:200,contentType:TYPE(k),body});});
  };
  if(!cold){const w=await b.newPage();await setup(w);await w.goto('http://localhost:5173/',{waitUntil:'networkidle2'});await w.close();}
  const p=await b.newPage();await p.setViewport({width:1440,height:900});await setup(p);
  const msgs=[];p.on('console',m=>{if(/preload/i.test(m.text()))msgs.push(m.text().slice(0,120))});
  const c=await p.target().createCDPSession();await c.send('Emulation.setCPUThrottlingRate',{rate:4});
  await p.evaluateOnNewDocument(PRE);
  const file=path.join(OUT,`vt_${v.name}_${cold?'cold':'warm'}.json`);
  await p.tracing.start({path:file,categories:['devtools.timeline','disabled-by-default-devtools.timeline','loading','blink','rail','disabled-by-default-devtools.timeline.stack']});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,4500));
  const fcp=await p.evaluate(()=>{const e=performance.getEntriesByName('first-contentful-paint')[0];return e?Math.round(e.startTime):null});
  await p.tracing.stop();await new Promise(r=>setTimeout(r,3500));await b.close();
  return {file,ver,fcp,msgs};
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
  const o={fontReq:[],fontsLoaded:[],fontInval:[],fcpTrace:null,layoutsAfterFont:[],totLayoutMs:0,totRecalcMs:0,layoutMsAfterFirstFont:0,bigLayouts:[]};
  const sorted=ev.filter(e=>e.pid===pid).sort((a,b)=>a.ts-b.ts);
  let firstFont=null;
  for(const e of sorted){
    if(e.name==='ResourceSendRequest'&&/gstatic/.test(e.args.data.url)) o.fontReq.push(T(e.ts)+':'+e.args.data.url.split('/')[4]+'/'+e.args.data.url.split('/').pop().slice(-14)+':'+e.args.data.priority);
    if(e.name==='RemoteFontLoaded'){o.fontsLoaded.push(T(e.ts)+':'+(((e.args.data||e.args).name)||'?'));if(firstFont===null)firstFont=e.ts;}
    if(e.name==='firstContentfulPaint'&&o.fcpTrace===null) o.fcpTrace=T(e.ts);
    if(!isMain(e)||e.ph!=='X') continue;
    if(e.name==='LayoutObject::InvalidateSubtreeForFontUpdates') o.fontInval.push(T(e.ts));
    if(e.name==='Layout'){o.totLayoutMs+=e.dur/1000;const d=e.args.beginData||{};
      if(d.dirtyObjects>500) o.bigLayouts.push(`${T(e.ts)}:${Math.round(e.dur/1000)}ms:${d.dirtyObjects}/${d.totalObjects}`);
      if(firstFont!==null&&e.ts>=firstFont){o.layoutMsAfterFirstFont+=e.dur/1000;if(e.dur>20000)o.layoutsAfterFont.push(`${T(e.ts)}:${Math.round(e.dur/1000)}ms:${d.dirtyObjects}/${d.totalObjects}`);}}
    if(e.name==='UpdateLayoutTree') o.totRecalcMs+=e.dur/1000;
  }
  o.totLayoutMs=Math.round(o.totLayoutMs);o.totRecalcMs=Math.round(o.totRecalcMs);o.layoutMsAfterFirstFont=Math.round(o.layoutMsAfterFirstFont);
  return o;
}
(async()=>{
  for(let r=0;r<ROUNDS;r++) for(const cold of (process.argv[4]==='warm'?[false]:process.argv[4]==='cold'?[true]:[true,false])) for(const v of variants){
    const {file,ver,fcp,msgs}=await one(v,cold);
    const a=analyze(file);
    console.log(JSON.stringify({round:r,variant:v.name,cache:cold?'cold':'warm',ver,fcp,preloadMsgs:msgs,...a}));
    fs.unlinkSync(file);
  }
})().catch(e=>{console.error(e);process.exit(1)});
