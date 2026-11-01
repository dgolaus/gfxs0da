const fs=require('fs');let s=fs.readFileSync('scrollcheck.js','utf8');
const a="if (vp.mobile) await p.emulateMediaFeatures([{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }, ...(reduced ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [])]);";
const b="if (vp.mobile) { const cdp = await p.target().createCDPSession(); await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'any-hover', value: 'none' }, { name: 'pointer', value: 'coarse' }, { name: 'any-pointer', value: 'coarse' }, ...(reduced ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [])] }); }";
if(!s.includes(a)) throw new Error('nomatch'); s=s.replace(a,b); fs.writeFileSync('scrollcheck.js',s); console.log('ok');
