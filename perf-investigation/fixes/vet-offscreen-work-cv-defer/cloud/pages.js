// /tos/ (scroll spy + TOC anchor clicks), /slots/, /404.html: baseline vs variant, frozen screenshots + behaviour.
// node pages.js <tag> ; VARS env (first = reference)
const fs = require('fs'); const path = require('path');
const L = require('./lib.js');
const [tag] = process.argv.slice(2);
const VARS = (process.env.VARS || 'baseline,base_i,cvd_gh,cvw_gh').split(',');
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });
const PAGES = [['/tos/', 'tos'], ['/slots/', 'slots'], ['/404.html', 'nf'], ['/tos/#refunds', 'toshash']];
(async () => {
  const R = {};
  for (const v of VARS) {
    const b = await L.launch();
    for (const [u, k] of PAGES) {
      const { p } = await L.open(b, v, { w: 1440, h: 900 });
      await p.goto(L.BASE + u, { waitUntil: 'load' });
      await L.settle(p, 2000);
      const r = { errs: [] };
      await L.freeze(p);
      r.shotTop = path.join(OUT, `${v}_${k}_top.png`); await p.screenshot({ path: r.shotTop });
      await L.unfreeze(p);
      r.sy0 = await p.evaluate(() => scrollY);
      if (k === 'tos') {
        // scroll spy along the page
        r.spy = [];
        const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        for (let y = 0; y <= maxY; y += 300) {
          await p.evaluate((y) => { window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); }, y);
          await L.w8(150);
          r.spy.push(await p.evaluate(() => { const a = document.querySelector('#toc-list li.is-active a'); return [Math.round(scrollY), a ? a.getAttribute('href') : null]; }));
        }
        // TOC click (Lenis smooth anchor) to #refunds from top
        await p.evaluate(() => window.lenis ? window.lenis.scrollTo(0, { immediate: true, force: true }) : scrollTo(0, 0));
        await L.w8(300);
        await p.evaluate(() => { const a = [...document.querySelectorAll('a[href="#refunds"]')][0]; if (a) a.click(); });
        await L.w8(2500);
        r.click = await p.evaluate(() => [Math.round(scrollY), Math.round(document.getElementById('refunds').getBoundingClientRect().top), location.hash]);
        await L.freeze(p);
        r.shotClick = path.join(OUT, `${v}_${k}_click.png`); await p.screenshot({ path: r.shotClick });
        await L.unfreeze(p);
      }
      if (k === 'toshash') r.hash = await p.evaluate(() => [Math.round(scrollY), Math.round(document.getElementById('refunds').getBoundingClientRect().top)]);
      r.errs = (await p.evaluate(() => window.__errs)).concat(p.__errs || []);
      R[v + ':' + k] = r;
      await p.close();
    }
    await b.close();
  }
  const ref = VARS[0];
  for (const v of VARS.slice(1)) for (const [, k] of PAGES) {
    const a = R[ref + ':' + k], c = R[v + ':' + k];
    const d = await L.diff(a.shotTop, c.shotTop, path.join(OUT, `heat_${v}_${k}.png`));
    const dc = a.shotClick ? await L.diff(a.shotClick, c.shotClick) : null;
    console.log(v, k, 'top diff', JSON.stringify(d), dc ? 'click diff ' + JSON.stringify(dc) : '', 'sy0', a.sy0, c.sy0,
      a.spy ? 'spySame ' + (JSON.stringify(a.spy) === JSON.stringify(c.spy)) : '', a.click ? 'click ' + JSON.stringify([a.click, c.click]) : '', a.hash ? 'hash ' + JSON.stringify([a.hash, c.hash]) : '', 'errs', JSON.stringify([a.errs, c.errs]));
  }
  if (R[ref + ':tos'].spy) console.log('spy sample', JSON.stringify(R[ref + ':tos'].spy.slice(0, 12)));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(R, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
