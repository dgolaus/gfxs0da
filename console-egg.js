/* Console easter egg: a styled brand mark + Discord hook for the curious
   devs who pop open the inspector. Loaded on every page. Harmless if console
   styling is unsupported (wrapped in try/catch). */
(function () {
  try {
    var mark = [
      '███████╗ ██████╗ ██████╗  █████╗ ',
      '██╔════╝██╔═████╗██╔══██╗██╔══██╗',
      '███████╗██║██╔██║██║  ██║███████║',
      '╚════██║████╔╝██║██║  ██║██╔══██║',
      '███████║╚██████╔╝██████╔╝██║  ██║',
      '╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝'
    ].join('\n');

    var red  = 'color:#fc1f25';
    var head = 'color:#f2f2f2;font:600 13px sans-serif';
    var body = 'color:#b0b0b0;font:12px/1.7 sans-serif';
    var cta  = 'color:#fc1f25;font:700 13px sans-serif';
    var foot = 'color:#6b6b6b;font:11px sans-serif';

    console.log('%c' + mark, red);
    console.log('%cInspecting the source? Good eye. 👀', head);
    console.log('%cEverything on this page earns its place,\nsame way I build thumbnails that win the click.\nGot a Roblox game that deserves better art?', body);
    console.log('%c→ discord.gg/s0da', cta);
    console.log('%c2.3B+ visits influenced · designing since 2020', foot);
  } catch (e) {}
})();
