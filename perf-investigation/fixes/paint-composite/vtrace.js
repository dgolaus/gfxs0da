// Records a short trace for a variant (window [from,to] ms after navigation) and summarizes
// paint/composite work. Counts are what matter (other agents may load the CPU).
const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const [vfile,which,fromS,toS,thrS,inval]=process.argv.slice(2);
  const variants=JSON.parse(fs.readFileSync(vfile,'utf8'));
  const v=variants.find(x=>x.name===which);
  const from=+(fromS||3800), to=+(toS||5000), thr=+(thrS||4);
  const browser=await puppeteer.launch({headless:'new'});
  const {p,c}=await openPage(browser,v,{throttle:thr});
  const file=path.join(__dirname,'vt_'+which+'_'+from+'.json');
  const cats=['devtools.timeline','disabled-by-default-devtools.timeline','blink','cc','disabled-by-default-devtools.timeline.frame'];
  if(inval) cats.push('disabled-by-default-devtools.timeline.invalidationTracking');
  if(from<=0){ await p.tracing.start({path:file,categories:cats}); await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'}); await w8(to);} 
  else { await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'}); await w8(from); await p.tracing.start({path:file,categories:cats}); await w8(to-from);} 
  await p.tracing.stop(); await browser.close();
  const raw=JSON.parse(fs.readFileSync(file,'utf8')); const ev=raw.traceEvents||raw;
  const metas=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain');
  const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;cnt[k]=(cnt[k]||0)+1;}
  const MAIN=metas.map(m=>m.pid+':'+m.tid).sort((a,b)=>cnt[b]-cnt[a])[0];
  const X=ev.filter(e=>(e.pid+':'+e.tid)===MAIN&&e.ph==='X'&&e.dur!=null).sort((a,b)=>a.ts-b.ts||b.dur-a.dur);
  const top=(n)=>{let s=0,end=-1,c=0;const ds=[];for(const e of X){if(e.name!==n)continue;if(e.ts>=end){s+=e.dur;end=e.ts+e.dur;c++;ds.push(e.dur/1000);}}ds.sort((a,b)=>a-b);return [Math.round(s/1000),c,ds.length?+ds[Math.floor(ds.length/2)].toFixed(2):0];};
  const out={};
  const tt=(n)=>{let s=0,end=-1,c=0;const ds=[];for(const e of X){if(e.name!==n)continue;if(e.ts>=end){const d=(e.tdur!=null?e.tdur:e.dur);s+=d;end=e.ts+e.dur;c++;ds.push(d/1000);}}ds.sort((a,b)=>a-b);return [Math.round(s/1000),c,ds.length?+ds[Math.floor(ds.length/2)].toFixed(2):0];};
  out.cpu={};for(const n of ['ProxyMain::BeginMainFrame','UpdateLayoutTree','PrePaint','Paint','Layerize','PaintArtifactCompositor::Update','Commit','LayerTreeHost::DoUpdateLayers']) out.cpu[n]=tt(n);
  for(const n of ['ProxyMain::BeginMainFrame','RunTask','FireAnimationFrame','UpdateLayoutTree','Layout','PrePaint','Paint','Layerize','Commit','LayerTreeHost::DoUpdateLayers','Blink.Animate.UpdateTime']) out[n]=top(n);
  // paint per node (self)
  const P=X.filter(e=>e.name==='Paint');for(const q of P)q.self=q.dur;const st=[];for(const q of P){while(st.length&&st[st.length-1].ts+st[st.length-1].dur<=q.ts)st.pop();if(st.length)st[st.length-1].self-=q.dur;st.push(q);}
  const by={};for(const q of P){const k=(q.args.data&&q.args.data.nodeName)||'?';by[k]=by[k]||[0,0];by[k][0]++;by[k][1]+=q.self;}
  out.paintNodes=Object.entries(by).sort((a,b)=>b[1][1]-a[1][1]).slice(0,14).map(([k,v])=>v[0]+'x '+(v[1]/1000).toFixed(1)+'ms '+k);
  // animations composite status
  const an=ev.filter(e=>e.name==='Animation'&&e.ph==='n'&&e.args&&e.args.data&&'compositeFailed' in e.args.data);
  const anb=ev.filter(e=>e.name==='Animation'&&e.ph==='b');
  const nameOf={};for(const b of anb){nameOf[JSON.stringify(b.id2||b.id)]=(b.args.data.displayName||b.args.data.name)+'@'+b.args.data.nodeName;}
  const agg={};for(const a of an){const k=(nameOf[JSON.stringify(a.id2||a.id)]||'?')+' fail='+a.args.data.compositeFailed+(a.args.data.unsupportedProperties?' '+a.args.data.unsupportedProperties.join('/'):'');agg[k]=(agg[k]||0)+1;}
  out.animations=Object.keys(agg).sort();
  if(inval){const iv=ev.filter(e=>/Invalidation/.test(e.name));const ia={};for(const e of iv){const d=e.args&&e.args.data||{};const k=e.name+' '+(d.nodeName||'')+' '+(d.reason||'');ia[k]=(ia[k]||0)+1;}out.invalidations=Object.entries(ia).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([k,v])=>v+'  '+k);}
  console.log(JSON.stringify(out,null,1));
  if(!process.env.KEEP) fs.unlinkSync(file); else console.error('kept '+file);
})().catch(e=>{console.error(e);process.exit(1)});
