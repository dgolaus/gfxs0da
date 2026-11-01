// Presented-frame smoothness of the hero intro: screencast frames (what the compositor actually shows),
// crop the title / sub / nav, and measure gaps between consecutive visual changes during the intro.
const path=require('path');const fs=require('fs');
const { openPage } = require('./bench_disk.js');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const sharp=require(path.join('../node_modules/sharp'));
const w8=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const [vfile,thr,...names]=process.argv.slice(2);
  const variants=JSON.parse(fs.readFileSync(vfile,'utf8'));
  for(const name of names){
    const v=variants.find(x=>x.name===name);
    const browser=await puppeteer.launch({headless:'new'});
    const {p,c}=await openPage(browser,v,{throttle:+thr});
    const frames=[];
    c.on('Page.screencastFrame',async(f)=>{frames.push({t:f.metadata.timestamp*1000,data:f.data});try{await c.send('Page.screencastFrameAck',{sessionId:f.sessionId});}catch(e){}});
    await c.send('Page.startScreencast',{format:'jpeg',quality:90,everyNthFrame:1});
    await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
    await w8(5000);
    await c.send('Page.stopScreencast');
    await browser.close();
    const R={title:{left:150,top:255,width:660,height:210},sub:{left:150,top:490,width:600,height:70},cta:{left:150,top:580,width:600,height:70},nav:{left:0,top:0,width:1440,height:72}};
    const out={frames:frames.length};
    for(const [k,r] of Object.entries(R)){
      let prev=null;const ch=[];
      for(const f of frames){
        const buf=Buffer.from(f.data,'base64');const m=await sharp(buf).metadata();const sx=m.width/1440,sy=m.height/900;
        const raw=await sharp(buf).extract({left:Math.round(r.left*sx),top:Math.round(r.top*sy),width:Math.round(r.width*sx),height:Math.round(r.height*sy)}).greyscale().raw().toBuffer();
        if(prev){let d=0;for(let i=0;i<raw.length;i+=3)d+=Math.abs(raw[i]-prev[i]);d/=(raw.length/3);if(d>0.15)ch.push({t:f.t,d});}
        prev=raw;
      }
      const gaps=[];for(let i=1;i<ch.length;i++)gaps.push(ch[i].t-ch[i-1].t);
      gaps.sort((a,b)=>a-b);
      out[k]={changes:ch.length,spanMs:ch.length?Math.round(ch[ch.length-1].t-ch[0].t):0,maxGap:gaps.length?Math.round(gaps[gaps.length-1]):null,p90Gap:gaps.length?Math.round(gaps[Math.floor(gaps.length*0.9)]):null};
    }
    console.log(name.padEnd(14)+' thr='+thr+' '+JSON.stringify(out));
  }
})().catch(e=>{console.error(e);process.exit(1)});
