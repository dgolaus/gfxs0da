// Repeats hash landings and records whether the IO-driven pause classes end up
// consistent with what is on screen (testimonials visible => must not be paused).
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./page.js');
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const reps = +(process.argv[3] || 4);
const urls = (process.argv[4] || '/#testimonials,/#pricing').split(',');
const throttle = +(process.argv[5] || 1);
const PRE = `(() => { window.__io = []; const O = window.IntersectionObserver; window.IntersectionObserver = function (cb, opt) { return new O((entries, obs) => { window.__io.push([Math.round(performance.now()), entries.map((e) => (e.target.id || e.target.className || '').toString().slice(0, 12) + ':' + (e.isIntersecting ? 1 : 0)).join(',')]); return cb(entries, obs); }, opt); }; window.IntersectionObserver.prototype = O.prototype; })();`;
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const tally = {};
  for (const url of urls) for (let r = 0; r < reps; r++) for (const v of variants) {
    const { p } = await openPage(browser, v, { throttle, extra: PRE });
    await p.goto('http://localhost:5173' + url, { waitUntil: 'load' });
    await new Promise((res) => setTimeout(res, 3500 + throttle * 500));
    const s = await p.evaluate(() => {
      const te = document.getElementById('testimonials'), hb = document.querySelector('.hero-bg'), hero = document.querySelector('.hero');
      const vis = (el) => { const b = el.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; };
      const multi = (window.__io || []).filter((x) => x[1].split(',').length > 1 && /(testimonia|hero):/.test(x[1]));
      return {
        y: Math.round(scrollY),
        teVis: vis(te), tePaused: te.classList.contains('is-paused'),
        heroVis: vis(hero), hbPaused: hb.classList.contains('is-paused'),
        multi: multi.map((x) => x.join(' ')).slice(0, 3),
      };
    });
    if (url.includes('process')) { const n0 = await p.evaluate(() => document.getElementById('chat-messages').children.length + '/' + document.getElementById('chat-messages').textContent.length); await new Promise((res) => setTimeout(res, 6000)); const n1 = await p.evaluate(() => document.getElementById('chat-messages').children.length + '/' + document.getElementById('chat-messages').textContent.length); s.chat = n0 + ' -> ' + n1; s.chatStuck = n0 === n1; }
    const bad = s.chatStuck || (s.teVis && s.tePaused) || (!s.teVis && !s.tePaused) || (s.heroVis && s.hbPaused) || (!s.heroVis && !s.hbPaused);
    const k = `${url} ${v.name}`; tally[k] = tally[k] || { runs: 0, inconsistent: 0 }; tally[k].runs++; if (bad) tally[k].inconsistent++;
    console.log(`${url.padEnd(15)} ${v.name.padEnd(26)} ${JSON.stringify(s)}${bad ? '  <-- INCONSISTENT' : ''}`);
    await p.close();
  }
  console.log(JSON.stringify(tally, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
