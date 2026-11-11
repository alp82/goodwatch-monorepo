# YepWatch E2E pipeline

How YepWatch changes reach production: a deploy gate on every push, a Coolify deploy driven by CI, a
production smoke after every deploy and OTA (and every 6 hours), and a pre-OTA gate run by hand.

| Tier | Where | Command | Target | Blocks |
|---|---|---|---|---|
| Deploy gate | GitHub Actions, push to main | `.github/workflows/yepwatch-gate.yml` | < 4 min | the Coolify deploy |
| Production smoke | GitHub Actions | `.github/workflows/yepwatch-smoke.yml` | < 90 s | nothing (opens an issue) |
| Pre-OTA gate | your machine (+ EAS for iOS) | `node yepwatch-app/e2e/ci/ota-gate.mjs [--ios]` | ~20 min (+ iOS in parallel) | the OTA publish |

## Deploy gate (`yepwatch-gate.yml`)

Triggered by a push to main touching `yepwatch-app/**`, `yepwatch-realtime/**`, the webapp's YepWatch server
code and contracts, or shared webapp server code the API bundle compiles in. Jobs run in parallel:

- **checks**: app typecheck, lint, unit tests; gateway build + tests (all four in parallel).
- **web-gate 1..6**: `node run.mjs gate -- --shard=N/6` with one Playwright worker per shard. Each shard brings
  the hermetic stack up itself (Crate, Valkey and Caddy in Docker; API and gateway bundles; web export with a
  cached Metro transform cache). **web-gate-verdict** merges the shard reports (`e2e/ci/merge-reports.mjs`) and
  recomputes timing p95 over all samples. It fails when a shard didn't report.
- **android-gate**: `node e2e/ci/native-gate.mjs`. It brings the stack up, builds the APK and boots two
  emulators at the same time, then runs `e2e/native/run.mjs gate` unchanged. Cached: node_modules, the
  emulator and system image, Maestro, the AVD with its snapshot (keyed by CPU model and emulator build), and
  the Gradle-built base APK (keyed by the harness's native key). A JS-only change only repacks the bundle.
- **deploy** (needs all of the above): `e2e/ci/coolify-deploy.mjs` runs `POST /api/v1/deploy?uuid=…&force=false`.
  On the installed Coolify 4.5.3, `GET /deploy` only answers "use POST". The script then polls
  `GET /api/v1/deployments/<uuid>` until the status is `finished`, `failed` or `cancelled-by-user`. It waits
  30 s for the compose container swap, then waits until `https://yepwatch.com/api/yepwatch/v1/proposal/health/ready`
  returns 200. Coolify always deploys the HEAD of main. If a newer commit on main touches YepWatch paths, this
  run stands down and that commit's own gate run deploys it.
- **smoke** (after a successful deploy): calls `yepwatch-smoke.yml`.

The deploy job runs only when the repository variable `YEPWATCH_DEPLOY_VIA_CI` is `true`. Until then the gate
reports and the Coolify webhook keeps deploying.

### Frame pacing on CI

GitHub's runners have no GPU.

- **Web: frame pacing is enforced** (60 fps, no frame over 20 ms during interactions). Each shard runs one
  test at a time on an otherwise idle 4-vCPU machine.
- **Android: frame pacing is reported, not gating.** `NATIVE_FRAMES: report` in the workflow. The emulator
  renders with SwiftShader, so `gfxinfo` frame times measure the software renderer, not the app. The numbers
  still appear in the job summary and in `result.json`. The pre-OTA gate enforces them on a real GPU.

Both switches are workflow env values (`WEB_FRAMES`, `NATIVE_FRAMES`). A 4-core local simulation doubled the
web frame-gate failures compared with the same tests on free cores. If CI frame failures turn out to come from
the runner rather than the app, the remedy is a bigger runner, not a looser budget.

### Hermeticity

- The gate jobs reference no secrets.
- The stack binds to loopback. Its Node processes load `e2e/stack/block-egress.mjs`, which refuses any
  non-loopback socket. Its environment starts empty, plus an allowlist (`e2e/stack/safe-env.mjs`).
- The APK only knows loopback origins (checked at build time), and the emulator snapshot has networking off.
- Each gate job points the production hosts at `0.0.0.0` in `/etc/hosts` as a second fence.
- Secrets exist only in two GitHub environments: `yepwatch-production` (deploy job) and `yepwatch-smoke`
  (smoke job).

## Production smoke (`yepwatch-smoke.yml`, `e2e/smoke/smoke.spec.ts`)

One room per run, three browsers:

1. A guest host (fast-4G throttled: 9 Mbps, +60 ms RTT) taps New room and creates a room named
   `e2e smoke <ISO minute>`, then sets a name and Netflix.
2. A fresh guest browser (throttled) joins through the invitation link.
3. The signed-in test member (unthrottled) joins through the same link ("Join as …").
4. The host starts the round, and everyone votes Yep until there is a match.
5. The friend and the member leave the room, and the host archives it.

Budgets come from `e2e/budgets.mjs` `production`: tap feedback 50 ms, New room / Create room 500 ms, invitation
in a fresh browser 1.2 s, vote to other phone 250 ms, Start to first card 400 ms. The member's
`unthrottled_*` numbers are reported without gating. A run costs 1 room, 2 admissions and about 40 commands,
far under the production limits of 20 creates/joins a minute and 60 commands per person a minute.
Runs are serialized by the concurrency group `yepwatch-smoke`.

On failure, the run opens the issue **"YepWatch production smoke is failing"** (label `yepwatch-e2e`), or
reopens it. Each failure comments the failing gates, timings and a link to the run artifacts. The next pass
comments and closes the issue (`e2e/ci/smoke-issue.mjs`).

Triggers:

- after each CI deploy
- after each OTA: `gh workflow run yepwatch-smoke.yml -f reason="after OTA <message>"`
- by hand: the same command, or the Actions tab
- every 6 hours, only once the variable `YEPWATCH_SMOKE_SCHEDULE` is `true`

### Room capacity

Production allows `YEPWATCH_PROPOSAL_MAX_ACTIVE_ROOMS` = 20 active rooms. Each room reserves its slot for
its whole 6 h life (`proposal-release-control.ts`). Archiving or leaving does not free the slot. So every
smoke run occupies 1 of the 20 slots for 6 hours: with the schedule, deploys and OTAs, that is typically 2 to
5 slots.

No code in the repository computes room statistics. The release control counts reservations, and
`operator.mjs inventory` counts all rows. If you count rooms elsewhere, exclude names starting with `e2e smoke `.

Owner decision: either free a room's reservation when its last participant leaves or archives it (a server
change that also helps real users), or raise the cap by the smoke's worst case.

### Running it

```sh
cd yepwatch-app/e2e
# dry run against the local stack (fake GoodWatch signs a throwaway member in):
node stack/up.mjs && node run.mjs smoke --origin http://127.0.0.1:18480
# production, by hand (once, after review):
E2E_SMOKE_MEMBER_EMAIL=… E2E_SMOKE_MEMBER_PASSWORD=… node run.mjs smoke --origin https://yepwatch.com
```

## Pre-OTA gate (`e2e/ci/ota-gate.mjs`)

```sh
cd yepwatch-app
node e2e/ci/ota-gate.mjs --ios      # refuses on a dirty tree; web full + Android full locally, iOS on EAS meanwhile
node e2e/ci/ota-gate.mjs --check    # exit 0 only with a passing verdict for HEAD and a clean tree
npm run update:beta:ios -- …        # docs/ota-updates.md
npm run update:beta:android -- …
gh workflow run yepwatch-smoke.yml -f reason="after OTA <message>"
```

The gate runs the web full tier, then the Android full tier (`--no-android` skips it). It records its verdict
in `e2e/.cache/ota-gate.json`.

With `--ios`, it starts `e2e/native/ci/eas-maestro-ios.yml` through `eas workflow:run`, which uploads the clean
project directory. That workflow has two jobs:

1. A `type: build` job with the `e2e-ios-simulator` profile in `eas.json`. It builds a Release simulator app
   without credentials, with `APP_VARIANT=development` (no OTA URL) and loopback origins.
2. A `type: maestro` job on macOS. Its `before_maestro_tests` hook starts the native dev stack on loopback
   inside the same VM, then Maestro runs `e2e/ci/maestro-ios-journey.yaml`.

The gate polls `eas workflow:status <id> --wait --json` and accepts only `SUCCESS`.

The `update:beta:*` scripts are part of the Expo runtime fingerprint, so they stay unchanged. The OTA procedure
in `docs/ota-updates.md` should run the gate and `--check` before publishing.

## What the owner does once

1. **Coolify API token**: in Coolify, open Keys & Tokens → API tokens and create a token with `deploy` and
   `read`. In GitHub → Settings → Environments, create `yepwatch-production`. Restrict its deployment branch to
   `main` and add the secret `COOLIFY_YEPWATCH_TOKEN`.
2. **Test member**: create a dedicated GoodWatch account with email and password, for example a `+yepwatch-smoke`
   alias of your address, and verify its email. In a normal browser, open yepwatch.com, choose Continue with
   GoodWatch, sign in with that account and press **Allow YepWatch** once. Optionally give it a display name and
   Netflix. Then create the environment `yepwatch-smoke` with the secrets `YEPWATCH_SMOKE_MEMBER_EMAIL` and
   `YEPWATCH_SMOKE_MEMBER_PASSWORD`.
   - Why a password, not a stored token: GoodWatch rotates refresh tokens (30 s reuse window, 300 s access
     tokens). The YepWatch session cookie seals those tokens, so a stored cookie or refresh token dies at its
     first renewal, and a replayed refresh token can revoke the grant.
3. **First production smoke, supervised**: `gh workflow run yepwatch-smoke.yml -f reason="first run"`. When it
   passes, set the repository variable `YEPWATCH_SMOKE_SCHEDULE=true`.
4. **Switch deploys to CI**, both steps together:
   - In GitHub, set the repository variable `YEPWATCH_DEPLOY_VIA_CI=true`.
   - In Coolify (v4.5.3), open Projects → the YepWatch project → application **YepWatch Webapp** → **Advanced**.
     Under **Build & deploy → Deployment**, set **Auto deploy** to **Manual deployments only**.

   If you only do the first step, both the webhook and CI deploy every push. If you only do the second, nothing
   deploys.
