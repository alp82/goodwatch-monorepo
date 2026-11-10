# Frozen-page Core Web Vitals fixture

The preview builds the application's production client configuration and renders its real routes with frozen
anonymous loader payloads. It serves TLS and HTTP/2, the application's 103 hints, compressed assets and real
hydration. The production server entry is replaced before bundling. Each route's live loader, action and headers
are stripped with Remix's own export-removal transform; selected loaders read only the frozen payloads. A fixture
build fails if its safe entry or any frozen loader was not installed.

The preview never loads `.env`. Its server clears the environment and denies outbound TCP and `fetch` **before**
importing the server bundle. It accepts GET/HEAD only, serves frozen public API responses locally and never starts the real
webapp or its background jobs. Captured root data must be anonymous; the preview replaces public Supabase settings
with `fixture.invalid` and clears the Faststats key. Browser resource checks additionally block writes and all
external hosts except TMDB image GETs (the hydration smoke also allows TVDB artwork GETs). Lighthouse must block external telemetry domains, as shown below.

This measures anonymous first views and controlled interactions. It does not validate member data, mutations,
live search interpretation or API results. Fixture route export flags describe the stripped fixture handlers;
normal production route configuration and client chunking rules are retained. The minimal renderer uses
`renderToString`; the live entry's streaming, page cache and infrastructure are outside this comparison.

Start from the task repository root. Define these paths once in the shell used for setup:

```bash
cwv_repo="$PWD"
cwv_data="$cwv_repo/goodwatch-benchmark/results/home-cwv-2026-11-10/fixture"
cwv_baseline="$cwv_data/baseline-source/goodwatch-webapp"
cwv_candidate="$cwv_repo/goodwatch-webapp"
mkdir -p "$cwv_data"
```

Capture once, then keep exactly the same payload file for baseline and candidate:

```bash
node "$cwv_repo/goodwatch-benchmark/cwv/capture-fixtures.mjs" "$cwv_data"
node "$cwv_repo/goodwatch-benchmark/cwv/capture-api-fixtures.mjs" "$cwv_data"
git fetch origin main
mkdir -p "$cwv_data/baseline-source"
git archive origin/main goodwatch-webapp | tar -x -C "$cwv_data/baseline-source"
cd "$cwv_baseline"
npm ci --ignore-scripts --no-audit --no-fund
node node_modules/patch-package/index.js
```

The 2026-11-10 run captured six public pages once, before either build, in `loader-data.json`. Do not run the capture
again between builds. Ignored HTML files retain the original anonymous responses; `capture.json` records page
paths and route IDs. The original run also records the frozen payload's SHA-256 and baseline commit there.

The API capture has an explicit six-request allowlist: US streaming providers, award marks, and the two measured
titles' character portraits and trope teasers. It sends no credentials or auth/member requests and refuses to
recapture an existing snapshot before sending requests. `api-responses.json` is shared by both builds;
`api-capture.json` records its SHA-256. API response schemas are checked at server startup. An unexpected API
request receives 404, while the local anonymous `/api/auth/get-session` contract returns `null` without contacting
production. Every write receives 405.

Prepare and compile the baseline:

```bash
cd "$cwv_repo"
node goodwatch-benchmark/cwv/prepare-build.mjs \
  "$cwv_baseline" "$cwv_data/baseline-build" "$cwv_data/loader-data.json"
cd "$cwv_baseline"
env -i PATH="$PATH" NODE_ENV=production SENTRY_DISABLE_AUTO_UPLOAD=true CHOKIDAR_USEPOLLING=1 \
  node node_modules/@remix-run/dev/dist/cli.js vite:build --config build/cwv-fixture-config/vite.config.mjs
```

Prepare and compile the candidate with the same installed dependencies and patches. The candidate's `node_modules`
can be a symlink to the baseline archive's dependency directory; preserve any pre-existing local installation:

```bash
cd "$cwv_repo"
node goodwatch-benchmark/cwv/prepare-build.mjs \
  "$cwv_candidate" "$cwv_data/candidate-build" "$cwv_data/loader-data.json"
cd "$cwv_candidate"
env -i PATH="$PATH" NODE_ENV=production SENTRY_DISABLE_AUTO_UPLOAD=true CHOKIDAR_USEPOLLING=1 \
  node node_modules/@remix-run/dev/dist/cli.js vite:build --config build/cwv-fixture-config/vite.config.mjs
```

The generated configuration lives under ignored `goodwatch-webapp/build/`. It uses an empty environment
directory, disables build telemetry and keeps the actual Vite client configuration. Every configuration
substitution requires exactly one match. Neither build executes the application's production server bootstrap.

Create a local certificate once:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$cwv_data/key.pem" -out "$cwv_data/cert.pem" \
  -days 2 -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1
```

Start the fixtures in separate terminals, with the same path variables defined:

```bash
env -i PATH="$PATH" NODE_ENV=production node "$cwv_repo/goodwatch-benchmark/cwv/serve-fixture.mjs" \
  "$cwv_data/baseline-build" "$cwv_baseline" "$cwv_data/loader-data.json" \
  3411 "$cwv_data/key.pem" "$cwv_data/cert.pem"

env -i PATH="$PATH" NODE_ENV=production node "$cwv_repo/goodwatch-benchmark/cwv/serve-fixture.mjs" \
  "$cwv_data/candidate-build" "$cwv_candidate" "$cwv_data/loader-data.json" \
  3412 "$cwv_data/key.pem" "$cwv_data/cert.pem"
```

For a static hostname check, start another candidate fixture on `3414`, then one on `3413` with
`CWV_ASSET_BASE=https://127.0.0.1:3414` in its scrubbed startup environment. The separate asset origin serves the
same build and CORS headers.

Run resource selection checks without overlapping a build or another browser measurement:

```bash
cd "$cwv_repo"
mkdir -p "$cwv_data/resources"
docker run --rm --network host --shm-size=1g \
  -v "$cwv_repo/goodwatch-benchmark/cwv:/cwv:ro" -v "$cwv_data/resources:/out" \
  --entrypoint node gw-bench-lighthouse:13.5.0-6dd25f05 /cwv/check-room-resources.mjs
```

Add `-e CWV_ORIGIN=https://127.0.0.1:3413 -e CWV_OUTPUT=/out/room-resources-cdn.json` to check the separate asset
origin. The seven viewports cover desktop density/resolution, upright phones and sideways phones. A pass requires
one room request, one visible painting, one matching preload, a `link` Resource Timing initiator and no page errors.
The JSON records priority, preload mode and transfer sizes. Both 2026-11-10 sets passed all seven viewports.

Before interpreting a budget, run the six-surface hydration smoke against both origins:

```bash
cd "$cwv_repo"
docker run --rm --network host --shm-size=1g \
  -v "$cwv_repo/goodwatch-benchmark/cwv:/cwv:ro" -v "$cwv_data/resources:/out" \
  --entrypoint node gw-bench-lighthouse:13.5.0-6dd25f05 /cwv/hydration-smoke.mjs
```

It checks HTTP 200, an attached React hydration marker, each route's real heading, Discover's result cards,
absence of ErrorBoundary output, client exceptions, console TypeErrors and failed API responses. The corrected
2026-11-10 fixture passed all twelve pages, including forty Discover cards on each build. A previous fixture
returned `{}` instead of a provider array and replaced Discover with its 500 boundary; those Discover budget
results are invalid and must not be compared as a production regression.

Run the existing six-surface budget serially for ports `3411` and `3412`, keeping every cap. The `public` path
option preserves the selected loopback target instead of the benchmark's private production routing:

```bash
cd "$cwv_repo/goodwatch-benchmark"
BENCH_TARGET_URL=https://127.0.0.1:3412 BENCH_RESOLVE_IP=127.0.0.1 BENCH_INSECURE_TLS=1 \
LH_EXTRA_CHROME_FLAGS=--ignore-certificate-errors \
LH_BLOCKED_URL_PATTERNS='*/api/og-image-warm* */api/auth/* *a.goodwatch.app* *posthog.com* *sentry.io* *supabase.co* *fixture.invalid* *faststats* *google-analytics.com* *googletagmanager.com*' \
  ./bench.sh budget --where local --path public --runs 3 --label cwv-candidate
```

The localhost server rejects every write. TMDB images may be fetched read-only. Keep identical browser, CPU cap,
network profile and frozen payloads for both builds, and report pre-existing budget failures separately from
changes. The [interaction and limited-connection runner](README.md) uses these fixture origins; it does not start
the application server. Local results are not field Core Web Vitals.

Run the fixture safety checks from the repository root:

```bash
node --test goodwatch-benchmark/cwv/fixture-safety.test.mjs goodwatch-benchmark/cwv/fixture-api.test.mjs
```

## Using an idle benchmark generator

When the development host is busy, keep SSR/assets on the isolated local fixtures and move only Chromium to the
same otherwise idle four-CPU generator for both variants. Record the generator's CPU/load, Docker image ID and
actual Chromium version; the same image tag can refer to a different cached browser build on another machine.
CPU emulation is relative to that generator. The controlled 2026-11-10 run used an explicit mobile multiplier of
1.8 there; do not compare it directly with a run at 6 on the development host.

Open loopback-only reverse forwards in a task-owned SSH control session:

```bash
cwv_generator=root@10.0.0.32
cwv_ssh=/tmp/gw-cwv-home-20261110.sock
ssh -M -S "$cwv_ssh" -fNT -o ExitOnForwardFailure=yes \
  -R 127.0.0.1:43411:127.0.0.1:3411 -R 127.0.0.1:43412:127.0.0.1:3412 "$cwv_generator"
```

The generator reaches the baseline at `https://127.0.0.1:43411` and candidate at `https://127.0.0.1:43412`.
Copy the current `run.mjs` and any explicitly derived probe helpers/CSS into a task-owned directory under remote
`/tmp`. Mount it read-only at `/cwv` and mount a separate output directory at `/out`. Prepare a Docker environment
file containing `CWV_CONFIG_JSON` on one line, with `baseUrl`, `runs`, `mobileCpu`, `scenarios`, `trace`, `variant`
and `out`; this bypasses the host launcher and runs the same request guard inside the existing browser image.
For example, `scenarios` can select `mobile-fresh-early` and `mobile-fresh-settled`, with `out` set to `/out`.

```bash
docker run --rm --init --network host --shm-size=1g --entrypoint node \
  --env-file /tmp/gw-home-cwv-20261110/config-candidate.env \
  -v /tmp/gw-home-cwv-20261110/runner:/cwv:ro -v /tmp/gw-home-cwv-20261110/out-candidate:/out \
  gw-bench-lighthouse:13.5.0-6dd25f05 /cwv/run.mjs --inside-container
```

Execute browser runs sequentially, with builds and other measurements stopped. Retrieve raw JSON, summaries,
configuration, screenshots and traces with `scp -o ControlPath="$cwv_ssh" -r "$cwv_generator:/tmp/gw-home-cwv-20261110/out-candidate" "$cwv_data/"`.
Verify copied artifacts before deleting only the task-owned remote `/tmp` directory. Close the control session
and its reverse forwards with `ssh -S "$cwv_ssh" -O exit "$cwv_generator"`. Stop the task's local fixture servers
when measurements are finished. Production compilation output is never a server to start or a module to import.
