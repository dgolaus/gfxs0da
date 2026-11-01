// Deterministic smoothness check: block the main thread for 700ms in the middle of the hero-title intro
// (like the real 350-520ms long tasks do) and count how many distinct frames the compositor presents for the
// title / sub / nav during the block. Ambient (non-intro) animations are paused identically in every run.
const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const sharp=require(path.join('../node_modules/sharp'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
const PAUSE_AMBIENT=".bg-row-track,.hero-bg-tilt,.bg-row,.particle,.site-bg>i,.site-bg::after,html::before,.accent-orbs,.btn-shiny,.btn-shiny::after,.dot.pulse,.scroll-line,.hero-badge::after{animation-play-state:paused!important}";
const BLOCK=`(function(){function poll(){var t=document.querySelector('.hero-title');var a=t&&t.getAnimations().filter(function(x){return x.playState==='running'})[0];
 if(a&&a.currentTime>260){window.__bs=performance.timeOrigin+performance.now();var e=performance.now()+700;while(performance.now()<e){}window.__be=performance.timeOrigin+performance.now();return;}
 requestAnimationFrame(poll);} requestAnimationFrame(poll);})();`;
(async()=>{
  const [vfile,...names]=process.argv.slice(2);
  const variants=JSON.parse(fs.readFileSync(vfile,'utf8'));
  for(const name of names){
    const v0=variants.find(x=>x.name===name)||{name};
    const v=Object.assign({},v0,{css:(v0.css||'')+PAUSE_AMBIENT, js:(v0.js||'')+BLOCK});
    const browser=await puppeteer.launch({headless:'new'});
    const {p,c}=await openPage(browser,v,{throttle:1});
    const frames=[];
    c.on('Page.screencastFrame',async(f)=>{frames.push({t:f.metadata.timestamp*1000,data:f.data});try{await c.send('Page.screencastFrameAck',{sessionId:f.sessionId});}catch(e){}});
    await c.send('Page.startScreencast',{format:'png',everyNthFrame:1});
    await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
    try{await p.waitForFunction('window.__be',{timeout:20000});}catch(e){console.log('no block; anims:',await p.evaluate(()=>{const t=document.querySelector('.hero-title');return t?t.getAnimations().map(a=>a.animationName+':'+a.playState+':'+Math.round(a.currentTime)).join(','):'none';}));}
    await w8(300);
    const {bs,be}=await p.evaluate(()=>({bs:window.__bs,be:window.__be}));
    await c.send('Page.stopScreencast');
    await browser.close();
    const R={title:{left:150,top:255,width:660,height:210},sub:{left:150,top:490,width:600,height:70},nav:{left:0,top:0,width:1440,height:72}};
    const inBlock=frames.filter(f=>f.t>bs+50&&f.t<be-20);
    const res={framesDuringBlock:inBlock.length};
    for(const [k,r] of Object.entries(R)){
      let prev=null,changed=0;
      for(const f of inBlock){
        const buf=Buffer.from(f.data,'base64');const m=await sharp(buf).metadata();const sx=m.width/1440,sy=m.height/900;
        const raw=await sharp(buf).extract({left:Math.round(r.left*sx),top:Math.round(r.top*sy),width:Math.round(r.width*sx),height:Math.round(r.height*sy)}).raw().toBuffer();
        if(prev){let d=0;for(let i=0;i<raw.length;i+=5)d+=Math.abs(raw[i]-prev[i]);d/=(raw.length/5);if(d>0.02)changed++;}
        prev=raw;
      }
      res[k+'Changes']=changed;
    }
    console.log(name.padEnd(36)+' '+JSON.stringify(res));
  }
})().catch(e=>{console.error(e);process.exit(1)});
