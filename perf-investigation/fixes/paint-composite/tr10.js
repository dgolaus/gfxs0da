const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const ev=raw.traceEvents||raw;
const metas=ev.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args.name==='CrRendererMain');
const cnt={};for(const e of ev){const k=e.pid+':'+e.tid;cnt[k]=(cnt[k]||0)+1;}
const MAIN=metas.map(m=>m.pid+':'+m.tid).sort((a,b)=>cnt[b]-cnt[a])[0];
const pid=+MAIN.split(':')[0];
const t0=Math.min(...ev.filter(e=>(e.pid+':'+e.tid)===MAIN&&e.ts).map(e=>e.ts));
// navigation start / FCP markers
for(const e of ev){ if(/navigationStart|firstContentfulPaint|firstPaint|largestContentfulPaint::Candidate|MarkDOMContent|MarkLoad|domContentLoadedEventEnd|loadEventEnd/.test(e.name)&&e.pid===pid) console.log('mark',e.name,((e.ts-t0)/1000).toFixed(0)); }
// Animation begin events with timestamps
const an=ev.filter(e=>e.name==='Animation'&&e.ph==='b');
for(const a of an){const d=a.args.data; if(/hero|nav|bgRow|Badge|Title|Fade/i.test(d.name||'')) console.log('anim start',d.name,d.nodeName,((a.ts-t0)/1000).toFixed(0));}
// frames: compositor frames drawn (DrawFrame on compositor thread or 'PipelineReporter')
const draws=ev.filter(e=>e.name==='DrawFrame'&&e.pid===pid).map(e=>(e.ts-t0)/1000).sort((a,b)=>a-b);
console.log('DrawFrame count',draws.length);
const bmf=ev.filter(e=>e.name==='ProxyMain::BeginMainFrame'&&e.ph==='X'&&(e.pid+':'+e.tid)===MAIN).map(e=>(e.ts-t0)/1000).sort((a,b)=>a-b);
console.log('BeginMainFrame starts <2600:',bmf.filter(x=>x<2600).map(x=>x.toFixed(0)).join(' '));
// compositor draws in 0-2600
console.log('DrawFrame <2600:', draws.filter(x=>x<2600).map(x=>x.toFixed(0)).join(' '));
