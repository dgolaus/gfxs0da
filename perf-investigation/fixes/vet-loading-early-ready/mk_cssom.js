const fs=require('fs');
const S='fixes/loading/';
let s=fs.readFileSync(S+'index.earlyready.html','utf8');
const re=/<script>\(function\(\)\{try\{var b=document.getElementById\('boot'\);if\(!b\|\|getComputedStyle\(b\).display==='none'\)document.body.classList.add\('ready'\)\}catch\(e\)\{\}\}\)\(\);<\/script>/;
if(!re.test(s))throw 'nomatch';
const js=`<script>(function(){try{var d=document,off=d.documentElement.classList.contains('no-boot'),ss=d.styleSheets,i,j,r;for(i=0;i<ss.length&&!off;i++){if((ss[i].href||'').indexOf('/boot.css')<0)continue;r=ss[i].cssRules;for(j=0;j<r.length;j++){if(r[j].selectorText==='#boot'&&r[j].style.getPropertyValue('display')==='none'&&r[j].style.getPropertyPriority('display')==='important'){off=true;break}}}if(off)d.body.classList.add('ready')}catch(e){}})();</script>`;
s=s.replace(re,()=>js);
fs.writeFileSync(__dirname+'/index.cssom.html',s);
console.log(s.includes(js));
