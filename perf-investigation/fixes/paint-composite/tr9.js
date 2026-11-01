const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const ev=raw.traceEvents||raw;
const names=new Set(['Layerize','PaintArtifactCompositor::Update','PaintArtifactCompositor::UpdateRepaintedLayers','LocalFrameView::PushPaintArtifactToCompositor','PaintArtifactCompositor::DecompositeTransforms','PaintArtifactCompositor::LayerizeGroup','PaintArtifactCompositor::CollectPendingLayers']);
const seen={};
for(const e of ev){ if(/PaintArtifact|Layeriz|PendingLayer|ContentLayerClient|cc::Layer|PropertyTree/.test(e.name)){ seen[e.name]=seen[e.name]||{n:0,args:JSON.stringify(e.args).slice(0,300)}; seen[e.name].n++; } }
for(const [k,v] of Object.entries(seen)) console.log(v.n+'  '+k+'  '+v.args);
