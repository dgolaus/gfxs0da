/* Smooth scroll — shared by the homepage and /slots/.
   Pure lerp with EASE 0.10. No dt, no cap. Auto-disables on touch /
   prefers-reduced-motion. CSS must NOT set `scroll-behavior: smooth`
   (it fights this and causes lag). */
(() => {
  'use strict';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (matchMedia('(hover: none)').matches) return;

  let target  = window.scrollY;
  let current = window.scrollY;
  let raf = null;

  /* EASE 0.10 = buttery with inertia. 0.16 too fast, 0.075 too sticky. */
  const EASE = 0.10;
  const NAV_OFFSET = 80;

  const maxScroll = () =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const clamp = (v) => Math.max(0, Math.min(v, maxScroll()));

  function loop() {
    current += (target - current) * EASE;
    if (Math.abs(target - current) < 0.5) {
      current = target;
      window.scrollTo(0, current);
      raf = null;
      return;
    }
    window.scrollTo(0, current);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (raf == null) raf = requestAnimationFrame(loop);
  }

  // Wheel
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return;
    if (e.target.closest && e.target.closest('.lightbox.is-open')) return;
    e.preventDefault();
    target = clamp(target + e.deltaY);
    start();
  }, { passive: false });

  // Anchor links
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const dest = document.getElementById(href.slice(1));
    if (!dest) return;
    e.preventDefault();
    target = clamp(dest.getBoundingClientRect().top + window.scrollY - NAV_OFFSET);
    start();
  });

  // Sync on external scroll (scrollbar, keyboard, find)
  window.addEventListener('scroll', () => {
    if (raf != null) return;
    const drift = Math.abs(window.scrollY - current);
    if (drift > 4) target = current = window.scrollY;
  }, { passive: true });

  window.addEventListener('resize', () => { target = clamp(target); });
})();
