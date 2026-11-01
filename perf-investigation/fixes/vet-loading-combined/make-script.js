// script.amended.js = loading/script.combined.js + IO callbacks read the LAST entry
// (a batched [stale, current] delivery otherwise leaves the stale state applied).
const fs=require('fs'),path=require('path');
const SRC='fixes/loading/script.combined.js';
let s=fs.readFileSync(SRC,'utf8'); if(!s.includes('\r\n')) throw new Error('CRLF');
const rep=(a,b,l)=>{const i=s.indexOf(a);if(i<0||s.indexOf(a,i+1)>=0)throw new Error('anchor '+l);s=s.replace(a,b);};
rep("new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.15 }).observe(section);",
    "// Último registro: o 1º aviso (y=0) e o pós-âncora (/#process) podem chegar juntos.\r\n    new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; }, { threshold: 0.15 }).observe(section);",'process');
rep("    ([entry]) => heroBg.classList.toggle('is-paused', !entry.isIntersecting),",
    "    // último registro do lote: chegando por /#secao o 1º pode ser o de y=0\r\n    (es) => heroBg.classList.toggle('is-paused', !es[es.length - 1].isIntersecting),",'herobg');
rep("    ([e]) => m.classList.toggle('is-paused', !e.isIntersecting),",
    "    // último registro do lote: chegando por /#testimonials o 1º é o de y=0\r\n    (es) => m.classList.toggle('is-paused', !es[es.length - 1].isIntersecting),",'tcols');
fs.writeFileSync(path.join(__dirname,'script.amended.js'),s);console.log('ok',s.length);
