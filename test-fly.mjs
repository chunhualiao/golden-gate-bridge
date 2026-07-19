import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

const camState = () => page.evaluate(() => ({
  pos: window.__gg.camera.position.toArray(),
  quat: window.__gg.camera.quaternion.toArray(),
  flyActive: window.__gg.fly.isActive,
  orbitEnabled: window.__gg.controls.enabled,
  speed: window.__gg.fly.speed,
}));

const before = await camState();
console.log('before fly:', before.pos.map(v => v.toFixed(1)), 'orbitEnabled:', before.orbitEnabled);

// Enter fly mode
await page.click('[data-mode="fly"]');
await new Promise(r => setTimeout(r, 200));

// Hold W for 1.5 s → should move forward ~120 m
await page.keyboard.down('KeyW');
await new Promise(r => setTimeout(r, 1500));
await page.keyboard.up('KeyW');
const afterW = await camState();
const moved = Math.hypot(...afterW.pos.map((v, i) => v - before.pos[i]));
console.log('moved forward:', moved.toFixed(1), 'm | flyActive:', afterW.flyActive, 'orbitEnabled:', afterW.orbitEnabled);

// Drag-look: yaw right 200 px
await page.mouse.move(720, 400);
await page.mouse.down();
await page.mouse.move(920, 380, { steps: 10 });
await page.mouse.up();
await new Promise(r => setTimeout(r, 200));
const afterLook = await camState();
const quatChanged = afterLook.quat.some((v, i) => Math.abs(v - afterW.quat[i]) > 1e-4);
console.log('look direction changed:', quatChanged);

// Wheel up → speed increases
await page.mouse.wheel({ deltaY: -240 });
await new Promise(r => setTimeout(r, 200));
const afterWheel = await camState();
console.log('fly speed:', afterWheel.speed.toFixed(1), '(was', afterLook.speed.toFixed(1) + ')');

// Q/E vertical: hold E for 0.8 s → altitude rises
await page.keyboard.down('KeyE');
await new Promise(r => setTimeout(r, 800));
await page.keyboard.up('KeyE');
const afterE = await camState();
console.log('altitude gain:', (afterE.pos[1] - afterWheel.pos[1]).toFixed(1), 'm');

// Back to orbit: pivot retargeted, controls re-enabled
await page.click('[data-mode="orbit"]');
await new Promise(r => setTimeout(r, 300));
const backOrbit = await camState();
console.log('back to orbit | flyActive:', backOrbit.flyActive, 'orbitEnabled:', backOrbit.orbitEnabled);

await page.click('[data-mode="fly"]');
await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: './shots/8-fly.png' });

console.log('pageerrors:', errors.length ? errors : 'none');
await browser.close();
