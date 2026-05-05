// Records a loop of the hero section as an animated GIF for the README.
// Approach: puppeteer captures PNG frames → node-canvas draws each →
// gif-encoder-2 stitches them into a proper animated GIF.
// Run: node record-hero.js   (server must be running on :5173)

const puppeteer = require('puppeteer');
const GIFEncoder = require('gif-encoder-2');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

const W = 800;
const H = 450;
const N_FRAMES = 36;
const FPS = 12;

(async () => {
  console.log('Launching headless chrome...');
  const browser = await puppeteer.launch({
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  // Reload so entrance animations replay from frame 0
  await page.reload({ waitUntil: 'networkidle2' });

  console.log(`Capturing ${N_FRAMES} frames at ${W}x${H}...`);
  const pngFrames = [];
  const start = Date.now();
  for (let i = 0; i < N_FRAMES; i++) {
    pngFrames.push(await page.screenshot({ type: 'png' }));
  }
  const elapsed = (Date.now() - start) / 1000;
  console.log(
    `  captured in ${elapsed.toFixed(2)}s (${(N_FRAMES / elapsed).toFixed(1)} fps real)`
  );
  await browser.close();

  console.log('Encoding animated GIF...');
  const encoder = new GIFEncoder(W, H, 'neuquant', true);
  encoder.setDelay(Math.round(1000 / FPS));
  encoder.setRepeat(0); // infinite loop
  encoder.setQuality(10); // 1 = best, 30 = worst
  encoder.start();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < pngFrames.length; i++) {
    const img = await loadImage(pngFrames[i]);
    ctx.drawImage(img, 0, 0, W, H);
    encoder.addFrame(ctx);
  }
  encoder.finish();

  const buf = encoder.out.getData();
  fs.writeFileSync('assets/preview.gif', buf);
  const sz = buf.length;
  console.log(`Saved assets/preview.gif — ${(sz / 1024 / 1024).toFixed(2)} MB`);

  // Remove old static webp if present
  if (fs.existsSync('assets/preview.webp')) {
    fs.unlinkSync('assets/preview.webp');
    console.log('Removed old assets/preview.webp');
  }
})();
