// openPage that does not need the static server: every localhost request is
// answered from disk (repo, or the variant's override file). Other hosts go to network.
const fs = require('fs');
const path = require('path');
const REPO = '..';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.avif': 'image/avif', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const PRELUDE = `(() => {
  try { localStorage.setItem('s0da-lite', '0'); } catch (e) {}
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  const add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function (...c) {
    if (this === document.documentElement.classList && c.includes('lite')) { c = c.filter((x) => x !== 'lite'); if (!c.length) return; }
    return add.apply(this, c);
  };
})();`;
async function openPage(browser, v, { throttle = 1, width = 1440, height = 900, extra } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width, height });
  const c = await p.target().createCDPSession();
  if (throttle > 1) await c.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const map = Object.fromEntries(Object.entries(v.files || {}).map(([k, f]) => [k, fs.readFileSync(f)]));
  const log = [];
  await p.setRequestInterception(true);
  p.on('request', (req) => {
    const u = new URL(req.url());
    log.push(u.host + u.pathname);
    if (!u.host.startsWith('localhost')) return req.continue();
    let k = decodeURIComponent(u.pathname);
    if (k === '/' || k === '') k = '/index.html'; else if (k.endsWith('/')) k += 'index.html';
    if (map[k]) return req.respond({ status: 200, contentType: MIME[path.extname(k)] || 'text/html', body: map[k] });
    const f = path.join(REPO, k);
    try { if (fs.statSync(f).isFile()) return req.respond({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); } catch (e) {}
    req.respond({ status: 404, contentType: 'text/plain', body: 'nf' });
  });
  await p.evaluateOnNewDocument(PRELUDE);
  if (v.js) await p.evaluateOnNewDocument(v.js);
  if (extra) await p.evaluateOnNewDocument(extra);
  return { p, c, log };
}
module.exports = { openPage, REPO };
