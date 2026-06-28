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
/* Only runs if a nav exists (TOS page still has one — homepage no longer does) */
const nav = document.getElementById('nav');
if (nav) {
  const setNavState = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  setNavState();
  window.addEventListener('scroll', setNavState, { passive: true });
}

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

    // Preload as variantes (WebP) quando o card entra na viewport
    const preloadIO = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          variants.forEach((v) => {
            new Image().src = `assets/work/${v}`;
          });
          obs.unobserve(entry.target);
        }
      },
      { rootMargin: '200px' }
    );
    preloadIO.observe(card);

    function setVariant(newIdx) {
      idx = (newIdx + variants.length) % variants.length;
      const webp = variants[idx];
      img.src = `assets/work/${webp}`;
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

/* 4b. Lightbox modal — variantes, zoom/pan, fullscreen, hash linking ---- */
(() => {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const lightboxImg     = lightbox.querySelector('.lightbox-img');
  const lightboxTitle   = lightbox.querySelector('.lightbox-title');
  const lightboxCreator     = lightbox.querySelector('.lightbox-creator');
  const lightboxCreatorName = lightbox.querySelector('.lightbox-creator-name');
  const lightboxSub     = lightbox.querySelector('.lightbox-sub');
  const lightboxCounter = lightbox.querySelector('.lightbox-counter');
  const closeBtn        = lightbox.querySelector('.lightbox-close');
  const prevBtn         = lightbox.querySelector('.lightbox-nav-prev');
  const nextBtn         = lightbox.querySelector('.lightbox-nav-next');

  let currentVariants = [];
  let currentIdx = 0;
  let currentTitle = '';
  let currentSub = '';
  let currentCreator = '';
  let currentCreatorVerified = false;
  let currentSlug = '';
  let lastFocused = null;

  // Zoom + pan state
  let zoomed = false;
  let panX = 0, panY = 0;
  let dragStart = null;

  function applyTransform() {
    lightboxImg.style.transform = zoomed
      ? `scale(2) translate(${panX}px, ${panY}px)`
      : '';
  }
  function resetZoom() {
    zoomed = false;
    panX = 0;
    panY = 0;
    lightboxImg.classList.remove('is-zoomed');
    applyTransform();
  }

  function showVariant(idx) {
    if (currentVariants.length === 0) return;
    resetZoom();
    currentIdx = (idx + currentVariants.length) % currentVariants.length;
    lightboxImg.src = `assets/work/${currentVariants[currentIdx]}`;
    lightboxImg.alt = currentVariants.length > 1
      ? `${currentTitle} — variant ${currentIdx + 1} of ${currentVariants.length}`
      : currentTitle;
    lightboxTitle.textContent = currentTitle;
    lightboxSub.textContent = currentSub;

    if (currentCreator) {
      lightboxCreatorName.textContent = 'By ' + currentCreator;
      lightboxCreator.style.display = '';
      const existingBadge = lightboxCreator.querySelector('.verified-badge');
      if (currentCreatorVerified && !existingBadge) {
        const img = document.createElement('img');
        img.className = 'verified-badge';
        img.src = 'assets/roblox-verified.svg';
        img.alt = 'Verified by Roblox';
        lightboxCreator.appendChild(img);
      } else if (!currentCreatorVerified && existingBadge) {
        existingBadge.remove();
      }
    } else {
      lightboxCreatorName.textContent = '';
      lightboxCreator.style.display = 'none';
    }

    if (currentVariants.length > 1) {
      lightboxCounter.textContent = `${currentIdx + 1} of ${currentVariants.length}`;
      prevBtn.classList.remove('is-hidden');
      nextBtn.classList.remove('is-hidden');
    } else {
      lightboxCounter.textContent = '';
      prevBtn.classList.add('is-hidden');
      nextBtn.classList.add('is-hidden');
    }

    // Update URL hash so the variant is deep-linkable.
    if (currentSlug) {
      const newHash = currentVariants.length > 1
        ? `#work-${currentSlug}-${currentIdx + 1}`
        : `#work-${currentSlug}`;
      history.replaceState(null, '', newHash);
    }
  }

  function open(variants, startIdx, title, sub, slug, creator, creatorVerified) {
    lastFocused = document.activeElement;
    currentVariants = variants;
    currentTitle = title;
    currentSub = sub;
    currentCreator = creator || '';
    currentCreatorVerified = !!creatorVerified;
    currentSlug = slug || '';
    showVariant(startIdx);

    lightbox.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    resetZoom();
    // Exit fullscreen if active
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    // Clear hash from URL
    if (location.hash.startsWith('#work-')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    setTimeout(() => {
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    }, 400);
  }

  function triggerFromCard(card) {
    const variantsAttr = card.dataset.variants;
    const variants = variantsAttr
      ? variantsAttr.split(',').map((v) => v.trim())
      : [card.querySelector('.card-img img')?.src.split('/').pop() || ''];
    const startIdx = parseInt(card.dataset.currentIdx || '0', 10);
    const title = card.querySelector('h3')?.textContent || '';
    const sub = card.querySelector('.card-sub')?.textContent || '';
    const slug = card.dataset.game || '';
    const creator = card.dataset.creatorName || '';
    const creatorVerified = card.dataset.creatorVerified === 'true';
    open(variants, startIdx, title, sub, slug, creator, creatorVerified);
  }

  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.card-arrow')) return;
      triggerFromCard(card);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerFromCard(card);
      }
    });
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => showVariant(currentIdx - 1));
  nextBtn.addEventListener('click', () => showVariant(currentIdx + 1));

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  // Zoom on click of image
  lightboxImg.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!zoomed) {
      zoomed = true;
      panX = 0; panY = 0;
      lightboxImg.classList.add('is-zoomed');
      applyTransform();
    } else {
      resetZoom();
    }
  });

  // Pan via pointer drag when zoomed
  lightboxImg.addEventListener('pointerdown', (e) => {
    if (!zoomed) return;
    e.preventDefault();
    dragStart = { x: e.clientX, y: e.clientY, panX, panY };
    lightboxImg.setPointerCapture(e.pointerId);
    lightboxImg.classList.add('is-dragging');
  });
  lightboxImg.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    panX = dragStart.panX + (e.clientX - dragStart.x) / 2;
    panY = dragStart.panY + (e.clientY - dragStart.y) / 2;
    applyTransform();
  });
  function endDrag() {
    if (!dragStart) return;
    dragStart = null;
    lightboxImg.classList.remove('is-dragging');
  }
  lightboxImg.addEventListener('pointerup', endDrag);
  lightboxImg.addEventListener('pointercancel', endDrag);

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape')     close();
    else if (e.key === 'ArrowLeft'  && currentVariants.length > 1) showVariant(currentIdx - 1);
    else if (e.key === 'ArrowRight' && currentVariants.length > 1) showVariant(currentIdx + 1);
    else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else lightbox.requestFullscreen().catch(() => {});
    }
  });

  // Deep-link on load — if URL has #work-<slug>[-<n>], open lightbox.
  function openFromHash() {
    const m = location.hash.match(/^#work-([a-z0-9-]+)(?:-(\d+))?$/i);
    if (!m) return;
    const [, slug, idxStr] = m;
    const card = document.querySelector(`.card[data-game="${slug}"]`);
    if (!card) return;
    const targetIdx = idxStr ? parseInt(idxStr, 10) - 1 : 0;
    card.dataset.currentIdx = String(targetIdx);
    triggerFromCard(card);
  }
  window.addEventListener('load', openFromHash);
  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#work-')) return;
    openFromHash();
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
  const go = () => heroCounters.forEach((c) => animateCounter(c, 2400));
  if (reducedMotion) { go(); return; }
  // If the loading splash is present, hold the count-up until it starts
  // leaving (body.ready) so the hero comes alive as the splash clears.
  // Without a splash, keep the original ~700ms-after-load timing.
  const boot = document.getElementById('boot');
  if (!boot) { setTimeout(go, 700); return; }
  const run = () => setTimeout(go, 180);
  if (document.body.classList.contains('ready')) { run(); return; }
  const obs = new MutationObserver(() => {
    if (document.body.classList.contains('ready')) { obs.disconnect(); run(); }
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
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

  // Dialog uses .html (innerHTML) so we can render <strong> + multi-line via \n.
  // All content is hardcoded — no XSS surface.
  const dialog = [
    {
      user: 'client', name: '@client', badge: 'Member', badgeClass: 'member',
      letter: 'C', color: '#5865F2', time: '14:23',
      html: 'yo bro, got a new game dropping soon. need a thumbnail, you available?',
    },
    {
      user: 'gfxs0da', name: '@gfxs0da', badge: 'Staff', badgeClass: 'staff',
      time: '14:24',
      html: 'for sure 🔥 send me the game link, references, and any ideas you have in mind.',
    },
    {
      user: 'client', name: '@client', badge: 'Member', badgeClass: 'member',
      letter: 'C', color: '#5865F2', time: '14:30',
      html: 'just sent everything over. curious to see what you come up with.',
    },
    {
      user: 'gfxs0da', name: '@gfxs0da', badge: 'Staff', badgeClass: 'staff',
      time: '14:32',
      html: "perfect. I'll put together 2 initial concepts so you can choose the direction you like best.",
    },
    {
      user: 'client', name: '@client', badge: 'Member', badgeClass: 'member',
      letter: 'C', color: '#5865F2', time: '14:33',
      html: 'sounds good bro 🙏',
    },
    {
      user: 'gfxs0da', name: '@gfxs0da', badge: 'Staff', badgeClass: 'staff',
      time: '17:48',
      html: 'the first pass is ready.\n\n• <strong>Concept 1:</strong> darker, more cinematic look\n• <strong>Concept 2:</strong> brighter, more explosive and action-focused\n\nwhich one are you feeling more?',
    },
    {
      user: 'client', name: '@client', badge: 'Member', badgeClass: 'member',
      letter: 'C', color: '#5865F2', time: '17:53',
      html: 'definitely concept 2. the effects go crazy 🤯',
    },
    {
      user: 'gfxs0da', name: '@gfxs0da', badge: 'Staff', badgeClass: 'staff',
      time: '18:01',
      html: 'w choice. polishing the final details and exporting now.',
    },
    {
      user: 'gfxs0da', name: '@gfxs0da', badge: 'Staff', badgeClass: 'staff',
      time: '18:34',
      html: 'final thumbnail delivered ✅\nappreciate the trust, excited to see the game launch.',
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
    // innerHTML: respects \n via CSS white-space: pre-line, allows <strong>, etc.
    el.querySelector('.chat-text').innerHTML = msg.html;
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
        if (!game) return;

        if (typeof game.visits === 'number') {
          const sub = card.querySelector('.card-sub');
          if (sub) {
            sub.textContent = sub.textContent.replace(
              /[\d.]+\s*[KMB]\+\s*visits/i,
              `${fmt(game.visits)} visits`
            );
          }
        }

        if (game.creatorName) {
          card.dataset.creatorName = game.creatorName;
          card.dataset.creatorVerified = game.creatorVerified ? 'true' : 'false';
        }
      });
    })
    .catch(() => { /* silent — keeps hardcoded fallback values */ });
})();

/* 6c. Scroll-driven gradient — Rockstar VI style ------------------------- */
/* Each accent text gets its own radial gradient whose center tracks the
   viewport vertical middle (50vh). As the element scrolls through the
   viewport, the bright spot appears to "pass through" the text.

   Per-element formula: circleY = 50vh - element's_top_in_vh
   → when element is at viewport top:    circle is 50vh below element top (dimmer)
   → when element is at viewport middle: circle is right at element top   (brightest)
   → when element is at viewport bottom: circle is 50vh above element top (dimmer)

   No transparent stop — last color is deep red so off-screen elements stay
   visible (no invisible text) even before they pass through bright spot.
   rAF loop instead of scroll events (scrollTo doesn't reliably fire them).*/
(() => {
  const els = document.querySelectorAll(
    '.hero-title .accent, .process-text h2 .accent-soft, .trust-stat strong'
  );
  if (!els.length) return;

  // Smoothed circleY per element — lerps toward the scroll-based target.
  // Higher LERP = faster catchup (1 = no lag). 0.10 gives a soft delay
  // where the gradient visibly follows the scroll instead of locking to it.
  const LERP = 0.10;
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
      el.style.backgroundImage =
        `radial-gradient(circle at 50% ${nextY.toFixed(2)}vh,` +
        ` #ff8b6b 0vh,` +
        ` #ff1727 ${tight ? 12 : 30}vh,` +
        ` #6B0808 ${tight ? 50 : 80}vh,` +
        ` #1F0202 ${tight ? 120 : 160}vh)`;
    }
  }

  function loop() {
    update();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

/* 6d. Section scroll fade-out ------------------------------------------- */
/* As the user scrolls past the Portfolio section, sections below it fade
   out as they LEAVE THE TOP of the viewport.

   Trigger metric: rect.bottom (not rect.top). The fade only kicks in
   once the section's BOTTOM enters the top 30% of viewport — meaning
   most of the section's content is already off-screen. This prevents
   the "still-looking-at-it-but-it's-blurred" bug that --rect.top would
   cause for tall sections (e.g. Pricing with the Calculator at the
   bottom: with the old formula the calc was already faded while still
   centered in view).

   Hero + Portfolio are excluded (stay crisp as anchors).
   rAF loop only WRITES a CSS variable — no layout thrash.            */
(() => {
  const ids = ['about', 'process', 'trust', 'pricing', 'contact'];
  const sections = ids
    .map((id) => document.getElementById(id))
    .filter((el) => el !== null);
  if (sections.length === 0) return;

  for (const s of sections) s.classList.add('scroll-fade');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function update() {
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
  // Idle-gated rAF: run while the page is scrolling, sleep when it's still.
  // The fade only depends on scroll position, so skipping idle frames is
  // free perf (no getBoundingClientRect thrash while you're just reading).
  let rafId = null;
  let lastY = -1;
  function loop() {
    update();
    if (window.scrollY !== lastY) {
      lastY = window.scrollY;
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }
  function kick() { if (rafId == null) { lastY = -1; rafId = requestAnimationFrame(loop); } }
  update();
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick, { passive: true });
})();

/* 6e. Pause the hero collage animation while the hero is off-screen -------- */
(() => {
  const heroBg = document.querySelector('.hero-bg');
  const hero = document.querySelector('.hero');
  if (!heroBg || !hero) return;
  new IntersectionObserver(
    ([entry]) => heroBg.classList.toggle('is-paused', !entry.isIntersecting),
    { threshold: 0 }
  ).observe(hero);
})();

/* 7. Smooth scroll — moved to shared smooth-scroll.js (loaded on both the
   homepage and /slots/). Keep CSS free of `scroll-behavior: smooth`. */

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


/* Nav pill morph driver — sets --nav-pill / --nav-bar-vis / --nav-pill-vis
   per scroll position; pairs with the NAV PILL MORPH block in styles.css.
   Bar stays present until the pill is already covering, so there is never
   a frame where the centre is uncovered:
     bar-vis  = clamp(1 - p * 1.5)        gone by p ≈ 0.67
     pill-vis = clamp((p - 0.30) / 0.50)  full by p ≈ 0.80
   Overlap 0.30–0.67 → smooth handoff, no gap. */
(() => {
  const root = document.documentElement;
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

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });

  update();
})();

/* Commission status — flip the hero + CTA "Commissions Open" badges to
   "closed" when assets/slots.json reports closed:true. Discord-driven: the
   slots channel name controls slots.json (see scripts/fetch-slots.js). Open
   (or any fetch failure) keeps the hardcoded "open" default. */
(() => {
  const badges = document.querySelectorAll('[data-comms-badge]');
  const ctas = document.querySelectorAll('[data-comms-cta]');
  if (!badges.length && !ctas.length) return;
  fetch('assets/slots.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !data.closed) return;
      badges.forEach((b) => {
        b.classList.add('is-comms-closed');
        const label = b.querySelector('.comms-label');
        if (label) label.textContent = 'Commissions closed';
      });
      ctas.forEach((c) => {
        const label = c.querySelector('.cta-label');
        if (label) label.textContent = 'Join the Waitlist';
      });
    })
    .catch(() => { /* keep default "open" on failure */ });
})();
