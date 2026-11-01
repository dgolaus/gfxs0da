const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  for (const vp of [{width:1440,height:900},{width:390,height:844,isMobile:true,hasTouch:true}]) {
  const p=await b.newPage();await p.setViewport(vp);
  // capture pre-script state of tracks
  await p.evaluateOnNewDocument(()=>{
    try{localStorage.setItem('s0da-lite','0')}catch(e){}
    document.addEventListener('readystatechange',()=>{});
    window.__pre=null;
    const mo=new MutationObserver(()=>{
      const s=document.querySelector('script[src="script.js"]');
      if(s&&!window.__pre){
        const wrap=document.querySelector('.tcols');
        window.__pre={target:wrap&&wrap.getBoundingClientRect().height,cols:[...document.querySelectorAll('.tcols .tcol')].map(c=>{const t=c.querySelector('.tcol-track');const o=[...t.querySelectorAll('.quote:not([aria-hidden])')];const cs=getComputedStyle(t);return {n:o.length,children:t.children.length,H:t.getBoundingClientRect().height,sumH:o.reduce((a,q)=>a+q.getBoundingClientRect().height,0),gap:cs.rowGap,pt:cs.paddingTop,pb:cs.paddingBottom,bt:cs.borderTopWidth,origFirst:[...t.children].slice(0,o.length).every(x=>!x.hasAttribute('aria-hidden'))}})};
        mo.disconnect();
      }
    });
    mo.observe(document,{childList:true,subtree:true});
  });
  await p.goto('http://localhost:5173/',{waitUntil:'networkidle2'});
  const r=await p.evaluate(()=>{
    const post=[...document.querySelectorAll('.tcols .tcol-track')].map(t=>({children:t.children.length,H:t.getBoundingClientRect().height}));
    const fixedIn=['about','process','trust','pricing','contact'].map(id=>{const s=document.getElementById(id);if(!s)return id+':none';const f=[...s.querySelectorAll('*')].filter(e=>{const p=getComputedStyle(e).position;return p==='fixed'||p==='sticky'}).map(e=>e.tagName+'.'+e.className+':'+getComputedStyle(e).position);return id+':'+s.className+' fixed/sticky='+JSON.stringify(f)});
    return {pre:window.__pre,post,wrapH:document.querySelector('.tcols').getBoundingClientRect().height,fixedIn,docH:document.documentElement.scrollHeight};
  });
  console.log(JSON.stringify(vp),JSON.stringify(r,null,1));
  await p.close();
  }
  await b.close();
})();
