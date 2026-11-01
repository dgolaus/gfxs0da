// Builds amended variants from the pristine repo index.html (CRLF preserved).
const fs=require('fs'),path=require('path');
const REPO='..';
const html=fs.readFileSync(path.join(REPO,'index.html'),'utf8');
if(!html.includes('\r\n')) throw new Error('expected CRLF');
const LINK='  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />\r\n';
if(html.split(LINK).length!==2) throw new Error('anchor');
// A) UA-agnostic: start the 3 latin-subset downloads as soon as the Google CSS is parsed
//    (no hard-coded gstatic URLs -> right file for every browser, no version drift, no render-blocking preload).
const A=[
'  <!-- Assim que o CSS do Google Fonts chega, já pede as 3 fontes (o mesmo',
'       arquivo que o navegador pediria sozinho, para qualquer navegador/SO),',
'       em vez de esperar o primeiro layout. Elas chegam enquanto a página',
'       ainda é pequena e não forçam um relayout da página inteira no meio da',
'       intro. Não muda nada visual: display=swap continua igual. -->',
'  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" onload="try{var f=document.fonts;f.load(\'700 1em &quot;Inter Tight&quot;\');f.load(\'400 1em Inter\');f.load(\'500 1em &quot;JetBrains Mono&quot;\')}catch(e){}" />',''].join('\r\n');
fs.writeFileSync(path.join(__dirname,'index.fontsload.html'),html.replace(LINK,A));
// B) UA-gated preload: same 3 URLs as the proposal, injected only where Google serves exactly these files
//    (Chromium on Windows / Linux / ChromeOS desktop; not Opera, not Android/iOS/Mac).
const PRE_ANCHOR='  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\r\n';
const B=[
'  <!-- Pré-carrega as 3 fontes (subset latin) para chegarem antes do layout',
'       grande e não forçarem um relayout da página inteira no meio da intro.',
'       O Google Fonts manda ARQUIVOS DIFERENTES por navegador/SO: estas URLs',
'       só valem para Chrome/Edge/Brave no Windows, Linux e ChromeOS. Em Mac,',
'       iPhone, Android, Firefox e Opera o script não faz nada (senão baixaria',
'       3 fontes à toa). Atualizar as URLs se o Google trocar v9/v20/v24. -->',
'  <script>',
'    (function () {',
'      try {',
'        var ua = navigator.userAgent;',
'        var desk = ua.indexOf("Windows NT") > -1 || ua.indexOf("X11; CrOS") > -1 || ua.indexOf("X11; Linux x86_64") > -1;',
'        if (!desk || ua.indexOf("Chrome/") < 0 || /OPR|Android|Mobile|YaBrowser|Vivaldi/.test(ua)) return;',
'        ["intertight/v9/NGSwv5HMAFg6IuGlBNMjxLsH8ag", "inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7",',
'         "jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg"].forEach(function (p) {',
'          var l = document.createElement("link");',
'          l.rel = "preload"; l.as = "font"; l.type = "font/woff2"; l.crossOrigin = "anonymous";',
'          l.href = "https://fonts.gstatic.com/s/" + p + ".woff2";',
'          document.head.appendChild(l);',
'        });',
'      } catch (e) {}',
'    })();',
'  </script>',''].join('\r\n');
if(html.split(PRE_ANCHOR).length!==2) throw new Error('anchor2');
fs.writeFileSync(path.join(__dirname,'index.uagated.html'),html.replace(PRE_ANCHOR,PRE_ANCHOR+B));
console.log('ok');
