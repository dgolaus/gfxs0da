// node pricing.js <tag> <WxH> <flags:mobile,reduced> <variant...>
// Home page #pricing: top/bottom edges, reveal mid-states, every card hover (and mid-hover), scroll-fade --leave mid values.
// Two freeze modes: 'pause' (main-thread draw) and 'slow' (animations keep running at playbackRate 1e-9, so
// compositor-driven ones stay on the compositor). Exact pixel diff (any channel > 0).
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [tag, vp, flagsS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const flags = new Set((flagsS || '').split(',').filter(Boolean));
const OUT = path.join(__dirname, 'out', tag); fs.mkdirSync(OUT, { recursive: true });

async function scrollTo(p, y) {
  await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
}
async function freezeAt(p, mode, T, tt) {
  await p.evaluate((mode, T, tt) => {
    document.querySelectorAll('.counter').forEach((el) => {
      const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
      el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
    });
    const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
    for (const a of document.getAnimations()) {
      try {
        const isT = (typeof CSSTransition !== 'undefined') && a instanceof CSSTransition;
        if (isT && tt == null) { a.finish(); continue; }
        if (mode === 'pause') a.pause();
        a.currentTime = isT ? tt : T;
        if (mode === 'slow') { a.playbackRate = 1e-9; a.play(); }
      } catch (e) {}
    }
  }, mode, T, tt);
  await L.w8(mode === 'slow' ? 400 : 250);
}
async function release(p) {
  await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.playbackRate = 1; a.play(); } catch (e) {} } });
}
async function geom(p) {
  return p.evaluate(() => {
    const pr = document.getElementById('pricing'); const r = pr.getBoundingClientRect();
    return { sy: scrollY, docH: document.documentElement.scrollHeight, prTop: Math.round((r.top + scrollY) * 10) / 10, prBot: Math.round((r.bottom + scrollY) * 10) / 10,
      leave: pr.style.getPropertyValue('--leave'), cards: [...pr.querySelectorAll('.price-card')].map((c) => { const q = c.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top + scrollY), Math.round(q.width), Math.round(q.height)].join(','); }).join(' ') };
  });
}

async function run(vname, label) {
  const b = await L.launch();
  const { p } = await L.open(b, vname, { w: W, h: H, mobile: flags.has('mobile'), reduced: flags.has('reduced') });
  await p.goto(L.BASE + '/', { waitUntil: 'load' });
  await L.settle(p, 2500);
  const shots = []; const g0 = await geom(p);
  const shot = async (name) => { const f = path.join(OUT, `${label}__${name}.png`); await p.screenshot({ path: f }); shots.push({ name, f }); };
  const prTop = g0.prTop, prBot = g0.prBot;
  // walk the whole section once so all reveals have fired
  for (let y = prTop - H; y < prBot; y += H / 2) { await scrollTo(p, y); await L.w8(400); }
  // 1 top edge, final state, many float phases, both modes
  await scrollTo(p, Math.round(prTop - H * 0.35)); await L.w8(1500);
  for (const mode of ['pause', 'slow']) for (const T of [0, 900, 1800, 2700, 3600, 4500, 5400, 6300, 7200, 8100]) { await freezeAt(p, mode, T, null); await shot(`top_${mode}_${T}`); await release(p); }
  // 2 reveal mid-states at the top edge (section-head + cards)
  for (const mode of ['pause', 'slow']) {
    await p.evaluate(() => {
      const els = [...document.querySelectorAll('#pricing .reveal')];
      for (const el of els) { el.classList.remove('is-in'); el.style.transition = 'none'; }
      void document.body.offsetWidth; for (const el of els) el.style.transition = ''; void document.body.offsetWidth;
      for (const el of els) el.classList.add('is-in');
    });
    await L.w8(30);
    for (const tt of [0, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200]) { await freezeAt(p, mode, 3000, tt); await shot(`reveal_${mode}_${tt}`); }
    await release(p); await p.evaluate(() => { for (const a of document.getAnimations()) if (a instanceof CSSTransition) a.finish(); });
    await L.w8(300);
  }
  // 3 bottom edge, final state (footer below)
  await scrollTo(p, Math.round(prBot - H * 0.75)); await L.w8(1500);
  for (const mode of ['pause', 'slow']) for (const T of [0, 1300, 2600, 3900, 5200, 6500]) { await freezeAt(p, mode, T, null); await shot(`bot_${mode}_${T}`); await release(p); }
  // 4 hover each card (final + mid-transition), card centered and also at the section-bottom view
  const cards = await p.evaluate(() => [...document.querySelectorAll('#pricing .price-card')].map((c) => { const r = c.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; }));
  for (let k = 0; k < cards.length; k++) {
    for (const pos of ['center', 'bottom']) {
      const y = pos === 'center' ? Math.round(cards[k].top + cards[k].h / 2 - H / 2) : Math.round(prBot - H * 0.75);
      await p.mouse.move(2, 2); await scrollTo(p, y); await L.w8(900);
      const sel = `#pricing .price-card:nth-child(${k + 1})`;
      const box = await p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.4, vis: r.bottom > 0 && r.top < innerHeight }; }, sel);
      if (!box.vis) continue;
      await p.mouse.move(box.x, Math.max(1, Math.min(H - 2, box.y)));
      await L.w8(30);
      for (const tt of [40, 120, 220]) { await freezeAt(p, 'pause', 2000, tt); await shot(`hover${k + 1}_${pos}_mid${tt}`); }
      await release(p); await L.w8(1100);
      for (const mode of ['pause', 'slow']) { await freezeAt(p, mode, 2000, null); await shot(`hover${k + 1}_${pos}_${mode}`); await release(p); }
    }
  }
  await p.mouse.move(2, 2); await L.w8(800);
  // 5 scroll-fade --leave mid values
  const leaves = [];
  for (const lv of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const y = Math.round(prBot - H * 0.30 * (1 - lv));
    await scrollTo(p, y); await L.w8(900);
    for (const mode of ['pause', 'slow']) { await freezeAt(p, mode, 2000, null); leaves.push(await p.evaluate(() => document.getElementById('pricing').style.getPropertyValue('--leave'))); await shot(`leave${lv}_${mode}`); await release(p); }
  }
  const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
  await b.close();
  return { g0, shots, leaves, errs };
}

(async () => {
  const res = { A: await run('baseline', 'A'), B: await run('baseline', 'B') };
  for (const v of vars) res[v] = await run(v, v);
  const out = { tag, vp, flags: [...flags], geom: {}, leaves: {}, errs: {}, rows: [] };
  for (const k of Object.keys(res)) { out.geom[k] = res[k].g0; out.leaves[k] = res[k].leaves.join(' '); out.errs[k] = res[k].errs; }
  const names = res.A.shots.map((s) => s.name);
  let bad = 0;
  for (let i = 0; i < names.length; i++) {
    const row = { name: names[i], noise: await L.xdiff(res.A.shots[i].f, res.B.shots[i].f) };
    for (const v of vars) {
      const sv = res[v].shots.find((s) => s.name === names[i]);
      if (!sv) { row[v] = 'missing'; continue; }
      row[v] = { vsA: await L.xdiff(res.A.shots[i].f, sv.f, path.join(OUT, `heat_${v}__${names[i]}.png`)), vsB: await L.xdiff(res.B.shots[i].f, sv.f) };
      if (Math.min(row[v].vsA.px, row[v].vsB.px) > row.noise.px) bad++;
    }
    out.rows.push(row);
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
  console.log(`== ${tag} ${vp} ${[...flags]} shots=${names.length} rowsAboveNoise=${bad}`);
  console.log('geom', JSON.stringify(out.geom));
  console.log('leaves', JSON.stringify(out.leaves), 'errs', JSON.stringify(out.errs));
  for (const r of out.rows) {
    const parts = [`${r.name.padEnd(26)} noise ${r.noise.px}/${r.noise.max}`];
    for (const v of vars) { const x = r[v]; if (x === 'missing') { parts.push(v + ' MISSING'); continue; } const flag = Math.min(x.vsA.px, x.vsB.px) > r.noise.px ? ' <<<' : ''; parts.push(`${v} A ${x.vsA.px}/${x.vsA.max} B ${x.vsB.px}/${x.vsB.max} bb=${JSON.stringify(x.vsA.bbox)}${flag}`); }
    console.log(parts.join(' | '));
  }
})().catch((e) => { console.error(e); process.exit(1); });
