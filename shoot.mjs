import puppeteer from 'puppeteer';
import fs from 'fs';

const OUT = './shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));

await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 6000)); // let the scene settle

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`shot: ${name}`);
}

// Overview (initial camera)
await shot('1-overview');

// Camera presets via HUD buttons
for (const [name, preset] of [['2-deck', 'deck'], ['3-tower', 'tower'], ['4-side', 'side']]) {
  await page.click(`[data-preset="${preset}"]`);
  await new Promise(r => setTimeout(r, 2200)); // tween 1.5s + settle
  await shot(name);
}

// Back to overview, then night mode
await page.click('[data-preset="overview"]');
await new Promise(r => setTimeout(r, 2200));
await page.click('[data-toggle="night"]');
await new Promise(r => setTimeout(r, 2000));
await shot('5-night');
await page.click('[data-toggle="night"]'); // back to day

// Heavy fog
await page.evaluate(() => {
  const s = document.getElementById('fog-slider');
  s.value = 70;
  s.dispatchEvent(new Event('input'));
});
await new Promise(r => setTimeout(r, 600));
await shot('6-fog');
await page.evaluate(() => {
  const s = document.getElementById('fog-slider');
  s.value = 12;
  s.dispatchEvent(new Event('input'));
});

// Hover + click the south tower: project its world position to screen coords
const towerScreen = await page.evaluate(() => {
  const { camera } = window.__gg;
  const p = new (Object.getPrototypeOf(camera.position).constructor)(-640, 138, 0); // portal strut
  p.project(camera);
  return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight };
});
await page.mouse.move(towerScreen.x, towerScreen.y);
await new Promise(r => setTimeout(r, 300));
await page.mouse.click(towerScreen.x, towerScreen.y);
await new Promise(r => setTimeout(r, 400));
await shot('7-click');

console.log('console errors:', errors.length ? errors : 'none');

// Close-up of the south tower base: fluting, saddle, textures
await page.evaluate(() => {
  const { camera, controls } = window.__gg;
  camera.position.set(-700, 100, 75);
  controls.target.set(-640, 130, 0);
});
await new Promise(r => setTimeout(r, 1500));
await shot('8-closeup');

console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
