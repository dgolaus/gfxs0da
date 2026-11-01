process.env.BENCH_DISK = '1';
const path = require('path');
const puppeteer = require(path.join('../node_modules/puppeteer'));
const { openPage } = require('./rerun/bench.js');
const S = 'scratchpad';
const VARIANT = { name: 'v', files: { '/script.js': S + '/fixes/forced-layout/script.js' } };
const BASE = { name: 'base' };
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const url of ['/#pricing', '/tos/#pricing']) for (let i = 0; i < 4; i++) for (const v of [BASE, VARIANT]) {
    const { p } = await openPage(browser, v, { throttle: 1 });
    await p.goto('http://localhost:5173' + url, { waitUntil: 'networkidle2' });
    await w8(2500);
    const r = await p.evaluate(() => ({ y: scrollY, leave: ['about','process','trust','pricing','contact'].map((id) => { const e = document.getElementById(id); return e ? getComputedStyle(e).getPropertyValue('--leave').trim() + '/' + getComputedStyle(e).opacity : '-'; }).join(' '), inline: document.documentElement.getAttribute('style') }));
    console.log(url, v.name, i, JSON.stringify(r));
    await p.close();
  }
  await browser.close();
})();
