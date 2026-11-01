const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const ev=raw.traceEvents||raw;
const seen={};
for(const e of ev){ if(/Raster|Tile|tiling|Tiling/.test(e.name)&&e.args&&Object.keys(e.args).length){ if(!seen[e.name]){seen[e.name]={n:0,a:JSON.stringify(e.args).slice(0,400)};} seen[e.name].n++; } }
for(const [k,v] of Object.entries(seen)) console.log(v.n+'  '+k+'  '+v.a);
// collect raster tile rects
const rt=ev.filter(e=>/RasterizerTaskImpl::RunOnWorkerThread|RasterTask/.test(e.name)&&e.args);
const sizes={};for(const e of rt){const d=JSON.stringify(e.args);const m=d.match(/"content_rect":\[(\d+),(\d+),(\d+),(\d+)\]/)||d.match(/"(?:width|w)":(\d+).*?"(?:height|h)":(\d+)/);if(m){const k=m.length>3?m[3]+'x'+m[4]:m[1]+'x'+m[2];sizes[k]=(sizes[k]||0)+1;}}
console.log('raster rect sizes',JSON.stringify(sizes).slice(0,500));
