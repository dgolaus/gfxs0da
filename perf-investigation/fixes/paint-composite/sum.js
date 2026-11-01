const o=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('wall  '+['ProxyMain::BeginMainFrame','UpdateLayoutTree','PrePaint','Paint','Layerize','Commit'].map(k=>k.replace(/.*::/,'')+'='+o[k].join('/')).join('  '));
console.log('cpu   '+Object.entries(o.cpu).map(([k,v])=>k.replace(/.*::/,'').replace('LayerTreeHost::','')+'='+v.join('/')).join('  '));
console.log('  '+o.paintNodes.slice(0,8).join(' | '));
if(process.argv[2]) console.log('  anims: '+o.animations.join(' ; '));
