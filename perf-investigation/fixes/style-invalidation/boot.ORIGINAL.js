/* Loading splash controller — shared across all pages.
   Shows the splash only ONCE per browser session (sessionStorage). On the
   first page of a session it plays + fades; on every later page/refresh in
   the same session it is skipped (the inline head-snippet adds html.no-boot
   before paint so there is no flash). setTimeout (not rAF) so it fires in a
   backgrounded tab; the CSS failsafe hides it anyway if this never runs. */
(function () {
  // BOOT SWITCH: if the splash is disabled in boot.css (the SWITCH block
  // sets #boot to display:none), skip everything and run the page
  // immediately. Re-enabling the splash there re-enables all of this.
  var bootEl = document.getElementById('boot');
  if (!bootEl || getComputedStyle(bootEl).display === 'none') {
    document.body.classList.add('ready');
    return;
  }

  var KEY = 's0da-booted';
  var seen = false;
  try { seen = !!sessionStorage.getItem(KEY); } catch (e) {}

  if (seen) {
    // Splash already shown this session → run the page normally, no splash.
    document.body.classList.add('ready');
    return;
  }

  try { sessionStorage.setItem(KEY, '1'); } catch (e) {}

  function reveal() {
    document.body.classList.add('ready');
    var el = document.getElementById('boot');
    if (el) setTimeout(function () { el.style.display = 'none'; }, 650);
  }
  setTimeout(reveal, 1200);
})();
