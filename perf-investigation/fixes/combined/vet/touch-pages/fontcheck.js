const L = require('./lib');
(async () => { const b = await L.launch(); const { p } = await L.open(b, 'combined', {});
  const reqs = []; p.on('requestfinished', (r) => { const u = r.url(); if (/fonts\.g/.test(u)) reqs.push(u.slice(0, 90) + ' ' + (r.response() && r.response().status())); });
  p.on('requestfailed', (r) => { if (/fonts\.g/.test(r.url())) reqs.push('FAIL ' + r.url().slice(0, 90)); });
  const t0 = Date.now(); await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 1500);
  console.log('t', Date.now() - t0, JSON.stringify(await p.evaluate(() => ({ lenis: !!window.lenis, hoverNone: matchMedia('(hover: none)').matches, fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + f.weight).join(','), errs: window.__errs }))));
  console.log(reqs.join('\n')); await b.close(); })();
