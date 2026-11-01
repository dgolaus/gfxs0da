const fs=require('fs');let s=fs.readFileSync('bench_disk.js','utf8');
const a="    await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; })));";
const b="    await Promise.race([Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 4000))]); // capped: far-below lazy imgs never load";
if(!s.includes(a)) throw new Error('nf'); s=s.replace(a,b);
// also allow custom times via env
s=s.replace("else if (mode === 'visual') r = await visual(variants);","else if (mode === 'visual') r = await visual(variants, process.env.TIMES ? process.env.TIMES.split(',').map(Number) : undefined);");
fs.writeFileSync('bench_disk.js',s);console.log('ok');
