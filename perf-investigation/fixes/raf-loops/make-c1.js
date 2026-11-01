// Builds script.raf-loops.js from the pristine copy, preserving CRLF.
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

/* ---- 6c gradient loop ---- */
rep(`  const LERP = 0.10;
  const smoothed = new WeakMap();

  function update() {
    const vh = window.innerHeight;
    if (vh === 0) return;
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      const elTopVh = (rect.top / vh) * 100;
      const targetY = 50 - elTopVh;

      // Init on first frame at the target (no startup snap), then lerp
      let prevY = smoothed.get(el);
      if (prevY === undefined) prevY = targetY;
      const nextY = prevY + (targetY - prevY) * LERP;
      smoothed.set(el, nextY);

      // "Yours" is huge — needs a tighter salmon zone so letters don't look yellow.
      // Other accents keep wider scale for smoother fade.
      const isHero = el.classList.contains('accent') &&
                     el.closest('.hero-title') !== null;
      const tight = isHero;
      const grad =
        \`radial-gradient(circle at 50% \${nextY.toFixed(2)}vh,\` +
        \` #ff8b6b 0vh,\` +
        \` #ff1727 \${tight ? 12 : 30}vh,\` +
        \` #6B0808 \${tight ? 50 : 80}vh,\` +
        \` #1F0202 \${tight ? 120 : 160}vh)\`;
      el.style.backgroundImage = grad;
      // O texto vive num filho .accent-text (o pai é a janela das orbs)
      const t = el.querySelector(':scope > .accent-text');
      if (t) t.style.backgroundImage = grad;
    }
  }
`, `  const LERP = 0.10;

  // Constantes por elemento, resolvidas uma vez (antes: querySelector +
  // closest a cada frame). O gradiente só aparece no filho .accent-text:
  // o pai tem \`background-image: none !important\` (styles.css, bloco
  // GRADIENTE ANIMADO), então a escrita inline nele nunca chegava à tela
  // e só invalidava estilo — removida.
  // "Yours" is huge — needs a tighter salmon zone so letters don't look yellow.
  // Other accents keep wider scale for smoother fade.
  const items = Array.from(els, (el) => ({
    el,
    t: el.querySelector(':scope > .accent-text'),
    tight: el.classList.contains('accent') && el.closest('.hero-title') !== null,
    y: undefined,   // circleY suavizado (lerp)
    top: 0,         // rect.top lido neste frame
    grad: '',       // último gradiente escrito
  }));

  function update() {
    const vh = window.innerHeight;
    if (vh === 0) return;
    // 1) Todas as leituras primeiro, 2) depois as escritas. Antes, a leitura
    // do 2º elemento vinha depois da escrita no 1º e forçava um recálculo de
    // estilo extra por frame. background-image não muda geometria, então os
    // rects lidos são os mesmos.
    for (const it of items) it.top = it.el.getBoundingClientRect().top;
    for (const it of items) {
      const elTopVh = (it.top / vh) * 100;
      const targetY = 50 - elTopVh;

      // Init on first frame at the target (no startup snap), then lerp
      const prevY = it.y === undefined ? targetY : it.y;
      const nextY = prevY + (targetY - prevY) * LERP;
      it.y = nextY;

      const tight = it.tight;
      const grad =
        \`radial-gradient(circle at 50% \${nextY.toFixed(2)}vh,\` +
        \` #ff8b6b 0vh,\` +
        \` #ff1727 \${tight ? 12 : 30}vh,\` +
        \` #6B0808 \${tight ? 50 : 80}vh,\` +
        \` #1F0202 \${tight ? 120 : 160}vh)\`;
      // Só escreve quando o valor muda (convergido, a string se repete).
      if (grad !== it.grad) {
        it.grad = grad;
        // O texto vive num filho .accent-text (o pai é a janela das orbs)
        if (it.t) it.t.style.backgroundImage = grad;
      }
    }
  }
`);

/* ---- 6d section fade ---- */
rep(`  function update() {
    const vh = window.innerHeight;
    // Fade window: section's bottom traveling from 30% of vh → 0 maps to leave 0→1
    const fadeStart = vh * 0.30;
    for (const s of sections) {
      const rect = s.getBoundingClientRect();
      let leave = 0;
      if (rect.bottom < fadeStart) {
        leave = Math.min(1, Math.max(0, (fadeStart - rect.bottom) / fadeStart));
      }
      s.style.setProperty('--leave', leave.toFixed(3));
    }
  }
`, `  // Último valor escrito por seção. Começa no default do CSS
  // (.scroll-fade { --leave: 0 }): escrever "0.000" por cima dele não muda
  // nada na tela, mas cada escrita invalidava o estilo da seção INTEIRA
  // (custom property herda para todos os descendentes) — no load eram 5
  // seções, cada uma forçando um recálculo intercalado com a próxima leitura.
  const lastLeave = sections.map(() => '0.000');
  const bottoms = new Array(sections.length);
  function update() {
    const vh = window.innerHeight;
    // Fade window: section's bottom traveling from 30% of vh → 0 maps to leave 0→1
    const fadeStart = vh * 0.30;
    // Leituras antes das escritas: --leave só mexe em opacity/filter/transform
    // da própria seção, que não alteram o rect das outras.
    for (let i = 0; i < sections.length; i++) bottoms[i] = sections[i].getBoundingClientRect().bottom;
    for (let i = 0; i < sections.length; i++) {
      let leave = 0;
      if (bottoms[i] < fadeStart) {
        leave = Math.min(1, Math.max(0, (fadeStart - bottoms[i]) / fadeStart));
      }
      const v = leave.toFixed(3);
      if (v !== lastLeave[i]) {
        lastLeave[i] = v;
        sections[i].style.setProperty('--leave', v);
      }
    }
  }
`);

/* ---- Nav pill driver ---- */
rep(`  const root = document.documentElement;
  const nav  = document.getElementById('nav');
  const END  = 360;

  let ticking = false;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const easeInOut = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function update() {
    const p    = easeInOut(clamp(window.scrollY / END));
    const bar  = clamp(1 - p * 1.5);
    const pill = clamp((p - 0.30) / 0.50);

    root.style.setProperty('--nav-pill', p.toFixed(3));
    root.style.setProperty('--nav-bar-vis', bar.toFixed(3));
    root.style.setProperty('--nav-pill-vis', pill.toFixed(3));
    if (nav) nav.classList.toggle('is-pill', p > 0.85);
`, `  const root = document.documentElement;
  const nav  = document.getElementById('nav');
  const END  = 360;
  // As três variáveis só são lidas por regras dentro do .nav (styles.css,
  // NAV PILL MORPH). Escritas no <html>, cada mudança recalculava o estilo
  // do documento inteiro (~1000 elementos); no #nav, só o nav. Os defaults
  // continuam no :root.
  const host = nav || root;
  // Últimos valores escritos — começam nos defaults do :root
  // (--nav-pill: 0; --nav-bar-vis: 1; --nav-pill-vis: 0). No topo da página
  // o cálculo dá exatamente isso, então nada é escrito no load.
  let lastP = '0.000', lastBar = '1.000', lastPill = '0.000';

  let ticking = false;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const easeInOut = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function update() {
    const p    = easeInOut(clamp(window.scrollY / END));
    const bar  = clamp(1 - p * 1.5);
    const pill = clamp((p - 0.30) / 0.50);

    const vp = p.toFixed(3), vb = bar.toFixed(3), vl = pill.toFixed(3);
    if (vp !== lastP)    { lastP = vp;    host.style.setProperty('--nav-pill', vp); }
    if (vb !== lastBar)  { lastBar = vb;  host.style.setProperty('--nav-bar-vis', vb); }
    if (vl !== lastPill) { lastPill = vl; host.style.setProperty('--nav-pill-vis', vl); }
    if (nav) nav.classList.toggle('is-pill', p > 0.85);
`);

/* ---- Cinematic footer --fp ---- */
rep(`    const p = Math.min(1, Math.max(0, (start - mb) / Math.max(1, start - end)));
    footer.style.setProperty('--fp', p.toFixed(3));
  }
`, `    const p = Math.min(1, Math.max(0, (start - mb) / Math.max(1, start - end)));
    // Só escreve quando muda; começa no default do CSS (.cfooter { --fp: 0 }),
    // então longe do fim da página nada é escrito (cada escrita recalcula o
    // footer inteiro, porque --fp herda para os filhos).
    const v = p.toFixed(3);
    if (v !== lastFp) { lastFp = v; footer.style.setProperty('--fp', v); }
  }
`);
rep(`  const main = document.querySelector('main');
  let raf = null;
  function update() {
    raf = null;
    const vh = window.innerHeight;
    const mb = main.getBoundingClientRect().bottom;`, `  const main = document.querySelector('main');
  let raf = null;
  let lastFp = '0.000';
  function update() {
    raf = null;
    const vh = window.innerHeight;
    const mb = main.getBoundingClientRect().bottom;`);

if (crlf) s = s.replace(/\n/g, '\r\n');
const OUTF = path.join(__dirname, 'script.raf-loops.js');
fs.writeFileSync(OUTF, s);
console.log('ok, crlf=', crlf, 'bytes', s.length, '->', OUTF);
