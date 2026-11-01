const fs=require('fs'),path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const {openPage}=require('./page.js');
const variants=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const reps=+(process.argv[3]||3);
const PRE=`(()=>{window.__d=[];const L=(s)=>window.__d.push(Math.round(performance.now())+' '+s);
const O=window.IntersectionObserver;window.IntersectionObserver=function(cb,opt){const o=new O((en,ob)=>{const f=en.filter(e=>e.target.id==='testimonials'||(e.target.classList&&e.target.classList.contains('hero')));if(f.length)L('IO['+en.length+'] '+f.map(e=>(e.target.id||'hero')+':'+(e.isIntersecting?1:0)+'@top'+Math.round(e.boundingClientRect.top)).join(',')+' y='+Math.round(scrollY));return cb(en,ob)},opt);const ob=o.observe.bind(o);o.observe=(t)=>{if(t.id==='testimonials'||(t.classList&&t.classList.contains('hero')))L('observe '+(t.id||'hero')+' y='+Math.round(scrollY));return ob(t)};return o};window.IntersectionObserver.prototype=O.prototype;
let ly=-1;const poll=()=>{if(scrollY!==ly){ly=scrollY;L('scrollY='+Math.round(scrollY))}requestAnimationFrame(poll)};requestAnimationFrame(poll);
document.addEventListener('DOMContentLoaded',()=>L('DCL'));addEventListener('load',()=>L('load'));
new MutationObserver(()=>L('te.class='+document.getElementById('testimonials').className)).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
})();`;
(async()=>{const b=await puppeteer.launch({headless:'new'});
for(let r=0;r<reps;r++)for(const v of variants){const {p}=await openPage(b,v,{extra:PRE});
await p.goto('http://localhost:5173/#testimonials',{waitUntil:'load'});await new Promise(x=>setTimeout(x,3000));
const d=await p.evaluate(()=>{const te=document.getElementById('testimonials');return {log:window.__d.filter(s=>!/te.class=/.test(s)||true),final:te.className,teTop:Math.round(te.getBoundingClientRect().top)}});
// dedupe consecutive class lines
let last='';const lines=d.log.filter(s=>{const k=s.replace(/^\d+ /,'');if(k.startsWith('te.class')&&k===last)return false;if(k.startsWith('te.class'))last=k;return true});
console.log('=== '+v.name+' final='+d.final+' teTop='+d.teTop);console.log(lines.join('\n'));await p.close();}
await b.close();})();
