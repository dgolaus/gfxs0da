// Lists composited layers with node + compositing reasons at a given time after nav.
// NOTE: LayerTree.enable must be sent AFTER navigation commits (bench.js layers enables before goto and gets 0 layers in Chrome 148).
const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{
  const vfile=process.argv[2]; const which=process.argv[3]||'baseline'; const waitMs=+(process.argv[4]||2500); const filt=process.argv[5]||'';
  const variants=vfile?JSON.parse(fs.readFileSync(vfile,'utf8')):[{name:'baseline'}];
  const v=variants.find(x=>x.name===which);
  const browser=await puppeteer.launch({headless:'new'});
  const {p,c}=await openPage(browser,v,{throttle:1});
  let last=null;
  c.on('LayerTree.layerTreeDidChange',e=>{if(e.layers&&e.layers.length)last=e.layers;});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await c.send('DOM.enable');
  await c.send('LayerTree.enable');
  await new Promise(r=>setTimeout(r,waitMs));
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await new Promise(r=>setTimeout(r,200));
  const layers=(last||[]);
  await c.send('DOM.getDocument',{depth:-1});
  const out=[];
  for(const l of layers){
    let reasons=[];
    try{const r=await c.send('LayerTree.compositingReasons',{layerId:l.layerId});reasons=r.compositingReasonIds||r.compositingReasons||[];}catch(e){}
    let node='';
    if(l.backendNodeId){try{const d=await c.send('DOM.describeNode',{backendNodeId:l.backendNodeId});const n=d.node;const a=n.attributes||[];const ci=a.indexOf('class');const ii=a.indexOf('id');node=n.nodeName+(ii>=0?'#'+a[ii+1]:'')+(ci>=0?'.'+a[ci+1].replace(/ /g,'.'):'');}catch(e){node='?'}}
    out.push({id:l.layerId,parent:l.parentLayerId,x:Math.round(l.offsetX),y:Math.round(l.offsetY),w:Math.round(l.width),h:Math.round(l.height),draws:l.drawsContent,node,reasons:reasons.join(','),paintCount:l.paintCount});
  }
  console.log('total layers',out.length,'drawsContent',out.filter(x=>x.draws).length);
  const area=out.filter(x=>x.draws).reduce((a,x)=>a+x.w*x.h,0);
  console.log('megapixels',(area/1e6).toFixed(1));
  for(const o of out) if(!filt||(o.node+o.reasons).includes(filt)) console.log(String(o.w).padStart(6)+'x'+String(o.h).padEnd(6)+' @'+String(o.x).padStart(6)+','+String(o.y).padEnd(6)+(o.draws?' D ':'   ')+' pc='+String(o.paintCount).padEnd(4)+' '+o.node.slice(0,60).padEnd(60)+' '+o.reasons);
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
