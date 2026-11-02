// node tabwalk.js <WxH> <page> <maxTabs> <variant...>
// Keyboard Tab through every focusable element from the top. After each Tab: 450ms, freeze all at 5000, full-viewport
// shot + focused element identity/rect + scrollY. Mouse parked off-page-content corner, never moved.
const fs = require('fs'); const path = require('path');
const { L, withPage, compare, out } = require('./dv');
const [vp, pg, maxS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const MAX = +maxS || 120;
const OUT = out(`tab_${vp}_${pg.replace(/\W+/g, '_') || 'root'}`);

async function run(v, label) {
  return withPage(v, { w: W, h: H }, async (p) => {
    await p.goto(L.BASE + pg, { waitUntil: 'load' });
    await L.settle(p, 2500);
    const shots = []; let first = null;
    for (let k = 0; k < MAX; k++) {
      await p.keyboard.press('Tab');
      await L.w8(450);
      const meta = await p.evaluate(() => {
        const e = document.activeElement; const r = e.getBoundingClientRect();
        document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
        for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (x) {} }
        const id = e.tagName + '.' + (e.className && e.className.baseVal === undefined ? e.className : '') + '|' + (e.getAttribute('href') || e.textContent.trim().slice(0, 20));
        return { id, fv: e.matches(':focus-visible'), r: [r.x, r.y, r.width, r.height].map((x) => Math.round(x * 10) / 10), sy: Math.round(scrollY * 10) / 10, lenis: !!window.lenis };
      });
      await L.w8(200);
      const f = path.join(OUT, `${label}_${String(k).padStart(3, '0')}.png`);
      await p.screenshot({ path: f });
      shots.push({ key: k, f, meta });
      await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (x) {} } });
      if (k === 0) first = meta.id; else if (meta.id === first) break;
    }
    return shots;
  });
}

(async () => {
  const A = await run('baseline', 'A'); const B = await run('baseline', 'B');
  const Vs = {}; const errs = { A: A.errs, B: B.errs };
  for (const v of vars) { const r = await run(v, v); Vs[v] = r.r; errs[v] = r.errs; }
  const n = Math.min(A.r.length, B.r.length, ...vars.map((v) => Vs[v].length));
  const res = await compare(OUT, A.r.slice(0, n), B.r.slice(0, n), Object.fromEntries(vars.map((v) => [v, Vs[v].slice(0, n)])));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ vp, pg, errs, lens: { A: A.r.length, B: B.r.length, ...Object.fromEntries(vars.map((v) => [v, Vs[v].length])) }, ...res }, null, 1));
  console.log(`== tab ${vp} ${pg} errs ${JSON.stringify(errs)} tabs A=${A.r.length} B=${B.r.length} ${vars.map((v) => v + '=' + Vs[v].length)} lenis=${A.r[0].meta.lenis} flagged=${JSON.stringify(res.flagged)}`);
  for (const r of res.rows) {
    const s = vars.map((v) => `${v}: A ${r[v].vsA.mad}/${r[v].vsA.pct} B ${r[v].vsB.mad}/${r[v].vsB.pct} bb=${JSON.stringify(r[v].vsA.bbox)}${r[v].metaSame ? '' : ' META=' + JSON.stringify(r[v].meta)}${r[v].flag ? ' <<<' : ''}`).join(' | ');
    console.log(`${r.key} ${r.metaA.id.slice(0, 60)} fv=${r.metaA.fv} sy=${r.metaA.sy} noise ${r.noise.mad}/${r.noise.pct} | ${s}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
