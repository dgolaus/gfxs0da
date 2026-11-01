// Aplica as mudanças da lane forced-layout sobre a cópia pristina do script.js.
// uso: node patch.js <saida.js> [--idle]
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'script.ORIGINAL.js');
const OUT = path.resolve(__dirname, process.argv[2] || 'script.js');
let s = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const rep = (from, to) => {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error('match count ' + n + ' for:\n' + from.slice(0, 160));
  s = s.replace(from, () => to);
};

/* 1. 6c scroll-driven gradient: metadados resolvidos uma vez; todas as
      leituras de geometria antes de qualquer escrita no frame. */
rep(`  const LERP = 0.10;
  const smoothed = new WeakMap();

  function update() {
    const vh = window.innerHeight;
    if (vh === 0) return;
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      const elTopVh = (rect.top / vh) * 100;
      const targetY = 50 - elTopVh;
`, `  const LERP = 0.10;
  const smoothed = new WeakMap();
  // Dados fixos de cada elemento, resolvidos uma vez (antes, closest() e
  // querySelector() rodavam em todo frame).
  const items = Array.from(els, (el) => ({
    el,
    // O texto vive num filho .accent-text (o pai é a janela das orbs)
    text: el.querySelector(':scope > .accent-text'),
    isHero: el.classList.contains('accent') && el.closest('.hero-title') !== null,
  }));
  const tops = new Array(items.length);

  function update() {
    const vh = window.innerHeight;
    if (vh === 0) return;
    // Todas as leituras primeiro, depois as escritas. Intercalar (escreve o
    // fundo de um, lê o rect do próximo) forçava um recálculo de estilo extra
    // por frame. background-image não mexe em layout: os valores são iguais.
    for (let i = 0; i < items.length; i++) tops[i] = items[i].el.getBoundingClientRect().top;
    for (let i = 0; i < items.length; i++) {
      const { el, text, isHero } = items[i];
      const elTopVh = (tops[i] / vh) * 100;
      const targetY = 50 - elTopVh;
`);
rep(`      const isHero = el.classList.contains('accent') &&
                     el.closest('.hero-title') !== null;
      const tight = isHero;`, `      const tight = isHero;`);
rep(`      el.style.backgroundImage = grad;
      // O texto vive num filho .accent-text (o pai é a janela das orbs)
      const t = el.querySelector(':scope > .accent-text');
      if (t) t.style.backgroundImage = grad;
    }`, `      el.style.backgroundImage = grad;
      if (text) text.style.backgroundImage = grad;
    }`);

/* 2. 6d section fade: leituras em lote e só escreve --leave quando muda. */
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
  }`, `  // Último valor escrito por seção. Começa em '0.000' = o --leave: 0 que
  // o CSS (.scroll-fade) já aplica, então no topo da página o init não
  // escreve nada. Antes, cada escrita invalidava a subárvore inteira da
  // seção (custom property herdada) e a leitura da seção seguinte forçava
  // o recálculo: 5 recálculos (~640 elementos) no meio do script de init.
  const lastLeave = sections.map(() => '0.000');
  const bottoms = new Array(sections.length);
  function update() {
    const vh = window.innerHeight;
    // Fade window: section's bottom traveling from 30% of vh → 0 maps to leave 0→1
    const fadeStart = vh * 0.30;
    // Leituras em lote, depois escritas (nunca lê depois de escrever).
    for (let i = 0; i < sections.length; i++) bottoms[i] = sections[i].getBoundingClientRect().bottom;
    for (let i = 0; i < sections.length; i++) {
      let leave = 0;
      if (bottoms[i] < fadeStart) {
        leave = Math.min(1, Math.max(0, (fadeStart - bottoms[i]) / fadeStart));
      }
      const v = leave.toFixed(3);
      if (v !== lastLeave[i]) { sections[i].style.setProperty('--leave', v); lastLeave[i] = v; }
    }
  }`);

/* 3. Nav pill: só escreve as variáveis do :root quando mudam. */
rep(`  let ticking = false;
  const clamp = (v) => Math.max(0, Math.min(1, v));`, `  let ticking = false;
  // Último valor escrito de cada variável; começa igual aos defaults do
  // :root (styles.css: --nav-pill 0, --nav-bar-vis 1, --nav-pill-vis 0).
  // Escrever custom property no <html> invalida o estilo do documento
  // inteiro; no init (scroll 0) o valor é o mesmo do CSS, então não escreve.
  const last = { '--nav-pill': '0.000', '--nav-bar-vis': '1.000', '--nav-pill-vis': '0.000' };
  const put = (k, v) => { if (last[k] !== v) { root.style.setProperty(k, v); last[k] = v; } };
  const clamp = (v) => Math.max(0, Math.min(1, v));`);
rep(`    root.style.setProperty('--nav-pill', p.toFixed(3));
    root.style.setProperty('--nav-bar-vis', bar.toFixed(3));
    root.style.setProperty('--nav-pill-vis', pill.toFixed(3));`, `    put('--nav-pill', p.toFixed(3));
    put('--nav-bar-vis', bar.toFixed(3));
    put('--nav-pill-vis', pill.toFixed(3));`);

/* 5. Footer cinematográfico: só escreve --fp quando muda (CSS: .cfooter { --fp: 0 }). */
rep(`    const p = Math.min(1, Math.max(0, (start - mb) / Math.max(1, start - end)));
    footer.style.setProperty('--fp', p.toFixed(3));`, `    const p = Math.min(1, Math.max(0, (start - mb) / Math.max(1, start - end)));
    // Só escreve quando muda. Começa em '0.000' = o --fp: 0 do CSS, então
    // no topo da página o init não invalida a subárvore do footer.
    const v = p.toFixed(3);
    if (v !== lastFp) { footer.style.setProperty('--fp', v); lastFp = v; }`);
rep(`  const main = document.querySelector('main');
  let raf = null;`, `  const main = document.querySelector('main');
  let raf = null;
  let lastFp = '0.000';`);

/* 4. Colunas de depoimentos: remove os duplicados de TODAS as colunas,
      mede todas de uma vez (um layout só) e só então clona. */
const TESTI_OLD = `  const target = (wrap ? wrap.getBoundingClientRect().height : 640) || 640;
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
})();`;
const TESTI_NEW = `  const target = (wrap ? wrap.getBoundingClientRect().height : 640) || 640;
  // Antes: por coluna, escreve → lê → escreve, e cada leitura forçava
  // recálculo de estilo + layout. Agora: remove os duplicados de todas as
  // colunas, mede todas de uma vez (um layout só) e só então clona. O laço
  // de medição continua igual para o caso raro de coluna curta ou oculta,
  // então o número de repetições é o mesmo. Clones entram por
  // DocumentFragment: mesma ordem, mesmo DOM final.
  const cloneInto = (track, nodes) => {
    const frag = document.createDocumentFragment();
    nodes.forEach((q) => { const c = q.cloneNode(true); c.setAttribute('aria-hidden', 'true'); frag.appendChild(c); });
    track.appendChild(frag);
  };
  const jobs = [];
  cols.forEach((col) => {
    const track = col.querySelector('.tcol-track');
    if (!track) return;
    const originals = Array.from(track.querySelectorAll('.quote:not([aria-hidden])'));
    if (!originals.length) return;
    // Remove duplicados atuais e reconstrói
    track.querySelectorAll('.quote[aria-hidden]').forEach((q) => q.remove());
    jobs.push({ track, originals, half: 0 });
  });
  jobs.forEach((j) => { j.half = j.track.getBoundingClientRect().height; });
  jobs.forEach(({ track, originals, half }) => {
    let reps = 1;
    while (half < target + 40 && reps < 6) { // garante folga
      cloneInto(track, originals);
      reps++;
      half = track.getBoundingClientRect().height;
    }
    // Segunda metade = cópia exata da primeira
    cloneInto(track, Array.from(track.children));
  });
})();`;
rep(TESTI_OLD, TESTI_NEW);

fs.writeFileSync(OUT, s.replace(/\n/g, '\r\n'));
console.log('ok ->', OUT);
