// Check 2: simulated main-thread stall during the intro, observed through compositor frames (Page.startScreencast).
// Intro animations restarted at t=T0 and playing at rate 1; every other animation paused at 5000. Then the main
// thread is blocked for STALL ms. Frames captured during the stall show what the compositor draws on its own.
const fs = require('fs');
const L = require('/tmp/claude-0/-home-user-gfxs0da/0364eb59-08fc-5b06-a692-a06b7bdc7a68/scratchpad/vet/lib.js');
const OUT = __dirname + '/out/';
const T0 = 300, STALL = 900;
(async () => {
  const b = await L.launch();
  const summary = {};
  for (const [tag, v] of [['A', 'baseline'], ['B', 'baseline'], ['split', 'split'], ['pcomb', 'pcomb']]) {
    const { p, c } = await L.open(b, v);
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    await p.mouse.move(720, 450);
    const frames = [];
    c.on('Page.screencastFrame', async (e) => { frames.push({ t: e.metadata.timestamp, d: e.data }); try { await c.send('Page.screencastFrameAck', { sessionId: e.sessionId }); } catch (x) {} });
    await p.evaluate((T0) => {
      document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
      const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
      for (const a of document.getAnimations()) { try { const intro = /^(hero|nav)/.test(a.animationName || ''); a.pause(); a.currentTime = intro ? T0 : 5000; } catch (e) {} }
    }, T0);
    await L.w8(400);
    await c.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 1440, maxHeight: 900 });
    await L.w8(300);
    const n0 = frames.length;
    // play intro, let ONE main frame commit (two rAFs) so composited animations start, then block the main thread
    await p.evaluate((STALL) => new Promise((res) => {
      for (const a of document.getAnimations()) if (/^(hero|nav)/.test(a.animationName || '')) a.play();
      requestAnimationFrame(() => requestAnimationFrame(() => { window.__stallStart = performance.now(); setTimeout(() => { const e = performance.now() + STALL; while (performance.now() < e) {} window.__stallEnd = performance.now(); }, 0); res(); }));
    }), STALL);
    await L.w8(STALL + 600);
    await c.send('Page.stopScreencast');
    const comp = await p.evaluate(() => document.getAnimations().filter((a) => /^(hero|nav)/.test(a.animationName || '')).length);
    await p.close();
    // keep frames from start of play onward
    const fr = frames.slice(Math.max(0, n0 - 1));
    const dir = `${OUT}stall_${tag}`; fs.mkdirSync(dir, { recursive: true });
    fr.forEach((f, i) => fs.writeFileSync(`${dir}/f${String(i).padStart(3, '0')}.png`, Buffer.from(f.d, 'base64')));
    summary[tag] = { n: fr.length, ts: fr.map((f) => +((f.t - fr[0].t) * 1000).toFixed(0)), dir, comp };
  }
  await b.close();
  // consecutive-frame motion inside each run, and stall-window frames vs baseline A at the same index-by-time
  for (const [tag, s] of Object.entries(summary)) {
    const mv = [];
    for (let i = 1; i < s.n; i++) { const d = await L.diff(`${s.dir}/f${String(i - 1).padStart(3, '0')}.png`, `${s.dir}/f${String(i).padStart(3, '0')}.png`); mv.push(`${s.ts[i]}:${d.mad}`); }
    console.log(`${tag}: ${s.n} frames, intro anims ${s.comp}\n  motion (ms-since-play:mad vs previous frame) ${mv.join(' ')}`);
  }
  fs.writeFileSync(`${OUT}stall_summary.json`, JSON.stringify(summary, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
