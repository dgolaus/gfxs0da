// Builds the modified copies (CRLF preserved) from the pristine repo files.
const fs=require('fs'),path=require('path');
const REPO='..';
const OUT=__dirname;
const rd=f=>fs.readFileSync(path.join(REPO,f),'utf8');
const rep=(s,a,b,label)=>{const i=s.indexOf(a);if(i<0||s.indexOf(a,i+1)>=0)throw new Error('anchor not unique/missing: '+label);return s.replace(a,b);};
const L=(...lines)=>lines.join('\r\n')+'\r\n';

const html=rd('index.html'), boot=rd('boot.js'), script=rd('script.js');
if(!html.includes('\r\n')) throw new Error('expected CRLF');

// ---- 1. font preload -------------------------------------------------
const PRE_ANCHOR='  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\r\n';
const PRELOADS=L(
'  <!-- Pré-carrega os 3 arquivos que o CSS do Google Fonts acima vai pedir',
'       (subset latin, fontes variáveis). Sem isto eles só são pedidos depois',
'       do primeiro layout e chegam no meio da intro, forçando um relayout da',
'       página inteira a cada fonte (FOUT). Se o Google trocar a versão (v20,',
'       v9, v24), o pior caso é baixar 3 arquivos à toa — nada quebra.',
'       Atualizar as URLs junto se mudar o link do Google Fonts. -->',
'  <link rel="preload" href="https://fonts.gstatic.com/s/intertight/v9/NGSwv5HMAFg6IuGlBNMjxLsH8ag.woff2" as="font" type="font/woff2" crossorigin />',
'  <link rel="preload" href="https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2" as="font" type="font/woff2" crossorigin />',
'  <link rel="preload" href="https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2" as="font" type="font/woff2" crossorigin />');
const fontPreload=h=>rep(h,PRE_ANCHOR,PRE_ANCHOR+PRELOADS,'preconnect gstatic');

// ---- 2. early body.ready --------------------------------------------
const BOOT_ANCHOR=L(
'  <div id="boot" aria-hidden="true">',
'    <div class="boot-inner">',
'      <img class="boot-logo" src="assets/favicon-192.png" alt="" />',
'    </div>',
'  </div>');
const EARLY=L(
'  <!-- Splash desligado (SWITCH no boot.css): põe body.ready JÁ AGORA, com o',
'       body quase vazio. O boot.js (defer) faz o mesmo no fim do parse, mas',
'       ali a troca de classe invalida o estilo da página inteira (regras',
'       body:not(.ready) * do boot.css) = ~80ms de recalc no meio da intro.',
'       Visualmente nada muda: com o splash desligado as duas regras dão',
'       animation-play-state: running. A contagem da hero continua esperando',
'       o boot.js (ver 5a no script.js), então o tempo dela não muda.',
'       Com o splash ligado (display != none) isto não faz nada. -->',
'  <script>(function(){try{var b=document.getElementById(\'boot\');if(!b||getComputedStyle(b).display===\'none\')document.body.classList.add(\'ready\')}catch(e){}})();</script>');
const earlyReady=h=>rep(h,BOOT_ANCHOR,BOOT_ANCHOR+EARLY,'#boot block');

// boot.js: set a JS flag wherever it marks the page ready
let boot2=boot;
boot2=rep(boot2,
"  if (!bootEl || getComputedStyle(bootEl).display === 'none') {\r\n    document.body.classList.add('ready');\r\n",
"  if (!bootEl || getComputedStyle(bootEl).display === 'none') {\r\n    markReady();\r\n",'boot off');
boot2=rep(boot2,
"    // Splash already shown this session → run the page normally, no splash.\r\n    document.body.classList.add('ready');\r\n",
"    // Splash already shown this session → run the page normally, no splash.\r\n    markReady();\r\n",'boot seen');
boot2=rep(boot2,
"  function reveal() {\r\n    document.body.classList.add('ready');\r\n",
"  function reveal() {\r\n    markReady();\r\n",'boot reveal');
boot2=rep(boot2,
"(function () {\r\n",
L("(function () {",
"  // \"Página liberada\". Além da classe body.ready (usada pelo CSS do splash),",
"  // marca window.s0daReady: o snippet inline do index.html pode pôr a classe",
"  // cedo, então o script.js não pode usar a presença dela como sinal. Re-adicionar",
"  // a classe já presente não custa estilo, mas ainda gera o MutationRecord",
"  // que o script.js (5a) escuta — o momento da contagem da hero fica igual.",
"  function markReady() {",
"    document.body.classList.add('ready');",
"    window.s0daReady = true;",
"  }"),'boot iife');

// script.js 5a: wait for boot.js, not for the class being present
const S5A_OLD=L(
"  const run = () => setTimeout(go, 180);",
"  if (document.body.classList.contains('ready')) { run(); return; }");
const S5A_NEW=L(
"  const run = () => setTimeout(go, 180);",
"  // Sinal = o boot.js rodar (window.s0daReady / mutação da classe), não a",
"  // classe já estar no body: o index.html pode pô-la cedo só para baratear",
"  // o estilo, e a contagem tem que manter o tempo de antes.",
"  if (window.s0daReady) { run(); return; }");
const script2=rep(script,S5A_OLD,S5A_NEW,'5a');

// ---- 3. visits.json single fetch -------------------------------------
const V1="  fetch('assets/visits.json', { cache: 'no-cache' })\r\n    .then((r) => (r.ok ? r.json() : null))\r\n    .then((data) => {\r\n      if (!data || !data.games) return;";
const V2="  fetch('assets/visits.json', { cache: 'no-cache' })\r\n    .then((r) => (r.ok ? r.json() : null))\r\n    .then((data) => {\r\n      if (!data || typeof data.influenced !== 'number') return;";
let script3=script2;
script3=rep(script3,V1,
"  // Um único pedido do visits.json, compartilhado pelos dois usos abaixo\r\n  // (antes eram 2 fetch idênticos com no-cache = 2 revalidações + 2 parses).\r\n  const visitsData = fetch('assets/visits.json', { cache: 'no-cache' })\r\n    .then((r) => (r.ok ? r.json() : null))\r\n    .catch(() => null);\r\n\r\n  visitsData\r\n    .then((data) => {\r\n      if (!data || !data.games) return;",'visits1');
script3=rep(script3,V2,"  visitsData\r\n    .then((data) => {\r\n      if (!data || typeof data.influenced !== 'number') return;",'visits2');

const W=(f,s)=>{fs.writeFileSync(path.join(OUT,f),s);console.log('wrote',f,s.length);};
W('index.fontpreload.html',fontPreload(html));
W('index.earlyready.html',earlyReady(html));
W('index.combined.html',earlyReady(fontPreload(html)));
W('boot.js',boot2);
W('script.earlyready.js',script2);
W('script.combined.js',script3);
