const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const base=`@keyframes k{to{opacity:.5}} .a{animation:k 1s infinite} .x{animation-play-state:paused} .h .y{animation-play-state:paused !important}`;
const freeze=`@layer bootfreeze { html:not(.no-boot) body:not(.rv) *, html:not(.no-boot) body:not(.rv) *::before, html:not(.no-boot) body:not(.rv) *::after { animation-play-state: paused !important; } body:not(.rv) #boot, body:not(.rv) #boot * { animation-play-state: running !important; } }`;
const off=`@layer bootfreeze { html:not(.no-boot) body:not(.rv) *, html:not(.no-boot) body:not(.rv) *::before, html:not(.no-boot) body:not(.rv) *::after { animation-play-state: revert-layer !important; } }`;
const html=`<div class=h><div id=plain class=a></div><div id=x class="a x"></div><div id=y class="a y"></div></div><div id=boot><i id=bi class=a></i></div><div id=pse class=a></div><style>#pse::before{content:'';animation:k 1s infinite} #pse::before{} </style>`;
(async()=>{const b=await puppeteer.launch({headless:'new'});
 for(const [n,css] of [['ON (freeze only)',base+freeze],['OFF (freeze+revert-layer)',base+freeze+off],['no boot rules',base]]){
  const p=await b.newPage();await p.setContent('<!doctype html><style>'+css+'</style><body>'+html+'</body>');
  const r=await p.evaluate(()=>{const g=(id,ps)=>getComputedStyle(document.getElementById(id),ps||null).animationPlayState;const o={plain:g('plain'),x:g('x'),y:g('y'),boot_i:g('bi'),pse_before:g('pse','::before')};document.body.classList.add('rv');document.body.offsetTop;o.after=JSON.stringify({plain:g('plain'),x:g('x'),y:g('y'),bi:g('bi')});return o;});
  console.log(n.padEnd(28),JSON.stringify(r));await p.close();}
 await b.close();})();
