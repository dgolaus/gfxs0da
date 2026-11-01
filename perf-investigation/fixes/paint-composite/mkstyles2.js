// Applies the "stable layerization" patch to a styles.css copy (orig -> stable, split -> combined). CRLF kept.
const fs=require('fs');
const L=s=>s.replace(/\r?\n/g,'\r\n');
function rep(s,a,b){const n=s.split(a).length-1;if(n!==1)throw new Error('anchor count '+n+' for '+a.slice(0,60));return s.replace(a,b);}
function stable(s){
  s=rep(s,L(`@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(177, 18, 18, 0.55); }
  70%      { box-shadow: 0 0 0 10px rgba(177, 18, 18, 0); }
}
`),L(`/* The second ring is fully transparent and fixed at the maximum spread: it draws
   nothing, but keeps the dot's paint bounds constant, so Chrome does not have to
   redo layerization of the whole page on every frame of the pulse. */
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(177, 18, 18, 0.55), 0 0 0 10px rgba(177, 18, 18, 0); }
  70%      { box-shadow: 0 0 0 10px rgba(177, 18, 18, 0), 0 0 0 10px rgba(177, 18, 18, 0); }
}
`));
  s=rep(s,L(`@keyframes pulseGreen {
  0%, 100% { box-shadow: 0 0 8px #57F287, 0 0 0 0 rgba(87, 242, 135, 0.45); }
  70%      { box-shadow: 0 0 8px #57F287, 0 0 0 9px rgba(87, 242, 135, 0); }
}
`),L(`@keyframes pulseGreen { /* transparent 3rd ring: constant bounds, see @keyframes pulse */
  0%, 100% { box-shadow: 0 0 8px #57F287, 0 0 0 0 rgba(87, 242, 135, 0.45), 0 0 0 9px rgba(87, 242, 135, 0); }
  70%      { box-shadow: 0 0 8px #57F287, 0 0 0 9px rgba(87, 242, 135, 0), 0 0 0 9px rgba(87, 242, 135, 0); }
}
`));
  s=rep(s,L(`  animation-name: priceFloatD;
  animation-duration: 8.6s;
  animation-delay: -5.7s;
}
`),L(`  animation-name: priceFloatD;
  animation-duration: 8.6s;
  animation-delay: -5.7s;
}
/* Paint boundary for the floating cards. Without it, the 4 composited
   \`translate\` animations make Chrome redo the layerization of the WHOLE page
   (PaintArtifactCompositor::Update) on almost every frame, even while the
   section is off-screen. Nothing in #pricing paints outside its padding box
   (shadows and the hover lift stay inside the section padding), so the clip
   is invisible. Do not add overflow-clip-margin: it brings the cost back. */
#pricing { contain: paint; }
`));
  return s;
}
const orig=fs.readFileSync('../styles.css','utf8');
fs.writeFileSync('styles.stable-layerize.css',stable(orig));
fs.writeFileSync('styles.combined.css',stable(fs.readFileSync('styles.intro-split.css','utf8')));
console.log('ok');
