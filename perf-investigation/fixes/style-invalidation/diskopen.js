/* Diagnostic page opener that serves the repo from DISK via request interception
   (used only while the shared static server is unreachable). Same PRELUDE as bench.js. */
const path=require('path');const fs=require('fs');
const REPO='..';
const benchSrc=fs.readFileSync(path.join(__dirname,'../../bench.js'),'utf8');
const PRELUDE=eval(benchSrc.match(/const PRELUDE = (`[\s\S]*?`);/)[1]);
const types={'.js':'application/javascript','.css':'text/css','.json':'application/json','.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2'};
async function openDisk(browser,v,{throttle=4}={}){
  const p=await browser.newPage();await p.setViewport({width:+(process.env.VW||1440),height:+(process.env.VH||900),isMobile:!!process.env.MOBILE,hasTouch:!!process.env.MOBILE});
  const c=await p.target().createCDPSession();
  if(throttle>1)await c.send('Emulation.setCPUThrottlingRate',{rate:throttle});
  const over=Object.fromEntries(Object.entries(v.files||{}).map(([k,f])=>[k,fs.readFileSync(f)]));
  await p.setRequestInterception(true);
  p.on('request',(req)=>{const u=new URL(req.url());
    if(u.host!=='localhost:5173')return req.continue();
    let k=decodeURIComponent(u.pathname);if(k.endsWith('/'))k+='index.html';
    if(over[k])return req.respond({status:200,contentType:types[path.extname(k)]||'application/octet-stream',body:over[k]});
    const f=path.join(REPO,k);
    if(fs.existsSync(f)&&fs.statSync(f).isFile())return req.respond({status:200,contentType:types[path.extname(k)]||'application/octet-stream',body:fs.readFileSync(f)});
    return req.respond({status:404,body:''});});
  await p.evaluateOnNewDocument(PRELUDE);
  if(v.js)await p.evaluateOnNewDocument(v.js);
  return {p,c};
}
module.exports={openDisk};
