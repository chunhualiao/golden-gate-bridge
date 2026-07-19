import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const projectRoot = new URL('../', import.meta.url).pathname;
const outputRoot = join(projectRoot, 'dist');
const browserAssets = [
  'index.html',
  'main.js',
  'bridge.js',
  'environment.js',
  'fly.js',
  'interactions.js',
  'traffic.js',
  'vendor',
];

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });

for (const asset of browserAssets) {
  await cp(join(projectRoot, asset), join(outputRoot, asset), { recursive: true });
}

console.log(`Staged ${browserAssets.length} browser assets in dist/`);
