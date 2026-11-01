const path = require('path');
const fs = require('fs');
const puppeteer = require('../node_modules/puppeteer');
const BASE = 'http://localhost:5173';
const FIX = 'fixes/forced-layout';
const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
const V = { base: {}, var: { '/script.js': FIX + '/script.js', '/index.html': FIX + '/index.html' } };
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const urls = process.argv.slice(2);
  for (const url of urls) for (let rep = 0; rep < 3; rep++) for (const vn of ['base', 'var']) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    let scriptServedAt=null; await require('./disk.js').serve(p, V[vn], { holdScript: 9000 });
    await p.evaluateOnNewDocument(`try{sessionStorage.setItem('s0da-booted','1');localStorage.setItem('s0da-lite','0')}catch(e){}; Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8}); Object.defineProperty(navigator,'deviceMemory',{get:()=>8});`);
    p.goto(BASE + url, { timeout: 60000 }).catch(() => {});
    const ys = [];
    for (let i = 0; i < 16; i++) { await w8(500); try { ys.push(await p.evaluate(() => Math.round(scrollY) + (document.readyState[0]))); } catch (e) { ys.push('x'); } }
    console.log(url, vn, rep, 'scriptAt', scriptServedAt, ys.join(' '));
    await ctx.close();
  }
  await browser.close();
})();
