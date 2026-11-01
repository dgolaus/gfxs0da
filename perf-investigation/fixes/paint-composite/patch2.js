const fs=require('fs');let s=fs.readFileSync('vtrace.js','utf8');
const a="  const out={};";
const b=`  const out={};
  const tt=(n)=>{let s=0,end=-1,c=0;const ds=[];for(const e of X){if(e.name!==n)continue;if(e.ts>=end){const d=(e.tdur!=null?e.tdur:e.dur);s+=d;end=e.ts+e.dur;c++;ds.push(d/1000);}}ds.sort((a,b)=>a-b);return [Math.round(s/1000),c,ds.length?+ds[Math.floor(ds.length/2)].toFixed(2):0];};
  out.cpu={};for(const n of ['ProxyMain::BeginMainFrame','UpdateLayoutTree','PrePaint','Paint','Layerize','PaintArtifactCompositor::Update','Commit','LayerTreeHost::DoUpdateLayers']) out.cpu[n]=tt(n);`;
if(!s.includes(a)) throw new Error('nf'); s=s.replace(a,b); fs.writeFileSync('vtrace.js',s); console.log('ok');
