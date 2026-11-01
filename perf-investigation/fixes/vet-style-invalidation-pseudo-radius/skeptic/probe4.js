// Which font actually shapes the nav / CTA text in each load, and does that explain the 1/64px text-width "alt mode"?
// Mimics comp.js up to its first dump (settle 2500, pin at 5000), then records nav width, CDP platform fonts for a nav link
// and a .btn label, gstatic request failures/finish times, and FontFace states.
// usage: node probe3.js <WxH> <N> <variant...>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [vp, N = '6', ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
(async () => {
  const rows = [];
  for (let k = 0; k < +N; k++) for (const v of vars) {
    const b = await L.launch();
    const { p, c } = await L.open(b, v, { w: W, h: H, block: process.env.BLOCK ? new RegExp(process.env.BLOCK) : null });
    const fails = []; const fin = [];
    p.on('requestfailed', (r) => { if (/gstatic|googleapis/.test(r.url())) fails.push(r.url().split('/').pop().slice(0, 20) + ':' + (r.failure() && r.failure().errorText)); });
    p.on('requestfinished', (r) => { if (/gstatic/.test(r.url())) fin.push(r.url().split('/').pop().slice(0, 12)); });
    const t0 = Date.now();
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} } });
    await L.w8(120);
    await c.send('DOM.enable'); await c.send('CSS.enable');
    const { root } = await c.send('DOM.getDocument', { depth: -1 });
    const pf = async (sel) => { const { nodeId } = await c.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel }); if (!nodeId) return '-'; const r = await c.send('CSS.getPlatformFontsForNode', { nodeId }); return r.fonts.map((f) => `${f.familyName}${f.isCustomFont ? '(web)' : '(LOCAL)'}x${f.glyphCount}`).join('+'); };
    const navF = await pf('.nav-links a'); const btnF = await pf('.hero .btn-ghost'); const accF = await pf('.accent-text');
    const r = await p.evaluate(() => ({ nav: getComputedStyle(document.querySelector('.nav-links')).width,
      ff: [...document.fonts].filter((f) => /U\+0-FF/.test(f.unicodeRange)).map((f) => f.family.replace(/ /g, '') + f.weight + ':' + f.status[0]).join(' ') }));
    await b.close();
    const row = { k, v, ...r, navF, btnF, accF, fails, nfin: fin.length, ms: Date.now() - t0 };
    rows.push(row);
    console.log(k, v, 'nav', r.nav, '| navFont', navF, '| btnFont', btnF, '| accFont', accF, '| gstatic finished', fin.length, 'failed', fails.length, fails.join(' '), '|', r.ff);
  }
  const by = {}; for (const r of rows) { const key = `${r.v} nav=${r.nav} navFont=${r.navF}`; by[key] = (by[key] || 0) + 1; }
  console.log('MODES', JSON.stringify(by, null, 1));
  fs.writeFileSync(path.join(__dirname, `probe4_${W}_${(process.env.BLOCK||'').replace(/\W/g,'')}.json`), JSON.stringify(rows, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
