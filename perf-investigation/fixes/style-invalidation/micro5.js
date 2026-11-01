const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const A='@keyframes f{50%{translate:0 -9px}} .p{animation:f 3s infinite}';
const kids=(t)=>t.repeat(5);
const cases={
 plain:[A,kids('<div>x</div>')],
 colorInherit:[A+' .p>div{color:inherit}',kids('<div>x</div>')],
 links:[A+' a{color:inherit}',kids('<a href=#>x</a>')],
 linksNoRule:[A,kids('<a href=#>x</a>')],
 varChild:[A+' .p{--c:red} .p>div{color:var(--c)}',kids('<div>x</div>')],
 emChild:[A+' .p>div{padding:1em}',kids('<div>x</div>')],
 svgCurrent:[A,kids('<svg viewBox="0 0 1 1" fill="currentColor"><path d="M0 0h1v1z"/></svg>')],
 img:[A,kids('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">')],
 blockquote:[A,kids('<blockquote>x</blockquote>')],
 parentTransition:[A+' .p{transition:transform .3s}',kids('<div>x</div>')],
 childTransitionAll:[A+' .p>div{transition:all .3s}',kids('<div>x</div>')],
 childHoverRule:[A+' .p:hover>div{color:red}',kids('<div>x</div>')],
 parentPseudoAfter:[A+' .p::after{content:"";border-radius:inherit}',kids('<div>x</div>')],
 childIsInherit:[A+' .p>div{border-radius:inherit}',kids('<div>x</div>')],
};
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  for(const [n,[css,html]] of Object.entries(cases)){
    const p=await b.newPage();
    await p.setContent('<!doctype html><style>'+css+'</style><body><div class=p>'+html+'</div><script>(function l(){requestAnimationFrame(l)})()</script></body>');
    await new Promise(r=>setTimeout(r,300));
    const f=path.join(__dirname,'micro_tmp.json');
    await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
    await new Promise(r=>setTimeout(r,400));
    await p.tracing.stop();
    const u=JSON.parse(fs.readFileSync(f,'utf8')).traceEvents.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X'&&e.args.elementCount>0).map(e=>e.args.elementCount);
    const c={};u.forEach(x=>c[x]=(c[x]||0)+1);
    console.log(n.padEnd(20),JSON.stringify(c));
    await p.close();
  }
  await b.close();
})();
