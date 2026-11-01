// node mkvar.js out.json name:css-snippet-file ...  -> builds styles.<name>.css = original + snippet, writes variants json
const fs=require('fs');const path=require('path');
const ORIG='../styles.css';
const DIR=__dirname.split(path.sep).join("/");
const out=process.argv[2];const vs=[{name:'baseline'}];
for(const a of process.argv.slice(3)){
  const [name,snip]=a.split('=');
  const css=fs.readFileSync(ORIG,'utf8')+'\r\n'+fs.readFileSync(path.join(DIR,snip),'utf8').replace(/\r?\n/g,'\r\n');
  const f=DIR+'/styles.'+name+'.css';fs.writeFileSync(f,css);
  vs.push({name,files:{'/styles.css':f}});
}
fs.writeFileSync(path.join(DIR,out),JSON.stringify(vs,null,1));
