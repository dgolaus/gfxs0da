const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const kids='<div><span>x</span></div>'.repeat(10);
const P='@property --r { syntax: "<number>"; inherits: false; initial-value: 0; }';
const cases={
 opacity:`.on{opacity:.99}`,
 unregVar:`.on{--x:0}`,
 regVar:`${P} .on{--r:1}`,
 regVarSame:`${P} .on{--r:0}`,
 willchange:`.on{will-change:opacity,filter,transform}`,
 filter:`.on{filter:blur(0px)}`,
 transform:`.on{transform:translateY(0px)}`,
 transition:`.on{transition:opacity .18s linear}`,
 scrollFadeUnreg:`.on{--leave:0;opacity:calc(1 - var(--leave));filter:blur(calc(var(--leave)*8px));transform:translateY(calc(var(--leave)*-24px));transition:opacity .18s linear,filter .18s linear,transform .18s linear;will-change:opacity,filter,transform}`,
 scrollFadeReg:`@property --leave { syntax: "<number>"; inherits: false; initial-value: 0; } .on{--leave:0;opacity:calc(1 - var(--leave));filter:blur(calc(var(--leave)*8px));transform:translateY(calc(var(--leave)*-24px));transition:opacity .18s linear,filter .18s linear,transform .18s linear;will-change:opacity,filter,transform}`,
};
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  for(const [n,css] of Object.entries(cases)){
    const p=await b.newPage();
    await p.setContent('<!doctype html><style>'+css+'</style><body><section id=s>'+kids+'</section></body>');
    await new Promise(r=>setTimeout(r,200));
    const f=path.join(__dirname,'micro_tmp.json');
    await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
    await p.evaluate(()=>{document.body.offsetTop;s.classList.add('on');s.offsetTop;s.style.setProperty(getComputedStyle(s).getPropertyValue('--leave')!==''||document.styleSheets[0].cssRules[0].cssText.includes('--leave')?'--leave':'--zz','0.000');s.offsetTop;});
    await p.tracing.stop();
    const ev=JSON.parse(fs.readFileSync(f,'utf8')).traceEvents;
    const u=ev.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X').map(e=>e.args.elementCount);
    console.log(n.padEnd(16),JSON.stringify(u));
    await p.close();
  }
  await b.close();
})();
