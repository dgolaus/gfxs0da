// Builds modified copies of styles.css (CRLF preserved). Repo is NOT touched.
const fs=require('fs');
const SRC='../styles.css';
const orig=fs.readFileSync(SRC,'utf8');
if(!orig.includes('\r\n')) throw new Error('expected CRLF');
const L=s=>s.replace(/\r?\n/g,'\r\n');
function rep(s,a,b,count=1){const n=s.split(a).length-1;if(n!==count)throw new Error('anchor count '+n+' for '+a);return s.split(a).join(b);}
function build(release){
  let s=orig;
  const blurFill = release ? 'backwards' : 'both';
  s=rep(s,'  animation: heroBadgeIn 0.9s var(--ease-out) both;\r\n  }','XX',0); // sanity no-op
  // hero (home) — lines 626/646/674/683/703/760 (the 2250+ TOS rules are left untouched)
  s=rep(s,'  margin: 0 0 clamp(18px, 2.6vh, 28px);\r\n  animation: heroBadgeIn 0.9s var(--ease-out) both;',
          '  margin: 0 0 clamp(18px, 2.6vh, 28px);\r\n  animation: heroBadgeInMove 0.9s var(--ease-out) both, heroBadgeInBlur 0.9s var(--ease-out) '+blurFill+';');
  s=rep(s,'  animation: heroTitleIn 1s var(--ease-out) 0.15s both;',
          '  animation: heroTitleInMove 1s var(--ease-out) 0.15s both, heroTitleInBlur 1s var(--ease-out) 0.15s '+blurFill+';');
  for(const d of ['0.30s','0.45s','0.60s','0.90s'])
    s=rep(s,'  animation: heroFadeIn 1s var(--ease-out) '+d+' both;',
            '  animation: heroFadeInMove 1s var(--ease-out) '+d+' both, heroFadeInBlur 1s var(--ease-out) '+d+' '+blurFill+';');
  // keyframes for the hero halves, right after the original heroFadeIn block
  s=rep(s,'@keyframes heroFadeIn {\r\n  from { opacity: 0; transform: translateY(12px); filter: blur(8px); }\r\n  to   { opacity: 1; transform: none; filter: blur(0); }\r\n}\r\n',
    '@keyframes heroFadeIn {\r\n  from { opacity: 0; transform: translateY(12px); filter: blur(8px); }\r\n  to   { opacity: 1; transform: none; filter: blur(0); }\r\n}\r\n'+L(`/* Same three entrances split in two animations with identical timing:
   *Move (opacity + transform) can run on the compositor thread, so it keeps
   gliding even while the main thread is busy during load; *Blur (filter)
   must stay on the main thread (Chrome never composites a blur animation).
   Values at any instant are exactly the ones of the combined keyframes above,
   which stay untouched for /tos/ (it still uses them). */
@keyframes heroBadgeInMove { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
@keyframes heroBadgeInBlur { from { filter: blur(5px); }  to { filter: blur(0); } }
@keyframes heroTitleInMove { from { opacity: 0; transform: translateY(20px); }  to { opacity: 1; transform: none; } }
@keyframes heroTitleInBlur { from { filter: blur(12px); } to { filter: blur(0); } }
@keyframes heroFadeInMove  { from { opacity: 0; transform: translateY(12px); }  to { opacity: 1; transform: none; } }
@keyframes heroFadeInBlur  { from { filter: blur(8px); }  to { filter: blur(0); } }
`));
  // nav (home) — line 4045 / 4054
  s=rep(s,'  animation: navIn 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;',
          '  animation: navInMove 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both, navInBlur 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;');
  s=rep(s,'  animation: navItemIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;',
          '  animation: navItemInMove 0.8s cubic-bezier(0.16, 1, 0.3, 1) both, navItemInBlur 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;');
  s=rep(s,'@keyframes navItemIn {\r\n  from { opacity: 0; translate: 0 -6px; filter: blur(6px); }\r\n  to   { opacity: 1; translate: 0 0;    filter: blur(0); }\r\n}\r\n',
    '@keyframes navItemIn {\r\n  from { opacity: 0; translate: 0 -6px; filter: blur(6px); }\r\n  to   { opacity: 1; translate: 0 0;    filter: blur(0); }\r\n}\r\n'+L(`/* navIn / navItemIn split the same way as the hero (see heroFadeInMove). */
@keyframes navInMove     { from { opacity: 0; translate: 0 -14px; } to { opacity: 1; translate: 0 0; } }
@keyframes navInBlur     { from { filter: blur(10px); } to { filter: blur(0); } }
@keyframes navItemInMove { from { opacity: 0; translate: 0 -6px; }  to { opacity: 1; translate: 0 0; } }
@keyframes navItemInBlur { from { filter: blur(6px); }  to { filter: blur(0); } }
`));
  return s;
}
fs.writeFileSync('styles.intro-split.css', build(false));
fs.writeFileSync('styles.intro-split-release.css', build(true));
console.log('ok');
