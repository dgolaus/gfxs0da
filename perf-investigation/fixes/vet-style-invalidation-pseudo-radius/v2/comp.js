// Whole-page computed-style dump (every element + ::before/::after/::marker? no: ::before/::after),
// all properties incl. custom props, in several states. One browser per run, closed after.
// usage: node comp.js <variant> <label> <page> <WxH> [mobile]
// writes comp_<label>.json : { state: { key: "prop=val\n..." } }
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [vname, label, pg, vp, mob] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const OUT = path.join(__dirname, 'comp'); fs.mkdirSync(OUT, { recursive: true });

const DUMP = () => {
  const keyOf = (el) => { const parts = []; let e = el; while (e && e.nodeType === 1) { const par = e.parentElement; parts.unshift(e.tagName + (par ? ':' + [...par.children].indexOf(e) : '')); e = par; } return parts.join('/'); };
  const T = window.__T || (window.__T = { pv: new Map(), pvl: [], el: new Map(), ell: [] });
  const ip = (s) => { let i = T.pv.get(s); if (i === undefined) { i = T.pvl.length; T.pvl.push(s); T.pv.set(s, i); } return i; };
  const ie = (s) => { let i = T.el.get(s); if (i === undefined) { i = T.ell.length; T.ell.push(s); T.el.set(s, i); } return i; };
  const ser = (cs) => { const o = []; for (let k = 0; k < cs.length; k++) { const n = cs[k]; o.push(ip(n + '=' + cs.getPropertyValue(n))); } return ie(o.join(',')); };
  const r = {};
  for (const el of document.querySelectorAll('*')) {
    const k = keyOf(el) + (el.className && typeof el.className === 'string' ? '[' + el.className.replace(/\b(is-in|in-view|is-visible|is-done|is-lit|is-paused|is-active|show|on)\b/g, '').trim().replace(/\s+/g, ' ') + ']' : '');
    r[k] = ser(getComputedStyle(el));
    for (const ps of ['::before', '::after']) {
      const cs = getComputedStyle(el, ps);
      if (cs.content !== 'none' && cs.content !== 'normal') r[k + ps] = ser(cs);
      else r[k + ps] = ie([ip('content=' + cs.content), ip('border-top-left-radius=' + cs.borderTopLeftRadius), ip('border-bottom-right-radius=' + cs.borderBottomRightRadius)].join(','));
    }
  }
  return r;
};

async function pin(p, T, sheenT) {
  await p.evaluate((T, sheenT) => {
    document.querySelectorAll('.counter').forEach((el) => {
      const v = parseFloat(el.dataset.value), d = parseInt(el.dataset.decimals || '0', 10);
      el.textContent = `${el.dataset.prefix || ''}${v.toFixed(d)}${el.dataset.suffix || ''}`;
    });
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = (a.animationName === 'btnSheen' || a.animationName === 'focusPop') ? sheenT : T; } catch (e) {} }
  }, T, sheenT);
  await L.w8(120);
}

(async () => {
  const b = await L.launch();
  const { p, c } = await L.open(b, vname, { w: W, h: H, mobile: mob === 'mobile' });
  await p.goto(L.BASE + pg, { waitUntil: 'load' });
  await L.settle(p, 2500);
  // reveal everything so state does not depend on scroll observers timing
  const out = {};
  await pin(p, 5000, 0);
  out.rest = await p.evaluate(DUMP);
  for (const T of [0, 1700, 3300]) { await pin(p, T, 0); out['float' + T] = await p.evaluate(DUMP); }
  await c.send('DOM.enable'); await c.send('CSS.enable');
  const { root } = await c.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await c.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '.btn, .quote, .price-card' });
  const states = [['hover'], ['focus', 'focus-visible'], ['hover', 'focus', 'focus-visible'], ['active', 'hover']];
  for (const st of states) {
    for (const id of nodeIds) await c.send('CSS.forcePseudoState', { nodeId: id, forcedPseudoClasses: st });
    await L.w8(200);
    const sheenTs = st.includes('hover') ? [0, 160, 450, 800] : [0];
    for (const t of sheenTs) { await pin(p, 5000, t); out[st.join('+') + '@' + t] = await p.evaluate(DUMP); }
    for (const id of nodeIds) await c.send('CSS.forcePseudoState', { nodeId: id, forcedPseudoClasses: [] });
    await L.w8(200);
  }
  // real keyboard focus: Tab through the page, dump the focused .btn's ::after each time
  await pin(p, 5000, 0);
  await L.unfreeze(p);
  const tabs = [];
  for (let i = 0; i < 60; i++) {
    await p.keyboard.press('Tab');
    await L.w8(60);
    const r = await p.evaluate(() => {
      const el = document.activeElement; if (!el || !el.matches('.btn, .quote, .price-card')) return null;
      const h = getComputedStyle(el), a = getComputedStyle(el, '::after');
      return { cls: el.className, fv: el.matches(':focus-visible'), hostR: h.borderTopLeftRadius, afterR: a.borderTopLeftRadius, content: a.content };
    });
    if (r) tabs.push(r);
  }
  out.__tabs = tabs;
  out.__tbl = await p.evaluate(() => ({ pv: window.__T.pvl, el: window.__T.ell }));
  out.__errs = (p.__errs || []).concat(await p.evaluate(() => window.__errs));
  await b.close();
  fs.writeFileSync(path.join(OUT, `comp_${label}.json`), JSON.stringify(out));
  console.log(label, Object.keys(out).length, 'states', Object.keys(out.rest).length, 'keys', 'tabs', JSON.stringify(tabs));
})().catch((e) => { console.error(e); process.exit(1); });
