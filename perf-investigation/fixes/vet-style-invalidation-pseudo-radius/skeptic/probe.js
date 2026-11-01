// Load-mode probe: N interleaved loads per variant, after the same settle as comp.js, record the geometry values that
// showed up as "real" comp diffs (nav-links width, hero accent span widths, SECTION:2 container margin, counters).
// usage: node probe.js <WxH> <flags> <N> <variant...>
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [vp, flags = '', N = '6', ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number); const F = new Set(flags.split(',').filter((x) => x && x !== '-'));
(async () => {
  const rows = [];
  for (let k = 0; k < +N; k++) for (const v of vars) {
    const b = await L.launch();
    const { p, c } = await L.open(b, v, { w: W, h: H, mobile: F.has('mobile'), dpr: F.has('dpr2') ? 2 : 1 });
    if (F.has('print')) await p.emulateMediaType('print');
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    const r = await p.evaluate(() => {
      const nl = document.querySelector('.nav-links'); const sec = document.querySelectorAll('body > main > section, main section')[2];
      const secs = [...document.querySelectorAll('section')].map((s) => { const d = s.querySelector(':scope > .container'); return d ? s.id + ':' + getComputedStyle(d).marginLeft : null; }).filter(Boolean);
      return { nav: getComputedStyle(nl).width, accent: [...document.querySelectorAll('.accent, .accent-text')].map((e) => e.getBoundingClientRect().width.toFixed(3)).join(','),
        fonts: [...document.fonts].map((f) => f.family + ':' + f.weight + ':' + f.status).join(' '), secs: secs.join(' ') };
    });
    await b.close();
    rows.push({ k, v, ...r });
    console.log(k, v, 'nav', r.nav, 'accent', r.accent, '|', r.secs);
    console.log('    fonts', r.fonts);
  }
  const by = {}; for (const r of rows) { const key = r.v + ' nav=' + r.nav; by[key] = (by[key] || 0) + 1; }
  console.log('MODES', JSON.stringify(by));
  fs.writeFileSync(path.join(__dirname, `probe_${W}${flags.replace(/\W/g, '')}.json`), JSON.stringify(rows, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
