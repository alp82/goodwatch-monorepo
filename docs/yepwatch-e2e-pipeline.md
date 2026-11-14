# YepWatch E2E pipeline

How YepWatch changes reach production: a deploy gate on every push, a Coolify deploy driven by CI, a
production smoke after every deploy and OTA (and every 6 hours), and a pre-OTA gate run by hand.

| Tier | Where | Command | Target | Blocks |
|---|---|---|---|---|
| Deploy gate | GitHub Actions: push to main (web), nightly / by hand / native changes (Android) | `.github/workflows/yepwatch-gate.yml` | < 5 min | the Coolify deploy |
| Production smoke | GitHub Actions | `.github/workflows/yepwatch-smoke.yml` | < 90 s | nothing (opens an issue) |
| Pre-OTA gate | your machine (+ EAS for iOS) | `node yepwatch-app/e2e/ci/ota-gate.mjs [--ios]` | ~20 min (+ iOS in parallel) | the OTA publish |

## What gates, and how hard (owner 2026-11-14)

"We don't aim for enterprise level QA here, just enough to be confident that everything does not break." Everything
CI runs fits free GitHub-hosted runners; there is no self-hosted runner.

- **Web (CI and production smoke)**: the journey finishes; console, request, WebSocket and schema errors; flash /
  one-frame wrong screen; blocking and connection words (no blocking "Reconnecting…"); axe WCAG 2.2 AA and 48 px
  targets. **Android on CI**: the journey finishes; logcat errors plus the browser friend's console and page errors;
  blocking words; labels and 48 dp targets. No flash check there (it needs the screen recording, which the
  software-rendered emulator can't afford); the video-based flash and timing checks stay in the pre-OTA gate.
- **Speed: ceilings gate, targets are reported.** All numbers live in `yepwatch-app/e2e/budgets.mjs`. The old tight
  budgets (`local`, `production`) are targets: every summary shows each moment's p95 against them, none fails on them.
  Gates are coarse `ceilings`: hermetic runs (local stack, CI) 3x each local target (Create room 900 ms, Start → first
  card 600 ms, vote → other phone 300 ms, …); the production smoke only Create room 1.5 s, invitation 3 s, vote →
  other phone 1 s, Start → first card 1.5 s, judged on the run's own samples.
- **Frame pacing is no gate anywhere.** It needs a real GPU and an idle CPU. After an animation change, measure it on
  demand: `node run.mjs frames [-- --grep voting]` in `yepwatch-app/e2e` (web, one test at a time, no frame over
  20 ms while something animates), `node e2e/native/run.mjs gate` on a GPU-backed emulator for Android
  (`gfxinfo`), plus the diagnosis switches in `e2e/README.md`.
- **No retries.** A remaining gate that flakes is a bug: fix the cause, don't loosen it silently.

## Deploy gate (`yepwatch-gate.yml`)

Triggered by a push to main touching `yepwatch-app/**`, `yepwatch-realtime/**`, the webapp's YepWatch server
code and contracts, or shared webapp server code the API bundle compiles in; also nightly (Android only) and by
hand (`gh workflow run yepwatch-gate.yml [-f android=false]`). No `pull_request` trigger, so fork code never runs
here. Jobs:

- **checks**: app typecheck, lint, unit tests; gateway build + tests (all four in parallel). ~1 min.
- **web-gate 1..3**: `node run.mjs ci -- --shard=N/3`, two Playwright workers per shard. The `ci` tier is every web
  journey once on the clean stack (no fault projects, no deploy/restart phase, timings x1): create, invite, join,
  vote, match, propose, Tonight, rooms, relaunch, small screens, members, the recorder's self-tests. Each shard
  brings the hermetic stack up itself (Crate, Valkey and Caddy in Docker; API and gateway bundles; web export with
  a cached Metro transform cache). Traces (actions + console), network logs and screenshots are kept for failed
  tests only. **web-gate-verdict** merges the shard reports (`e2e/ci/merge-reports.mjs`), recomputes timing p95
  over all samples against the ceilings, and fails when a shard didn't report. The fault projects (no WebSocket,
  rapid taps, slow network, hidden tab, second device, restarts) stay in the local `gate` / `full` tiers.
- **android-gate**: nightly, on `workflow_dispatch`, and on pushes whose files touch the APK's native inputs
  (job **android-changes**: one compare API call against `native/lib/build.mjs` `nativeKey()`'s files plus the
  Android harness). One emulator (KVM, SwiftShader), `node e2e/ci/native-gate.mjs --mode=journey`: the cold start
  to the start page, then one mixed room: the Android app phone creates the room, a browser phone (Playwright
  Chromium) joins through the invitation link, the phone starts, and both vote until there is a match. No video
  and no timing gate (step times on the host clock are reported). Gates: journey, errors (logcat plus the
  browser's console and page errors), blocking words, a11y (labels and 48 dp targets). The video-timed `subset`,
  the two-phone `gate` and the `full` Android run stay in the pre-OTA gate (`ota-gate.mjs`) on real hardware.

  The background step `native-gate.mjs --prepare=…` brings the stack up and builds the APK (cached base + JS
  repack) right after node_modules are restored, while the emulator, system image and AVD caches download.
- **deploy** (needs checks and the web verdict to pass, and the Android journey to pass or be skipped): `e2e/ci/coolify-deploy.mjs` runs `POST /api/v1/deploy?uuid=…&force=false`.
  On the installed Coolify 4.5.3, `GET /deploy` only answers "use POST". The script then polls
  `GET /api/v1/deployments/<uuid>` until the status is `finished`, `failed` or `cancelled-by-user`. It waits
  30 s for the compose container swap, then waits until `https://yepwatch.com/api/yepwatch/v1/proposal/health/ready`
  returns 200. Coolify always deploys the HEAD of main. If a newer commit on main touches YepWatch paths, this
  run stands down and that commit's own gate run deploys it.
- **smoke** (after a successful deploy): calls `yepwatch-smoke.yml`.

The deploy job runs only when the repository variable `YEPWATCH_DEPLOY_VIA_CI` is `true`. Until then the gate
reports and the Coolify webhook keeps deploying.

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

Gates: the journey, errors, flash, blocking and connection words (a deploy during the run must not show a blocking
"Reconnecting…"), and the production ceilings in `e2e/budgets.mjs`: Create room 1.5 s, invitation in a fresh
browser 3 s, vote to other phone 1 s, Start to first card 1.5 s. Every other moment (tap feedback, New room, next
card, …) and the tight targets (`production`: Create room 500 ms, invitation 1.2 s, vote 250 ms, Start 400 ms) are
reported only, as are the member's `unthrottled_*` numbers. No frame gate: a busy runner can't fail it. A readiness probe
held past 1 s during a deploy is reported, not failed (a 5xx fails); the people's screens decide. A run costs 1 room, 2 admissions and about 40 commands,
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

There is no shared cap on active rooms (removed 2026-11-12). Each person, an account or a guest
installation/browser, may have 10 rooms they created active at a time (`YEPWATCH_PROPOSAL_ROOMS_PER_PERSON`,
`proposal-creation-quota.ts`); a room holds its creator's slot for its whole 6 h life, and archiving or
leaving does not free it. The smoke host is a fresh guest browser, so each run uses its own allowance and
never competes with real users. The shared limit left is the rate window: 20 room creations or joins a
minute across all users.

No code in the repository computes room statistics. The release control counts reservations, and
`operator.mjs inventory` counts all rows. If you count rooms elsewhere, exclude names starting with `e2e smoke `.


### Running it

```sh
cd yepwatch-app/e2e
# dry run against the local stack (fake GoodWatch signs a throwaway member in):
node stack/up.mjs && node run.mjs smoke --origin http://127.0.0.1:18480
# production, by hand (once, after review):
E2E_SMOKE_MEMBER_EMAIL=… E2E_SMOKE_MEMBER_PASSWORD=… node run.mjs smoke --origin https://yepwatch.com
# or, with neither variable set, from ~/.config/yepwatch/smoke-member.json ({"email": "…", "password": "…"}):
node run.mjs smoke --origin https://yepwatch.com
```

The smoke member is never traced. When a member step fails, the failure names the requests it hung on (origin and
path only, no query): `network: document GET https://yepwatch.com/api/…/member/callback open 30.0 s …`.

A run that overlaps a YepWatch deploy fails: Coolify removes the old containers before it starts new ones, so
yepwatch.com answers nothing for a few seconds. Check `application_deployment_queues` before calling a failure flaky.

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
