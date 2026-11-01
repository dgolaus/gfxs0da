const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const ev=raw.traceEvents||raw;
const VIZ=process.argv[3], GPU=process.argv[4];
const metas=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain');
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;cnt[k]=(cnt[k]||0)+1;}
const MAIN=metas.map(m=>m.pid+':'+m.tid).sort((a,b)=>cnt[b]-cnt[a])[0];
const t0=Math.min(...ev.filter(e=>(e.pid+':'+e.tid)===MAIN&&e.ts).map(e=>e.ts));
const V=ev.filter(e=>(e.pid+':'+e.tid)===VIZ&&e.ph==='X'&&e.dur!=null).sort((a,b)=>a.ts-b.ts);
const frames=V.filter(e=>e.name==='DirectRenderer::DrawFrame');
console.log('sample DrawRenderPass args:',JSON.stringify((V.find(e=>e.name==='DirectRenderer::DrawRenderPass')||{}).args));
const G=ev.filter(e=>(e.pid+':'+e.tid)===GPU&&e.ph==='X'&&e.dur!=null&&e.name==='SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass');
console.log('sample FinishPaintRenderPass args',JSON.stringify((G[0]||{}).args));
const B=250;const rows={};
for(const f of frames){const b=Math.floor((f.ts-t0)/1000/B);const kids=V.filter(e=>e.name==='DirectRenderer::DrawRenderPass'&&e.ts>=f.ts&&e.ts<=f.ts+f.dur);rows[b]=rows[b]||{frames:0,passes:0,drawMs:0};rows[b].frames++;rows[b].passes+=kids.length;rows[b].drawMs+=f.dur/1000;}
for(const g of G){const b=Math.floor((g.ts-t0)/1000/B);rows[b]=rows[b]||{frames:0,passes:0,drawMs:0};rows[b].gpuFPRP=(rows[b].gpuFPRP||0)+g.dur/1000;rows[b].nFPRP=(rows[b].nFPRP||0)+1;}
for(const [b,r] of Object.entries(rows)) console.log(String(b*B).padStart(5)+'ms frames='+r.frames+' renderPasses/frame='+(r.passes/Math.max(1,r.frames)).toFixed(1)+' vizDraw='+r.drawMs.toFixed(0)+'ms gpuFinishPaintRenderPass='+(r.gpuFPRP||0).toFixed(0)+'ms n='+(r.nFPRP||0)+' per='+((r.gpuFPRP||0)/Math.max(1,r.nFPRP||0)).toFixed(2));
