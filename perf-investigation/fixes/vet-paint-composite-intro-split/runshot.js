// Check 1: animations left RUNNING at playbackRate 1e-7 (so composited Move halves really run on the compositor).
// baseline A, baseline B (noise), split, pcomb at intro times T. 1440x900.
const L = require('/tmp/claude-0/-home-user-gfxs0da/0364eb59-08fc-5b06-a692-a06b7bdc7a68/scratchpad/vet/lib.js');
const OUT = __dirname + '/out/';
const TS = [450, 700, 1000];
(async () => {
  const b = await L.launch();
  const res = {};
  for (const [tag, v] of [['A', 'baseline'], ['B', 'baseline'], ['split', 'split'], ['pcomb', 'pcomb']]) {
    const { p } = await L.open(b, v);
    await p.goto(L.BASE + '/', { waitUntil: 'load' });
    await L.settle(p, 2500);
    await p.mouse.move(720, 450);
    for (const T of TS) {
      await p.evaluate((T) => {
        document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; });
        const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px';
        for (const a of document.getAnimations()) { try { const intro = /^(hero|nav)/.test(a.animationName || ''); a.pause(); a.currentTime = intro ? T : 5000; if (intro) { a.playbackRate = 1e-7; a.play(); } } catch (e) {} }
      }, T);
      await L.w8(700);
      const f = `${OUT}run_${tag}_${T}.png`;
      await p.screenshot({ path: f, clip: { x: 0, y: 0, width: 1440, height: 900 } });
      const st = await p.evaluate(() => document.getAnimations().filter((a) => /^(hero|nav)/.test(a.animationName || '')).map((a) => a.animationName + ':' + a.playState).slice(0, 40).join(' '));
      (res[tag] = res[tag] || {})[T] = { f, st };
    }
    await p.close();
  }
  await b.close();
  for (const T of TS) {
    const aa = await L.diff(res.A[T].f, res.B[T].f);
    const s = await L.diff(res.A[T].f, res.split[T].f, `${OUT}heat_run_split_${T}.png`);
    const sb = await L.diff(res.B[T].f, res.split[T].f);
    const c = await L.diff(res.A[T].f, res.pcomb[T].f, `${OUT}heat_run_pcomb_${T}.png`);
    console.log(`T=${T} A/A ${JSON.stringify(aa)}\n  split~A ${JSON.stringify(s)} split~B ${JSON.stringify(sb)}\n  pcomb~A ${JSON.stringify(c)}`);
  }
  console.log('states split@450:', res.split[450].st);
})().catch((e) => { console.error(e); process.exit(1); });
