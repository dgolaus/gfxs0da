/* Preload hook (node -r ./diskserve-hook.js bench.js ...): used ONLY because the shared
   static server at localhost:5173 went down mid-run. It starts no server: inside each
   puppeteer page it answers requests for http://localhost:5173/* from the repo files on
   disk (read-only). bench.js file overrides still win (they respond first). */
const fs = require('fs');
const path = require('path');
const PC = '../node_modules/puppeteer-core/lib/cjs/puppeteer/';
const ROOT = '..';
const { HTTPRequest } = require(PC + 'api/HTTPRequest.js');
const { CdpBrowser } = require(PC + 'cdp/Browser.js');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const isLocal = (u) => { try { const x = new URL(u); return x.hostname === 'localhost' && x.port === '5173'; } catch (e) { return false; } };
function fromDisk(u) {
  let p = decodeURIComponent(new URL(u).pathname);
  let f = path.join(ROOT, p);
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (e) {}
  try {
    const body = fs.readFileSync(f);
    return { status: 200, contentType: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', body, headers: { 'cache-control': 'no-cache' } };
  } catch (e) { return { status: 404, contentType: 'text/plain', body: 'not found' }; }
}
const origContinue = HTTPRequest.prototype.continue;
HTTPRequest.prototype.continue = function (overrides, priority) {
  if (isLocal(this.url())) return this.respond(fromDisk(this.url()), priority);
  return origContinue.call(this, overrides, priority);
};
const origNewPage = CdpBrowser.prototype.newPage;
CdpBrowser.prototype.newPage = async function (...a) {
  const page = await origNewPage.apply(this, a);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    setTimeout(() => {
      try { if (!req.isInterceptResolutionHandled()) req.continue().catch(() => {}); } catch (e) {}
    }, 0);
  });
  return page;
};
