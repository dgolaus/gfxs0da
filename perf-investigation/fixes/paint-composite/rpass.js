// Counts viz render passes per composited frame (GPU process) in a steady window, per variant.
const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const [vfile,...names]=process.argv.slice(2);
  const variants=JSON.parse(fs.readFileSync(vfile,'utf8'));
  for(const name of names){
    const v=variants.find(x=>x.name===name)||{name};
    const browser=await puppeteer.launch({headless:'new'});
    const {p}=await openPage(browser,v,{throttle:1});
    await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
    await w8(4000);
    const file=path.join(__dirname,'rp_'+name+'.json');
    await p.tracing.start({path:file,categories:['viz','gpu','disabled-by-default-viz.quads']});
    await w8(1200);
    await p.tracing.stop();
    await browser.close();
    const ev=JSON.parse(fs.readFileSync(file,'utf8')).traceEvents;
    const meta=ev.filter(e=>e.ph==='M'&&e.name==='thread_name');
    const viz=meta.filter(m=>m.args.name==='VizCompositorThread').map(m=>m.pid+':'+m.tid);
    const V=ev.filter(e=>viz.includes(e.pid+':'+e.tid)&&e.ph==='X'&&e.dur!=null).sort((a,b)=>a.ts-b.ts);
    const frames=V.filter(e=>e.name==='DirectRenderer::DrawFrame');
    const passes=V.filter(e=>e.name==='DirectRenderer::DrawRenderPass');
    let per=[];for(const f of frames){per.push(passes.filter(x=>x.ts>=f.ts&&x.ts<=f.ts+f.dur).length);}
    per.sort((a,b)=>a-b);
    const quads=passes.reduce((a,x)=>a+((x.args&&x.args.NumberOfQuads)||0),0);
    const gpu=ev.filter(e=>e.name==='SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass'&&e.ph==='X');
    const gms=gpu.reduce((a,x)=>a+x.dur,0)/1000;
    console.log(name.padEnd(26)+' frames='+frames.length+' renderPasses/frame median='+per[Math.floor(per.length/2)]+' min='+per[0]+' max='+per[per.length-1]+' quads/frame='+(quads/Math.max(1,frames.length)).toFixed(0)+' gpuFinishPaintRenderPass/frame='+(gms/Math.max(1,gpu.length)).toFixed(2)+'ms');
    fs.unlinkSync(file);
  }
})().catch(e=>{console.error(e);process.exit(1)});
