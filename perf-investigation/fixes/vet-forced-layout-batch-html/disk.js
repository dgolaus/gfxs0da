const fs = require('fs');
const path = require('path');
const ROOT = '..';
const CT = { js: 'application/javascript', css: 'text/css', json: 'application/json', html: 'text/html; charset=utf-8', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon', woff2: 'font/woff2', woff: 'font/woff', mp4: 'video/mp4', webm: 'video/webm', txt: 'text/plain', avif: 'image/avif' };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
async function serve(p, files, { holdScript = 0 } = {}) {
  const map = Object.fromEntries(Object.entries(files || {}).map(([k, f]) => [k, fs.readFileSync(f)]));
  await p.setRequestInterception(true);
  p.on('request', async (req) => {
    const u = new URL(req.url());
    if (!u.host.startsWith('localhost')) { if (u.host.includes('cloudflareinsights')) return req.abort(); return req.continue(); }
    let k = decodeURIComponent(u.pathname); if (k === '/' || k === '') k = '/index.html'; if (k.endsWith('/')) k += 'index.html';
    if (k === '/script.js' && holdScript) await w8(holdScript);
    const ext = k.split('.').pop().toLowerCase();
    let body = map[k];
    if (!body) { const f = path.join(ROOT, k); if (fs.existsSync(f) && fs.statSync(f).isFile()) body = fs.readFileSync(f); }
    if (!body) return req.respond({ status: 404, contentType: 'text/plain', body: 'nf' });
    try { return await req.respond({ status: 200, contentType: CT[ext] || 'application/octet-stream', body }); } catch (e) {}
  });
}
module.exports = { serve };
