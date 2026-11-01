const puppeteer=require('../node_modules/puppeteer');
(async()=>{const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();
console.log(await b.version());
console.log(await p.evaluate(()=>[
 CSS.supports('content-visibility','auto'),
 CSS.supports('contain-intrinsic-height','auto calc(100svh + 197px)'),
 CSS.supports('contain-intrinsic-height','auto calc(410.8px + (100vw - 1100px) * 0.111)'),
 CSS.supports('contain-intrinsic-height','auto var(--x)'),
 'oncontentvisibilityautostatechange' in document.body || 'oncontentvisibilityautostatechange' in window,
]));await b.close();})();
