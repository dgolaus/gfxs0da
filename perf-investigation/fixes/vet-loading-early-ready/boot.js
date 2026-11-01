/* Loading splash controller — shared across all pages.
   Shows the splash only ONCE per browser session (sessionStorage). On the
   first page of a session it plays + fades; on every later page/refresh in
   the same session it is skipped (the inline head-snippet adds html.no-boot
   before paint so there is no flash). setTimeout (not rAF) so it fires in a
   backgrounded tab; the CSS failsafe hides it anyway if this never runs. */
(function () {
  // "Página liberada". Além da classe body.ready (usada pelo CSS do splash),
  // marca window.s0daReady: o snippet inline do index.html pode pôr a classe
  // cedo, então o script.js não pode usar a presença dela como sinal. Re-adicionar
  // a classe já presente não custa estilo, mas ainda gera o MutationRecord
  // que o script.js (5a) escuta — o momento da contagem da hero fica igual.
  function markReady() {
    document.body.classList.add('ready');
    window.s0daReady = true;
  }
  // BOOT SWITCH: if the splash is disabled in boot.css (the SWITCH block
  // sets #boot to display:none), skip everything and run the page
  // immediately. Re-enabling the splash there re-enables all of this.
  var bootEl = document.getElementById('boot');
  if (!bootEl || getComputedStyle(bootEl).display === 'none') {
    markReady();
    return;
  }

  var KEY = 's0da-booted';
  var seen = false;
  try { seen = !!sessionStorage.getItem(KEY); } catch (e) {}

  if (seen) {
    // Splash already shown this session → run the page normally, no splash.
    markReady();
    return;
  }

  try { sessionStorage.setItem(KEY, '1'); } catch (e) {}

  function reveal() {
    markReady();
    var el = document.getElementById('boot');
    if (el) setTimeout(function () { el.style.display = 'none'; }, 650);
  }
  setTimeout(reveal, 1200);
})();
