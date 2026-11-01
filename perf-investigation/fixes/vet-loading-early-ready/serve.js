// Serves the repo through request interception (no server). Modified files via map.
const fs=require('fs');const path=require('path');
const ROOT='..';
const CT={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.avif':'image/avif','.ico':'image/x-icon','.mp4':'video/mp4','.webm':'video/webm','.gif':'image/gif','.txt':'text/plain'};
const cache=new Map();
function read(f){if(!cache.has(f))cache.set(f,fs.existsSync(f)&&fs.statSync(f).isFile()?fs.readFileSync(f):null);return cache.get(f);}
async function attach(p,files){
  const map=Object.fromEntries(Object.entries(files||{}).map(([k,f])=>[k,fs.readFileSync(f)]));
  await p.setRequestInterception(true);
  p.on('request',req=>{
    const u=new URL(req.url());
    if(u.host!=='localhost:5173')return req.continue();
    let k=decodeURIComponent(u.pathname);if(k.endsWith('/'))k+='index.html';
    let body=map[k];let f=path.join(ROOT,k);
    if(!body){body=read(f);if(!body&&!path.extname(k)){f=path.join(ROOT,k,'index.html');body=read(f);k+='/index.html';}}
    if(!body)return req.respond({status:404,contentType:'text/plain',body:'nf'});
    req.respond({status:200,contentType:CT[path.extname(k).toLowerCase()]||'application/octet-stream',body});
  });
}
module.exports={attach};
