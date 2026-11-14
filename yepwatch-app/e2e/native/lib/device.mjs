// Emulator lifecycle: one dedicated AVD (yw-e2e) with a prepared snapshot, booted read-only so two
// instances can run side by side for two-phone rooms. Networking inside the emulator is switched off
// in the snapshot (wifi + mobile data): the app reaches the local stack only through `adb reverse`
// on loopback, so nothing the app does can reach a production host (no OTA check, no app-link
// fallback to a real browser page).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HOME, SDK, log, mkdirp, run, sleep, toolEnv, tools } from './env.mjs';
import { PACKAGE } from './build.mjs';

export const AVD = process.env.YW_E2E_AVD ?? 'yw-e2e';
export const SNAPSHOT = 'yw-base-v2';
/** The harness's own "this snapshot saved" marker inside the snapshot directory. */
export const SNAPSHOT_MARKER = 'yw-saved.json';
const IMAGE = 'system-images;android-35;google_apis;x86_64';
/** Console ports (serial emulator-<port>); even numbers in 5554..5682. Kept inside 5555-5585: Maestro (dadb) only treats emulators in that range as connected.
 * YW_E2E_EMU_PORTS (comma list, e.g. 5574,5576) lets a second harness run its own instances next to 5570/5572. */
export const PORTS = (process.env.YW_E2E_EMU_PORTS ?? '5570,5572').split(',').map(Number);
if (PORTS.some(p => !Number.isInteger(p) || p % 2 || p < 5556 || p > 5584)) throw new Error(`YW_E2E_EMU_PORTS: even ports in 5556-5584, got ${PORTS}`);
if (new Set(PORTS).size !== PORTS.length) throw new Error(`YW_E2E_EMU_PORTS: each port once, got ${PORTS}`);
const GPU = process.env.YW_E2E_GPU ?? 'host';

export const adb = (serial, ...args) => run(tools.adb, ['-s', serial, ...args], { timeout: 60000 });
export const shell = (serial, cmd) => adb(serial, 'shell', cmd);

export function devices() {
  return run(tools.adb, ['devices']).split('\n').slice(1).map(l => l.trim().split(/\s+/)).filter(p => p[1] === 'device').map(p => p[0]);
}

export function ensureAvd() {
  const dir = path.join(HOME, 'avd', `${AVD}.avd`);
  if (fs.existsSync(dir)) return;
  log('creating AVD', AVD);
  // avdmanager ignores ANDROID_AVD_HOME when that directory doesn't exist yet and silently writes the AVD to
  // ~/.android/avd instead (exit 0), which is what a fresh CI runner without the AVD cache hit.
  mkdirp(path.dirname(dir));
  run(tools.avdmanager, ['create', 'avd', '-n', AVD, '-k', IMAGE, '-d', 'pixel_8', '--force'], { input: 'no\n', stdio: ['pipe', 'pipe', 'pipe'] });
  const cfg = path.join(dir, 'config.ini');
  if (!fs.existsSync(cfg)) throw new Error(`avdmanager reported success but ${cfg} is missing`);
  const kv = { 'hw.keyboard': 'yes', 'hw.audioInput': 'no', 'hw.audioOutput': 'no', 'hw.camera.back': 'none', 'hw.camera.front': 'none',
    'hw.ramSize': '3072', 'disk.dataPartition.size': '4G', 'hw.cpu.ncore': '4', 'hw.gps': 'no' };
  let text = fs.readFileSync(cfg, 'utf8');
  for (const [k, v] of Object.entries(kv)) text = text.match(new RegExp(`^${k}=`, 'm')) ? text.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : `${text}${k}=${v}\n`;
  fs.writeFileSync(cfg, text);
}

function startEmulator(port, { readOnly, loadSnapshot }) {
  const logFile = path.join(mkdirp(path.join(HOME, 'logs')), `emulator-${port}.log`);
  const args = ['-avd', AVD, '-port', String(port), '-no-window', '-no-audio', '-no-boot-anim', '-gpu', GPU, '-accel', 'on', '-netfast',
    ...(readOnly ? ['-read-only'] : []), ...(loadSnapshot ? ['-snapshot', SNAPSHOT, '-no-snapshot-save'] : ['-no-snapshot-load'])];
  const child = spawn(tools.emulator, args, { env: toolEnv(), stdio: ['ignore', fs.openSync(logFile, 'w'), fs.openSync(logFile, 'a')], detached: true });
  child.unref();
  fs.writeFileSync(path.join(HOME, `emulator-${port}.pid`), String(child.pid));
  return { serial: `emulator-${port}`, pid: child.pid, logFile };
}

async function waitBoot(serial, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (shell(serial, 'getprop sys.boot_completed').trim() === '1') return; } catch { /* not attached yet */ }
    await sleep(250);
  }
  throw new Error(`${serial} did not boot in ${ms} ms`);
}

function snapshotExists() {
  return fs.existsSync(path.join(HOME, 'avd', `${AVD}.avd`, 'snapshots', SNAPSHOT));
}

/** One-time: cold boot, configure, save the snapshot every later boot loads (~90 s once). */
export async function ensureSnapshot() {
  ensureAvd();
  if (snapshotExists()) return;
  log('creating emulator snapshot', SNAPSHOT, '(one time)');
  const port = PORTS[0];
  const { serial } = startEmulator(port, { readOnly: false, loadSnapshot: false });
  await waitBoot(serial, 240000);
  await sleep(5000);
  for (const cmd of [
    'svc power stayon true', 'settings put system screen_off_timeout 2147483647', 'locksettings set-disabled true', 'wm dismiss-keyguard',
    'settings put secure show_ime_with_hard_keyboard 0', 'settings put global package_verifier_enable 0', 'settings put global verifier_verify_adb_installs 0',
    'settings put secure spell_checker_enabled 0', 'settings put global window_animation_scale 1', 'settings put global transition_animation_scale 1',
    'settings put global animator_duration_scale 1', 'settings put system show_touches 1', 'svc wifi disable', 'svc data disable', 'settings put global auto_time 0',
    // No first-run/notification prompts from the app layer.
    'settings put secure immersive_mode_confirmations confirmed', 'settings put global hidden_api_policy 1',
  ]) { try { shell(serial, cmd); } catch (e) { log('snapshot prep warn', cmd, e.message.split('\n')[0]); } }
  // Maestro's driver lives in the snapshot, so neither the harness nor `maestro test` installs it per boot.
  const { maestroApks } = await import('./phone.mjs');
  for (const apk of maestroApks()) adb(serial, 'install', '-r', '-g', apk);
  await sleep(2000);
  const saved = run(tools.adb, ['-s', serial, 'emu', 'avd', 'snapshot', 'save', SNAPSHOT], { timeout: 120000 });
  if (/^KO\b/m.test(saved)) throw new Error(`emulator refused to save snapshot ${SNAPSHOT}: ${saved.trim().slice(0, 200)}`);
  run(tools.adb, ['-s', serial, 'emu', 'kill']);
  for (let i = 0; i < 120 && devices().includes(serial); i++) await sleep(500);
  await sleep(1000);
  // Written only after the save came back without KO: CI caches the AVD only with this marker (yepwatch-gate.yml).
  fs.writeFileSync(path.join(HOME, 'avd', `${AVD}.avd`, 'snapshots', SNAPSHOT, SNAPSHOT_MARKER), JSON.stringify({ savedAt: new Date().toISOString() }));
}

/** Boot (or reuse) `count` emulators from the snapshot. Returns serials and boot timings. */
export async function boot(count = 1) {
  if (PORTS.length < count) throw new Error(`${count} emulators need ${count} ports, YW_E2E_EMU_PORTS has ${PORTS.length} (${PORTS})`);
  ensureAdbServer();
  await ensureSnapshot();
  const present = devices();
  const out = [];
  await Promise.all(PORTS.slice(0, count).map(async port => {
    const serial = `emulator-${port}`;
    const started = Date.now();
    if (!present.includes(serial)) { startEmulator(port, { readOnly: true, loadSnapshot: true }); await waitBoot(serial, 120000); }
    out.push({ serial, bootMs: Date.now() - started, reused: present.includes(serial) });
  }));
  return out.sort((a, b) => a.serial.localeCompare(b.serial));
}

export function shutdown(serials = PORTS.map(p => `emulator-${p}`)) {
  for (const s of serials) { try { run(tools.adb, ['-s', s, 'emu', 'kill']); } catch { /* not running */ } }
}

/** adb reverse for every stack port, so 127.0.0.1:<port> on the device is the host's loopback. */
export function reverse(serial, ports) {
  adb(serial, 'reverse', '--remove-all');
  for (const port of ports) adb(serial, 'reverse', `tcp:${port}`, `tcp:${port}`);
}

/** adb scans 5555-5585 for emulators; unrelated local services on those ports show up as offline
 * "emulator-55xx" ghosts, and Maestro (dadb) aborts its device listing on them. Restart the adb server
 * with scanning off (emulators register themselves) when ghosts are present. */
export function ensureAdbServer() {
  const list = run(tools.adb, ['devices']);
  if (!/emulator-\d+\s+offline/.test(list)) return;
  run(tools.adb, ['kill-server']);
  run(tools.adb, ['start-server'], { env: { ADB_LOCAL_TRANSPORT_MAX_PORT: '5553' } });
}

export function installed(serial) {
  return shell(serial, `pm list packages ${PACKAGE}`).includes(PACKAGE);
}

/** Installs the APK (if its hash differs from what's on the device) and selects it for invitation links. */
export function install(serial, apk) {
  const marker = `/data/local/tmp/yw-e2e-apk`;
  const want = path.basename(apk);
  let have = '';
  try { have = shell(serial, `cat ${marker} 2>/dev/null`).trim(); } catch { /* none */ }
  if (have !== want || !installed(serial)) {
    adb(serial, 'install', '-r', '-d', '-g', apk);
    shell(serial, `echo ${want} > ${marker}`);
  }
  // Unverifiable in the emulator (offline, local hosts): select the app for these hosts like a user would.
  for (const host of ['yepwatch.com', '127.0.0.1']) shell(serial, `pm set-app-links-user-selection --user 0 --package ${PACKAGE} true ${host}`);
}

/** Fresh app state (no rooms, no device account) without reinstalling. */
export function clearApp(serial) {
  shell(serial, `pm clear ${PACKAGE}`);
  for (const host of ['yepwatch.com', '127.0.0.1']) shell(serial, `pm set-app-links-user-selection --user 0 --package ${PACKAGE} true ${host}`);
}

export { SDK };
