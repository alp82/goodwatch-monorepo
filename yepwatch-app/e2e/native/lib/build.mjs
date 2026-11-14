// Release-like APK (JS embedded as Hermes bytecode, no dev menu) pointed at a local stack.
//
// Two cache levels:
//  - native key: native inputs (lockfile, app.json/config, plugins, assets, images under src). A change
//    means expo prebuild + Gradle assembleRelease in a staging copy (minutes).
//  - js key: src/ + origins. A change with the same native key only re-bundles: expo export:embed,
//    hermesc, swap assets/index.android.bundle in the cached APK, zipalign + apksigner with the
//    staging debug key (~20-40 s).
// EXPO_PUBLIC_* origins are inlined into the bundle, so pointing the APK at another stack is a JS rebuild.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { APP_DIR, HOME, NATIVE_DIR, SDK, log, mkdirp, run, runLogged, toolEnv, tools } from './env.mjs';

export const PACKAGE = 'dev.yepwatch.e2e';
const BUILD_ROOT = path.join(HOME, 'build', crypto.createHash('sha1').update(APP_DIR).digest('hex').slice(0, 10));
const STAGE = path.join(BUILD_ROOT, 'app');
const APK_CACHE = path.join(HOME, 'apk');

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, filter, out); else if (filter(p)) out.push(p);
  }
  return out;
}
function hashFiles(files, extra = '') {
  const h = crypto.createHash('sha256');
  for (const f of files) { h.update(path.relative(APP_DIR, f)); h.update(fs.readFileSync(f)); }
  h.update(extra);
  return h.digest('hex').slice(0, 16);
}
const CODE = /\.(tsx?|jsx?|cjs|mjs|json)$/;
export function nativeKey() {
  const files = [
    ...['package.json', 'package-lock.json', 'app.json', 'app.config.ts'].map(f => path.join(APP_DIR, f)),
    ...walk(path.join(NATIVE_DIR, 'build'), () => true),
    ...walk(path.join(APP_DIR, 'plugins'), () => true),
    ...walk(path.join(APP_DIR, 'assets'), () => true),
    // Images/fonts/sounds required from JS become Android resources: a change there needs Gradle.
    ...walk(path.join(APP_DIR, 'src'), p => !CODE.test(p)),
  ];
  return hashFiles(files.filter(f => fs.existsSync(f)));
}
export function jsKey(origins) {
  return hashFiles(walk(path.join(APP_DIR, 'src'), p => CODE.test(p)), JSON.stringify(publicEnv(origins)) + nativeKey());
}

/** The only build-time configuration the bundle sees. Loopback only, by construction. */
export function publicEnv({ api, ws, app }) {
  for (const o of [api, ws, app]) {
    const u = new URL(o);
    if (!['127.0.0.1', 'localhost'].includes(u.hostname)) throw new Error(`Refusing non-loopback origin for the E2E build: ${o}`);
  }
  return { EXPO_PUBLIC_API_ORIGIN: api, EXPO_PUBLIC_WS_ORIGIN: ws, EXPO_PUBLIC_APP_ORIGIN: app, EXPO_PUBLIC_ENABLE_FIXTURES: 'false', EXPO_PUBLIC_GUEST_ONLY: 'false' };
}

function buildEnv(origins) {
  // Explicit allowlist: no inherited secrets or production origins reach Metro/Gradle.
  return toolEnv({ ...publicEnv(origins), NODE_ENV: 'production', APP_VARIANT: 'development', EXPO_NO_TELEMETRY: '1', CI: '1',
    GRADLE_USER_HOME: path.join(HOME, 'gradle'), CMAKE_BUILD_PARALLEL_LEVEL: '8', EXPO_NO_DOTENV: '1' });
}

function syncStage() {
  mkdirp(STAGE);
  // Source tree without heavy/generated dirs; node_modules is a reflink copy, refreshed when the lockfile moves.
  run('rsync', ['-a', '--delete', '--exclude=/node_modules', '--exclude=/android', '--exclude=/ios', '--exclude=/.expo', '--exclude=/artifacts',
    '--exclude=/dist*', '--exclude=/e2e', '--exclude=/e2e-plugins', '--exclude=/test-results', '--exclude=/store', '--exclude=/.env*', `${APP_DIR}/`, `${STAGE}/`]);
  fs.copyFileSync(path.join(NATIVE_DIR, 'build/app.config.e2e.ts'), path.join(STAGE, 'app.config.ts'));
  mkdirp(path.join(STAGE, 'e2e-plugins'));
  fs.copyFileSync(path.join(NATIVE_DIR, 'build/with-loopback-cleartext.cjs'), path.join(STAGE, 'e2e-plugins/with-loopback-cleartext.cjs'));
  const lock = fs.readFileSync(path.join(APP_DIR, 'package-lock.json'));
  const stamp = path.join(BUILD_ROOT, 'node_modules.lock');
  if (!fs.existsSync(stamp) || !fs.readFileSync(stamp).equals(lock) || !fs.existsSync(path.join(STAGE, 'node_modules'))) {
    fs.rmSync(path.join(STAGE, 'node_modules'), { recursive: true, force: true });
    run('cp', ['-a', '--reflink=auto', path.join(APP_DIR, 'node_modules'), path.join(STAGE, 'node_modules')]);
    fs.writeFileSync(stamp, lock);
  }
}

async function gradleBuild(origins, logFile) {
  const env = buildEnv(origins);
  log('native: expo prebuild (android)');
  let code = await runLogged(path.join(STAGE, 'node_modules/.bin/expo'), ['prebuild', '--platform', 'android', '--no-install', '--clean'], { cwd: STAGE, env, log: logFile });
  if (code) throw new Error(`expo prebuild failed (${code}); see ${logFile}`);
  const manifest = fs.readFileSync(path.join(STAGE, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  // Safety: the E2E APK must never look for OTA updates.
  if (/EXPO_UPDATE_URL|u\.expo\.dev/.test(manifest)) throw new Error('E2E manifest has an OTA update URL; refusing to build');
  log('native: gradle assembleRelease (x86_64)');
  code = await runLogged(path.join(STAGE, 'android/gradlew'), [':app:assembleRelease', '--console=plain', '-PreactNativeArchitectures=x86_64',
    '--build-cache', '-Dorg.gradle.jvmargs=-Xmx6g',
    // CI builds while the emulator and the stack run on a 16 GB runner: a Gradle daemon (6 GB heap) and a Kotlin
    // daemon left alive after the build, plus the journey's Chromium, filled swap until the emulator was killed.
    ...(process.env.CI ? ['--no-daemon', '-Pkotlin.compiler.execution.strategy=in-process'] : [])], { cwd: path.join(STAGE, 'android'), env, log: logFile });
  if (code) throw new Error(`gradle failed (${code}); see ${logFile}`);
  const out = ['outputs/apk/release', 'intermediates/apk/release'].map(d => path.join(STAGE, 'android/app/build', d, 'app-release.apk')).find(f => fs.existsSync(f));
  if (!out) throw new Error('gradle finished without app-release.apk');
  return out;
}

/**
 * The key base.apk was signed with, kept next to it in the shared APK cache. The staging copy is per
 * worktree, so when another worktree built base.apk this one has no android/ dir. Older cache entries
 * lack the file: prebuild copies android/app/debug.keystore verbatim from expo's template, so the same
 * key comes out of that tarball.
 */
function signingKey(cacheDir) {
  const kept = path.join(cacheDir, 'debug.keystore');
  if (fs.existsSync(kept)) return kept;
  const staged = path.join(STAGE, 'android/app/debug.keystore');
  if (fs.existsSync(staged)) fs.copyFileSync(staged, kept);
  else fs.writeFileSync(kept, execFileSync('tar', ['-xzf', path.join(STAGE, 'node_modules/expo/template.tgz'), '-O', 'package/android/app/debug.keystore'], { maxBuffer: 1 << 20 }));
  return kept;
}

/** Rebundle JS into an existing APK. */
async function repackJs(baseApk, outApk, origins, logFile) {
  // Metro's transform cache lives under TMPDIR. One directory per build-time env: EXPO_PUBLIC_* values are
  // inlined during the transform, so a cache only ever serves bundles for the origins that filled it. CI keeps
  // it between runs (yepwatch-gate.yml), which turns a JS-only repack into an incremental bundle.
  const metroTmp = mkdirp(path.join(HOME, 'metro', crypto.createHash('sha1').update(JSON.stringify(publicEnv(origins))).digest('hex').slice(0, 10)));
  const env = { ...buildEnv(origins), TMPDIR: metroTmp };
  const work = mkdirp(path.join(BUILD_ROOT, 'repack'));
  fs.rmSync(work, { recursive: true, force: true }); mkdirp(path.join(work, 'assets'));
  const js = path.join(work, 'index.android.bundle.js');
  log('js: expo export:embed');
  let code = await runLogged(path.join(STAGE, 'node_modules/.bin/expo'), ['export:embed', '--platform', 'android', '--dev', 'false', '--minify', 'true',
    '--entry-file', 'node_modules/expo-router/entry.js', '--bundle-output', js, '--assets-dest', path.join(work, 'res')], { cwd: STAGE, env, log: logFile });
  if (code) throw new Error(`export:embed failed (${code}); see ${logFile}`);
  const hermesc = path.join(STAGE, 'node_modules/hermes-compiler/hermesc/linux64-bin/hermesc');
  code = await runLogged(hermesc, ['-emit-binary', '-O', '-max-diagnostic-width=80', '-out', path.join(work, 'assets/index.android.bundle'), js], { cwd: work, env, log: logFile });
  if (code) throw new Error(`hermesc failed (${code})`);
  const unsigned = path.join(work, 'unsigned.apk');
  fs.copyFileSync(baseApk, unsigned);
  run('zip', ['-q', '-d', unsigned, 'META-INF/*'], {}); // drop old signature files if present (v1)
  run('zip', ['-q', '-0', unsigned, 'assets/index.android.bundle'], { cwd: work });
  const bt = tools.buildTools();
  const aligned = path.join(work, 'aligned.apk');
  run(path.join(bt, 'zipalign'), ['-f', '-p', '4', unsigned, aligned]);
  run(path.join(bt, 'apksigner'), ['sign', '--ks', signingKey(path.dirname(baseApk)), '--ks-pass', 'pass:android', '--key-pass', 'pass:android',
    '--ks-key-alias', 'androiddebugkey', '--out', outApk, aligned]);
}

/**
 * Returns the path of an APK for these origins, building only what changed.
 * origins = { api, ws, app } (loopback). Writes build timings to the returned info.
 */
export async function ensureApk(origins, { force = false } = {}) {
  const started = Date.now();
  const nk = nativeKey(); const jk = jsKey(origins);
  const dir = mkdirp(path.join(APK_CACHE, nk));
  const base = path.join(dir, 'base.apk'); const baseMeta = path.join(dir, 'base.json');
  const final = path.join(dir, `app-${jk}.apk`);
  const logFile = path.join(mkdirp(path.join(HOME, 'logs')), `build-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
  const info = { nativeKey: nk, jsKey: jk, apk: final, log: logFile, gradle: false, repack: false };
  if (fs.existsSync(final) && !force) { info.ms = Date.now() - started; return info; }
  syncStage();
  if (!fs.existsSync(base) || force) {
    const apk = await gradleBuild(origins, logFile);
    fs.copyFileSync(apk, base);
    fs.copyFileSync(path.join(STAGE, 'android/app/debug.keystore'), path.join(dir, 'debug.keystore'));
    fs.writeFileSync(baseMeta, JSON.stringify({ jsKey: jk, builtAt: new Date().toISOString() }));
    info.gradle = true;
  }
  const meta = JSON.parse(fs.readFileSync(baseMeta, 'utf8'));
  if (meta.jsKey === jk) fs.copyFileSync(base, final);
  else { await repackJs(base, final, origins, logFile); info.repack = true; }
  for (const f of fs.readdirSync(dir)) if (f.startsWith('app-') && f !== path.basename(final)) fs.rmSync(path.join(dir, f), { force: true });
  info.ms = Date.now() - started;
  return info;
}

export { SDK };
