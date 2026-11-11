// Tool paths and process helpers for the Android E2E harness. Nothing here edits the user's shell config:
// SDK, JDK and Maestro locations are resolved per process.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NATIVE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP_DIR = path.resolve(NATIVE_DIR, '../..');
export const REPO_DIR = path.resolve(APP_DIR, '..');
/** Shared across worktrees: AVD, Maestro, JDK, Gradle cache, APK cache. CI points it at its own cache dir. */
export const HOME = process.env.YW_E2E_HOME ?? path.join(os.homedir(), '.cache/yepwatch-e2e-native');
export const RUNS_DIR = process.env.YW_E2E_RUNS ?? path.join(NATIVE_DIR, '.cache/runs');
export const SDK = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? path.join(os.homedir(), 'Android/Sdk');

function firstExisting(...candidates) { return candidates.find(c => c && fs.existsSync(c)); }

export const tools = {
  adb: path.join(SDK, 'platform-tools/adb'),
  emulator: path.join(SDK, 'emulator/emulator'),
  avdmanager: firstExisting(path.join(SDK, 'cmdline-tools/latest/bin/avdmanager')),
  buildTools: () => {
    const dir = path.join(SDK, 'build-tools');
    const v = fs.readdirSync(dir).filter(n => /^\d/.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
    return path.join(dir, v);
  },
  java: () => firstExisting(process.env.YW_E2E_JAVA_HOME, path.join(HOME, 'tools/jdk-21'), process.env.JAVA_HOME),
  maestro: () => firstExisting(process.env.YW_E2E_MAESTRO, path.join(HOME, 'tools/maestro/bin/maestro'), path.join(os.homedir(), '.maestro/bin/maestro')),
};

/** Environment for SDK tools and Maestro. Starts from the caller's env minus anything secret-looking. */
export function toolEnv(extra = {}) {
  const javaHome = tools.java();
  const keep = ['HOME', 'USER', 'LANG', 'TERM', 'TMPDIR', 'XDG_RUNTIME_DIR', 'DISPLAY', 'SHELL'];
  const env = Object.fromEntries(keep.filter(k => process.env[k]).map(k => [k, process.env[k]]));
  env.PATH = [javaHome && path.join(javaHome, 'bin'), path.join(SDK, 'platform-tools'), path.join(SDK, 'emulator'), path.dirname(process.execPath), '/usr/local/bin', '/usr/bin', '/bin'].filter(Boolean).join(':');
  env.ANDROID_HOME = SDK; env.ANDROID_SDK_ROOT = SDK;
  env.ANDROID_AVD_HOME = path.join(HOME, 'avd');
  env.ADB_LOCAL_TRANSPORT_MAX_PORT = '5553'; // see device.ensureAdbServer
  if (javaHome) env.JAVA_HOME = javaHome;
  // Maestro phones home for analytics unless told not to; the harness keeps it quiet.
  env.MAESTRO_CLI_NO_ANALYTICS = '1'; env.MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true'; env.MAESTRO_DISABLE_UPDATE_CHECK = 'true';
  return { ...env, ...extra };
}

export function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, ...opts, env: toolEnv(opts.env) });
}

/** Streams output to a log file; resolves with the exit code. */
export function runLogged(cmd, args, { log, cwd, env, timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const out = log ? fs.openSync(log, 'a') : 'ignore';
    const child = spawn(cmd, args, { cwd, env: env ?? toolEnv(), stdio: ['ignore', out, out] });
    const timer = timeoutMs ? setTimeout(() => child.kill('SIGTERM'), timeoutMs) : null;
    child.on('error', reject);
    child.on('exit', code => { if (timer) clearTimeout(timer); resolve(code ?? 1); });
  });
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const now = () => performance.now();
export function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); return p; }
export function log(...a) { console.log(new Date().toISOString().slice(11, 23), ...a); }
