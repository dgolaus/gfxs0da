// Same-page containment check without interaction: at each stop, frozen + JS timers held,
// screenshot with content-visibility:auto (a), forced visible (b), auto again (a2). node static.js <tag> <WxH[m]> <variant>
const fs = require('fs'); const path = require('path');
const L = require('./lib.js');
const [tag, SZ, V0] = process.argv.slice(2);
const mobile = SZ.endsWith('m'); const [W, H] = SZ.replace('m', '').split('x').map(Number);
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
const OFF = '#main > section.about, #main > section.process, #main > section.trust, #main > section.pricing, #contact{content-visibility:visible !important}';
(async () => {
  const b = await L.launch();
  const { p } = await L.open(b, V0, { w: W, h: H, mobile });
  await p.goto(L.BASE + '/', { waitUntil: 'load' });
  await L.settle(p, 2000);
  const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= maxY + 200; y += 200) { await p.evaluate((y) => scrollTo(0, y), Math.min(y, maxY)); await L.w8(120); }
  await L.w8(1500);
  const maxY2 = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const stops = []; for (let y = Math.round(H * 1.5); y < maxY2; y += Math.round(H * 0.6)) stops.push(y); stops.push(maxY2);
  const rows = [];
  for (const y of stops) {
    await p.evaluate((y) => scrollTo(0, y), y);
    await p.evaluate(() => { window.__st = window.setTimeout; window.__q = []; window.setTimeout = (fn, ms, ...a) => { window.__q.push([fn, ms, a]); return 0; }; });
    await L.w8(1600);
    await L.freeze(p);
    const fa = path.join(OUT, `${y}_a.png`), fb = path.join(OUT, `${y}_b.png`), fa2 = path.join(OUT, `${y}_a2.png`);
    await p.screenshot({ path: fa });
    await p.evaluate((css) => { const s = document.createElement('style'); s.id = '__off'; s.textContent = css; document.head.appendChild(s); }, OFF);
    await L.w8(200);
    await p.screenshot({ path: fb });
    await p.evaluate(() => document.getElementById('__off').remove());
    await L.w8(200);
    await p.screenshot({ path: fa2 });
    const d = await L.diff(fa, fb, path.join(OUT, `heat_${y}.png`)); const n = await L.diff(fa, fa2); const n2 = await L.diff(fb, fa2);
    rows.push({ y, sy: await p.evaluate(() => scrollY), ab: d, aa2: n, ba2: n2 });
    console.log('y', y, 'auto-vs-visible', JSON.stringify(d), '| auto-vs-auto', JSON.stringify(n));
    await p.evaluate(() => { window.setTimeout = window.__st; const q = window.__q; window.__q = []; q.forEach(([fn, ms, a]) => window.__st(fn, ms, ...a)); });
    await L.unfreeze(p);
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(rows, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
