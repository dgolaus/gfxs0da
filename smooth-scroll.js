/* Smooth scroll — shared by the homepage and /slots/.
   Lenis (mesmo motor do Cube Graphics), lerp 0.085. Substitui o lerp
   manual anterior: um único loop de animação, inércia consistente em
   roda e trackpad, e scrollTo programático com easing para as âncoras.
   Auto-desliga em touch e prefers-reduced-motion. CSS must NOT set
   `scroll-behavior: smooth` (fights this and causes lag).

   Carregamento: o script injeta o Lenis via CDN e só instancia depois do
   load. Se o CDN falhar, a página rola nativa — nada quebra. */
(() => {
  'use strict';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (matchMedia('(hover: none)').matches) return;

  const NAV_OFFSET = 80;
  const CDN = 'https://cdn.jsdelivr.net/npm/lenis@1.1.18/dist/lenis.min.js';

  function boot() {
    if (!window.Lenis) return;

    const lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 1,
      smoothWheel: true,
      syncTouch: false,
      // A lightbox rola por dentro; o Lenis não deve capturar a roda ali.
      prevent: (node) => !!(node.closest && node.closest('.lightbox.is-open')),
    });

    let raf = null;
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    // Âncoras (#work, #pricing…) rolam suave com offset da nav.
    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const dest = document.getElementById(href.slice(1));
      if (!dest) return;
      e.preventDefault();
      // Alvo numérico, não o elemento: com elemento o scroll suave parava
      // antes do destino em páginas longas (visto no /tos/). Calculado
      // aqui e limitado ao máximo rolável.
      const y = Math.min(lenis.limit, Math.max(0, dest.getBoundingClientRect().top + window.scrollY - NAV_OFFSET));
      lenis.scrollTo(y, { duration: 1.2 });
      history.pushState(null, '', href);
    });

    // A lightbox põe body.overflow=hidden ao abrir; espelha isso no Lenis
    // para a página não deslizar por baixo do modal.
    const body = document.body;
    new MutationObserver(() => {
      if (body.style.overflow === 'hidden') lenis.stop();
      else lenis.start();
    }).observe(body, { attributes: true, attributeFilter: ['style'] });

    window.lenis = lenis;
  }

  if (window.Lenis) { boot(); return; }
  const s = document.createElement('script');
  s.src = CDN;
  s.async = true;
  s.onload = boot;
  document.head.appendChild(s);
})();
