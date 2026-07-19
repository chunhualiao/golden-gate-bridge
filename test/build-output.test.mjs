import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url).pathname;
const outputRoot = join(projectRoot, 'dist');

async function listFiles(directory) {
  const files = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else files.push(relative(outputRoot, path));
  }

  return files.sort();
}

test('deployment output contains only the browser application', async () => {
  assert.ok(existsSync(outputRoot), 'dist/ must be created before deployment');

  const files = await listFiles(outputRoot);
  for (const required of [
    'index.html',
    'main.js',
    'bridge.js',
    'environment.js',
    'fly.js',
    'interactions.js',
    'traffic.js',
    'vendor/three.module.js',
    'vendor/waternormals.jpg',
  ]) {
    assert.ok(files.includes(required), `missing required asset: ${required}`);
  }

  assert.equal(files.some((file) => file.startsWith('node_modules/')), false);
  assert.equal(files.some((file) => file.startsWith('shots/')), false);
  assert.equal(files.some((file) => file.endsWith('.mjs')), false);

  for (const file of files) {
    const size = (await stat(join(outputRoot, file))).size;
    assert.ok(size <= 25 * 1024 * 1024, `${file} exceeds Cloudflare's 25 MiB asset limit`);
  }
});
