import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nativeKey } from '../e2e/native/lib/build.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yepwatch-native-cache-'));
  const module = path.join(root, 'modules', 'example');
  fs.mkdirSync(path.join(module, 'android', 'src'), { recursive: true });
  for (const name of ['package.json', 'package-lock.json', 'app.json', 'app.config.ts']) fs.writeFileSync(path.join(root, name), '{}');
  fs.writeFileSync(path.join(module, 'expo-module.config.json'), '{"platforms":["android"]}');
  fs.writeFileSync(path.join(module, 'android', 'src', 'Module.kt'), 'class VersionOne');
  return { root, module };
}

test('a local Expo module source change invalidates the cached native APK', () => {
  const { root, module } = fixture();
  try {
    const before = nativeKey(root);
    fs.writeFileSync(path.join(module, 'android', 'src', 'Module.kt'), 'class VersionTwo');
    assert.notEqual(nativeKey(root), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('generated local module output leaves the native cache key stable', () => {
  const { root, module } = fixture();
  try {
    const before = nativeKey(root);
    for (const dir of ['android/build', 'android/.gradle', 'node_modules']) {
      fs.mkdirSync(path.join(module, dir), { recursive: true });
      fs.writeFileSync(path.join(module, dir, 'generated.txt'), 'generated');
    }
    assert.equal(nativeKey(root), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
