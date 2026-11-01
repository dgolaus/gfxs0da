const fs=require('fs');
const rd=(f)=>fs.readFileSync(f,'utf8');
const fix=(s,NL)=>s.replace(/\r?\n/g,NL);
// ---------- boot.css ----------
let css=rd('boot.ORIGINAL.css');const NL=css.includes('\r\n')?'\r\n':'\n';
const a=css.indexOf('/* ----- Freeze the page behind the splash');
const b=css.indexOf('/* ====================================================================='+NL+'   BOOT SWITCH');
if(a<0||b<0)throw 'markers';
const freezeNew=fix(`/* ----- Freeze the page behind the splash (first view of a session only) -----
   Pause EVERY animation except the splash itself, so the site sits at its
   first frame and only comes alive the moment the splash starts leaving.
   Gated on html.boot-freeze, which the inline head snippet (placed right
   after this stylesheet) sets before paint ONLY when the splash is on
   (same test boot.js uses: #boot not display:none, i.e. no SWITCH below)
   and this is the first view of the session; boot.js removes it in the
   same instant it adds body.ready. With the splash off the class never
   exists, so these selectors are rejected instantly (bloom filter) and
   adding body.ready no longer restyles the whole page (~1000 elements).
   The #boot rules out-specify the universal pause so the splash keeps
   animating. */
html.boot-freeze:not(.no-boot) body *,
html.boot-freeze:not(.no-boot) body *::before,
html.boot-freeze:not(.no-boot) body *::after {
  animation-play-state: paused !important;
}
html.boot-freeze:not(.no-boot) #boot,
html.boot-freeze:not(.no-boot) #boot::before,
html.boot-freeze:not(.no-boot) #boot::after,
html.boot-freeze:not(.no-boot) #boot *,
html.boot-freeze:not(.no-boot) #boot *::before,
html.boot-freeze:not(.no-boot) #boot *::after {
  animation-play-state: running !important;
}

`,NL);
css=css.slice(0,a)+freezeNew+css.slice(b);
const oldSwitch=fix(`/* SWITCH-START */
#boot { display: none !important; }
/* the page-freeze above must not run while the splash is off */
html:not(.no-boot) body:not(.ready) *,
html:not(.no-boot) body:not(.ready) *::before,
html:not(.no-boot) body:not(.ready) *::after {
  animation-play-state: running !important;
}
/* SWITCH-END */`,NL);
if(!css.includes(oldSwitch))throw 'switch';
css=css.replace(oldSwitch,fix(`/* SWITCH-START */
#boot { display: none !important; }
/* SWITCH-END */`,NL));
fs.writeFileSync('boot.freezegate.css',css);
// ---------- boot.js ----------
let js=rd('boot.ORIGINAL.js');const NLj=js.includes('\r\n')?'\r\n':'\n';
const o1=fix(`  if (!bootEl || getComputedStyle(bootEl).display === 'none') {
    document.body.classList.add('ready');
    return;
  }`,NLj);
if(!js.includes(o1))throw 'js1';
js=js.replace(o1,fix(`  if (!bootEl || getComputedStyle(bootEl).display === 'none') {
    document.documentElement.classList.remove('boot-freeze'); // never armed when off; just in case
    document.body.classList.add('ready');
    return;
  }`,NLj));
const o2=fix(`  function reveal() {
    document.body.classList.add('ready');`,NLj);
if(!js.includes(o2))throw 'js2';
js=js.replace(o2,fix(`  function reveal() {
    // unfreeze the page (boot.css) in the same instant the splash starts leaving
    document.documentElement.classList.remove('boot-freeze');
    document.body.classList.add('ready');`,NLj));
fs.writeFileSync('boot.freezegate.js',js);
// ---------- head snippet in the 3 pages ----------
const snippetNew="<script>(function(){var d=document.documentElement,s=null;try{s=sessionStorage.getItem('s0da-booted')}catch(e){}if(s){d.classList.add('no-boot');return}try{var t=document.createElement('div');t.id='boot';d.appendChild(t);var off=getComputedStyle(t).display==='none';d.removeChild(t);if(!off)d.classList.add('boot-freeze')}catch(e){}})()</script>";
for(const [src,dst,pre] of [['index.ORIGINAL.html','index.freezegate.html',''],['tos.ORIGINAL.html','tos.freezegate.html','/'],['slots.ORIGINAL.html','slots.freezegate.html','/']]){
  let h=rd(src);const N=h.includes('\r\n')?'\r\n':'\n';
  const oldS=`  <script>try{if(sessionStorage.getItem('s0da-booted'))document.documentElement.classList.add('no-boot')}catch(e){}</script>${N}  <link rel="stylesheet" href="${pre}boot.css" />`;
  if(!h.includes(oldS))throw 'html '+src;
  h=h.replace(oldS,`  <link rel="stylesheet" href="${pre}boot.css" />${N}  <!-- after boot.css: arms the page-freeze (html.boot-freeze) only when the splash is on; see boot.css -->${N}  `+snippetNew);
  fs.writeFileSync(dst,h);
}
console.log('ok');
