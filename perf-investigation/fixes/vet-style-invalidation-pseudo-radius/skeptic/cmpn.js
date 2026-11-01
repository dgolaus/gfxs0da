// pairwise rest-state diff between several loads: node cmpn.js <label> <file1> <file2> ... (comp_*.json names without dir)
const fs = require('fs'); const path = require('path');
const [st, ...files] = process.argv.slice(2);
const L = files.map((f) => { const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'comp', f))); return { f, j, m: (k) => { const id = j[st][k]; if (id === undefined) return {}; const o = {}; for (const x of j.__tbl.el[id].split(',')) { const s = j.__tbl.pv[+x]; const i = s.indexOf('='); o[s.slice(0, i)] = s.slice(i + 1); } return o; } }; });
for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
  const X = L[a], Y = L[b]; const keys = new Set([...Object.keys(X.j[st]), ...Object.keys(Y.j[st])]); const out = [];
  for (const k of keys) { const mx = X.m(k), my = Y.m(k); for (const p of new Set([...Object.keys(mx), ...Object.keys(my)])) if (mx[p] !== my[p]) out.push(`${k.split('/').slice(-2).join('/')} ${p}: ${mx[p]} -> ${my[p]}`); }
  const props = {}; for (const o of out) { const p = o.split(' ')[1].replace(':', ''); props[p] = (props[p] || 0) + 1; }
  console.log(`${X.f} vs ${Y.f}: ${out.length}`, JSON.stringify(props)); for (const o of out.filter((o) => /margin-left|nav-links\] width/.test(o)).slice(0, 4)) console.log('    ', o);
}
