// Whole-page computed-style dump (every element + ::before/::after/::marker? no: ::before/::after),
// all properties incl. custom props, in several states. One browser per run, closed after.
// usage: node comp.js <variant> <label> <page> <WxH> [mobile]
// writes comp_<label>.json : { state: { key: "prop=val\n..." } }
const fs = require('fs'); const path = require('path');
const L = require('./lib');
const [vname, label, pg, vp, flags = ''] = process.argv.slice(2);
const F = new Set(flags.split(',').filter(Boolean)); const mob = F.has('mobile') ? 'mobile' : '';
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
  const { p, c } = await L.open(b, vname, { w: W, h: H, mobile: mob === 'mobile', reduced: F.has('reduced'), dpr: F.has('dpr2') ? 2 : 1 });
  if (F.has('print')) await p.emulateMediaType('print');
  const feats = []; if (F.has('forced')) feats.push({ name: 'forced-colors', value: 'active' }); if (F.has('light')) feats.push({ name: 'prefers-color-scheme', value: 'light' });
  if (feats.length) await c.send('Emulation.setEmulatedMedia', { features: feats });
  await p.goto(L.BASE + pg, { waitUntil: 'load' });
  await L.settle(p, 2500);
  // reveal everything so state does not depend on scroll observers timing
  const out = {};
  await pin(p, 5000, 0);
  out.rest = await p.evaluate(DUMP);
  await c.send('DOM.enable'); await c.send('CSS.enable');
  const { root } = await c.send('DOM.getDocument', { depth: -1 });
  const pf = async (sel) => { const { nodeId } = await c.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel }); if (!nodeId) return '-'; const r = await c.send('CSS.getPlatformFontsForNode', { nodeId }); return r.fonts.map((f) => `${f.familyName}${f.isCustomFont ? '(web)' : '(LOCAL)'}x${f.glyphCount}`).join('+'); };
  const m = await p.evaluate(() => ({ nav: getComputedStyle(document.querySelector('.nav-links')).width, a0: document.querySelector('.nav-links a').getBoundingClientRect().width, cta: document.querySelector('.hero .btn-ghost').getBoundingClientRect().width,
    dpr: devicePixelRatio, zoom: visualViewport.scale, iw: innerWidth, ff: getComputedStyle(document.querySelector('.nav-links a')).fontFamily + '|' + getComputedStyle(document.querySelector('.nav-links a')).fontSize }));
  m.navF = await pf('.nav-links a'); m.btnF = await pf('.hero .btn-ghost');
  await b.close();
  fs.appendFileSync(path.join(__dirname, 'compmode.jsonl'), JSON.stringify({ label, vname, vp, t: new Date().toISOString(), ...m }) + '\n');
  console.log(label, vname, JSON.stringify(m));
})().catch((e) => { console.error(e); process.exit(1); });
