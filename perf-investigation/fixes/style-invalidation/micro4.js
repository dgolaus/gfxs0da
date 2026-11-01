const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const kids='<div class=a><div class=b><p class=c><span class=d>x</span><a class=e href=#>y</a></p></div></div>'.repeat(300);
const filler=Array.from({length:400},(_,i)=>`.k${i} .z${i}>.q{color:red} .a.k${i}{margin:${i}px}`).join('\n');
const R=(n,inh)=>`@property ${n} { syntax: "<number>"; inherits: ${inh}; initial-value: 0; }`;
const SF=`opacity:calc(1 - var(--leave));filter:blur(calc(var(--leave)*8px));transform:translateY(calc(var(--leave)*-24px));transition:opacity .18s linear,filter .18s linear,transform .18s linear;will-change:opacity,filter,transform`;
const cases={
 unreg:        {css:`.on{--leave:0;${SF}}`, v:'--leave'},
 regNoInherit: {css:`${R('--leave',false)} .on{--leave:0;${SF}}`, v:'--leave'},
 navUnregRoot: {css:`:root{--nav-pill:0}`, v:'--nav-pill', root:true},
 navOnSection: {css:`:root{--nav-pill:0}`, v:'--nav-pill', small:true},
 plainClass:   {css:`.on{opacity:.99}`, v:'--zz'},
 readyUniversal:{css:`body:not(.ready) *{animation-play-state:running!important}`, ready:true},
 readyNone:    {css:``, ready:true},
};
async function step(p,f,fn,arg){await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});await p.evaluate(fn,arg);await p.tracing.stop();
  return JSON.parse(fs.readFileSync(f,'utf8')).traceEvents.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X').map(e=>e.args.elementCount+'/'+(e.dur/1000).toFixed(2)+'ms').join(',');}
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const f=path.join(__dirname,'micro_tmp.json');
  for(const [n,c] of Object.entries(cases)){
    const p=await b.newPage();
    await p.setContent('<!doctype html><style>'+filler+'\n'+c.css+'</style><body><header id=h><a>n</a></header><section id=s>'+kids+'</section></body>');
    await new Promise(r=>setTimeout(r,200));
    await p.evaluate(()=>document.body.offsetTop);
    let A,B,C;
    if(c.ready){A=await step(p,f,()=>{document.body.classList.add('ready');document.body.offsetTop;});}
    else{
    A=await step(p,f,(c)=>{if(!c.root&&!c.small) s.classList.add('on'); document.body.offsetTop;},c);
    B=await step(p,f,(c)=>{const t=c.root?document.documentElement:c.small?h:s; t.style.setProperty(c.v,'0.000'); document.body.offsetTop;},c);
    C=await step(p,f,(c)=>{const t=c.root?document.documentElement:c.small?h:s; t.style.setProperty(c.v,'0.500'); document.body.offsetTop;},c);}
    console.log(n.padEnd(16),'classAdd',A,' | inline0.000',B,' | inline0.5',C);
    await p.close();
  }
  await b.close();
})();
