// probe scroll/--fp/--leave state at the scroll-fade stops, per variant, 2 loads each
const L = require('./lib');
const [vp, ...vars] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number);
(async () => {
  for (const rep of [1, 2]) for (const v of vars) {
    const b = await L.launch(); const { p } = await L.open(b, v, { w: W, h: H });
    await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    const prBot = await p.evaluate(() => { const r = document.getElementById('pricing').getBoundingClientRect(); return r.bottom + scrollY; });
    const rows = [];
    for (const lv of [0.1, 0.5, 0.9]) {
      const y = Math.round(prBot - H * 0.30 * (1 - lv));
      await p.evaluate((y) => window.scrollTo(0, y), y); await L.w8(900);
      rows.push(await p.evaluate(() => ({ sy: scrollY, mainBot: Math.round(document.querySelector('main').getBoundingClientRect().bottom * 100) / 100, fp: document.querySelector('.cfooter').style.getPropertyValue('--fp'), leave: document.getElementById('pricing').style.getPropertyValue('--leave') })));
    }
    console.log(v, rep, JSON.stringify(rows));
    await b.close();
  }
})();
