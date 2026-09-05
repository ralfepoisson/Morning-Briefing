import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webDirectory = path.resolve(import.meta.dirname, '../../src/web');

test('production build preserves static asset URLs and contents', () => {
  // Run after npm run build: Vite creates dist/assets before static assets copy.
  const sourceDirectory = path.join(webDirectory, 'assets');
  for (const entry of readdirSync(sourceDirectory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const source = path.join(entry.parentPath, entry.name);
    const relative = path.relative(sourceDirectory, source);
    const deployed = path.join(webDirectory, 'dist/assets', relative);
    assert.deepEqual(readFileSync(deployed), readFileSync(source), `/assets/${relative} must be published unchanged`);
  }
  assert.deepEqual(
    readFileSync(path.join(webDirectory, 'dist/favicon.ico')),
    readFileSync(path.join(webDirectory, 'favicon.ico'))
  );
});
