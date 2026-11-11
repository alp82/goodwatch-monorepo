// Builds the three stack artifacts, each cached on a content hash of its inputs so a warm `up` skips them:
//  - API bundle (goodwatch-webapp/build/yepwatch-e2e/api.mjs) from e2e/stack/api-entry.ts + webapp sources
//  - gateway bundle (yepwatch-realtime/dist/main.js) via the gateway's own `npm run build` recipe
//  - web export (e2e/.cache/web-<hash>) via expo export with loopback origins, plus invite.html
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { API_BUNDLE_DIR, APP_DIR, CACHE_DIR, E2E_DIR, GATEWAY_BUNDLE, ORIGINS, REALTIME_DIR, WEBAPP_DIR } from './config.mjs';
import { cleanEnv } from './safe-env.mjs';

fs.mkdirSync(CACHE_DIR, { recursive: true });

function hashTree(roots, filter = () => true) {
  const h = createHash('sha256');
  const walk = (p) => {
    const st = fs.statSync(p, { throwIfNoEntry: false });
    if (!st) return;
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(p).sort()) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        walk(path.join(p, name));
      }
    } else if (filter(p)) {
      h.update(p);
      h.update(fs.readFileSync(p));
    }
  };
  for (const r of roots) walk(r);
  return h.digest('hex').slice(0, 16);
}
const stamp = (name) => path.join(CACHE_DIR, `${name}.hash`);
const fresh = (name, hash, output) => fs.existsSync(output) && fs.readFileSync(stamp(name), { encoding: 'utf8', flag: 'a+' }) === hash;

export async function buildApi(log) {
  const hash = hashTree([
    path.join(WEBAPP_DIR, 'app/server'),
    path.join(WEBAPP_DIR, 'app/utils'),
    path.join(WEBAPP_DIR, 'packages/yepwatch-contracts'),
    path.join(E2E_DIR, 'stack/api-entry.ts'),
    path.join(E2E_DIR, 'stack/fixture-titles.mjs'),
    path.join(E2E_DIR, 'stack/build.mjs'),
  ], (p) => /\.(ts|tsx|mjs|js|json)$/.test(p));
  const out = path.join(API_BUNDLE_DIR, 'api.mjs');
  if (fresh('api', hash, out)) return { built: false, out };
  log('building API bundle');
  const require = createRequire(path.join(WEBAPP_DIR, 'package.json'));
  const { build } = require('esbuild');
  await build({
    absWorkingDir: WEBAPP_DIR,
    // link-card.mjs beside the bundle draws invite preview cards (as in build-release.mjs).
    entryPoints: { api: path.join(E2E_DIR, 'stack/api-entry.ts'), 'link-card': path.join(WEBAPP_DIR, 'app/server/yepwatch/link-card.child.ts') },
    outdir: API_BUNDLE_DIR,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    packages: 'external',
    platform: 'node',
    target: 'node24',
    format: 'esm',
    alias: { '~': path.join(WEBAPP_DIR, 'app') },
    tsconfig: path.join(WEBAPP_DIR, 'tsconfig.json'),
    logLevel: 'error',
    banner: { js: 'import { createRequire as __e2eRequire } from "node:module"; const require = __e2eRequire(import.meta.url);' },
  });
  fs.mkdirSync(path.join(API_BUNDLE_DIR, 'fonts'), { recursive: true });
  for (const f of ['Gabarito-Bold.ttf', 'OFL-Gabarito.txt']) fs.copyFileSync(path.join(WEBAPP_DIR, 'app/server/og-image/fonts', f), path.join(API_BUNDLE_DIR, 'fonts', f));
  fs.writeFileSync(stamp('api'), hash);
  return { built: true, out };
}

export function buildGateway(log) {
  const hash = hashTree([path.join(REALTIME_DIR, 'src'), path.join(WEBAPP_DIR, 'packages/yepwatch-contracts'), path.join(E2E_DIR, 'stack/gateway-entry.ts')]);
  if (fresh('gateway', hash, GATEWAY_BUNDLE)) return { built: false, out: GATEWAY_BUNDLE };
  log('building gateway bundle');
  // Same recipe as the gateway's own `npm run build`, from the E2E entry (gateway-entry.ts).
  const r = spawnSync('npx', ['esbuild', path.join(E2E_DIR, 'stack/gateway-entry.ts'), '--bundle', '--platform=node', '--format=esm', '--target=node24',
    '--external:ws', '--external:ioredis', '--external:zod', `--outfile=${GATEWAY_BUNDLE}`, '--log-level=error'],
  { cwd: REALTIME_DIR, stdio: 'inherit', env: cleanEnv({}, { node: false }) });
  if (r.status !== 0) throw new Error('gateway build failed');
  fs.writeFileSync(stamp('gateway'), hash);
  return { built: true, out: GATEWAY_BUNDLE };
}

export const WEB_ENV = {
  // 'development' keeps app.json as-is; release variants insist on the yepwatch.com origins. The export is still a
  // production (minified, __DEV__=false) bundle.
  APP_VARIANT: 'development',
  EXPO_NO_DOTENV: '1',
  EXPO_NO_TELEMETRY: '1',
  CI: '1',
  EXPO_PUBLIC_API_ORIGIN: ORIGINS.front,
  EXPO_PUBLIC_APP_ORIGIN: ORIGINS.front,
  EXPO_PUBLIC_WS_ORIGIN: ORIGINS.ws,
  EXPO_PUBLIC_ENABLE_FIXTURES: 'false',
  EXPO_PUBLIC_GUEST_ONLY: 'false',
};

export function buildWeb(log) {
  const hash = hashTree([
    path.join(APP_DIR, 'src'), path.join(APP_DIR, 'assets'), path.join(APP_DIR, 'public'), path.join(APP_DIR, 'app.config.ts'),
    path.join(APP_DIR, 'app.json'), path.join(APP_DIR, 'metro.config.js'), path.join(APP_DIR, 'metro'), path.join(APP_DIR, 'package-lock.json'), path.join(APP_DIR, 'scripts/invite-page.cjs'),
    path.join(WEBAPP_DIR, 'packages/yepwatch-contracts'),
  ]) + createHash('sha256').update(JSON.stringify(WEB_ENV)).digest('hex').slice(0, 6);
  const out = path.join(CACHE_DIR, `web-${hash}`);
  if (fs.existsSync(path.join(out, 'invite.html'))) return { built: false, out };
  log('exporting web app (expo export, ~1-2 min on a cold cache)');
  const buildNumber = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'eas.json'), 'utf8')).build.base.env.APP_BUILD_NUMBER;
  const env = cleanEnv({ ...WEB_ENV, APP_BUILD_NUMBER: buildNumber, NODE_ENV: 'production' }, { node: false });
  const tmp = `${out}.tmp`;
  fs.rmSync(tmp, { recursive: true, force: true });
  const r = spawnSync(process.execPath, [path.join(APP_DIR, 'node_modules/expo/bin/cli'), 'export', '--platform', 'web', '--output-dir', tmp, '--source-maps'],
    { cwd: APP_DIR, stdio: ['ignore', 'inherit', 'inherit'], env });
  if (r.status !== 0) throw new Error('expo export failed');
  const i = spawnSync(process.execPath, [path.join(APP_DIR, 'scripts/invite-page.cjs'), tmp], { stdio: 'ignore' });
  if (i.status !== 0) throw new Error('invite-page failed');
  fs.renameSync(tmp, out);
  // Keep the two newest exports.
  const old = fs.readdirSync(CACHE_DIR).filter((n) => /^web-[0-9a-f]+$/.test(n)).map((n) => path.join(CACHE_DIR, n))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(2);
  for (const dir of old) fs.rmSync(dir, { recursive: true, force: true });
  return { built: true, out };
}
