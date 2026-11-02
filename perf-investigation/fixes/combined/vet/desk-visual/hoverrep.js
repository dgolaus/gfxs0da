// node hoverrep.js <tag> <WxH> <btnIndexCsv> <ts> <N> <variant...>
// Same procedure as hover.js v3 for selected .btn targets at one sheen time, repeated N times per variant (fresh browser,
// interleaved); shots clustered by exact pixel hash -> are the variant's hover states ones that baseline also produces?
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const sharp = require('/home/user/gfxs0da/node_modules/sharp');
const { L, withPage, out } = require('./dv');
const [tag, vp, idxS, tsS, nS, ...vars] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number); const IDX = idxS.split(',').map(Number); const TS = +tsS; const N = +nS;
const OUT = out(`hoverrep_${tag}`);
(async () => {
  const res = {};
  for (let k = 0; k < N; k++) for (const v of vars) {
    await withPage(v, { w: W, h: H }, async (p) => {
      await p.goto(L.BASE + '/', { waitUntil: 'load' }); await L.settle(p, 2500);
      for (const i of IDX) {
        await p.mouse.move(W - 3, H - 3);
        await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) {} } });
        await p.evaluate((i) => { const e = document.querySelectorAll('.btn')[i]; const r = e.getBoundingClientRect(); const y = Math.max(0, Math.round(scrollY + r.top + r.height / 2 - innerHeight / 2)); if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); }, i);
        await L.w8(1300);
        await p.evaluate(() => { document.querySelectorAll('.counter').forEach((el) => { const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10); el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`; }); for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 5000; } catch (e) {} } });
        await L.w8(150);
        const b = await p.evaluate((i) => { const r = document.querySelectorAll('.btn')[i].getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, i);
        await p.mouse.move(b.x + b.w / 2, b.y + b.h / 2, { steps: 3 });
        // AFTER=1: let the hover play out in real time (sheen 0.9s finishes, transitions end), then freeze everything
        if (!process.env.AFTER) await p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); } catch (e) {} } });
        else await p.evaluate(() => { for (const a of document.getAnimations()) { try { if (a.playState === 'paused') a.play(); } catch (e) {} } });
        await L.w8(process.env.AFTER ? 2500 : 1200);
        await p.evaluate(() => { const bg = document.querySelector('.hero-bg'); if (bg) bg.style.translate = '0px 0px'; });
        await p.evaluate((ts) => { for (const a of document.getAnimations()) { try { a.pause(); const hov = !!a.transitionProperty || a.animationName === 'btnSheen' || a.animationName === 'focusPop'; a.currentTime = hov ? ts : 5000; } catch (e) {} } }, TS);
        await L.w8(200);
        const so = await p.evaluate(() => [scrollX, scrollY]);
        const f = path.join(OUT, `${v}_${k}_btn${i}.png`);
        await p.screenshot({ path: f, clip: { x: Math.max(0, Math.floor(b.x - 48)) + so[0], y: Math.max(0, Math.floor(b.y - 48)) + so[1], width: Math.ceil(b.w + 96), height: Math.ceil(b.h + 96) }, captureBeyondViewport: false });
        const h = crypto.createHash('md5').update(await sharp(f).raw().toBuffer()).digest('hex').slice(0, 8);
        ((res[`btn${i}`] = res[`btn${i}`] || {})[v] = res[`btn${i}`][v] || []).push(h);
        console.log(v, k, `btn${i}`, h);
      }
    });
  }
  const summ = Object.fromEntries(Object.entries(res).map(([b, byV]) => [b, Object.fromEntries(Object.entries(byV).map(([v, hs]) => [v, hs.reduce((m, h) => (m[h] = (m[h] || 0) + 1, m), {})]))]));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ tag, vp, IDX, TS, N, summ, res }, null, 1));
  console.log('SUMMARY', JSON.stringify(summ));
})().catch((e) => { console.error(e); process.exit(1); });
