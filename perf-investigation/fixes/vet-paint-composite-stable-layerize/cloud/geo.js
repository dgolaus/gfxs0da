// Geometry / behaviour across loads: anchor landing, doc height, section offsets, /tos/ scroll spy at every stop,
// TOC click navigation. node geo.js <WxH> <flags:mobile> <variant...>
const L = require('./lib'); const fs = require('fs'); const path = require('path');
const [vp, flagsS, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number);
const flags = new Set((flagsS || '').split(',').filter(Boolean));
async function one(v, url, fn) {
  const b = await L.launch(); const { p } = await L.open(b, v, { w: W, h: H, mobile: flags.has('mobile') });
  await p.goto(L.BASE + url, { waitUntil: 'load' }); await L.settle(p, 3000);
  const r = await fn(p); r.errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs)); await b.close(); return r;
}
const base = (p) => p.evaluate(() => ({ sy: Math.round(scrollY * 10) / 10, docH: document.documentElement.scrollHeight, lenis: !!window.lenis,
  secs: [...document.querySelectorAll('section[id], #contact')].map((s) => s.id + ':' + Math.round((s.getBoundingClientRect().top + scrollY) * 10) / 10).join(' '),
  prContain: document.getElementById('pricing') ? getComputedStyle(document.getElementById('pricing')).contain : null }));
(async () => {
  const out = {};
  for (const v0 of vars) {
    const v = out[v0] ? v0 + '#' + Object.keys(out).length : v0; out[v] = {};
    for (const url of ['/', '/#pricing', '/#process', '/#testimonials', '/tos/', '/tos/#pricing', '/tos/#refunds', '/tos/#general', '/slots/', '/404.html']) out[v][url] = await one(v0, url, base);
    out[v].tosSpy = await one(v0, '/tos/', async (p) => {
      const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); const spy = [];
      for (let y = 0; y <= max + 150; y += 150) { const yy = Math.min(y, max); await p.evaluate((y) => window.scrollTo(0, y), yy); await L.w8(350); spy.push(yy + ':' + (await p.evaluate(() => { const a = document.querySelector('#toc-list li.is-active a'); return a ? a.getAttribute('href') : '-'; }))); if (yy === max) break; }
      // click TOC links
      const clicks = [];
      for (const href of ['#general', '#pricing', '#delivery', '#rescales']) { await p.click(`#toc-list a[href="${href}"]`); await L.w8(1800); clicks.push(href + '->' + (await p.evaluate(() => Math.round(scrollY) + ':' + location.hash + ':' + (document.querySelector('#toc-list li.is-active a') || {}).getAttribute?.('href')))); }
      return { spy: spy.join(' '), clicks: clicks.join(' ') };
    });
  }
  const ref = out[vars[0]];
  for (const v of Object.keys(out).slice(1)) for (const k of Object.keys(ref)) { const strip = (o) => JSON.stringify(o, (kk, vv) => kk === 'prContain' ? undefined : vv); const a = strip(ref[k]), c = strip(out[v][k]); console.log(`${v} ${k}: ${a === c ? 'SAME' : 'DIFF'}`); if (a !== c) { console.log('  base', a); console.log('  ' + v, c); } }
  console.log('contain', Object.keys(out).map((v) => v + ':' + out[v]['/'].prContain + '/' + out[v]['/tos/'].prContain).join(' '));
  console.log('baseline sample', JSON.stringify(ref['/#pricing']), JSON.stringify(ref['/tos/#pricing']));
  fs.writeFileSync(path.join(__dirname, 'out', `geo_${vp}_${[...flags].join('-') || 'desk'}.json`), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
