const fs=require('fs');const lines=fs.readFileSync('struct.js','utf8').split('\n');
const i=lines.findIndex(l=>l.includes("for (const f of res.forcedScript)"));
lines[i]="    for (const f of res.forcedScript) if (!f.includes('script.js:910:')) console.log('   ', f);";
fs.writeFileSync('struct-all.js',lines.join('\n'));
