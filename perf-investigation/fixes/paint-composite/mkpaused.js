const fs=require('fs');
const PAUSE="\r\n/* DIAGNOSTIC ONLY: freeze ambient (non-intro) animations */\r\n.bg-row-track,.hero-bg-tilt,.bg-row,.particle,.site-bg>i,.site-bg::after,html::before,.accent-orbs,.btn-shiny,.btn-shiny::after,.dot.pulse,.scroll-line,.hero-badge::after{animation-play-state:paused!important}\r\n";
const orig=fs.readFileSync('../styles.css','utf8');
fs.writeFileSync('diag.styles.base.paused.css',orig+PAUSE);
fs.writeFileSync('diag.styles.split.paused.css',fs.readFileSync('styles.intro-split.css','utf8')+PAUSE);
const D=__dirname.split(String.fromCharCode(92)).join('/');
// JS: stop the accent gradient rAF loop from changing pixels (diagnostic): freeze backgroundImage writes after first
const js="(function(){var d=Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype,'backgroundImage');})();";
fs.writeFileSync('diag_smooth.json',JSON.stringify([
 {name:'baseline_p',files:{'/styles.css':D+'/diag.styles.base.paused.css'}},
 {name:'split_p',files:{'/styles.css':D+'/diag.styles.split.paused.css'}}
],null,1));
console.log('ok');
