// Builds bench_disk.js: identical to ../../bench.js, but when the localhost:5173 server is down it serves
// every localhost request straight from the repo (read-only) via request interception. No server is started.
const fs=require('fs');
let s=fs.readFileSync('../../bench.js','utf8');
const a="  if (v.files && Object.keys(v.files).length) {";
if(!s.includes(a)) throw new Error('anchor');
s=s.replace(a, "  if (true) {");
const b="      if (map[k] && u.host.startsWith('localhost')) return req.respond({ status: 200, contentType: type(k), body: map[k] });";
if(!s.includes(b)) throw new Error('anchor2');
s=s.replace(b, b+"\n      if (u.host.startsWith('localhost')) { const REPO='..'; let f=REPO+decodeURIComponent(k); try { if (fs.statSync(f).isDirectory()) f+= '/index.html'; } catch(e){} if (fs.existsSync(f)) { const ext=f.split('.').pop().toLowerCase(); const ct={js:'application/javascript',css:'text/css',json:'application/json',html:'text/html; charset=utf-8',webp:'image/webp',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',svg:'image/svg+xml',ico:'image/x-icon',woff2:'font/woff2',mp4:'video/mp4',txt:'text/plain'}[ext]||'application/octet-stream'; return req.respond({ status: 200, contentType: ct, body: fs.readFileSync(f), headers: {'cache-control':'no-cache'} }); } return req.respond({ status: 404, contentType: 'text/plain', body: 'nf' }); }");
s=s.replace("const map = Object.fromEntries(Object.entries(v.files).map(","const map = Object.fromEntries(Object.entries(v.files||{}).map(");
s=s.replace("const OUT = __dirname;","const OUT = __dirname; // outputs land in fixes/paint-composite");
s=s.split("path.join('../node_modules/puppeteer')").join("path.join('../node_modules/puppeteer')");
fs.writeFileSync('bench_disk.js',s); console.log('ok');
