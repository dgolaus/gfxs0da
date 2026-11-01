// Counts how many DISTINCT visual states the hero title / sub / nav go through during the intro,
// as actually presented by the compositor (Page.startScreencast), CPU 4x. Ambient animations that are
// not part of the intro are paused identically in every run so only intro motion changes the crops.
const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const sharp=require(path.join('../node_modules/sharp'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
const PAUSE_AMBIENT=".bg-row-track,.hero-bg-tilt,.bg-row,.particle,.site-bg>i,.site-bg::after,html::before,.accent-orbs,.btn-shiny,.btn-shiny::after,.dot.pulse,.scroll-line,.hero-badge::after{animation-play-state:paused!important}";
(async()=>{
  const [vfile,...names]=process.argv.slice(2);
  const variants=JSON.parse(fs.readFileSync(vfile,'utf8'));
  for(const name of names){
    const v0=variants.find(x=>x.name===name)||{name};
    const v=Object.assign({},v0,{css:(v0.css||'')+PAUSE_AMBIENT});
    const browser=await puppeteer.launch({headless:'new'});
    const {p,c}=await openPage(browser,v,{throttle:4});
    const frames=[];
    c.on('Page.screencastFrame',async(f)=>{frames.push({t:f.metadata.timestamp,data:f.data});try{await c.send('Page.screencastFrameAck',{sessionId:f.sessionId});}catch(e){}});
    await c.send('Page.startScreencast',{format:'png',everyNthFrame:1,maxWidth:1440,maxHeight:900});
    const t0=Date.now()/1000;
    await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
    await w8(4000);
    await c.send('Page.stopScreencast');
    await browser.close();
    // crops: title, sub, nav
    const R={title:{left:150,top:260,width:640,height:200},sub:{left:150,top:495,width:600,height:60},nav:{left:0,top:0,width:1440,height:72}};
    const res={};
    for(const [k,r] of Object.entries(R)){
      let prev=null,distinct=0,changes=[];
      for(const f of frames){
        const buf=Buffer.from(f.data,'base64');
        const meta=await sharp(buf).metadata();
        const sx=meta.width/1440, sy=meta.height/900;
        const raw=await sharp(buf).extract({left:Math.round(r.left*sx),top:Math.round(r.top*sy),width:Math.round(r.width*sx),height:Math.round(r.height*sy)}).raw().toBuffer();
        if(prev){let d=0;for(let i=0;i<raw.length;i+=7)d+=Math.abs(raw[i]-prev[i]);d/= (raw.length/7);if(d>0.05){distinct++;changes.push(+(f.t-t0).toFixed(2));}}
        else distinct++;
        prev=raw;
      }
      res[k]={distinctStates:distinct,firstChange:changes[0],lastChange:changes[changes.length-1]};
    }
    console.log(name.padEnd(36)+' screencastFrames='+frames.length+' '+JSON.stringify(res));
  }
})().catch(e=>{console.error(e);process.exit(1)});
