# GoodWatch benchmarks

## What this is

Use k6 to compare server response times and capacity before and after a change. Use Lighthouse to compare mobile page performance. The scripts use Bash, Docker, and Node.js without local npm dependencies. They send only GET requests in the load test.

## Prerequisites

- Install Node.js 20 or later, Bash, SSH, scp, and Git on the development machine.
- Give the generator access to Docker. The default generator is worker3 at `10.0.0.32`, with four cores.
- Use a separate serving host. The default resolve address is abio at `10.0.0.21`.
- Set `BENCH_SSH_JUMP` in your environment or local config when a jump host is required. Leave it empty for direct SSH. Do not commit its value.
- Use Docker locally for `lighthouse --where local`. The generator needs no Node, Chrome, or k6 installation.
- Allow image pulls and the Lighthouse image build to download dependencies. k6 uses `grafana/k6:1.8.1`. Lighthouse uses version `13.5.0`.

The SSH commands use batch mode and a 15-second connection timeout. Remote scripts run through `bash -s`, so fish can remain your interactive shell. The generator's host file limit can remain 1024. The k6 container uses host networking and `--ulimit nofile=65535:65535`.

## Quick start

From this directory:

```sh
cp config.env.example config.env
# Edit config.env. Uncomment only the settings you need.
./bench.sh load --mode smoke --rate 5 --duration 10 --label initial
```

This command contacts the generator and target. Review the target and SSH settings first. A smoke run checks the tooling. It is not a performance baseline.

To check the scripts without SSH or target traffic:

```sh
bash scripts/selftest.sh
```

With a working local Docker daemon, run `bash scripts/test-local.sh`. It starts a Node HTTP stub bound to loopback, runs the pinned k6 image at 5 req/s for 10 seconds in each cache mode, checks headers, and checks exit code 99 against a failing route. It does not use SSH or contact the app. Docker may pull the pinned image if it is missing.

`config.env` uses Bash assignment syntax. The entry point sources it and exports its settings. Run `./bench.sh` directly from fish. Do not source the config in fish. Results and the config are ignored by Git. Review any sample before publishing it: results can include user paths, hostnames, logs, and private infrastructure details.

## Commands

### Load tests

```sh
./bench.sh load --mode smoke --cache warm --urls hot --rate 5 --duration 10 --label before
./bench.sh load --mode ramp --start 10 --step 10 --max 100 --step-duration 60 --cache warm --urls hot --label before --yes-ramp-production
```

| Option | Default | Purpose |
| --- | --- | --- |
| `--mode smoke\|ramp` | `smoke` | Select one plateau or a capacity ramp. |
| `--cache warm\|cold` | `warm` | Select request cookies and prewarming. |
| `--urls hot\|surfaces\|longtail\|<path.json>` | `hot` | Select the workload. |
| `--label <text>` | `run` | Add a label, sanitized to lowercase letters, digits, and hyphens. |
| `--rate N` | `5` | Smoke requests per second. |
| `--duration S` | `10` | Smoke duration in seconds. |
| `--start N --step N --max N` | `5`, `5`, `5` | Ramp start, increment, and maximum rate. Set these explicitly for a ramp. |
| `--step-duration S` | `10` | Seconds per plateau. |
| `--rates N,N,...` | None | An explicit, increasing plateau list for a ramp, such as `2,4,6,10,15`. It replaces `--start`, `--step`, and `--max`. |
| `--routes ROUTE[:CLIENT],...` | None | Keep only these entries of the URL set, such as `home` or `title_movie:browser`. Use it to ramp one surface at a time. |
| `--path private\|public` | `private` | Select the network path. |
| `--raw` | Off | Save compressed k6 JSON time series for deeper analysis. |
| `--yes-ramp-production` | Off | Required for every ramp. |

`RAMP_SECONDS` sets the transition length, default 5 seconds. Transitions belong to the following step. The printed request budget includes the linear transitions. There is one open-model arrival-rate scenario. One iteration sends one request. No redirects are followed. The script assigns labels such as `s01` and `s02` from elapsed scenario time.

Set `PRE_VUS` and `MAX_VUS` to override the default allocation of `max(20, RATE_MAX)` and `max(50, RATE_MAX * 4)`. Insufficient VUs cause dropped iterations rather than a slower closed-model workload.

### Lighthouse

```sh
./bench.sh lighthouse --label before
./bench.sh lighthouse --where local --runs 3 --path public --urls lighthouse/urls.txt
```

| Option | Default | Purpose |
| --- | --- | --- |
| `--urls <file>` | `lighthouse/urls.txt` | Read lines containing a label and URL. Blank lines and comments are ignored. |
| `--runs N` | `3` | Repeat each URL. |
| `--where generator\|local` | `generator` | Choose the Docker host. |
| `--label <text>` | `run` | Name the run. |
| `--path public\|private` | `public` | Use normal DNS or a Chrome resolver rule. |

The image builds on the chosen host if missing. It includes Chromium, fonts, and Lighthouse. Each run uses Lighthouse's default mobile emulation and simulated throttling. No desktop preset is used. The container gets 1 GiB of shared memory. Extra Chrome flags come from `LH_EXTRA_CHROME_FLAGS`. Private mode derives each hostname from its URL and maps it to the resolve address. TLS verification stays enabled.

Lighthouse runs on the generator by default. That host is idle, has a fixed size, and sits in a data center, so two runs days apart see the same CPU and network. A laptop doesn't give that. Never run Lighthouse during a load test: the lock on the generator prevents it.

Lighthouse drives a real browser, so the page's own script runs. After each page view, the page posts to `/api/og-image-warm`, which starts a render on the server. The runner blocks that request with `LH_BLOCKED_URL_PATTERNS` (default `*/api/og-image-warm*`, patterns separated by spaces). Analytics requests are not blocked, because they are part of the page's real cost. Each Lighthouse run therefore shows up as a page view in analytics.

The image tag ends with a hash of `lighthouse/Dockerfile` and `lighthouse/run.sh`. A change to either file builds a new image. Remove old `gw-bench-lighthouse` images on the generator by hand.

Failed individual runs are logged. Other runs continue. The container exits nonzero only when all runs fail. The report uses successful runs and computes a separate median for each metric. Performance scores range from 0 to 100. Fractional median request counts are possible with an even number of runs.

### Long-tail URL generation

```sh
./bench.sh longtail
./bench.sh longtail --sitemaps ../goodwatch-webapp/public/sitemaps --limit 300 --seed before-after --og-share 0.1
```

The builder reads `sitemap_*.xml` URL sets from the checked-in sitemap directory. It skips sitemap indexes, deduplicates paths, strips origins, and shuffles with a deterministic seed. It does not fetch sitemaps. `--limit` caps browser entries before adding OG entries. `--og-share` adds `floor(title_count * share)` bot OG entries, so `0.1` means one additional OG request per ten selected title URLs. It defaults to `0.1`; use `0` to disable it. `--seed` defaults to `1`. `--out` defaults to the ignored `urls/longtail.json`.

Every entry has weight 1. Movie and show pages use `title_movie` and `title_show`. Home uses `home`, discover uses `discover`, and other sitemap paths use `other`. The current source contains 1,000 titles and produces 1,196 entries with the defaults.

### Doctor

```sh
./bench.sh doctor --path private
```

Doctor checks SSH, Docker, images, file limits, free disk, and the generator lock. It sends exactly one GET for the target's `/` from the generator, using curl without following redirects. Curl must be available there. It expects status 200. Doctor reports findings and changes nothing. An existing lock can mean an active run or a stale lock. Inspect the host before removing it.

### Summarize and compare

```sh
./bench.sh summarize <run-id-or-directory>
./bench.sh compare <before-run> <after-run>
./bench.sh compare <before-run> <after-run> --out results/comparison.md --json
```

Compare summarizes a directory if `summary.json` is missing. It prints Markdown, or structured JSON with `--json`. `--out` writes Markdown in either mode. Tables show A, B, B minus A, and percentage change relative to A. A zero baseline has no percentage delta. Missing metrics show `n/a`. Warnings identify different URL sets, cache modes, network paths, or rate plans. Normal comparisons exit zero, including regressions and incompatible runs. Missing files fail. Other input errors are printed as diagnostics.

## URL sets

`hot.json` models one viral movie page, with about 10% link-preview bot traffic. Optional share-list entries are part of this mix. `surfaces.json` uses equal entry weights across HTML, OG images, the redirecting search page, and GET search APIs. `longtail.json` spreads requests across sitemap titles.

Each entry contains `route`, `path`, `weight`, `client`, and optional `expect` (default `[200]`). Weights are relative. Use a stable route label rather than a title key. Browser and bot clients share route labels and have separate `client` tags. Browser requests use a Chrome on Android User-Agent. Bot requests use the recognized `facebookexternalhit/1.1` token, without the external URL normally included in that User-Agent, to keep committed configuration free of other hostnames. Bots send no cookies or Accept-Language. Response cookies are not retained.

`/search?q=heist` expects 301. The script treats an unexpected status or transport error as a failure. It never follows a redirect. Person URLs with a query string require the `gw_browser=1` cookie.

To include your share list, set `SHARE_LIST_PATH` to its page path and `SHARE_LIST_OG_PATH` to the `og:image` path from its HTML. Store these only in `config.env`. Do not commit a user's list URL. Missing placeholders are dropped with a warning. Remaining weights still apply. Share-list pages are private and do not use a shared HTTP cache. Add your list to the ignored copy of a Lighthouse URL file when testing it with Lighthouse.

## Cache modes

Warm mode sends the same `COOKIE` (default `gw_browser=1`) and `ACCEPT_LANGUAGE` on every browser request. An explicitly empty cookie disables that header. Before measurement, setup fetches each distinct path and client pair once, capped by `PREWARM_MAX` (200). Setup requests carry `phase:prewarm` and do not appear in reported request, error, route, or step metrics.

Cold mode skips prewarming. Browser requests get a unique cookie from `COOKIE_TEMPLATE`, replacing `{id}` once per request with a run-and-iteration identifier. Accept-Language rotates through `ACCEPT_LANGUAGES`, separated by `|`. These headers defeat caches keyed by `Vary: Cookie` and `Accept-Language`.

`CACHE_BUST_QUERY=1` also adds a unique `_cb` query parameter to cold requests, including bots and OG images. It never adds this parameter to person pages without `gw_browser=1`. Cookie variation does not affect bot requests. Query variation does not make Redis data caches cold.

Today, no shared page cache sits in front of the app. Both modes reach the app. The meaningful cache difference today is the state of app data caches, including warming from the setup pass. Redis caches use title or person keys, not cookies or query strings. Cold header variation becomes meaningful at the HTTP layer when a shared page cache exists. For a true cold-data-cache workload, use the long-tail set with `SEQUENTIAL=1` and titles that are not already cached. This visits each entry once per pass; later passes can be warm. The tooling does not flush Redis. OG variants can also reuse data from a title already visited.

## Private and public paths

The private path resolves `goodwatch.app` to `10.0.0.21` in k6's `hosts` option. Requests go through Traefik and TLS on the serving host over the private network. The hostname still matches the certificate. TLS verification stays on.

Private mode does not exercise public DNS, the public network interface, the provider's edge or firewall, a future CDN, or real-world client latency. Public mode uses normal DNS and the public serving path, including any future CDN. It includes latency from the generator's location rather than the distribution of real client locations. The generator's uplink can limit the measured rate. Lighthouse defaults to public mode so lab results include the public serving path.

## Results

Run IDs use `<UTC yyyymmddTHHMMSSZ>-<kind>-<label>`.

```text
results/<run-id>/
  meta.json
  urls.json                 # Resolved load workload
  k6.log
  k6-summary.json
  k6-raw.json.gz            # With --raw
  host-metrics/*.jsonl
  host-metrics/*.log
  webapp/before.txt         # With BENCH_WEBAPP_PROBE=1
  webapp/after.txt
  webapp/samples.jsonl
  lighthouse/<label>/run-*.json
  lighthouse.log
  summary.json
  summary.md
```

Only relevant files exist for a given run. Metadata records the Git commit and dirty flag, target, path, cache mode, URL set, rate plan, timestamps, and k6 exit code. Cookies and share-list values are redacted from effective inputs. The jump destination is never stored; only `jump: true|false` is recorded. Non-private generator and metric addresses are redacted in metadata. Explicit target URL and resolve overrides are retained as supplied. Keep results private unless reviewed.

### Summary schema

`summary.json` uses schema version 1. Top-level fields are `schema`, `run_id`, `kind`, `label`, `meta`, `load`, `hosts`, and `lighthouse`. Unavailable measurements use `null`; missing counters use zero.

- `load` holds abort status and reason, duration in seconds, request count and rate, error fraction, latency and TTFB in milliseconds, dropped iterations, `routes`, and `steps`. Steps include their target rate. Step req/s divides requests by the planned step length, including transitions. For the step in which a run aborts, it divides by the time the step ran. Route status buckets are `2xx`, `3xx`, `4xx`, `5xx`, and `0` for transport failures.
- `hosts` is keyed by hostname. Each host includes its role, sample count, averages and maxima, and container metrics. Samples are trimmed to the run timestamps when both timestamps exist. Network rates use decimal Mbps. Container memory uses MiB despite the stable `mem_mb` field name.
- `webapp` exists only with the webapp probe. It holds the window length, the deployed commit, a restart flag, request rates (`total_rps`, `benchmark_rps`, `background_rps`, `crawler_loop_rps`), `routes`, `caches`, `qdrant`, `thread_cpu_pct`, `main_thread_by_time`, `proxy_cpu_pct`, `proxy_accepts_per_s`, `in_flight`, and `loop_delay_ms`.
- `lighthouse` is keyed by URL label. Each entry includes the URL, successful run count, per-metric `median`, and `all_runs`. Bytes by resource type come from `resource-summary` or fall back to `network-requests`.

`response_bytes_avg` uses Content-Length when present. It is not total transferred bytes. Chunked responses without Content-Length are skipped. Error fractions and status buckets are distinct: an expected 301 is successful and still counts as 3xx.

## Host metrics

Each sampler emits a header and JSON Lines with CPU busy, iowait, steal, load average, total and available memory, network receive and transmit rates, established TCP connections, and core count. It reads Linux `/proc` files. Network sums exclude loopback, veth, Docker, and bridge interfaces.

`BENCH_METRIC_HOSTS` uses `host:role[:prefix+prefix]`, separated by commas. The default target prefixes are `coolify-proxy` and `gk4owk8`. Add data hosts with role `data`, for example `10.0.0.22:data`. The generator is added automatically. Docker is optional for the sampler. Container CPU and memory come from one background `docker stats` call, filtered by prefix. The next sample includes the latest completed result so Docker's roughly two-second sampling time does not stretch the host interval.

Samplers start one second apart, so that a jump host doesn't reset connections that open at the same moment. They start at least ten seconds before k6, run for at most the planned duration plus 30 seconds, and stop after k6 exits. Long prewarming can consume that allowance. Use Grafana Cloud as a cross-check for CPU, Redis, databases, network saturation, and any gaps in the sampler output. Aggregate host metrics include setup time because run timestamps bracket the k6 invocation.

### Webapp probe

Set `BENCH_WEBAPP_PROBE=1` to read the webapp's own numbers for the same window as the load. `scripts/webapp-probe.sh` runs on the serving host over SSH and changes nothing there. It needs `docker`, `nsenter`, and `curl` on that host.

- Before and after k6, it saves the webapp's `/metrics` text from port `9464` and Qdrant's request counters. It reaches Qdrant with the webapp container's own settings, and never prints the key.
- During the run, it samples CPU time per thread name of the webapp process, CPU time of the proxy, the connections the proxy accepted, the requests in flight, and the event loop delay.

The summary gets a `webapp` section and a "Webapp process" table:

- Requests per second in total, from the benchmark, and from background traffic (everything the webapp finished minus what k6 sent). The crawler loop is `/person/:personKey` redirects plus `/browser-check`.
- Response time per route pattern from the webapp's histograms. These are estimates between bucket edges, and they exclude the proxy, TLS, and the network.
- Data cache lookups, hits, and misses per cache name, and Qdrant calls with their average time per endpoint.
- CPU of the main thread, the libuv and V8 worker threads, and the proxy, in percent of one core.

The event loop delay gauge restarts on every scrape. The probe scrapes every `BENCH_METRIC_INTERVAL` seconds, so Grafana's own samples of that gauge cover shorter windows during a run.

## Automatic stop rules

Each step has an aborting error-rate threshold (default less than 2%) and p95 latency threshold (default less than 3,000 ms). `ABORT_DELAY` defaults to 10 seconds. k6 evaluates thresholds periodically; it cannot stop on the exact failing request. Delay is relative to test start, not a fresh delay for each step. Step metrics prevent earlier healthy plateaus from diluting a later overloaded plateau.

Dropped iterations use a global threshold because k6 does not attach custom step tags to its dropped-iteration counter. The default limit is 5% of the maximum-rate plateau's planned iterations, rounded up. `ABORT_DROPPED` overrides it. This is a whole-run count, not a per-step percentage.

Latency here is k6's `http_req_duration`: the time until the last byte of the response. HTML pages stream, so this is longer than the time to first byte, which the summaries list as TTFB. On October 3, 2026 (UTC), production crossed the 3,000 ms limit at 3 requests per second with the `hot` set. To record a baseline at low rates anyway, raise `ABORT_P95_MS` for that run and note it. The value is stored in `meta.json`.

k6 exit code 99 marks an abort or threshold failure. The summary lists failed thresholds. The launcher retrieves available results and exits nonzero. A short smoke run can reach its end before a threshold evaluation aborts it. Missing samples are not evidence of success.

## Safety limits

Smoke mode allows one plateau, at most 20 req/s and 120 seconds. Larger tests require ramp mode. Every ramp requires `--yes-ramp-production`, prints its full plan, and waits ten seconds. Set `BENCH_NO_COUNTDOWN=1` only when an intentional automated run needs to skip the wait. Rates above 500 req/s also require `BENCH_ALLOW_ABOVE_500=1`.

The launcher refuses a generator address equal to the resolve address. Use the private serving address in this setting even for public tests so the check remains effective. A directory lock prevents load and Lighthouse runs from overlapping on the generator. Local Lighthouse runs do not acquire that lock. Ctrl-C stops the named container and samplers and releases the lock. A killed client or lost connection can leave a stale lock; inspect the named container before clearing it.

## Known limitations

- Load traffic is GET only. It excludes `POST /api/combined-search`, which can trigger paid model calls or guest quota writes, and `POST /api/og-image-warm`, which triggers rendering.
- k6 does not fetch browser subresources. Static assets and client API calls after hydration are not modeled. Explicit search GET entries cover only those requested API endpoints.
- Lighthouse is lab data, not field data. Its browser loads page subresources and can execute normal page code. GET-only load guarantees apply to k6, not browser-side application behavior in Lighthouse.
- Docker stats are coarse and can lag a host sample. Container CPU can exceed 100% across multiple cores.
- Per-route summary percentiles cover the whole measured run. A per-step route breakdown requires `--raw`. Summary percentiles cannot be averaged into new percentiles.
- Rate denominators in k6's raw summary can include setup overhead. Step rates use the planned step length, or the elapsed time for an aborted step. Compare equivalent plans and cache modes.
- These scripts do not provision infrastructure, clear data caches, or model authenticated sessions. They do not install monitoring services.

## Leave no trace

Normal cleanup removes each remote run directory and its lock. Docker images and an empty work directory remain on the generator. Set `BENCH_KEEP_REMOTE=1` to retain a run for diagnosis. Retained runs include the environment file, which can contain cookies. Local results remain until you remove them.

## Production baseline

`results/baseline-2026-10-04/` holds the summaries of the baseline runs from October 4, 2026. [`docs/benchmarks/viral-spike-baseline.md`](../docs/benchmarks/viral-spike-baseline.md) explains them and lists the command for each run.

## Sample smoke run

**Smoke numbers. Not a baseline.** These runs prove that the tooling works. They are short, slow, and ran while the serving host carried other traffic.

`results/samples/` holds three reviewed runs from October 3, 2026 (23:16 to 23:22 UTC) and one comparison:

- `20261003T231620Z-load-smoke-hot-warm-2rps`: the `hot` set, warm, 2 requests per second for 60 seconds, private path.
- `20261003T231802Z-load-smoke-hot-cold-2rps`: the same in cold mode.
- `20261003T231955Z-lighthouse-smoke-a`: Lighthouse for the home page and one movie page, three runs each, public path.
- `compare-warm-vs-cold.md`: the output of `./bench.sh compare` for the two load runs.

Each sample directory holds `meta.json`, `summary.json`, and `summary.md`. The raw k6 summary, the logs, the host metric samples, and the Lighthouse reports stay out of Git.

The following table shows the warm run by route.

| Route | Requests | p50 ms | p95 ms | p99 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- |
| `title_movie` | 76 | 278 | 1,009 | 1,501 | 220 |
| `title_show` | 5 | 466 | 1,408 | 1,472 | 206 |
| `discover` | 13 | 178 | 473 | 491 | 302 |
| `person` | 10 | 157 | 260 | 265 | 67 |
| `home` | 8 | 71 | 282 | 338 | 124 |
| `og_title` | 6 | 24 | 103 | 119 | 77 |

All 119 requests succeeded. The serving host averaged 33% CPU on eight cores, and the generator averaged 7% on four.
