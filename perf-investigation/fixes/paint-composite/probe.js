const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{
  const vfile=process.argv[2]; const which=process.argv[3]||'baseline';
  const variants=vfile?JSON.parse(fs.readFileSync(vfile,'utf8')):[{name:'baseline'}];
  const v=variants.find(x=>x.name===which);
  const browser=await puppeteer.launch({headless:'new'});
  const {p}=await openPage(browser,v,{throttle:1});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,100));
  const r=await p.evaluate(()=>{
    const hi=getComputedStyle(document.querySelector('.hero-inner'));
    const list=document.getAnimations().map(a=>{const t=a.effect&&a.effect.target;const ps=a.effect&&a.effect.pseudoElement;const k=a.effect.getKeyframes?a.effect.getKeyframes():[];const props=[...new Set(k.flatMap(f=>Object.keys(f).filter(x=>!['offset','easing','composite','computedOffset'].includes(x))))];
      const r=t&&t.getBoundingClientRect();
      return (a.animationName||a.transitionProperty||'?')+' | '+(t?(t.tagName+'.'+String(t.className).replace(/ /g,'.')).slice(0,50):'')+(ps||'')+' | '+props.join(',')+' | '+(r?Math.round(r.width)+'x'+Math.round(r.height)+'@'+Math.round(r.top):'');});
    return {heroInnerAnim:hi.animationName, heroInnerFilter:hi.filter, n:list.length, list};
  });
  console.log(JSON.stringify(r,null,1));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
