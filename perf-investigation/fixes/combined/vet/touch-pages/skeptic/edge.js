// node edge.js <scenario> <variant...> : baseline twice (A,B) + variants. Scenarios: rot390, anchor390, anchor1440, thr390nav, resize1440, ipad2
const fs = require('fs'); const path = require('path'); const L = require('./lib');
const [sc, ...vars] = process.argv.slice(2); const OUT = path.join(__dirname, 'out', 'edge_' + sc); fs.mkdirSync(OUT, { recursive: true });
const st = (p) => p.evaluate(() => { const o = { sy: Math.round(scrollY), docH: document.documentElement.scrollHeight, lenis: !!window.lenis, iw: innerWidth };
  document.querySelectorAll('.scroll-fade').forEach((e) => { o['op#' + e.id] = getComputedStyle(e).opacity; });
  const n = document.getElementById('nav'); if (n) { o.navv = ['--nav-pill', '--nav-bar-vis', '--nav-pill-vis'].map((k) => parseFloat(getComputedStyle(n).getPropertyValue(k))).join(','); o.pill = n.classList.contains('is-pill'); }
  const pr = document.getElementById('pricing'); if (pr) o.contain = getComputedStyle(pr).contain;
  o.tracks = [...document.querySelectorAll('.tcol-track')].map((t) => t.children.length).join(','); return o; });
async function snap(p, label, key, res, clip) { await L.freeze(p); const f = path.join(OUT, `${label}_${key}.png`);
  const buf = await p.screenshot(); if (clip) await require('/home/user/gfxs0da/node_modules/sharp')(buf).extract(clip).png().toFile(f); else fs.writeFileSync(f, buf);
  res[key] = { f, st: await st(p) }; await L.unfreeze(p); }
const scroll = (p, y) => p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
async function run(v, label) { const res = {}; let b, p;
  const mk = async (o) => { b = await L.launch({ touch: !!o.mobile }); p = (await L.open(b, v, o)).p; };
  if (sc === 'rot390') { await mk({ w: 390, h: 844, mobile: true }); await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    for (const y of [0, 3000, 6500]) { await scroll(p, y); await L.w8(1300);
      await p.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true }); await L.w8(1500); await snap(p, label, `land_${y}`, res);
      await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await L.w8(1500); await snap(p, label, `port_${y}`, res); } }
  if (sc === 'anchor390' || sc === 'anchor1440') { const m = sc === 'anchor390'; await mk(m ? { w: 390, h: 844, mobile: true } : { w: 1440, h: 900 });
    for (const h of ['#pricing', '#trust', '#contact', '#process']) { await p.goto(L.BASE + '/' + h, { waitUntil: 'load' }); await L.settle(p, 2500); await L.w8(1000); await snap(p, label, h.slice(1), res);
      await p.goto('about:blank'); } }
  if (sc === 'thr390nav') { await mk({ w: 390, h: 844, mobile: true, throttle: 4 }); await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 3000);
    for (let y = 0; y <= 480; y += 40) { await scroll(p, y); await L.w8(900); await snap(p, label, `y${y}`, res, { left: 0, top: 0, width: 390, height: 140 }); } }
  if (sc === 'resize1440') { await mk({ w: 1600, h: 900 }); await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    const y = await p.evaluate(() => { const e = document.getElementById('pricing'); return e.getBoundingClientRect().top + scrollY + e.offsetHeight - 900 + 40; });
    for (const w of [1600, 1439, 1440, 1300, 1441]) { await p.setViewport({ width: w, height: 900 }); await L.w8(800); const yy = await p.evaluate(() => { const e = document.getElementById('pricing'); return Math.round(e.getBoundingClientRect().top + scrollY + e.offsetHeight - innerHeight + 40); }); await scroll(p, yy); await L.w8(1300); await snap(p, label, `w${w}`, res); } }
  if (sc === 'ipad2') { await mk({ w: 820, h: 1180, mobile: true, dpr: 2 }); await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
    const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); for (let y = 0; y < maxY + 590; y += 590) { const yy = Math.min(y, maxY); await scroll(p, yy); await L.w8(1300); await snap(p, label, `y${yy}`, res); } }
  res.errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs || [])); await b.close(); return res; }
(async () => { const A = await run('baseline', 'A'), B = await run('baseline', 'B'); const V = {}; for (const v of vars) V[v] = await run(v, v);
  const out = { sc, errs: { A: A.errs, B: B.errs }, rows: [] }; for (const v of vars) out.errs[v] = V[v].errs;
  for (const k of Object.keys(A).filter((k) => k !== 'errs')) { const row = { k, noise: await L.diff(A[k].f, B[k].f), stA: A[k].st };
    for (const v of vars) { if (!V[v][k]) { row[v] = 'missing'; continue; } const sa = A[k].st, sv = V[v][k].st, sb = B[k].st;
      const sd = Object.keys({ ...sa, ...sv }).filter((x) => String(sa[x]) !== String(sv[x])).map((x) => `${x}:${sa[x]}>${sv[x]}${String(sb[x]) !== String(sa[x]) ? '(A/B too)' : ''}`);
      row[v] = { vsA: await L.diff(A[k].f, V[v][k].f, path.join(OUT, `heat_${v}_${k}.png`)), vsB: await L.diff(B[k].f, V[v][k].f), sd }; }
    out.rows.push(row); }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
  console.log(`== ${sc} lenis=${out.rows[0] && out.rows[0].stA.lenis} errs=${JSON.stringify(out.errs)}`);
  for (const r of out.rows) { const parts = [`${r.k} noise=${r.noise.pct}`]; for (const v of vars) { const x = r[v]; if (x === 'missing') { parts.push(v + ' MISSING'); continue; }
      parts.push(`${v}: A ${x.vsA.pct} B ${x.vsB.pct} bb=${JSON.stringify(x.vsA.bbox)}${x.sd.length ? ' ST=' + JSON.stringify(x.sd) : ''}${Math.min(x.vsA.pct, x.vsB.pct) > r.noise.pct + 0.02 ? ' <<<' : ''}`); }
    console.log(parts.join(' | ')); }
})().catch((e) => { console.error(e); process.exit(1); });
