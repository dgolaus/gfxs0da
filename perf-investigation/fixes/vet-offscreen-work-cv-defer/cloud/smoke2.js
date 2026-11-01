const L = require('./lib.js');
(async () => { const b = await L.launch(); const { p, c } = await L.open(b, 'baseline', { w: 1440, h: 900 }); await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.w8(1500);
  const q = () => p.evaluate(() => ['(hover: none)','(hover: hover)','(pointer: fine)','(pointer: coarse)','(pointer: none)','(any-hover: hover)'].map((m) => m + '=' + matchMedia(m).matches).join(' ') + ' lenis=' + !!window.lenis + ' lenisScript=' + !!document.querySelector('script[src*=lenis]'));
  console.log('default', await q());
  try { await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'hover' }, { name: 'pointer', value: 'fine' }, { name: 'any-hover', value: 'hover' }, { name: 'any-pointer', value: 'fine' }] }); console.log('emulated', await q()); } catch (e) { console.log('emu err', e.message); }
  await b.close(); })();
