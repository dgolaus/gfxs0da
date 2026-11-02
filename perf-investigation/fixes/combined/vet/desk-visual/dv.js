// Helpers for the desk-visual lens. Uses the shared ../lib.js read-only.
const fs = require('fs'); const path = require('path');
const L = require('../lib');
const OUTROOT = path.join(__dirname, 'out');

// run one variant in its own browser (one browser at a time)
async function withPage(vname, o, fn) {
  const b = await L.launch({ touch: false });
  try {
    const { p, c } = await L.open(b, vname, o);
    const r = await fn(p, c);
    const errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs || []).catch(() => ['eval-fail']));
    return { r, errs };
  } finally { await b.close(); }
}

// compare lists of shots {key, f, meta} for A, B, and variants; returns rows and flagged
async function compare(OUT, A, B, Vs, region) {
  const rows = []; const flagged = [];
  for (let i = 0; i < A.length; i++) {
    const key = A[i].key;
    const reg = region ? region(A[i]) : A[i].region;
    const noise = await L.diff(A[i].f, B[i].f, null, reg);
    const row = { key, noise, metaA: A[i].meta };
    for (const [v, list] of Object.entries(Vs)) {
      const s = list[i];
      if (!s || s.key !== key) { row[v] = { error: 'missing/mismatch' }; flagged.push(key + ':' + v + ':missing'); continue; }
      const dA = await L.diff(A[i].f, s.f, path.join(OUT, `heat_${v}_${String(key).replace(/[^\w.-]+/g, '_')}.png`), reg);
      const dB = await L.diff(B[i].f, s.f, null, reg);
      const metaSame = JSON.stringify(s.meta) === JSON.stringify(A[i].meta);
      const metaSameB = JSON.stringify(s.meta) === JSON.stringify(B[i].meta);
      const flag = dA.error || dB.error || Math.min(dA.pct, dB.pct) > noise.pct + 0.02 || Math.min(dA.mad, dB.mad) > noise.mad + 0.05;
      row[v] = { vsA: dA, vsB: dB, metaSame, metaSameB, meta: metaSame ? undefined : s.meta, flag };
      if (flag || (!metaSame && metaSameB === false && JSON.stringify(A[i].meta) === JSON.stringify(B[i].meta))) flagged.push(key + ':' + v);
    }
    rows.push(row);
  }
  return { rows, flagged };
}

function out(tag) { const d = path.join(OUTROOT, tag); fs.mkdirSync(d, { recursive: true }); return d; }

// freeze all animations at T, with optional per-animation override fn(a)->time|undefined
async function freezeAt(p, T, overrides) {
  await p.evaluate((T, ov) => {
    document.querySelectorAll('.counter').forEach((el) => {
      const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
      el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
    });
    for (const a of document.getAnimations()) {
      try {
        a.pause();
        const name = a.animationName || (a.transitionProperty ? 'transition:' + a.transitionProperty : '');
        a.currentTime = (ov && name in ov) ? ov[name] : T;
      } catch (e) {}
    }
  }, T, overrides || null);
  await L.w8(200);
}

module.exports = { L, withPage, compare, out, freezeAt };
