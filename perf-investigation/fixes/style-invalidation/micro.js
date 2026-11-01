const path=require('path');const fs=require('fs');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const cases={
 plain:`<style>@keyframes f{50%{translate:0 -9px}} .p{animation:f 3s infinite}</style><div class=p>${'<div><span>x</span></div>'.repeat(10)}</div>`,
 willchange:`<style>@keyframes f{50%{translate:0 -9px}} .p{animation:f 3s infinite;will-change:translate}</style><div class=p>${'<div><span>x</span></div>'.repeat(10)}</div>`,
 transform:`<style>@keyframes f{50%{transform:translateY(-9px)}} .p{animation:f 3s infinite}</style><div class=p>${'<div><span>x</span></div>'.repeat(10)}</div>`,
 pseudo:`<style>@keyframes f{50%{translate:0 -9px}} .p{animation:f 3s infinite} .p::before,.p::after{content:'';position:absolute}</style><div class=p>${'<div><span>x</span></div>'.repeat(10)}</div>`,
 inheritChild:`<style>@keyframes f{50%{translate:0 -9px}} .p{animation:f 3s infinite} .p>div{border-radius:inherit}</style><div class=p>${'<div><span>x</span></div>'.repeat(10)}</div>`,
 opacity:`<style>@keyframes f{50%{opacity:.5}} .p{animation:f 3s infinite}</style><div class=p>${'<div><span>x</span></div>'.repeat(10)}</div>`,
 boxshadow:`<style>@keyframes f{50%{box-shadow:0 0 9px red}} .p{animation:f 3s infinite}</style><div class=p>${'<div><span>x</span></div>'.repeat(10)}</div>`,
};
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  for(const [n,html] of Object.entries(cases)){
    const p=await b.newPage();
    await p.setContent('<!doctype html><body>'+html+'<script>(function l(){requestAnimationFrame(l)})()</script></body>');
    await new Promise(r=>setTimeout(r,500));
    const f=path.join(__dirname,'micro_tmp.json');
    await p.tracing.start({path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
    await new Promise(r=>setTimeout(r,600));
    await p.tracing.stop();
    const ev=JSON.parse(fs.readFileSync(f,'utf8')).traceEvents;
    const u=ev.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X'&&e.args&&e.args.elementCount>0).map(e=>e.args.elementCount);
    const c={};u.forEach(x=>c[x]=(c[x]||0)+1);
    console.log(n.padEnd(14),JSON.stringify(c));
    await p.close();
  }
  await b.close();
})();
