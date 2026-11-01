const path=require('path');
const puppeteer=require(path.join('../node_modules/puppeteer'));
const S='fixes/loading/';
const V=__dirname.split(String.fromCharCode(92)).join('/')+'/';
const all={baseline:{},early:{'/index.html':S+'index.earlyready.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'},
 cssom:{'/index.html':V+'index.cssom.html','/boot.js':S+'boot.js','/script.js':S+'script.earlyready.js'}};
const names=(process.argv[3]||'baseline,early,cssom').split(',');const thr=+(process.argv[2]||1);const reps=+(process.argv[4]||5);
(async()=>{const b=await puppeteer.launch({headless:'new'});const agg={};
for(let rep=0;rep<reps;rep++)for(const nm of names){const p=await b.newPage();await p.setViewport({width:1440,height:900});
const c=await p.target().createCDPSession();if(thr>1)await c.send('Emulation.setCPUThrottlingRate',{rate:thr});
await require('./serve.js').attach(p,all[nm]);await p.evaluateOnNewDocument(()=>{try{localStorage.setItem('s0da-lite','0')}catch(e){}});
await p.goto('http://localhost:5173/',{waitUntil:'load'});await new Promise(r=>setTimeout(r,300));
const r=await p.evaluate(()=>{const A=document.getAnimations().filter(a=>a.animationName&&a.startTime!=null);
 const g=(n)=>A.filter(a=>a.animationName===n).map(a=>a.startTime);
 const rows=g('bgRowIn'),hero=g('heroBlockIn'),all=A.filter(a=>{const t=a.effect.target;return t&&t.closest&&t.closest('.hero,.nav,.ambient,.site-bg')}).map(a=>a.startTime);
 const mn=Math.min(...all),mx=Math.max(...all);
 return {rows:rows.map(x=>Math.round(x)),hero:hero.map(x=>Math.round(x)),spread:Math.round(mx-mn),n:all.length,distinct:[...new Set(all.map(x=>Math.round(x)))].sort((a,b)=>a-b)};});
const rowSkew=Math.max(...r.rows)-Math.min(...r.rows), heroVsRow1=r.hero[0]-r.rows[0];
(agg[nm]=agg[nm]||[]).push(rowSkew);
console.log(nm.padEnd(8),`rowStarts=${r.rows.join(',')} hero=${r.hero} rowSkew=${rowSkew} hero-row1=${heroVsRow1} heroAreaStartSpread=${r.spread} distinct=${r.distinct.join(',')}`);await p.close();}
console.log(Object.entries(agg).map(([k,v])=>k+' rowSkew>0: '+v.filter(x=>x>0).length+'/'+v.length+' max '+Math.max(...v)).join(' | '));
await b.close();})();
