const fs=require('fs');const f=__dirname+'/index.cssom.html';let s=fs.readFileSync(f,'utf8');
const a=s.indexOf('  <!-- Splash desligado (SWITCH no boot.css)');const b=s.indexOf('-->',a)+3;
if(a<0)throw 'no comment';
const c=[
'  <!-- Splash desligado (SWITCH no boot.css): põe body.ready JÁ AGORA, com o',
'       body quase vazio. O boot.js (defer) faz o mesmo no fim do parse, mas',
'       ali a troca de classe invalida o estilo da página inteira (regras',
'       body:not(.ready) * do boot.css) = ~80ms de recalc no meio da intro.',
'       Visualmente nada muda: com o splash desligado as duas regras dão',
'       animation-play-state: running. A contagem da hero continua esperando',
'       o boot.js (ver 5a no script.js), então o tempo dela não muda.',
'       Detecta o SWITCH lendo a regra "#boot { display: none !important }"',
'       no CSSOM do boot.css, SEM getComputedStyle: forçar estilo aqui faz o',
'       parser ceder um frame e pintar a página pela metade (sem a hero) antes',
'       do resto chegar. Se não achar a regra (splash ligado, SWITCH comentado,',
'       boot.css falhou), não faz nada e o boot.js segue como antes. -->'].join('\r\n');
s=s.slice(0,a)+c+s.slice(b);fs.writeFileSync(f,s);
console.log((s.match(/\r/g)||[]).length,(s.match(/\n/g)||[]).length);
