// Deterministic: after load, rewind the intro animations of the hero/nav to t=250ms (active phase), let two
// frames commit, then block the main thread for 700ms (like the real 350-520ms load-time long tasks).
// Count presented compositor frames whose title/sub/nav crops change DURING the block.
// Ambient animations are frozen in the stylesheet itself (diag.*.paused.css) for both runs.
const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const sharp=require(path.join('../node_modules/sharp'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const [vfile,...names]=process.argv.slice(2);
  const variants=JSON.parse(fs.readFileSync(vfile,'utf8'));
  for(const name of names){
    const v=variants.find(x=>x.name===name);
    const browser=await puppeteer.launch({headless:'new'});
    const {p,c}=await openPage(browser,v,{throttle:1});
    await p.goto('http://localhost:5173/',{waitUntil:'load'});
    await w8(3000);
    const frames=[];
    c.on('Page.screencastFrame',async(f)=>{frames.push({t:f.metadata.timestamp*1000,data:f.data});try{await c.send('Page.screencastFrameAck',{sessionId:f.sessionId});}catch(e){}});
    await c.send('Page.startScreencast',{format:'png',everyNthFrame:1});
    await w8(300);
    await p.evaluate(()=>{
      const sel='.hero-badge,.hero-title,.hero-sub,.hero-cta,.hero-stats-strip,.nav,.nav .brand,.nav .nav-links > a,.nav > .btn';
      const els=[...document.querySelectorAll(sel)];
      els.forEach(el=>el.getAnimations().forEach(a=>{ if(/hero|nav/i.test(a.animationName||'')){ a.currentTime=Math.min(450, (a.effect.getTiming().delay||0)+250); a.play(); }}));
      requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>{window.__bs=performance.timeOrigin+performance.now();const e=performance.now()+700;while(performance.now()<e){}window.__be=performance.timeOrigin+performance.now();},0)));
    });
    await p.waitForFunction('window.__be',{timeout:30000});
    await w8(300);
    const {bs,be}=await p.evaluate(()=>({bs:window.__bs,be:window.__be}));
    await c.send('Page.stopScreencast');
    await browser.close();
    const R={title:{left:150,top:255,width:660,height:210},sub:{left:150,top:490,width:600,height:70},nav:{left:0,top:0,width:1440,height:72}};
    const inBlock=frames.filter(f=>f.t>bs+30&&f.t<be-10);
    const res={framesPresentedDuringBlock:inBlock.length};
    for(const [k,r] of Object.entries(R)){
      let prev=null,changed=0;
      for(const f of inBlock){
        const buf=Buffer.from(f.data,'base64');const m=await sharp(buf).metadata();const sx=m.width/1440,sy=m.height/900;
        const raw=await sharp(buf).extract({left:Math.round(r.left*sx),top:Math.round(r.top*sy),width:Math.round(r.width*sx),height:Math.round(r.height*sy)}).greyscale().raw().toBuffer();
        if(prev){let d=0;for(let i=0;i<raw.length;i+=3)d+=Math.abs(raw[i]-prev[i]);d/=(raw.length/3);if(d>0.05)changed++;}
        prev=raw;
      }
      res[k+'FramesThatMoved']=changed;
    }
    console.log(name.padEnd(14)+' '+JSON.stringify(res));
  }
})().catch(e=>{console.error(e);process.exit(1)});
