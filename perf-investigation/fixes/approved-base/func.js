// node func.js <mode> <reps> [variants...]   modes: anchors | scroll | scrollm | reduced | tcols | discord | stats | tos
// Interleaved baseline/variant loads, one browser at a time (fresh browser per load).
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [mode, repsS, ...vs] = process.argv.slice(2);
const vars = vs.length ? vs : ['baseline', 'base'];
const reps = +repsS || 2;
const OUT = path.join(__dirname, 'out', 'func'); fs.mkdirSync(OUT, { recursive: true });

const STATE = () => {
  const n = (el, k) => el ? parseFloat(getComputedStyle(el).getPropertyValue(k)) : null;
  const navL = document.querySelector('.nav-links'), nav = document.getElementById('nav');
  const foot = document.querySelector('.cfooter'), fc = document.querySelector('.cfooter-center');
  const secs = [...document.querySelectorAll('.scroll-fade')];
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return {
    sy: Math.round(scrollY * 10) / 10, fc: window.__fc, sc: window.__sc,
    navExp: (() => { const c = (v) => Math.max(0, Math.min(1, v)); const t = c(scrollY / 360); return +(t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2).toFixed(3); })(),
    docH: document.documentElement.scrollHeight,
    nav: navL ? { p: n(navL, '--nav-pill'), bar: n(navL, '--nav-bar-vis'), pill: n(navL, '--nav-pill-vis'),
      pad: getComputedStyle(nav).padding, navOp: getComputedStyle(navL).opacity, pillCls: nav.classList.contains('is-pill'),
      before: getComputedStyle(nav, '::before').opacity + '|' + getComputedStyle(navL, '::before').opacity } : null,
    leave: secs.map((s) => ({ id: s.id, v: n(s, '--leave'), op: getComputedStyle(s).opacity, fi: getComputedStyle(s).filter, tf: getComputedStyle(s).transform })),
    fp: foot ? { v: n(foot, '--fp'), inline: foot.style.getPropertyValue('--fp'), op: fc ? getComputedStyle(fc).opacity : null } : null,
  };
};

async function withPage(v, o, fn) {
  const b = await L.launch();
  try {
    const { p } = await L.open(b, v, { ...o, throttle: +process.env.THROTTLE || 0, pre: process.env.FC ? 'window.__fc=0;window.__sc=0;addEventListener("scroll",()=>window.__sc++,{passive:true,capture:true});(function f(){window.__fc++;requestAnimationFrame(f);})();' : undefined });
    const r = await fn(p);
    r.errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs).catch(() => ['<no __errs>']));
    return r;
  } finally { await b.close(); }
}

const modes = {
  // anchor landing on load, desktop and mobile
  async anchors() {
    const res = [];
    for (const vp of [{ w: 1440, h: 900 }, { w: 390, h: 844, mobile: true }].filter((q) => !process.env.VPW || String(q.w) === process.env.VPW))
      for (const hash of (process.env.HASHES ? process.env.HASHES.split(',') : ['#about', '#process', '#trust', '#testimonials', '#pricing', '#contact']))
        for (let r = 0; r < reps; r++) for (const v of vars) {
          const x = await withPage(v, vp, async (p) => {
            await p.goto(L.BASE + '/' + hash, { waitUntil: 'load' });
            await L.w8(3000);
            const s = await p.evaluate(STATE);
            s.chatH = await p.evaluate(() => { const m = document.getElementById('chat-messages'); return m ? m.children.length + 'msg/' + Math.round(document.querySelector('.process').getBoundingClientRect().height) : null; });
            s.tgtTop = await p.evaluate((h) => { const t = document.getElementById(h.slice(1)); return t ? Math.round(t.getBoundingClientRect().top * 10) / 10 : 'NO-ELEMENT'; }, hash);
            return s;
          });
          res.push({ vp: vp.w, hash, r, v, ...x });
          console.log(`${vp.w} ${hash.padEnd(14)} r${r} ${v.padEnd(9)} sy=${x.sy} tgtTop=${x.tgtTop} docH=${x.docH} nav=${JSON.stringify(x.nav && [x.nav.p, x.nav.bar, x.nav.pill, x.nav.pillCls])} leave=${x.leave.map((l) => l.v).join(',')} fp=${x.fp && x.fp.v}/${x.fp && x.fp.op} chat=${x.chatH} errs=${x.errs.length}`);
        }
    return res;
  },
  async navstress() {
    const res = [];
    for (const red of [true, false]) for (let r = 0; r < reps; r++) for (const v of vars) {
      const x = await withPage(v, { w: 1440, h: 900, reduced: red }, async (p) => {
        await p.goto(L.BASE + '/', { waitUntil: 'load' });
        await L.settle(p, 1500);
        const ys = []; for (let i = 0; i < 60; i++) ys.push(Math.round(Math.abs(Math.sin(i * 1.7)) * 420));
        let stale = 0, staleList = [];
        for (const y of ys) {
          await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); }, y);
          await L.w8(250);
          const s = await p.evaluate(STATE);
          if (Math.abs(s.nav.p - s.navExp) > 0.0015) { stale++; staleList.push(`${y}:${s.nav.p}/${s.navExp}`); }
        }
        return { stale, staleList };
      });
      res.push({ red, r, v, ...x });
      console.log(`reduced=${red} r${r} ${v.padEnd(9)} stale=${x.stale}/60 ${x.staleList.join(' ')} errs=${x.errs.length}`);
    }
    return res;
  },
  async scroll() { return scrollStates({ w: 1440, h: 900 }); },
  async scrollm() { return scrollStates({ w: 390, h: 844, mobile: true }); },
  async reduced() { return scrollStates({ w: 1440, h: 900, reduced: true }); },
  // testimonial columns filled and moving
  async tcols() {
    const res = [];
    for (const vp of [{ w: 1440, h: 900 }, { w: 390, h: 844, mobile: true }])
      for (let r = 0; r < reps; r++) for (const v of vars) {
        const x = await withPage(v, vp, async (p) => {
          await p.goto(L.BASE + '/' + (process.env.HASH || '#trust'), { waitUntil: 'load' });
          await L.w8(3000);
          const snap = () => p.evaluate(() => {
            const wrap = document.querySelector('.tcols');
            return { wrapH: wrap.getBoundingClientRect().height, paused: wrap.classList.contains('is-paused'),
              cols: [...document.querySelectorAll('.tcols .tcol')].map((c) => { const t = c.querySelector('.tcol-track');
                const a = t.getAnimations()[0];
                return { disp: getComputedStyle(c).display, n: t.children.length, hidden: t.querySelectorAll('[aria-hidden]').length,
                  h: Math.round(t.getBoundingClientRect().height * 10) / 10, tf: getComputedStyle(t).transform, ps: a ? a.playState : 'none', ct: a ? Math.round(a.currentTime) : null,
                  html: (() => { let h = 0; const s = t.innerHTML; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; })() }; }) };
          });
          const a = await snap(); await L.w8(700); const b2 = await snap();
          return { a, moving: a.cols.map((c, i) => c.disp === 'none' ? 'hidden' : (c.tf !== b2.cols[i].tf && c.ps === 'running')) };
        });
        res.push({ vp: vp.w, r, v, ...x });
        console.log(`${vp.w} r${r} ${v.padEnd(9)} wrapH=${x.a.wrapH} paused=${x.a.paused} cols=${x.a.cols.map((c) => `${c.n}/${c.hidden}h ${c.h}px ${c.ps} hash${c.html}`).join(' ; ')} moving=${x.moving} errs=${x.errs.length}`);
      }
    return res;
  },
  // Discord ticket loop on /#process: messages appear
  async discord() {
    const res = [];
    for (let r = 0; r < reps; r++) for (const v of vars) {
      const x = await withPage(v, { w: 1440, h: 900 }, async (p) => {
        await p.goto(L.BASE + '/#process', { waitUntil: 'load' });
        const c = [];
        for (const t of [2500, 3000, 3000]) { await L.w8(t); c.push(await p.evaluate(() => document.getElementById('chat-messages').children.length)); }
        return { counts: c, sy: await p.evaluate(() => scrollY) };
      });
      res.push({ r, v, ...x });
      console.log(`r${r} ${v.padEnd(9)} sy=${x.sy} msgs@2.5/5.5/8.5s=${x.counts} ${x.counts[2] === 0 ? 'EMPTY!!' : ''} errs=${JSON.stringify(x.errs)}`);
    }
    return res;
  },
  // trust counters/stars: start time after scrolling into view (JS-timed, should not shift)
  async stats() {
    const res = [];
    for (let r = 0; r < reps; r++) for (const v of vars) {
      const x = await withPage(v, { w: 1440, h: 900 }, async (p) => {
        await p.goto(L.BASE + '/', { waitUntil: 'load' });
        await L.settle(p, 2500);
        return p.evaluate(async () => {
          const sec = document.getElementById('trust');
          const cs = [...sec.querySelectorAll('.counter')]; const init = cs.map((c) => c.textContent);
          const t0 = performance.now(); let tc = null, ts = null;
          const mo = new MutationObserver(() => {
            if (tc == null && cs.some((c, i) => c.textContent !== init[i])) tc = performance.now() - t0;
            if (ts == null && sec.querySelector('.star.lit')) ts = performance.now() - t0;
          });
          mo.observe(sec, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
          const y = sec.getBoundingClientRect().top + scrollY - 80;
          if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 4500));
          mo.disconnect();
          return { tc: tc && Math.round(tc), ts: ts && Math.round(ts), final: cs.map((c) => c.textContent).join(' '), lit: sec.querySelectorAll('.star.lit').length, isLit: !!sec.querySelector('.is-lit') };
        });
      });
      res.push({ r, v, ...x });
      console.log(`r${r} ${v.padEnd(9)} counterStart=${x.tc}ms starStart=${x.ts}ms final="${x.final}" lit=${x.lit} isLit=${x.isLit} errs=${x.errs.length}`);
    }
    return res;
  },
  // /tos/: nav vars + scroll spy
  async tos() {
    const res = [];
    for (let r = 0; r < reps; r++) for (const v of vars) {
      const x = await withPage(v, { w: 1440, h: 900 }, async (p) => {
        await p.goto(L.BASE + '/tos/', { waitUntil: 'load' });
        await L.settle(p, 1500);
        const out = [];
        for (const y of [0, 100, 200, 360, 1200, 2400, 99999]) {
          await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); }, y);
          await L.w8(700);
          const s0 = await p.evaluate(STATE);
          const s = { sy: s0.sy, nav: s0.nav, leave: s0.leave.map((l) => l.v), fc: s0.fc, sc: s0.sc };
          s.active = await p.evaluate(() => [...document.querySelectorAll('[aria-current], .is-active, .active')].map((e) => e.textContent.trim().slice(0, 20)).join('|'));
          out.push(s);
        }
        return { out };
      });
      res.push({ r, v, ...x });
      for (const [i, s] of x.out.entries()) console.log(`r${r} ${v.padEnd(9)} frames=${i ? s.fc - x.out[i - 1].fc : '-'} scrollEv=${i ? s.sc - x.out[i - 1].sc : '-'} sy=${s.sy} nav=${s.nav && [s.nav.p, s.nav.bar, s.nav.pill, s.nav.pillCls, s.nav.pad]} leave=${s.leave} active=${s.active}`);
      console.log(`   errs=${JSON.stringify(x.errs)}`);
    }
    return res;
  },
};

async function scrollStates(vp) {
  const res = [];
  for (let r = 0; r < reps; r++) for (const v of vars) {
    const x = await withPage(v, vp, async (p) => {
      await p.goto(L.BASE + '/', { waitUntil: 'load' });
      await L.settle(p, 2500);
      // positions derived from layout (identical docH/section tops in both, checked below)
      const pos = await p.evaluate(() => {
        const vh = innerHeight, maxY = document.documentElement.scrollHeight - vh, out = [0, 30, 90, 150, 200, 250, 300, 360, 500];
        for (const s of document.querySelectorAll('.scroll-fade')) {
          const bot = s.getBoundingClientRect().bottom + scrollY;
          for (const f of [0.1, 0.5, 0.9]) out.push(Math.round(bot - vh * 0.30 * (1 - f)));
        }
        for (const k of [600, 400, 300, 200, 100, 50, 0]) out.push(maxY - k);
        out.push(0);
        return out.filter((y) => y >= 0 && y <= maxY);
      });
      const st = [];
      for (const y of pos) {
        await p.evaluate((y) => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); }, y);
        await L.w8(600);
        st.push({ y, ...(await p.evaluate(STATE)) });
      }
      return { st };
    });
    res.push({ r, v, ...x });
    console.error(`${v} r${r} errs=${JSON.stringify(x.errs)}`);
    for (let i = 1; i < x.st.length; i++) { const s = x.st[i], q = x.st[i - 1]; if (s.nav && Math.abs(s.nav.p - s.navExp) > 0.0015) console.error(`  STALE NAV ${v} r${r} y=${s.y} p=${s.nav.p} expected=${s.navExp} framesDuringWait=${s.fc - q.fc} scrollEvents=${s.sc - q.sc}`); }
  }
  // compare: per position, max |delta| of numeric vars variant vs baseline, and baseline vs baseline (A/A)
  const by = (v, r) => res.find((x) => x.v === v && x.r === r);
  const flat = (s) => ({ sy: s.sy, docH: s.docH, nav: s.nav && [s.nav.p, s.nav.bar, s.nav.pill], navS: s.nav && [s.nav.pad, s.nav.navOp, s.nav.pillCls, s.nav.before].join('|'),
    leave: s.leave.map((l) => l.v), leaveS: s.leave.map((l) => l.op + '|' + l.fi + '|' + l.tf), fp: s.fp && s.fp.v, fpOp: s.fp && s.fp.op });
  const B0 = by(vars[0], 0);
  for (let i = 0; i < B0.st.length; i++) {
    const row = [`y=${B0.st[i].y}`];
    for (const x of res) {
      if (x === B0) continue;
      const a = flat(B0.st[i]), b = flat(x.st[i]);
      const dl = Math.max(0, ...a.leave.map((q, j) => Math.abs(q - b.leave[j])));
      const dn = a.nav ? Math.max(...a.nav.map((q, j) => Math.abs(q - b.nav[j]))) : 0;
      const df = Math.abs((a.fp || 0) - (b.fp || 0));
      const geo = a.sy === b.sy && a.docH === b.docH ? '' : ` GEO ${a.sy}/${b.sy} ${a.docH}/${b.docH}`;
      const s = (a.navS === b.navS ? '' : ' NAVSTR') + (a.leaveS.join() === b.leaveS.join() ? '' : ' LEAVESTR') + (a.fpOp === b.fpOp ? '' : ` FPOP ${a.fpOp}/${b.fpOp}`);
      row.push(`${x.v}_r${x.r}: dLeave=${dl.toFixed(3)} dNav=${dn.toFixed(3)} dFp=${df.toFixed(3)}${geo}${s}`);
    }
    const a = flat(B0.st[i]);
    row.push(`[ref nav=${a.nav} leave=${a.leave} fp=${a.fp}]`);
    console.log(row.join(' | '));
  }
  return res;
}

(async () => {
  const res = await modes[mode]();
  fs.writeFileSync(path.join(OUT, `${mode}${process.env.THROTTLE ? '-t' + process.env.THROTTLE : ''}${process.env.TAG || ''}.json`), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
