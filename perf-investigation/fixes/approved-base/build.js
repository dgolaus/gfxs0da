// Builds approved-base/script.js and styles.css from the vetted sources.
// script.js = fixes/raf-loops/script.raf-loops.js (noop-writes, = vet-raf-loops-noop-writes*/script.variant.js)
//           + lastFp amendment (null start, verdict raf-loops-noop-writes-plus-leave[1].amendment)
//           + forced-layout-batch hunk E (testimonial filler batching, fixes/forced-layout/script.js)
// styles.css = fixes/raf-loops/styles.raf-loops.css (@property --leave; = both vet styles.variant.css)
const fs = require('fs'), path = require('path');
const PI = path.resolve(__dirname, '../..');
const REPO = path.resolve(PI, '..');
const rd = (p) => fs.readFileSync(p, 'utf8');
function rep(src, a, b, label) {
  const n = src.split(a).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1 occurrence, got ${n}`);
  return src.replace(a, () => b);
}
let s = rd(path.join(PI, 'fixes/raf-loops/script.raf-loops.js'));
if (/\r/.test(s)) throw new Error('unexpected CR in source');

// --- amendment: footer first write always happens (lastFp = null)
s = rep(s,
`  let raf = null;
  let lastFp = '0.000';
`,
`  let raf = null;
  // null (não '0.000'): o 1º update() sempre escreve --fp inline, como o
  // original. Assim o footer não depende do default do CSS e continua igual
  // se o @media (prefers-reduced-motion) começar a valer com a página aberta.
  let lastFp = null;
`, 'lastFp');
s = rep(s,
`    // Só escreve quando muda; começa no default do CSS (.cfooter { --fp: 0 }),
    // então longe do fim da página nada é escrito (cada escrita recalcula o
    // footer inteiro, porque --fp herda para os filhos).
`,
`    // Só escreve quando muda (cada escrita recalcula o footer inteiro,
    // porque --fp herda para os filhos).
`, 'fp comment');

// --- forced-layout-batch hunk E (verbatim from fixes/forced-layout/script.js)
const fl = rd(path.join(PI, 'fixes/forced-layout/script.js'));
const oldE =
`  const target = (wrap ? wrap.getBoundingClientRect().height : 640) || 640;
  cols.forEach((col) => {
    const track = col.querySelector('.tcol-track');
    if (!track) return;
    const originals = Array.from(track.querySelectorAll('.quote:not([aria-hidden])'));
    if (!originals.length) return;
    // Remove duplicados atuais e reconstrói
    track.querySelectorAll('.quote[aria-hidden]').forEach((q) => q.remove());
    const setHeight = () => track.getBoundingClientRect().height;
    let half = setHeight();
    let reps = 1;
    while (half < target + 40 && reps < 6) { // garante folga
      originals.forEach((q) => { const c = q.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
      reps++;
      half = setHeight();
    }
    // Segunda metade = cópia exata da primeira
    Array.from(track.children).forEach((q) => { const c = q.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
  });
})();
`;
const a = fl.indexOf(`  const target = (wrap ? wrap.getBoundingClientRect().height : 640) || 640;\n`);
const endMark = `    cloneInto(track, Array.from(track.children));\n  });\n})();\n`;
const b = fl.indexOf(endMark, a);
if (a < 0 || b < 0) throw new Error('hunk E not found in forced-layout/script.js');
const newE = fl.slice(a, b + endMark.length);
s = rep(s, oldE, newE, 'hunk E');

fs.writeFileSync(path.join(__dirname, 'script.js'), s);
const css = rd(path.join(PI, 'fixes/raf-loops/styles.raf-loops.css'));
fs.writeFileSync(path.join(__dirname, 'styles.css'), css);
console.log('ok', s.split('\n').length - 1, 'lines js;', css.split('\n').length - 1, 'lines css');
