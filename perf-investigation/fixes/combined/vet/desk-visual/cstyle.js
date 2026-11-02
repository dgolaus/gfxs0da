// node cstyle.js <WxH> <variant...>
// Computed-style equality probe (desktop): ::after border-radius/inset/opacity of every .btn, .price-card, .quote,
// at rest, with keyboard focus (:focus-visible), and the computed style of #pricing / .scroll-fade sections / #nav vars.
const fs = require('fs'); const path = require('path');
const { L, withPage, out } = require('./dv');
const [vp, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const OUT = out(`cstyle_${vp}`);
(async () => {
  const all = {};
  for (const v of ['baseline', ...vars]) {
    const { r } = await withPage(v, { w: W, h: H }, async (p) => {
      await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
      const sel = ['.btn', '.price-card', '.quote'];
      const rest = await p.evaluate((sel) => sel.flatMap((s) => [...document.querySelectorAll(s)].map((e, i) => { const a = getComputedStyle(e, '::after'); const h = getComputedStyle(e);
        return `${s}#${i} host:${h.borderTopLeftRadius}/${h.borderBottomRightRadius} after:${a.content}|${a.borderTopLeftRadius}/${a.borderTopRightRadius}/${a.borderBottomLeftRadius}/${a.borderBottomRightRadius}|${a.opacity}|${a.translate}|${a.position}`; })), sel);
      const focus = [];
      const n = await p.evaluate(() => document.querySelectorAll('.btn').length);
      for (let i = 0; i < n; i++) {
        await p.evaluate((i) => { const e = document.querySelectorAll('.btn')[i]; e.focus({ preventScroll: true }); }, i);
        await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); await p.keyboard.press('Tab');
        focus.push(await p.evaluate((i) => { const e = document.querySelectorAll('.btn')[i]; const a = getComputedStyle(e, '::after'); const h = getComputedStyle(e);
          return `.btn#${i} fv=${e.matches(':focus-visible')} host:${h.borderTopLeftRadius} after:${a.borderTopLeftRadius}/${a.borderBottomRightRadius}`; }, i));
      }
      const misc = await p.evaluate(() => {
        const g = (e, ks) => ks.map((k) => k + '=' + getComputedStyle(e).getPropertyValue(k).trim()).join(' ');
        return { pricing: g(document.getElementById('pricing'), ['contain', 'opacity', 'filter', 'transform', 'overflow', 'isolation', 'z-index']),
          sections: ['about', 'process', 'trust', 'pricing', 'contact'].map((id) => { const e = document.getElementById(id); return e ? id + ':' + g(e, ['opacity', 'filter', 'transform']) + ' leave=' + parseFloat(getComputedStyle(e).getPropertyValue('--leave')) : id + ':none'; }),
          nav: ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => k + '=' + parseFloat(getComputedStyle(document.getElementById('nav')).getPropertyValue(k))).join(' '),
          navLinksBefore: getComputedStyle(document.querySelector('.nav-links'), '::before').opacity + ' ' + getComputedStyle(document.querySelector('.nav'), '::before').opacity,
          accentParentBg: [...document.querySelectorAll('.hero-title .accent, .process-text h2 .accent-soft')].map((e) => getComputedStyle(e).backgroundImage),
          fp: parseFloat(getComputedStyle(document.querySelector('.cfooter')).getPropertyValue('--fp')),
          tcols: [...document.querySelectorAll('.tcol-track')].map((t) => t.children.length + ':' + [...t.children].filter((c) => c.hasAttribute('aria-hidden')).length) };
      });
      return { rest, focus, misc };
    });
    all[v] = r;
  }
  const res = {};
  for (const v of vars) {
    const B = all.baseline, V = all[v];
    res[v] = { restDiff: B.rest.map((x, i) => x === V.rest[i] ? null : [x, V.rest[i]]).filter(Boolean), restN: B.rest.length,
      focusDiff: B.focus.map((x, i) => x === V.focus[i] ? null : [x, V.focus[i]]).filter(Boolean),
      miscDiff: Object.keys(B.misc).filter((k) => JSON.stringify(B.misc[k]) !== JSON.stringify(V.misc[k])).map((k) => [k, B.misc[k], V.misc[k]]) };
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ all, res }, null, 1));
  console.log(JSON.stringify(res, null, 1));
  console.log('baseline focus:', JSON.stringify(all.baseline.focus));
  console.log('baseline misc:', JSON.stringify(all.baseline.misc));
})().catch((e) => { console.error(e); process.exit(1); });
