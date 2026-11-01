// Counts LayerTree.layerTreeDidChange events in a steady window and how the layer set changes.
const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const [vfile,...names]=process.argv.slice(2);
  const variants=JSON.parse(fs.readFileSync(vfile,'utf8'));
  const browser=await puppeteer.launch({headless:'new'});
  for(const name of names){
    const v=variants.find(x=>x.name===name)||{name};
    const {p,c}=await openPage(browser,v,{throttle:1});
    let evs=[];
    c.on('LayerTree.layerTreeDidChange',e=>{evs.push(e.layers||[]);});
    await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
    await c.send('LayerTree.enable');
    await w8(3500);
    evs=[];
    const f0=await p.evaluate(()=>window.__frames.length);
    await w8(2000);
    const f1=await p.evaluate(()=>window.__frames.length);
    const sig=l=>l.map(x=>x.layerId).join(',');
    let structural=0;for(let i=1;i<evs.length;i++){if(sig(evs[i])!==sig(evs[i-1]))structural++;}
    const counts=evs.map(l=>l.length);
    // which layers' size/offset change between consecutive events
    const changed={};
    for(let i=1;i<evs.length;i++){const prev=Object.fromEntries(evs[i-1].map(x=>[x.layerId,x]));for(const x of evs[i]){const q=prev[x.layerId];if(q&&(q.width!==x.width||q.height!==x.height||q.offsetX!==x.offsetX||q.offsetY!==x.offsetY||JSON.stringify(q.transform)!==JSON.stringify(x.transform))){changed[x.layerId]=(changed[x.layerId]||0)+1;}}}
    const top=Object.entries(changed).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const descr=[];
    for(const [id,n] of top){const l=evs[evs.length-1].find(x=>x.layerId===id)||{};let node='';if(l.backendNodeId){try{await c.send('DOM.getDocument',{depth:0});const d=await c.send('DOM.describeNode',{backendNodeId:l.backendNodeId});const a=d.node.attributes||[];const ci=a.indexOf('class');node=d.node.nodeName+(ci>=0?'.'+a[ci+1]:'');}catch(e){node='?'}}descr.push(n+'x '+node+' '+Math.round(l.width)+'x'+Math.round(l.height));}
    console.log(name.padEnd(22)+' frames2s='+(f1-f0)+' treeChanges='+evs.length+' structural='+structural+' layers='+Math.min(...counts)+'-'+Math.max(...counts)+' | '+descr.join(' ; '));
    await p.close();
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
