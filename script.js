/* gfxs0da — interactions
   Smooth scroll · reveal · lightbox · count-up · stars · particles · mouse glow
   ========================================================================== */

/* 0. Scroll restoration — always start at top on F5/refresh -------------- */
/* Disable browser's auto-restore (which jumps you back to where you were).
   Then force scroll to top before any other script captures position.    */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);
// Re-enforce on load (in case something fires after) and on bfcache restore
window.addEventListener('load',     () => window.scrollTo(0, 0));
window.addEventListener('pageshow', (e) => { if (e.persisted) window.scrollTo(0, 0); });

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none)').matches;

/* 1. Nav scroll state ----------------------------------------------------- */
const nav = document.getElementById('nav');
const setNavState = () => nav.classList.toggle('scrolled', window.scrollY > 24);
setNavState();
window.addEventListener('scroll', setNavState, { passive: true });

/* 2. Reveal on scroll ----------------------------------------------------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/* 3. Card pointer-tracked light ------------------------------------------ */
if (!isTouch) {
  const cards = document.querySelectorAll('.card');
  cards.forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mx', `${x}%`);
      card.style.setProperty('--my', `${y}%`);
    });
  });

  const style = document.createElement('style');
  style.textContent = `
    .card .card-img::after {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(280px circle at var(--mx) var(--my),
                                  rgba(177, 18, 18, 0.22), transparent 55%);
      opacity: 0;
      transition: opacity .35s cubic-bezier(.22,1,.36,1);
      pointer-events: none;
      z-index: 1;
      mix-blend-mode: screen;
    }
    .card:hover .card-img::after { opacity: 1; }
  `;
  document.head.appendChild(style);
}

/* 4a. Card carousel — para cards multi-variantes ------------------------- */
(() => {
  document.querySelectorAll('.card.has-variants').forEach((card) => {
    const variantsAttr = card.dataset.variants;
    if (!variantsAttr) return;

    const variants = variantsAttr.split(',').map((v) => v.trim());
    const img = card.querySelector('.card-img img');
    const counter = card.querySelector('.card-count');
    const prevBtn = card.querySelector('.card-arrow-prev');
    const nextBtn = card.querySelector('.card-arrow-next');
    let idx = 0;

    // Preload todas as variantes assim que o card entra na viewport
    const preloadIO = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          variants.forEach((v) => {
            const im = new Image();
            im.src = `assets/work/${v}`;
          });
          obs.unobserve(entry.target);
        }
      },
      { rootMargin: '200px' }
    );
    preloadIO.observe(card);

    function setVariant(newIdx) {
      idx = (newIdx + variants.length) % variants.length;
      img.src = `assets/work/${variants[idx]}`;
      if (counter) counter.textContent = `${idx + 1} / ${variants.length}`;
      card.dataset.currentIdx = String(idx);
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setVariant(idx - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setVariant(idx + 1);
      });
    }
  });
})();

/* 4b. Lightbox modal — com suporte a variantes e navegação --------------- */
(() => {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const lightboxImg     = lightbox.querySelector('.lightbox-img');
  const lightboxTitle   = lightbox.querySelector('.lightbox-title');
  const lightboxSub     = lightbox.querySelector('.lightbox-sub');
  const lightboxCounter = lightbox.querySelector('.lightbox-counter');
  const closeBtn        = lightbox.querySelector('.lightbox-close');
  const prevBtn         = lightbox.querySelector('.lightbox-nav-prev');
  const nextBtn         = lightbox.querySelector('.lightbox-nav-next');

  let currentVariants = [];
  let currentIdx = 0;
  let currentTitle = '';
  let currentSub = '';
  let lastFocused = null;

  function showVariant(idx) {
    if (currentVariants.length === 0) return;
    currentIdx = (idx + currentVariants.length) % currentVariants.length;
    lightboxImg.src = `assets/work/${currentVariants[currentIdx]}`;
    lightboxImg.alt = currentVariants.length > 1
      ? `${currentTitle} — variant ${currentIdx + 1} of ${currentVariants.length}`
      : currentTitle;
    lightboxTitle.textContent = currentTitle;
    lightboxSub.textContent = currentSub;

    if (currentVariants.length > 1) {
      lightboxCounter.textContent = `${currentIdx + 1} of ${currentVariants.length}`;
      prevBtn.classList.remove('is-hidden');
      nextBtn.classList.remove('is-hidden');
    } else {
      lightboxCounter.textContent = '';
      prevBtn.classList.add('is-hidden');
      nextBtn.classList.add('is-hidden');
    }
  }

  function open(variants, startIdx, title, sub) {
    lastFocused = document.activeElement;
    currentVariants = variants;
    currentTitle = title;
    currentSub = sub;
    showVariant(startIdx);

    lightbox.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    }, 400);
  }

  document.querySelectorAll('.card').forEach((card) => {
    const trigger = () => {
      // Se card tem variantes, abre na variante atual; senão, single image
      const variantsAttr = card.dataset.variants;
      const variants = variantsAttr
        ? variantsAttr.split(',').map((v) => v.trim())
        : [card.querySelector('.card-img img')?.src.split('/').pop() || ''];
      const startIdx = parseInt(card.dataset.currentIdx || '0', 10);
      const title = card.querySelector('h3')?.textContent || '';
      const sub = card.querySelector('.card-sub')?.textContent || '';
      open(variants, startIdx, title, sub);
    };

    card.addEventListener('click', (e) => {
      // Não abre lightbox se clicou numa setinha do carrossel
      if (e.target.closest && e.target.closest('.card-arrow')) return;
      trigger();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger();
      }
    });
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => showVariant(currentIdx - 1));
  nextBtn.addEventListener('click', () => showVariant(currentIdx + 1));

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowLeft'  && currentVariants.length > 1) showVariant(currentIdx - 1);
    if (e.key === 'ArrowRight' && currentVariants.length > 1) showVariant(currentIdx + 1);
  });
})();

/* Shared counter animation — used by hero stats + trust section ---------- */
function animateCounter(el, duration = 2400) {
  const target = parseFloat(el.dataset.value);
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';

  if (reducedMotion) {
    el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
    return;
  }

  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = (eased * target).toFixed(decimals);
    el.textContent = `${prefix}${current}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* 5a. Hero stats — count up on page load (after stats strip fades in) ---- */
(() => {
  const heroCounters = document.querySelectorAll('.hero-stats-strip .counter');
  if (!heroCounters.length) return;
  // Stats strip animation has 0.6s delay — start counters slightly after it begins
  const wait = reducedMotion ? 0 : 700;
  setTimeout(() => {
    heroCounters.forEach((c) => animateCounter(c, 2400));
  }, wait);
})();

/* 5b. Trust section — count-up + star sequence --------------------------- */
(() => {
  const trustStats = document.getElementById('trust-stats');
  if (!trustStats) return;

  function animateStars(stars) {
    if (reducedMotion) {
      stars.forEach((s) => s.classList.add('lit'));
      return;
    }
    /* Atrasado pra sequência começar DEPOIS dos números aparecerem.
       Numbers completam em ~2400ms; stars começam em 1000ms e
       terminam em 1000 + 4*340 = 2360ms — sincronia natural. */
    stars.forEach((star, i) => {
      setTimeout(() => {
        star.classList.add('lit', 'flash');
        setTimeout(() => star.classList.remove('flash'), 900);
      }, 1000 + i * 340);
    });
  }

  const trustObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const counters = entry.target.querySelectorAll('.counter');
        counters.forEach((c) => animateCounter(c));
        const stars = entry.target.querySelectorAll('.star');
        animateStars(stars);
        trustObserver.unobserve(entry.target);
      }
    },
    { threshold: 0.35 }
  );
  trustObserver.observe(trustStats);
})();

/* 5b2. Chat card — animated dialog playback ----------------------------- */
/* Plays a natural Discord-style ticket conversation. Plays ONCE (no loop)
   when section enters viewport, then stays in final state.               */
(() => {
  const messagesEl = document.getElementById('chat-messages');
  const typingEl   = document.getElementById('chat-typing');
  if (!messagesEl || !typingEl) return;
  const typingNameEl = typingEl.querySelector('.typing-name');

  const dialog = [
    {
      user: 'client', name: '@client', badge: 'Member', badgeClass: 'member',
      letter: 'C', color: '#5865F2', time: '14:23',
      text: 'yo bro! need a thumb for my new game, u down?',
    },
    {
      user: 'gfxs0da', name: '@gfxs0da', badge: 'Staff', badgeClass: 'staff',
      time: '14:25',
      text: "sup bro! let's do it\nsend refs + brief, ideas, anything that helps",
    },
    {
      user: 'client', name: '@client', badge: 'Member', badgeClass: 'member',
      letter: 'C', color: '#5865F2', time: '14:31',
      text: 'just sent, lmk what u can cook there',
    },
    {
      user: 'gfxs0da', name: '@gfxs0da', badge: 'Staff', badgeClass: 'staff',
      time: '14:33',
      text: 'bet 🔥 locking in now, 2 directions by tonight',
    },
    {
      user: 'client', name: '@client', badge: 'Member', badgeClass: 'member',
      letter: 'C', color: '#5865F2', time: '14:35',
      text: 'ur the goat 🙏 no rush',
    },
    {
      user: 'gfxs0da', name: '@gfxs0da', badge: 'Staff', badgeClass: 'staff',
      time: '18:47',
      text: 'done. v1 darker/cinematic, v2 loud/explosive\nwhich one u feeling?',
    },
    {
      user: 'client', name: '@client', badge: 'Member', badgeClass: 'member',
      letter: 'C', color: '#5865F2', time: '18:52',
      text: 'v2, that muzzle flash is insane 🤌',
    },
    {
      user: 'gfxs0da', name: '@gfxs0da', badge: 'Staff', badgeClass: 'staff',
      time: '19:01',
      text: 'said n done, finalizing now',
    },
    {
      user: 'gfxs0da', name: '@gfxs0da', badge: 'Staff', badgeClass: 'staff',
      time: '19:34',
      text: 'delivered ✅ ticket closing',
    },
  ];

  function createMsg(msg) {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    const isS0da = msg.user === 'gfxs0da';
    el.innerHTML = `
      <div class="chat-avatar${isS0da ? ' chat-avatar-s0da' : ''}"
           ${msg.letter ? `data-letter="${msg.letter}"` : ''}
           ${msg.color  ? `style="--c:${msg.color}"`     : ''}></div>
      <div class="chat-body">
        <div class="chat-meta">
          <span class="chat-name">${msg.name}<span class="chat-badge chat-badge-${msg.badgeClass}">${msg.badge}</span></span>
          <span class="chat-time">Today at ${msg.time}</span>
        </div>
        <p class="chat-text"></p>
      </div>`;
    el.querySelector('.chat-text').textContent = msg.text;
    return el;
  }

  function showTyping(name) {
    typingNameEl.textContent = name;
    typingEl.classList.add('is-active');
  }
  function hideTyping() { typingEl.classList.remove('is-active'); }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function addMessage(msg) {
    const el = createMsg(msg);
    messagesEl.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
  }

  async function playOnce() {
    messagesEl.innerHTML = '';
    hideTyping();
    await wait(250);

    for (let i = 0; i < dialog.length; i++) {
      const msg = dialog[i];
      // Typing indicator before every message except the first
      // (first msg = client opening the ticket, instant)
      if (i > 0) {
        showTyping(msg.name);
        await wait(550);
        hideTyping();
        await wait(80);
      }
      addMessage(msg);
      await wait(200);
    }
    // Done — stays in final state, no loop
  }

  if (reducedMotion) {
    dialog.forEach((m) => {
      const el = createMsg(m);
      el.classList.add('is-in');
      messagesEl.appendChild(el);
    });
    return;
  }

  // Trigger once when section enters viewport, then never again
  const section = document.getElementById('process');
  if (!section) { playOnce(); return; }
  const startObs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        playOnce();
        startObs.disconnect();
        return;
      }
    }
  }, { threshold: 0.2 });
  startObs.observe(section);
})();

/* 5c. Chat card — 3D tilt + cursor-tracked glow -------------------------- */
(() => {
  const card = document.getElementById('chat-card');
  if (!card || isTouch || reducedMotion) return;

  const wrapper = card.parentElement; // .chat-mock — listens for mouse, applies tilt to inner card
  let raf = null;
  let targetRX = 0, targetRY = 0;
  let curRX = 0, curRY = 0;
  let mx = 50, my = 50;

  function onMove(e) {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    targetRX = (0.5 - y) * 7;   // -3.5 to 3.5 deg
    targetRY = (x - 0.5) * 8;   // -4 to 4 deg
    mx = x * 100;
    my = y * 100;
    if (!card.classList.contains('tilting')) card.classList.add('tilting');
    if (raf == null) raf = requestAnimationFrame(loop);
  }

  function onLeave() {
    targetRX = 0;
    targetRY = 0;
    if (raf == null) raf = requestAnimationFrame(loop);
    setTimeout(() => card.classList.remove('tilting'), 400);
  }

  function loop() {
    // Lerp toward target — buttery, not snappy
    curRX += (targetRX - curRX) * 0.12;
    curRY += (targetRY - curRY) * 0.12;
    card.style.transform = `rotateX(${curRX.toFixed(2)}deg) rotateY(${curRY.toFixed(2)}deg)`;
    card.style.setProperty('--gx', `${mx}%`);
    card.style.setProperty('--gy', `${my}%`);

    if (Math.abs(targetRX - curRX) > 0.05 || Math.abs(targetRY - curRY) > 0.05) {
      raf = requestAnimationFrame(loop);
    } else {
      curRX = targetRX;
      curRY = targetRY;
      card.style.transform = `rotateX(${curRX}deg) rotateY(${curRY}deg)`;
      raf = null;
    }
  }

  wrapper.addEventListener('mousemove', onMove);
  wrapper.addEventListener('mouseleave', onLeave);
})();

/* 5d. TOS scroll spy — highlights active section in TOC ------------------ */
(() => {
  if (!document.body.classList.contains('tos-page')) return;
  const tocList = document.getElementById('toc-list');
  if (!tocList) return;

  const sections = document.querySelectorAll('.tos-section');
  const items = tocList.querySelectorAll('li');
  if (!sections.length || !items.length) return;

  const sectionToItem = new Map();
  sections.forEach((sec, i) => {
    if (items[i]) sectionToItem.set(sec.id, items[i]);
  });

  function activate(id) {
    items.forEach((it) => it.classList.remove('is-active'));
    const target = sectionToItem.get(id);
    if (target) target.classList.add('is-active');
  }

  // IntersectionObserver — picks the topmost section currently in viewport
  const visible = new Set();
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else                       visible.delete(entry.target.id);
      });
      // Activate the topmost visible section (lowest DOM index)
      let topIdx = Infinity;
      let topId = null;
      sections.forEach((sec, i) => {
        if (visible.has(sec.id) && i < topIdx) {
          topIdx = i;
          topId = sec.id;
        }
      });
      if (topId) activate(topId);
    },
    { rootMargin: '-90px 0px -65% 0px', threshold: 0 }
  );
  sections.forEach((sec) => obs.observe(sec));

  // Activate first item by default before scroll happens
  if (items[0]) items[0].classList.add('is-active');
})();

/* 6. Mouse-tracked glow --------------------------------------------------- */
(() => {
  const glow = document.querySelector('.mouse-glow');
  if (!glow || isTouch || reducedMotion) return;

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let gx = mx;
  let gy = my;
  let active = false;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (!active) {
      glow.classList.add('active');
      active = true;
    }
  });
  document.addEventListener('mouseleave', () => {
    glow.classList.remove('active');
    active = false;
  });

  const tick = () => {
    gx += (mx - gx) * 0.12;
    gy += (my - gy) * 0.12;
    glow.style.left = `${gx}px`;
    glow.style.top = `${gy}px`;
    requestAnimationFrame(tick);
  };
  tick();
})();

/* 6b. Roblox visits — live update from assets/visits.json ----------------- */
/* JSON is regenerated hourly by the GitHub Action at
   .github/workflows/update-visits.yml. Page falls back gracefully to the
   hardcoded HTML values if fetch fails (offline, JSON missing, etc).      */
(() => {
  const cards = document.querySelectorAll('.card[data-game]');
  if (!cards.length) return;

  function fmt(n) {
    if (n >= 1e9) return strip(n / 1e9) + 'B+';
    if (n >= 1e6) return strip(n / 1e6) + 'M+';
    if (n >= 1e3) return strip(n / 1e3) + 'K+';
    return String(n);
  }
  function strip(v) {
    const s = v.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  }

  fetch('assets/visits.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !data.games) return;
      cards.forEach((card) => {
        const key = card.dataset.game;
        const game = data.games[key];
        if (!game || typeof game.visits !== 'number') return;
        const sub = card.querySelector('.card-sub');
        if (!sub) return;
        // Replace just the "<num><K|M|B>+ visits" portion, keep the genre prefix
        sub.textContent = sub.textContent.replace(
          /[\d.]+\s*[KMB]\+\s*visits/i,
          `${fmt(game.visits)} visits`
        );
      });
    })
    .catch(() => { /* silent — keeps hardcoded fallback values */ });
})();

/* 7. Smooth scroll — implementação simples e direta ---------------------- */
/* Lerp puro com EASE 0.16. Sem dt, sem cap, sem complicação.
   Importante: CSS NÃO deve ter `scroll-behavior: smooth` (causa lag).
   Auto-desliga em touch / prefers-reduced-motion.                          */
(() => {
  'use strict';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (matchMedia('(hover: none)').matches) return;

  let target  = window.scrollY;
  let current = window.scrollY;
  let raf = null;

  /* EASE 0.10 = mais manteiga, mais inércia. Sweet spot:
     - 0.16 = muito rápido
     - 0.075 (com dt-aware antigo) = travado
     - 0.10 = buttery sem laggy */
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

/* Custom scrollbar rail — position, glow on scroll, drag-to-scroll -------- */
(() => {
  const rail = document.querySelector('.rail');
  const thumb = document.querySelector('.rail__thumb');
  if (!rail || !thumb) return;

  const html = document.documentElement;
  const MIN_THUMB = 48; // smallest thumb height in px
  let scrollTimer = null;
  const STOP_MS = 260;

  function update() {
    const docH = html.scrollHeight;
    const winH = window.innerHeight;
    if (docH <= winH + 1) {
      rail.style.display = 'none';
      return;
    }
    rail.style.display = '';
    const trackH = winH;
    const ratio = winH / docH;
    const thumbH = Math.max(MIN_THUMB, Math.round(ratio * trackH));
    const maxScroll = docH - winH;
    const top = (window.scrollY / maxScroll) * (trackH - thumbH);
    thumb.style.height = thumbH + 'px';
    thumb.style.transform = `translate(-50%, ${top}px)`;
  }

  // Mark scrolling for the glow effect
  window.addEventListener('scroll', () => {
    html.classList.add('is-scrolling');
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => html.classList.remove('is-scrolling'), STOP_MS);
    update();
  }, { passive: true });
  window.addEventListener('resize', update);

  // Drag-to-scroll on the thumb
  let dragging = false;
  let dragStartY = 0;
  let dragStartScroll = 0;
  thumb.addEventListener('mousedown', (e) => {
    dragging = true;
    dragStartY = e.clientY;
    dragStartScroll = window.scrollY;
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const docH = html.scrollHeight;
    const winH = window.innerHeight;
    const thumbH = thumb.offsetHeight;
    const trackH = winH - thumbH;
    if (trackH <= 0) return;
    const scrollRatio = (docH - winH) / trackH;
    const dy = e.clientY - dragStartY;
    window.scrollTo(0, dragStartScroll + dy * scrollRatio);
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
  });

  update();
})();
