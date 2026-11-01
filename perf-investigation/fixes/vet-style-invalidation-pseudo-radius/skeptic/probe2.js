// Text-width mode probe: per fresh-browser load, after comp.js's settle, record nav-links width, each nav link width,
// the font files actually fetched (URL tail, size, duration) and FontFace load states.
// usage: node probe2.js <WxH> <N> <variant...>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [vp, N = '6', ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
(async () => {
  const rows = [];
  for (let k = 0; k < +N; k++) for (const v of vars) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: W, h: H });
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    const r = await p.evaluate(() => {
      const nl = document.querySelector('.nav-links');
      const res = performance.getEntriesByType('resource').filter((e) => /gstatic|googleapis/.test(e.name)).map((e) => e.name.split('/').slice(-1)[0].slice(0, 40) + ':' + e.encodedBodySize + ':' + Math.round(e.startTime) + '+' + Math.round(e.duration));
      const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + f.weight + '/' + (f.unicodeRange || '').slice(0, 12)).join(' ');
      return { nav: getComputedStyle(nl).width, links: [...nl.querySelectorAll('a')].map((a) => a.getBoundingClientRect().width.toFixed(4)).join(','), font: getComputedStyle(nl.querySelector('a')).fontFamily, res, loaded };
    });
    await b.close();
    rows.push({ k, v, ...r });
    console.log(k, v, 'nav', r.nav, r.links, '| fontfiles', r.res.length, '| loaded', r.loaded);
    for (const x of r.res) console.log('      ', x);
  }
  const by = {}; for (const r of rows) { const key = r.v + ' nav=' + r.nav; by[key] = (by[key] || 0) + 1; }
  console.log('MODES', JSON.stringify(by));
  fs.writeFileSync(path.join(__dirname, `probe2_${W}.json`), JSON.stringify(rows, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
