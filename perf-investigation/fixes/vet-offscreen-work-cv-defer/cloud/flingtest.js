const L = require('./lib.js');
(async () => { const b = await L.launch(); const { p, c } = await L.open(b, 'baseline', { w: 390, h: 844, mobile: true });
  await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.w8(2000);
  try { await c.send('Input.synthesizeScrollGesture', { x: 195, y: 422, yDistance: -3000, speed: 3000, gestureSourceType: 'touch' }); console.log('gesture ok', await p.evaluate(() => scrollY)); } catch (e) { console.log('gesture err', e.message); }
  // manual touch drag with a fast release
  const y0 = await p.evaluate(() => scrollY);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 700 }] });
  for (let i = 1; i <= 6; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 700 - i * 90 }] }); await L.w8(8); }
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const t = []; for (let i = 0; i < 10; i++) { await L.w8(100); t.push(await p.evaluate(() => Math.round(scrollY))); }
  console.log('touch drag from', y0, '->', JSON.stringify(t));
  await b.close(); })();
