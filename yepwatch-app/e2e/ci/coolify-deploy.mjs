#!/usr/bin/env node
// Deploys YepWatch through the Coolify v4 API once the gate passed, waits for it, then waits for the swap.
//
//   COOLIFY_TOKEN=… node e2e/ci/coolify-deploy.mjs --sha <commit> [--repo owner/name] [--dry-run]
//
// Coolify 4.5.x (checked against the installed version's routes/api.php and DeployController):
//   POST /api/v1/deploy?uuid=<app>&force=false   (GET /deploy only answers "use POST"; token needs `deploy`)
//     200 {"deployments":[{"message","resource_uuid","deployment_uuid"}]}   429 + Retry-After when throttled
//   GET  /api/v1/deployments/<deployment_uuid>    status: queued | in_progress | finished | failed | cancelled-by-user
//   GET  /api/v1/deployments/applications/<app>?skip=0&take=N   {"count","deployments":[…]}  (read ability)
//
// Coolify deploys the HEAD of the configured branch (main), not a given commit. So before deploying:
//   - if a newer commit on main touches YepWatch paths, this run stands down: that commit's own gate deploys it
//     (else an ungated commit would ship behind this gate's back);
//   - newer commits that touch nothing YepWatch builds from ship along (they can't change the images).
// After "finished": wait SWAP_WAIT_S (compose deploys stop the old containers before starting new ones), then
// poll the public readiness route until it answers 200.
//
// --dry-run makes READ-ONLY calls (application + last deployments) and prints what it would do.
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const DRY = args.includes('--dry-run');
const BASE = process.env.COOLIFY_URL ?? 'https://coolify.goodwatch.app';
const APP = process.env.COOLIFY_APP_UUID ?? 'csq2euofkojrcfzyxwrjxwym';
const TOKEN = process.env.COOLIFY_TOKEN;
const SHA = opt('--sha', process.env.GITHUB_SHA);
const REPO = opt('--repo', process.env.GITHUB_REPOSITORY ?? 'alp82/goodwatch-monorepo');
const READY_URL = process.env.YEPWATCH_READY_URL ?? 'https://yepwatch.com/api/yepwatch/v1/proposal/health/ready';
const SWAP_WAIT_S = Number(process.env.SWAP_WAIT_S ?? 30);
const DEPLOY_TIMEOUT_S = Number(process.env.DEPLOY_TIMEOUT_S ?? 900);
// Same list as the Coolify application's watch paths (GET /applications/<uuid> → watch_paths) and the gate's
// push filter. The compose file lives in yepwatch-app/, the API image builds from the webapp's YepWatch server
// code and contracts. Keep these three in sync.
const WATCH = [/^yepwatch-app\//, /^yepwatch-realtime\//, /^goodwatch-webapp\/app\/server\/yepwatch\//, /^goodwatch-webapp\/packages\/yepwatch-contracts\//];

const t0 = Date.now();
const log = (m) => console.log(`[deploy ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const out = (k, v) => { if (process.env.GITHUB_OUTPUT) execFileSync('sh', ['-c', `printf '%s=%s\\n' "$0" "$1" >> "$GITHUB_OUTPUT"`, k, String(v)]); };
if (!TOKEN) { console.error('COOLIFY_TOKEN is not set'); process.exit(2); }
if (!SHA) { console.error('--sha (or GITHUB_SHA) is required'); process.exit(2); }

async function api(method, path, { ok = [200] } = {}) {
  const r = await fetch(`${BASE}/api/v1${path}`, { method, headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!ok.includes(r.status)) throw Object.assign(new Error(`${method} ${path} → ${r.status} ${text.slice(0, 300)}`), { status: r.status, retryAfter: Number(r.headers.get('retry-after') ?? 0) });
  return body;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Newer commits on main after SHA that touch a watched path (via the GitHub API; gh is on every runner). */
function newerWatchedCommits() {
  let compare;
  try {
    compare = JSON.parse(execFileSync('gh', ['api', `repos/${REPO}/compare/${SHA}...main`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } catch (e) {
    throw new Error(`could not compare ${SHA}...main: ${String(e.stderr ?? e.message).slice(0, 300)}`);
  }
  if (compare.status === 'diverged' || compare.status === 'behind') throw new Error(`${SHA} is not an ancestor of main (${compare.status})`);
  const files = (compare.files ?? []).map((f) => f.filename);
  // The compare API lists at most 300 files; past that assume something watched changed.
  const watched = compare.files?.length >= 300 ? ['(over 300 files)'] : files.filter((f) => WATCH.some((re) => re.test(f)));
  return { ahead: compare.ahead_by ?? 0, watched };
}

const app = await api('GET', `/applications/${APP}`);
log(`application "${app.name}" ${app.status}, branch ${app.git_branch}, auto deploy ${app.settings?.is_auto_deploy_enabled ? 'ON (webhook still deploys every push)' : 'off'}`);
const recent = await api('GET', `/deployments/applications/${APP}?skip=0&take=3`);
for (const d of recent.deployments ?? []) log(`recent: ${d.deployment_uuid} ${d.status} ${String(d.commit).slice(0, 9)} webhook=${d.is_webhook} api=${d.is_api}`);

const { ahead, watched } = newerWatchedCommits();
if (watched.length) {
  log(`main is ${ahead} commit(s) ahead of ${SHA.slice(0, 9)} and they touch YepWatch (${watched.slice(0, 5).join(', ')}); their own gate run deploys. Standing down.`);
  out('deployed', 'false');
  process.exit(0);
}
if (ahead) log(`main is ${ahead} commit(s) ahead, none touch YepWatch paths: deploying main HEAD carries this commit's images`);

if (DRY) {
  log(`dry run: would POST /deploy?uuid=${APP}&force=false, poll the deployment, wait ${SWAP_WAIT_S} s, then poll ${READY_URL}`);
  out('deployed', 'false');
  process.exit(0);
}

let started;
for (let attempt = 1; ; attempt++) {
  try {
    started = await api('POST', `/deploy?uuid=${APP}&force=false`);
    break;
  } catch (e) {
    if (e.status === 429 && attempt < 4) { log(`throttled; retrying in ${e.retryAfter || 60} s`); await sleep((e.retryAfter || 60) * 1000); continue; }
    throw e;
  }
}
const entry = (started.deployments ?? []).find((d) => d.resource_uuid === APP) ?? started.deployments?.[0];
if (!entry?.deployment_uuid) throw new Error(`Coolify started no deployment: ${JSON.stringify(started).slice(0, 300)}`);
log(`deployment ${entry.deployment_uuid}: ${entry.message}`);
out('deployment_uuid', entry.deployment_uuid);
out('deployment_url', `${BASE}${recent.deployments?.[0]?.deployment_url?.replace(/\/deployment\/[^/]+$/, '') ?? ''}/deployment/${entry.deployment_uuid}`);

let d;
let last = '';
const end = Date.now() + DEPLOY_TIMEOUT_S * 1000;
for (;;) {
  d = await api('GET', `/deployments/${entry.deployment_uuid}`).catch((e) => ({ status: `poll error: ${e.message}` }));
  if (d.status !== last) { log(`status ${d.status}${d.commit ? ` (commit ${String(d.commit).slice(0, 9)})` : ''}`); last = d.status; }
  if (['finished', 'failed', 'cancelled-by-user'].includes(d.status)) break;
  if (Date.now() > end) throw new Error(`deployment still ${d.status} after ${DEPLOY_TIMEOUT_S} s`);
  await sleep(5000);
}
if (d.status !== 'finished') { log(`deployment ended ${d.status}; see Coolify for its log`); out('deployed', 'false'); process.exit(1); }
if (d.commit && !String(d.commit).startsWith(SHA) && !ahead) log(`note: Coolify built ${d.commit}, the gate checked ${SHA}`);

log(`finished; waiting ${SWAP_WAIT_S} s for the container swap`);
await sleep(SWAP_WAIT_S * 1000);
const readyEnd = Date.now() + 120000;
for (;;) {
  const r = await fetch(READY_URL, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (r?.ok) break;
  if (Date.now() > readyEnd) throw new Error(`${READY_URL} not ready 120 s after the deployment finished (last ${r?.status ?? 'no answer'})`);
  await sleep(3000);
}
log('YepWatch answers ready');
out('deployed', 'true');
out('commit', d.commit ?? SHA);
