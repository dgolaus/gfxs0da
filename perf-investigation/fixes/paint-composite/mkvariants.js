const fs=require('fs');
const KF=`
@keyframes pcHeroBadgeInMove { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
@keyframes pcHeroBadgeInBlur { from { filter: blur(5px); } to { filter: blur(0); } }
@keyframes pcHeroTitleInMove { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
@keyframes pcHeroTitleInBlur { from { filter: blur(12px); } to { filter: blur(0); } }
@keyframes pcHeroFadeInMove  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes pcHeroFadeInBlur  { from { filter: blur(8px); } to { filter: blur(0); } }
@keyframes pcNavInMove       { from { opacity: 0; translate: 0 -14px; } to { opacity: 1; translate: 0 0; } }
@keyframes pcNavInBlur       { from { filter: blur(10px); } to { filter: blur(0); } }
@keyframes pcNavItemInMove   { from { opacity: 0; translate: 0 -6px; } to { opacity: 1; translate: 0 0; } }
@keyframes pcNavItemInBlur   { from { filter: blur(6px); } to { filter: blur(0); } }`;
const SPLIT=`
@media (prefers-reduced-motion: no-preference) {
  .hero-badge        { animation-name: pcHeroBadgeInMove, pcHeroBadgeInBlur; }
  .hero-title        { animation-name: pcHeroTitleInMove, pcHeroTitleInBlur; }
  .hero-sub, .hero-cta, .hero-stats-strip, .scroll-indicator { animation-name: pcHeroFadeInMove, pcHeroFadeInBlur; }
  .nav               { animation-name: pcNavInMove, pcNavInBlur; }
  .nav .brand, .nav .nav-links > a, .nav > .btn { animation-name: pcNavItemInMove, pcNavItemInBlur; }
}`;
// blur half ends without holding blur(0): fill backwards on the BLUR animation only (hero only; nav keeps both)
const SPLIT_FILL=SPLIT.replace('}\n}', `}
  .hero-badge, .hero-title, .hero-sub, .hero-cta, .hero-stats-strip, .scroll-indicator { animation-fill-mode: both, backwards; }
}`);
const FILL=`
@media (prefers-reduced-motion: no-preference) {
  .hero-badge, .hero-title, .hero-sub, .hero-cta, .hero-stats-strip, .scroll-indicator { animation-fill-mode: backwards; }
}`;
const v=[
  {name:'baseline'},
  {name:'paint-composite-intro-split', css: KF+SPLIT},
  {name:'paint-composite-intro-split-release', css: KF+SPLIT_FILL},
  {name:'paint-composite-hero-fill-release', css: FILL},
];
fs.writeFileSync('variants.json', JSON.stringify(v,null,1));
fs.writeFileSync('intro-split.css', KF+SPLIT);
fs.writeFileSync('intro-split-release.css', KF+SPLIT_FILL);
fs.writeFileSync('hero-fill-release.css', FILL);
console.log(SPLIT_FILL);
