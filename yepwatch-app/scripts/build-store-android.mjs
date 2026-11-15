// Store gallery APK for the Android emulator: the E2E harness's release-like base APK (Hermes, no dev menu,
// no OTA URL) with the current app source bundled against the public origins, fixtures off.
// The E2E build refuses non-loopback origins by design, so this repack lives here, outside the harness.
// Usage (from yepwatch-app): node scripts/build-store-android.mjs  -> prints the APK path
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HOME, toolEnv, tools } from '../e2e/native/lib/env.mjs';
import { nativeKey } from '../e2e/native/lib/build.mjs';

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const base = path.join(HOME, 'apk', nativeKey(), 'base.apk');
if (!fs.existsSync(base)) throw new Error('No E2E base APK for the current native inputs; run `node e2e/native/run.mjs journey` once to build it.');
const keystore = path.join(path.dirname(base), 'debug.keystore');
const work = path.join(APP, '.expo/store-android');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(path.join(work, 'assets'), { recursive: true });
const env = toolEnv({
  EXPO_PUBLIC_API_ORIGIN: 'https://yepwatch.com', EXPO_PUBLIC_APP_ORIGIN: 'https://yepwatch.com', EXPO_PUBLIC_WS_ORIGIN: 'wss://yepwatch.com',
  EXPO_PUBLIC_ENABLE_FIXTURES: 'false', EXPO_PUBLIC_GUEST_ONLY: 'false', NODE_ENV: 'production', APP_VARIANT: 'development',
  EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1', CI: '1', TMPDIR: fs.mkdtempSync(path.join(HOME, 'metro', 'store-')),
});
const js = path.join(work, 'index.android.bundle.js');
const opts = { cwd: APP, env, stdio: ['ignore', 'inherit', 'inherit'] };
execFileSync(path.join(APP, 'node_modules/.bin/expo'), ['export:embed', '--platform', 'android', '--dev', 'false', '--minify', 'true',
  '--entry-file', 'node_modules/expo-router/entry.js', '--bundle-output', js, '--assets-dest', path.join(work, 'res')], opts);
execFileSync(path.join(APP, 'node_modules/hermes-compiler/hermesc/linux64-bin/hermesc'), ['-emit-binary', '-O', '-out', path.join(work, 'assets/index.android.bundle'), js], opts);
const unsigned = path.join(work, 'unsigned.apk');
fs.copyFileSync(base, unsigned);
try { execFileSync('zip', ['-q', '-d', unsigned, 'META-INF/*']); } catch { /* v2-only signature */ }
execFileSync('zip', ['-q', '-0', unsigned, 'assets/index.android.bundle'], { cwd: work });
const bt = tools.buildTools();
const aligned = path.join(work, 'aligned.apk');
execFileSync(path.join(bt, 'zipalign'), ['-f', '-p', '4', unsigned, aligned]);
const out = path.join(work, 'yepwatch-store.apk');
execFileSync(path.join(bt, 'apksigner'), ['sign', '--ks', keystore, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--ks-key-alias', 'androiddebugkey', '--out', out, aligned], { env });
console.log(out);
