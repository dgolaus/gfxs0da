// Builds script.raf-loops-counter.js (ORIGINAL + counter text-node write only), preserving CRLF.
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'script.ORIGINAL.js');
let s = fs.readFileSync(SRC, 'utf8');
const crlf = s.includes('\r\n');
s = s.replace(/\r\n/g, '\n');
const rep = (from, to) => {
  const i = s.indexOf(from);
  if (i < 0 || s.indexOf(from, i + 1) >= 0) throw new Error('anchor not unique/found:\n' + from.slice(0, 160));
  s = s.slice(0, i) + to + s.slice(i + from.length);
};

rep(`  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = (eased * target).toFixed(decimals);
    el.textContent = \`\${prefix}\${current}\${suffix}\`;
`, `  // Atualiza o próprio nó de texto em vez de trocá-lo a cada frame
  // (textContent remove o Text antigo e insere um novo: destrói e recria o
  // LayoutText e recalcula o estilo do nó novo). Mesmo texto na tela.
  // Lê o nó atual a cada frame, então uma escrita externa (fetch do
  // visits.json) continua sendo sobrescrita no frame seguinte, como antes.
  const put = (str) => {
    const n = el.firstChild;
    if (n && n.nodeType === 3 && !n.nextSibling) { if (n.data !== str) n.data = str; }
    else el.textContent = str;
  };

  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = (eased * target).toFixed(decimals);
    put(\`\${prefix}\${current}\${suffix}\`);
`);

if (crlf) s = s.replace(/\n/g, '\r\n');
const OUTF = path.join(__dirname, 'script.raf-loops-counter.js');
fs.writeFileSync(OUTF, s);
console.log('ok, crlf=', crlf, '->', OUTF);
