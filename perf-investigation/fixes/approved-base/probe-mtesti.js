// node probe-mtesti.js <reps> : mobile /#testimonials landing; dump doc-y of section children to find the 18px shift
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const reps = +process.argv[2] || 4; const res = [];
(async () => {
  for (let r = 0; r < reps; r++) for (const v of ['baseline', 'base']) {
    const b = await L.launch();
    const { p } = await L.open(b, v, { w: 390, h: 844, mobile: true });
    const trace = [];
    await p.exposeFunction('__t', (x) => trace.push(x));
    await p.evaluateOnNewDocument(() => {
      addEventListener('load', () => {
        const t0 = performance.now();
        const snap = (tag) => { const t = document.getElementById('testimonials'); if (!t) return;
          window.__t({ tag, t: Math.round(performance.now() - t0), sy: scrollY, top: Math.round((t.getBoundingClientRect().top + scrollY) * 10) / 10,
            trustH: Math.round(document.getElementById('trust').getBoundingClientRect().height * 10) / 10 }); };
        [0, 1, 340, 360, 600, 890, 910, 1500, 2500].forEach((d) => setTimeout(() => snap('t' + d), d));
      });
    });
    await p.goto(L.BASE + '/#testimonials', { waitUntil: 'load' });
    await L.w8(3000);
    const d = await p.evaluate(() => {
      const out = {}; const doc = (e) => Math.round((e.getBoundingClientRect().top + scrollY) * 10) / 10;
      const walk = (e, depth, pre) => { [...e.children].forEach((c, i) => { const k = pre + '/' + (c.id || c.className.toString().split(' ')[0] || c.tagName) + i;
        out[k] = doc(c) + ' h' + Math.round(c.getBoundingClientRect().height * 10) / 10; if (depth > 0) walk(c, depth - 1, k); }); };
      walk(document.querySelector('main'), 3, '');
      return { sy: scrollY, out };
    });
    await b.close();
    res.push({ r, v, sy: d.sy, out: d.out, trace });
    console.log(`r${r} ${v} sy=${d.sy} trace=${trace.map((x) => `${x.tag}:${x.top}/${x.trustH}@${x.sy}`).join(' ')}`);
  }
  fs.writeFileSync(path.join(__dirname, 'out', 'probe-mtesti.json'), JSON.stringify(res, null, 1));
  // which keys differ between runs
  const keys = Object.keys(res[0].out); const diffKeys = keys.filter((k) => new Set(res.map((x) => x.out[k])).size > 1);
  console.log('keys differing across runs:', diffKeys.length);
  for (const k of diffKeys.slice(0, 40)) console.log(k, res.map((x) => `${x.v[0]}${x.r}:${x.out[k]}`).join(' '));
})().catch((e) => { console.error(e); process.exit(1); });
