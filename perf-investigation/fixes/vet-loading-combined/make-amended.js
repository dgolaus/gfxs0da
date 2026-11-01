// Amended variant: same as loading-combined, but the 3 hardcoded gstatic
// <link rel=preload> (URLs only valid for desktop Chromium on Windows/Linux) are
// replaced by a UA-agnostic inline document.fonts.load() right after the Google
// Fonts stylesheet, so the browser fetches exactly the files Google served it.
const fs = require('fs'), path = require('path');
const SRC = 'fixes/loading/index.combined.html';
const OUT = __dirname;
let h = fs.readFileSync(SRC, 'utf8');
if (!h.includes('\r\n')) throw new Error('expected CRLF');
const start = h.indexOf('  <!-- Pré-carrega os 3 arquivos');
const lastPre = h.indexOf('<link rel="preload" href="https://fonts.gstatic.com/s/jetbrainsmono');
const end = h.indexOf('\r\n', lastPre) + 2;
if (start < 0 || lastPre < 0) throw new Error('preload block not found');
h = h.slice(0, start) + h.slice(end);
const GF = '&display=swap" rel="stylesheet" />\r\n';
const i = h.indexOf(GF); if (i < 0 || h.indexOf(GF, i + 1) >= 0) throw new Error('GF anchor');
const L = (...l) => l.join('\r\n') + '\r\n';
const INS = L(
'  <!-- Pede já os arquivos de fonte que o CSS do Google acima escolheu PARA ESTE',
'       navegador (o Google serve URLs diferentes p/ Windows, Mac, iOS, Android,',
'       Firefox — por isso nada de URL fixa em <link rel=preload>). Este script',
'       roda quando aquele CSS já carregou (scripts esperam folhas pendentes),',
'       então as @font-face já existem. Sem isto as fontes só são pedidas depois',
'       do primeiro layout e chegam no meio da intro (relayout da página toda). -->',
'  <script>try{var F=document.fonts;if(F&&F.load)[\'400 1em "Inter Tight"\',\'500 1em "Inter Tight"\',\'600 1em "Inter Tight"\',\'700 1em "Inter Tight"\',\'800 1em "Inter Tight"\',\'400 1em Inter\',\'500 1em Inter\',\'600 1em Inter\',\'500 1em "JetBrains Mono"\',\'600 1em "JetBrains Mono"\'].forEach(function(s){F.load(s).catch(function(){})})}catch(e){}</script>');
h = h.slice(0, i + GF.length) + INS + h.slice(i + GF.length);
fs.writeFileSync(path.join(OUT, 'index.amended.html'), h);
console.log('wrote index.amended.html', h.length);
