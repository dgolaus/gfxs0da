const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const kids='<div><span>x</span></div>'.repeat(10);
const R=(n,inh)=>`@property ${n} { syntax: "<number>"; inherits: ${inh}; initial-value: 0; }`;
const SF=`opacity:calc(1 - var(--leave));filter:blur(calc(var(--leave)*8px));transform:translateY(calc(var(--leave)*-24px));transition:opacity .18s linear,filter .18s linear,transform .18s linear;will-change:opacity,filter,transform`;
const cases={
 unreg:        {css:`.on{--leave:0;${SF}}`, v:'--leave'},
 regNoInherit: {css:`${R('--leave',false)} .on{--leave:0;${SF}}`, v:'--leave'},
 regInherit:   {css:`${R('--leave',true)} .on{--leave:0;${SF}}`, v:'--leave'},
 regNoInheritVal1: {css:`${R('--leave',false)} .on{--leave:1}`, v:'--leave'},
 navUnregRoot: {css:`:root{--nav-pill:0}`, v:'--nav-pill', root:true},
 navRegRoot:   {css:`${R('--nav-pill',true)} :root{--nav-pill:0}`, v:'--nav-pill', root:true},
};
async function step(p,f,fn,arg){await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});await p.evaluate(fn,arg);await p.tracing.stop();
  return JSON.parse(fs.readFileSync(f,'utf8')).traceEvents.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X').map(e=>e.args.elementCount);}
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const f=path.join(__dirname,'micro_tmp.json');
  for(const [n,c] of Object.entries(cases)){
    const p=await b.newPage();
    await p.setContent('<!doctype html><style>'+c.css+'</style><body><section id=s>'+kids+'</section></body>');
    await new Promise(r=>setTimeout(r,200));
    await p.evaluate(()=>document.body.offsetTop);
    const A=await step(p,f,(c)=>{const t=c.root?document.documentElement:s; if(!c.root) s.classList.add('on'); else t.style.setProperty('--zz','1'); document.body.offsetTop;},c);
    const B=await step(p,f,(c)=>{const t=c.root?document.documentElement:s; t.style.setProperty(c.v,'0.000'); document.body.offsetTop;},c);
    const C=await step(p,f,(c)=>{const t=c.root?document.documentElement:s; t.style.setProperty(c.v,'0.500'); document.body.offsetTop;},c);
    console.log(n.padEnd(18),'classAdd',JSON.stringify(A),' inline0.000',JSON.stringify(B),' inline0.5',JSON.stringify(C));
    await p.close();
  }
  await b.close();
})();
