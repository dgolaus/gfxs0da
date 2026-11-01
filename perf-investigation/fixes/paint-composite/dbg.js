const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{
  for (const mode of ['new','shell']) {
  let browser;
  try { browser=await puppeteer.launch({headless:mode}); } catch(e){ console.log(mode,'launch failed',e.message.slice(0,200)); continue; }
  console.log(mode, await browser.version());
  const p=await browser.newPage();
  await p.setViewport({width:1440,height:900});
  const c=await p.target().createCDPSession();
  let n=0,withL=0,maxL=0;
  c.on('LayerTree.layerTreeDidChange',e=>{n++; if(e.layers){withL++;maxL=Math.max(maxL,e.layers.length);}});
  await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});
  await c.send('DOM.enable'); await c.send('Page.enable');
  await c.send('LayerTree.enable');
  await p.evaluate(()=>window.scrollBy(0,10));
  await new Promise(r=>setTimeout(r,1500));
  console.log('events',n,'withLayers',withL,'max',maxL);
  await browser.close();
  }
})();
