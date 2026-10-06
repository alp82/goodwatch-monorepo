# GoodWatch benchmarks

## What this is

Use k6 to compare server response times and capacity before and after a change. Use Lighthouse to compare mobile page performance. Use the tap test to check that the controls of a title page answer a tap. The scripts use Bash, Docker, and Node.js without local npm dependencies. The load test sends only GET requests, with one exception: the page-view scenario replays a read that the home page sends with POST (see [Page views](#page-views)).

Every webapp deploy ends with `./bench.sh smoke`. It checks the new container's startup log and a fixed list of pages with edge cases. See [Smoke check after a deploy](#smoke-check-after-a-deploy).

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

With a working local Docker daemon, run `bash scripts/test-local.sh` and `bash scripts/test-page-view.sh`. The second one runs the page-view scenario against an HTTP/2 stub with TLS on loopback and checks that every visitor arrives on its own connection, that no TLS session is resumed, and which requests carry the cache identity header.

About the first one: It starts a Node HTTP stub bound to loopback, runs the pinned k6 image at 5 req/s for 10 seconds in each cache mode, checks headers, and checks exit code 99 against a failing route. It does not use SSH or contact the app. Docker may pull the pinned image if it is missing.

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
| `--scenario requests\|page-view` | `requests` | `requests`: one iteration sends one request. `page-view`: one iteration is one visitor with a whole page view. |
| `--connections new\|reuse` | `reuse`, and `new` for page views | `new`: every iteration opens its own connection with a full TLS handshake. |
| `--identity VALUE` | None, and `anon;US;en` for page views | The `GW-Cache-Identity` header for page requests. Several values separated by `\|` rotate. |
| `--page-assets FILE` | None | Reuse the `page-view-capture.json` of an earlier run of the same deploy instead of capturing again. |
| `--allow-above-500` | Off | Allow more than 500 requests per second. Same as `BENCH_ALLOW_ABOVE_500=1`. |

`RAMP_SECONDS` sets the transition length, default 5 seconds. Transitions belong to the following step. The printed request budget includes the linear transitions. There is one open-model arrival-rate scenario. One iteration sends one request. No redirects are followed. The script assigns labels such as `s01` and `s02` from elapsed scenario time.

Set `PRE_VUS` and `MAX_VUS` to override the default allocation of `max(20, RATE_MAX)` and `max(50, RATE_MAX * 4)`. Insufficient VUs cause dropped iterations rather than a slower closed-model workload.

### Page views

```sh
./bench.sh load --scenario page-view --mode smoke --rate 1 --duration 30 --urls hot --path public --label page-views
./bench.sh load --scenario page-view --mode ramp --rates 10,20,40,60,80,100 --step-duration 30 --urls hot --routes title_movie:browser \
  --path public --allow-above-500 --yes-ramp-production --label movie-page-views
./bench.sh load --scenario page-view --mode ramp --rates 25,50,100,200,300,400 --step-duration 30 --urls handshake \
  --path public --yes-ramp-production --label tls-handshakes
```

In this scenario the rates are **visitors per second**, and the summary reports page views per second. One iteration is one first-time visitor:

1. **A new connection.** With `--connections new` (the default here), k6 closes the visitor's connection after the iteration (`noVUConnectionReuse`). The next visitor does a full TLS handshake: k6 keeps no TLS session cache, so no session is resumed. All requests of one visitor share the connection over HTTP/2, as in a browser.
2. **The document,** with `GW-Cache-Identity: anon;US;en` (`--identity`), as a cache in front of the app would send it (see [`docs/cache-identity.md`](../docs/cache-identity.md)). The app then answers with the shared policy. Only page requests get the header: files, images, and API requests don't.
3. **Everything else the page loads from its own origin,** at once: scripts, styles, fonts, images, and API requests. A new visitor has an empty browser cache, so nothing is skipped.
4. **Requests on a second connection.** Chrome fetches the web app manifest without credentials, on its own connection with its own handshake. One k6 virtual user has one connection, so a second k6 scenario (`side`) sends those requests at the same rate, each on a new connection.

A `bot` entry and a `browser` entry with `"single": true` send their one request, on their own connection. `urls/handshake.json` is one such entry (`/health/live`): it measures new TLS connections alone.

**Where the list of requests comes from.** File names change with every build, so the list is read at the start of every run. The launcher starts headless Chromium (in the Lighthouse image, on the generator), loads each browser path of the URL set once with an empty profile and a mobile viewport, waits `CAPTURE_SETTLE` seconds (default 10) for the late analytics scripts, and records every request. `scripts/page-view-set.mjs` turns that into the run's URL set and prints one line per surface: requests, connections, bytes, and what it left out. The capture is `page-view-capture.json` in the run directory. It counts as one page view per surface in analytics. Before the measurement, k6 requests every page until the page store answers it and every file once, and stops when a file doesn't answer 200 (a list from another build).

**What a page view leaves out:**

- **Requests to other hosts:** TMDB images, the analytics host, and Google's tag.
- **`POST /api/e`, the error tracking tunnel.** The app forwards every envelope to the vendor, so a replay would create events there or load a third party. Every page view sends one, with 38 to 75 KB of request body. Its cost isn't in any page-view number.
- **Other requests with a body,** such as `POST /api/poster-impressions` on Discover, which writes.
- **One exception:** `POST /api/living-room/picks?view=pool`, the home page's read of its title pool, is replayed with the body that the captured browser sent. It only reads. The list of replayed requests is `REPLAYED_POSTS` in `scripts/page-view-set.mjs`.

**Cookies.** A visitor starts without cookies (`COOKIE` is empty in this scenario unless you set it). The requests of one visitor share a cookie jar, so the balanced route's instance cookie from the document comes back with the page's files, and one visitor's page view stays on one instance.

**The 500 limit.** A plan whose highest step is above 500 requests per second (visitors times requests per visit, printed before the run) needs `--allow-above-500`. Smoke mode allows at most 2 visitors per second.

**Stop rules,** per step: 2% of page views failed (a page view fails when any of its requests fails), document p95 above `ABORT_P95_MS`, page view p95 above `ABORT_PAGE_P95_MS` (default 10,000 ms), and the dropped iterations limit.

**Summary.** `summary.md` gets a "Page views" table (visitors, complete page views, failed page views, document and page view percentiles, TLS handshakes and their time, per step) and the response headers of each page from before the run. Every load run with the webapp probe also gets "Resources per step": each instance's main thread and proxy CPU, the connections the proxy accepted, and CPU and network of the target hosts and the generator. A step whose generator CPU is near 100% isn't valid. `summary.json` counts the 503 answers that carry `GW-Page-Cache: busy` per step, route, and run as `page_cache_busy`. They are also part of the 5xx count.

**A long plateau.** `SLICE_SECONDS=60` cuts the run into slices and adds the first request's and the page view's percentiles per slice, to see a page's lifetime ending or a snapshot reload. For a hold, use ramp mode with one rate: `--mode ramp --rates 40 --step-duration 600`.

**Reused connections.** `--connections reuse --path private` sends the same page views over each virtual user's open connection. The difference to a run with new connections on the public path is the cost of the TLS handshakes.

**Two generators.** worker3 has four cores, and 50 movie page views per second with new connections use about 60% of them. Above about 60 movie page views per second, split the rate over two generators: start the same command twice at the same moment, the second one with `BENCH_GENERATOR=<other host> BENCH_METRIC_HOSTS= BENCH_WEBAPP_PROBE=0` and `--page-assets` pointing at a capture of the same deploy, and add the two summaries per step. When one run stops, stop the other run's container with `docker stop` on its generator, so that its summary is still written.

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

The image builds on the chosen host if missing. It includes Chromium, fonts, and Lighthouse. Each run uses Lighthouse's default mobile emulation and simulated throttling. No desktop preset is used. The container gets 1 GiB of shared memory. Extra Chrome flags come from `LH_EXTRA_CHROME_FLAGS`. Chromium runs with `--hide-scrollbars`: without it, the first paint is observed about one second late (see [the render path budget](../docs/benchmarks/viral-spike-render-path-budget.md#the-late-first-paint-on-the-generator)). Private mode derives each hostname from its URL and maps it to the resolve address. TLS verification stays enabled.

Lighthouse runs on the generator by default. That host is idle, has a fixed size, and sits in a data center, so two runs days apart see the same CPU and network. A laptop doesn't give that. Never run Lighthouse during a load test: the lock on the generator prevents it.

Lighthouse drives a real browser, so the page's own script runs. After each page view, the page posts to `/api/og-image-warm`, which starts a render on the server. The runner blocks that request with `LH_BLOCKED_URL_PATTERNS` (default `*/api/og-image-warm*`, patterns separated by spaces). Analytics requests are not blocked, because they are part of the page's real cost. Each Lighthouse run therefore shows up as a page view in analytics.

The image tag ends with a hash of `lighthouse/Dockerfile` and `lighthouse/run.sh`. A change to either file builds a new image. Remove old `gw-bench-lighthouse` images on the generator by hand.

Failed individual runs are logged. Other runs continue. The container exits nonzero only when all runs fail. The report uses successful runs and computes a separate median for each metric. Performance scores range from 0 to 100. Fractional median request counts are possible with an even number of runs.

### Render path budget

```sh
./bench.sh budget
./bench.sh budget --runs 5 --label after-fonts
./bench.sh budget --run 20261004T190000Z-lighthouse-budget
```

`budget` runs Lighthouse for each landing surface in [`urls/budget.json`](urls/budget.json) (home, movie, show, person, Discover, and the share list), takes the median of the runs per line, and compares it with the budget. It prints `pass` or `FAIL` per line with the measured value, and exits with 1 when a line fails. Run it after a change to scripts, styles, fonts, images, or the page markup.

| Option | Default | Purpose |
| --- | --- | --- |
| `--runs N` | `3` | Lighthouse runs per surface. The comparison uses the median. |
| `--where generator\|local` | `generator` | The Docker host. The time lines of the budget are calibrated for the generator. |
| `--path public\|private` | `public` | The network path, as for `lighthouse`. |
| `--label <text>` | `budget` | Name the run. |
| `--budget <file>` | `urls/budget.json` | Another budget file. |
| `--run <run>` | None | Compare an existing Lighthouse run again, without measuring. |

The lines, all for a first-time mobile visitor who doesn't scroll:

| Line | Read from the Lighthouse report |
| --- | --- |
| `html_bytes` | Transfer size of the document |
| `host_requests` | Requests to the page's own origin |
| `script_count`, `script_bytes` | Script requests and their transfer size |
| `image_count`, `image_bytes` | Image requests and their transfer size. Lighthouse doesn't scroll, so these are the images before scrolling. |
| `font_requests` | Font requests |
| `blocking_requests` | Render-blocking requests (stylesheets and scripts) |
| `third_party_origins` | Origins other than the page's own |
| `total_bytes` | Transfer size of all requests |
| `lcp_ms`, `tbt_ms`, `cls`, `score` | Lighthouse's simulated LCP and TBT, CLS, and the performance score |
| `lcp_element` | The LCP element's tag, and a text that its markup must contain. It passes when more than half of the runs match. |

In the budget file, a line has either `max` or `min`. `targets` holds the values that count as good (LCP 2.5 s, TBT 200 ms, CLS 0.1, score 90): the report shows the gap to them, and they never fail a run. A surface's `path` can name a setting, such as `${SHARE_LIST_PATH}` from `config.env`. The report never prints a URL.

Each surface's header line shows the observed FCP and Lighthouse's CPU benchmark of the host. An observed FCP above one second, or a benchmark far from 1,100 on the generator, means the measurement was disturbed: check for other containers on the generator and repeat.

The limits come from a measured run plus a margin: about 5% on bytes, one or two requests, and the spread between runs on the time lines. When a change improves a line for good, lower its limit in the same commit. When a change has to raise a line, raise the limit in that commit and say why. The run writes `budget.json` and `budget.md` into its result directory. The comparison logic has tests: `node --test scripts/budget.test.mjs`.

### Tap test

```sh
./bench.sh tap
./bench.sh tap --runs 7 --label after-carousel
./bench.sh tap --controls cast_next,related_tab --modes early --runs 3
./bench.sh tap --base-url http://127.0.0.1:3304 --label branch
```

`tap` answers one question for a title page: does a tap right after the page loads, or right after a fast scroll, always do something? It taps each control that needs script on the movie page and the show page of [`urls/budget.json`](urls/budget.json), and reports per control whether the tap had its effect and how long the effect took. A tap without its effect inside the limit is a lost tap.

Every measurement is its own page load in a new browser: empty cache, no cookies, a signed-out visitor. The browser is the Chromium of the Lighthouse image with a phone viewport (412 by 823), touch input, and the CPU slowed four times, which is Lighthouse's mobile setting. The network isn't throttled unless you ask for it.

| Option | Default | Purpose |
| --- | --- | --- |
| `--base-url URL` | `BENCH_TARGET_URL` | The origin to test, such as a branch instance. For `127.0.0.1` or `localhost`, the container uses the Docker host's network. |
| `--runs N` | `5` | Measurements per page, control, and mode. |
| `--controls ID,ID` | All | Only these controls. |
| `--modes early,scroll` | Both | Only these modes. |
| `--movie PATH`, `--show PATH` | From `urls/budget.json` | Other titles. A path that starts with `/movie/` gets no episode cell. |
| `--where generator\|local` | `generator` | The Docker host. Times are only comparable between runs on the same machine. |
| `--path public\|private` | `public` | The network path, as for `lighthouse`. |
| `--resolve ADDRESS` | None | Resolve the base URL's host name to this address, for one instance behind its own proxy. With `BENCH_INSECURE_TLS=1`, the browser accepts a certificate for another name. |
| `--timeout MS` | `5000` | The limit after which a tap is lost. |
| `--settle MS` | `3000` | Scroll mode: the wait between the load event and the first drag. |
| `--cpu N` | `4` | The CPU slowdown. |
| `--network none\|slow4g` | `none` | `slow4g` adds 150 ms per round trip and limits the download to 1.6 Mbit/s. |
| `--label <text>` | `run` | Name the run. |
| `--strict` | Off | Exit with 1 when a tap was lost. |

**The two modes.**

- `early`: the tap goes out as soon as the browser reports the first contentful paint and the control is in the document. A control below the first screen is brought into view with one jump of the scroll position, not with a gesture, and the tap waits until the control is where a tap can reach it. "Tap at" in the report is when the tap arrived, counted from the start of the navigation.
- `scroll`: the page loads and rests for the settle time. Then touch drags scroll to the control, each at 8,000 CSS pixels per second (`TAP_SCROLL_SPEED`) with a rest of a tenth of a second before the finger lifts, so that the browser adds no fling and every run scrolls the same distance. A control in the first screen is scrolled away and back first. The tap follows the last drag as soon as the scroll position holds for two frames. Sections below the fold reserve estimated heights, so the control can land outside the screen: further drags then correct that, and the report counts them.

**The controls and their effects.** An effect is a change in the document that the script watches with a `MutationObserver`. The time to effect runs from the finger going down (the browser's time stamp of the input) to that change.

| Control | What is tapped | The effect |
| --- | --- | --- |
| `streaming_tab` | The first offer type tab in `#streaming` that isn't selected, such as "Rent" | That tab has `aria-selected="true"` |
| `action_want` | "Want to See" | The button has `aria-pressed="true"`. A signed-out visitor's Wishlist lives in the browser, so nothing is saved on the server. |
| `action_seen` | "Mark as Seen" | The sign-in prompt is in the document (a `dialog` with "Sign in" in its text). Its code loads on this first press, so the time includes one script request. |
| `fingerprint_switch` | The first "See all ... traits" button in `#fingerprint` | One of the six detail views is displayed |
| `episode_cell` | The first displayed episode cell in `#episode-ratings` (show page only) | The episode's tip is in the document |
| `cast_next` | The next arrow of the cast row in `#actors_and_crew` | The row's active slide is another one than before the tap |
| `related_tab` | The first tab in `#related` that isn't pressed | That tab has `aria-pressed="true"`. The rows of the new panel load after that and aren't part of the time. |
| `related_next` | The next arrow of the first row in `#related` | The row's active slide is another one than before the tap |

The selectors use section ids, roles, and accessible names. The carousel arrows have no name: they are the last `button` that is a direct child of a `.swiper` element. The controls and their effects are in `pageLib` in [`tap/tap.mjs`](tap/tap.mjs): change them there when the page's markup changes.

**What a measurement can end as.**

- `effect`: the tap reached the control and the effect came inside the limit.
- `lost`: the tap reached the control and no effect came inside the limit. The script then waits up to 10 more seconds for script to take the control over, and 3 seconds after that: an effect in that time is listed under "Late effects". The tap still counts as lost.
  - "Lost: click elsewhere" counts the lost taps whose click went to another element. The browser picks the click's element when it handles the tap. When the main thread is busy at that moment and the layout moves, for example because a carousel starts, the click goes to whatever is under the finger afterwards, such as a link to another title.
- `absent`: the control wasn't in the document, for example a related row that came without cards.
- `missed`: the tap landed on another element, for example because the layout moved. This is a fault of the check, or a control that something covers. The report names what the tap hit.
- `invalid`: the effect was there before the tap.
- `error`: the page didn't load, or the tap left the page.

The "Effect" and "Lost" columns count only taps that reached the control. The rest is in "Other".

**The diagnosis columns.** "Script took over at" is when React had attached the control's node, or Swiper had started the row, counted from the start of the navigation. An early tap before that moment is lost unless the browser still holds the click when the script starts. `tap.jsonl` also has, per measurement, `input_delay_ms` and `click_delay_ms` (how long the main thread was busy before the page's script saw the tap and the click), the requests that started after the tap, and the console's error messages.

**Requests.** The page's own script runs, so every measurement counts as a page view in analytics, and a run with the defaults is 150 page views. Requests that write are blocked in the browser: `/api/update-*`, `/api/poster-impressions`, and `/api/og-image-warm` (`TAP_BLOCKED_URL_PATTERNS`, patterns separated by spaces). The report lists every request other than GET that a page sent.

**Results.** `tap.jsonl` has one line per measurement, written as the run goes, and `tap.log` the progress. `summary.json` and `summary.md` have one row per page, mode, and control: taps with an effect, lost taps, and the median, lowest, and highest time to effect. The console section counts React errors by number, such as 418 or 421. `node scripts/tap-report.mjs <run>` writes the summary again. Its logic has tests: `node --test scripts/tap-report.test.mjs`.

The run takes the generator's lock, like a Lighthouse run. With the defaults it takes about 30 minutes.

To run the script without Docker, point it at a directory that can resolve `puppeteer-core` and at a Chromium binary:

```sh
TAP_PUPPETEER_FROM=/path/with/node_modules/ CHROME_PATH=/usr/bin/chromium \
  TAP_BASE_URL=https://example.org TAP_PAGES=movie=/movie/603-the-matrix TAP_RUNS=1 node tap/tap.mjs > tap.jsonl
```

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

### Smoke check after a deploy

**Every deploy of the webapp ends with this command.** A push to `main` deploys, also for files outside the webapp. Run the check from the development machine, with the commit that you pushed:

```sh
./bench.sh smoke --commit "$(git rev-parse origin/main)"
```

It prints one line per check (`PASS`, `FAIL`, `WARN`, or `SKIP`) and exits with 1 when any check fails. A run takes 6 seconds on a container that is older than a minute, and up to about two minutes on a new one, because it waits for the first per-minute `Process:` log line. It sends about 30 GET requests over the public address. It never sends `POST /api/combined-search` or another writing request.

What it does, in order:

1. **Finds the container.** It connects with SSH to the host that the target's name resolves to, and waits until exactly one `gk4owk8-*` container runs, is healthy, and fits the options. `--commit SHA` compares with `SOURCE_COMMIT` in the container's environment. `--newer-than NAME` refuses the container with that name: note the name before a deploy when you don't know the commit. `--deploy-timeout` (default 600 seconds) limits the wait. Then it waits until the home page answers 200, because requests can fail for a moment while the proxy switches containers (see [webapp deploys](../docs/webapp-deploys.md)).
2. **Reads the metrics** from the private port inside the container (`goodwatch_http_responses_total`, the process uptime, and the build's commit).
3. **Requests the pages** in [`smoke/urls.json`](smoke/urls.json) and checks the status, markers in the body, headers, and for HTML pages the rendered markers: the title text in `<title>` and `<h1>`, links to titles in the server HTML, an image `src` on the image host, and JSON-LD blocks that parse. No response may contain `Unexpected Server Error`.
4. **Scans the container's log from its start** with the patterns in [`smoke/log-patterns.json`](smoke/log-patterns.json), after the requests, so that errors from the edge-case pages are in it. The people index, the title snapshot, and the search index must report that they loaded. The latest `Process:` line must say `query encoder ready`. Slow subsystems have until 120 seconds after the process start (`--log-wait`). No line may match a failure pattern, such as `failed to start`, `Cannot find module`, or `TypeError`.
5. **Reads the metrics again.** The Redis client must be ready, no Redis breaker may be open, and no route's 5xx counter may have risen since step 2. Background traffic counts too: a 5xx that a crawler caused during the run fails the check. 5xx responses from before the run print a warning.

The URL list covers a well-known movie and show, a title without a poster, without a backdrop, without cast, without a trailer, and without streaming data, a show with more than 3,300 cast rows, a person with and without a department, a filtered person URL without the cookie (403), with it (200), and from a crawler (301), home, Discover with and without a filter, the share list and its image, a missing share list and a missing title (404), a title's OG image, `robots.txt`, a script that the home page references, `/metrics` on the public port, and the GET endpoints that pages call. Each entry's `guards` field says which regression or edge it's for, and a failure prints it.

To add a check after a regression, add an entry to `smoke/urls.json` or a pattern to `smoke/log-patterns.json`. Use public catalog entries only. The share list entries read `SHARE_LIST_PATH` and `SHARE_LIST_OG_PATH` from `config.env`, print a warning when they're unset, and never print the path.

#### Check one instance

With more than one webapp instance, the public route reaches either of them, and the default check reads the log and the metrics of the container on abio only. `--host` checks one instance by itself:

```sh
./bench.sh smoke --host vector1 --commit "$(git rev-parse origin/main)"
./bench.sh smoke --host abio --commit "$(git rev-parse origin/main)"
```

`--host` takes a name from `goodwatch-hq/ansible/hosts.ini` or a private address. The check finds the `gk4owk8-*` container on that host, opens an SSH tunnel from a free local port to the container's port 3000 on its Docker network, and sends every request through it. No proxy, no load balancer, and no public route is involved, so the result describes that process alone, and it works before the instance takes traffic. The log and the metrics come from the same container. SSH jumps through `BENCH_SSH_JUMP`, or through the host that the target's name resolves to when it's unset.

After a deploy to two instances, run the check three times: once per host, and once without `--host` for the public route. Coolify deploys the additional server after the primary one finishes, so start the check for the second host with `--commit` and let it wait.

#### Watch a deploy

`./bench.sh deploy-watch` waits for the next push to `main` (or starts at once with `--now`), sends 2 requests per second over the public address while the deploy runs, and reads Docker's events, the webapp containers' state and health, and their logs on the serving host. It changes nothing there. The report lists the container events, the `Shutdown:` log lines of the old container, and every failed request with its time. The recording stays in `results/`. [Webapp deploys](../docs/webapp-deploys.md) explains what to expect.

#### Check a local build

`--target local` checks a production build on the development machine, for example to prove that the check catches a bug:

```sh
./bench.sh smoke --target local --base-url http://127.0.0.1:3304 \
  --log-file /path/to/server.log --metrics-url http://127.0.0.1:9304/metrics
```

Start the server with `NODE_ENV=production`, a `METRICS_PORT`, and its output in the log file. `--container NAME` reads a local Docker container's log instead of a file. `--skip ID,ID` skips checks by the id that each line prints, such as `log:search-index`: a local server that reads Crate through the VPN doesn't load the people index, the search index, and the availability index in time. Point a local server at a throwaway Valkey, never at the production cluster.

#### Limits

- The log scan needs the log from the process start. `docker logs` keeps a limited local copy, so on a container that has run for a long time the start can be gone: the three "loaded" checks then print a warning and don't fail.
- The check requests one URL per case. It doesn't replace watching the 5xx counters after a deploy, because crawlers reach titles that no list holds.
- It doesn't run page scripts. A crash during hydration and requests that only a browser sends need Lighthouse or a browser.
- It doesn't send a search (`POST /api/combined-search`), so a search that fails with a ready encoder stays unseen.
- Catalog entries change: when TMDB adds a poster to the title without one, the entry still passes and guards nothing. Check the list against the data from time to time.

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

## One instance

The load test's target is the proxy of one host: `BENCH_RESOLVE_IP` sets the address that `goodwatch.app` resolves to on the generator, and `BENCH_METRIC_HOSTS` names the host whose CPU and containers are sampled. The default is abio. To load the instance on vector1 by itself, through vector1's proxy:

```sh
BENCH_RESOLVE_IP=10.0.0.20 BENCH_INSECURE_TLS=1 \
  BENCH_METRIC_HOSTS='10.0.0.20:target:coolify-proxy+gk4owk8' \
  ./bench.sh load --mode smoke --rate 5 --duration 30 --label vector1-only
```

`BENCH_INSECURE_TLS=1` turns off the certificate check in k6. vector1's proxy has no certificate for `goodwatch.app`, because the name's public address is abio. Use it only on the private path. `meta.json` and the summary record `insecure_tls`.

Once abio's proxy balances across both instances, a run against abio's address measures both together, and no request path reaches abio's instance alone. Split the result by instance with the server metrics instead: see "Two instances" in [`docs/benchmarks/viral-spike-metrics.md`](../docs/benchmarks/viral-spike-metrics.md). k6 keeps no cookies, so the proxy's sticky cookie doesn't apply and the requests alternate between the instances.

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
  tap.jsonl                 # Tap test: one line per measurement
  tap.log
  summary.json
  summary.md
```

Only relevant files exist for a given run. Metadata records the Git commit and dirty flag, target, path, cache mode, URL set, rate plan, timestamps, and k6 exit code. Cookies and share-list values are redacted from effective inputs. The jump destination is never stored; only `jump: true|false` is recorded. Non-private generator and metric addresses are redacted in metadata. Explicit target URL and resolve overrides are retained as supplied. Keep results private unless reviewed.

### Summary schema

`summary.json` uses schema version 1. Top-level fields are `schema`, `run_id`, `kind`, `label`, `meta`, `load`, `hosts`, and `lighthouse`. Unavailable measurements use `null`; missing counters use zero.

- `load` holds abort status and reason, duration in seconds, request count and rate, error fraction, latency and TTFB in milliseconds, dropped iterations, `routes`, and `steps`. Steps include their target rate. Step req/s divides requests by the planned step length, including transitions. For the step in which a run aborts, it divides by the time the step ran. Route status buckets are `2xx`, `3xx`, `4xx`, `5xx`, and `0` for transport failures.
- `hosts` is keyed by hostname. Each host includes its role, sample count, averages and maxima, and container metrics. Samples are trimmed to the run timestamps when both timestamps exist. Network rates use decimal Mbps. Container memory uses MiB despite the stable `mem_mb` field name.
- `webapp_instances` exists only with `BENCH_WEBAPP_PROBE_EXTRA`. It is keyed by host, and each entry has the fields of `webapp` without the benchmark's share.
- `webapp` exists only with the webapp probe. It holds the window length, the deployed commit, a restart flag, request rates (`total_rps`, `benchmark_rps`, `background_rps`, `crawler_loop_rps`), `routes`, `caches`, `qdrant`, `page_cache` (hits, stale answers, joined requests, misses, and bypasses per route pattern), `thread_cpu_pct`, `main_thread_by_time`, `proxy_cpu_pct`, `proxy_accepts_per_s`, `in_flight`, and `loop_delay_ms`.
- `load.page_view` exists only for the page-view scenario: the connection mode, the cache identity, the response headers of each page before the run (`pages`), totals, `slices` with `SLICE_SECONDS`, and page views per route. Each step then also has `visits`, `page_views`, `page_view_error_rate`, `page_view_ms`, `tls_handshakes`, `tls_handshake_ms`, and `kinds` (document, asset, api, side, single).
- `load.steps[].resources` exists when the run knows when its scenario started: per instance the main thread and proxy CPU in percent of one core, accepted connections, and the highest event loop delay, and per host CPU, network rates, and memory. The transition seconds at the start of a step are left out.
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

With more than one instance behind the balanced route, name the other instances' hosts in `BENCH_WEBAPP_PROBE_EXTRA` (private addresses, separated by commas, for example `10.0.0.20`). Each is read the same way into `webapp-<host>/`, and the summary gets a "Webapp instances" section: requests per second, 5xx responses, main-thread CPU, requests in flight, and memory per instance, the background rate over all instances, and the page cache's hits, stale answers, and misses per route pattern. "From the benchmark" and "background" in the "Webapp process" section are wrong for one instance of several, because k6 can't tell which instance answered.

The probe reads the `remix-serve` process of the container. The OG card renderer starts short-lived child processes, which the probe ignores.

The event loop delay gauge restarts on every scrape. The probe scrapes every `BENCH_METRIC_INTERVAL` seconds, so Grafana's own samples of that gauge cover shorter windows during a run.

## Automatic stop rules

Each step has an aborting error-rate threshold (default less than 2%) and p95 latency threshold (default less than 3,000 ms). `ABORT_DELAY` defaults to 10 seconds. k6 evaluates thresholds periodically; it cannot stop on the exact failing request. Delay is relative to test start, not a fresh delay for each step. Step metrics prevent earlier healthy plateaus from diluting a later overloaded plateau.

Dropped iterations use a global threshold because k6 does not attach custom step tags to its dropped-iteration counter. The default limit is 5% of the maximum-rate plateau's planned iterations, rounded up. `ABORT_DROPPED` overrides it. This is a whole-run count, not a per-step percentage.

Latency here is k6's `http_req_duration`: the time until the last byte of the response. HTML pages stream, so this is longer than the time to first byte, which the summaries list as TTFB. On October 3, 2026 (UTC), production crossed the 3,000 ms limit at 3 requests per second with the `hot` set. To record a baseline at low rates anyway, raise `ABORT_P95_MS` for that run and note it. The value is stored in `meta.json`.

k6 exit code 99 marks an abort or threshold failure. The summary lists failed thresholds. The launcher retrieves available results and exits nonzero. A short smoke run can reach its end before a threshold evaluation aborts it. Missing samples are not evidence of success.

## Safety limits

Smoke mode allows one plateau, at most 20 req/s and 120 seconds. Larger tests require ramp mode. Every ramp requires `--yes-ramp-production`, prints its full plan, and waits ten seconds. Set `BENCH_NO_COUNTDOWN=1` only when an intentional automated run needs to skip the wait. Rates above 500 req/s also require `BENCH_ALLOW_ABOVE_500=1`.

The launcher refuses a generator address equal to the resolve address. Use the private serving address in this setting even for public tests so the check remains effective. A directory lock prevents load, Lighthouse, and tap test runs from overlapping on the generator. Local Lighthouse runs do not acquire that lock. Ctrl-C stops the named container and samplers and releases the lock. A killed client or lost connection can leave a stale lock; inspect the named container before clearing it.

## Known limitations

- Load traffic is GET only, apart from the one replayed read in the page-view scenario. It excludes `POST /api/combined-search`, which can trigger paid model calls or guest quota writes, `POST /api/og-image-warm`, which triggers rendering, and `POST /api/e`, which the app forwards to the error tracking vendor.
- In the `requests` scenario, k6 does not fetch browser subresources. The page-view scenario does, from a captured page load. It sends them all at once after the document, where a browser discovers them in several rounds over about five seconds, and it doesn't model third-party hosts or a returning visitor's browser cache.
- The page-view scenario opens two connections per browser visitor because the captured Chrome does. Browsers that don't fetch the manifest open one.
- Lighthouse is lab data, not field data. Its browser loads page subresources and can execute normal page code. GET-only load guarantees apply to k6, not browser-side application behavior in Lighthouse.
- Docker stats are coarse and can lag a host sample. Container CPU can exceed 100% across multiple cores.
- Per-route summary percentiles cover the whole measured run. A per-step route breakdown requires `--raw`. Summary percentiles cannot be averaged into new percentiles.
- Rate denominators in k6's raw summary can include setup overhead. Step rates use the planned step length, or the elapsed time for an aborted step. Compare equivalent plans and cache modes.
- These scripts do not provision infrastructure, clear data caches, or model authenticated sessions. They do not install monitoring services.

## Leave no trace

Normal cleanup removes each remote run directory and its lock. Docker images and an empty work directory remain on the generator. Set `BENCH_KEEP_REMOTE=1` to retain a run for diagnosis. Retained runs include the environment file, which can contain cookies. Local results remain until you remove them.

## Production baseline

`results/baseline-2026-10-04/` holds the summaries of the baseline runs from October 4, 2026. [`docs/benchmarks/viral-spike-baseline.md`](../docs/benchmarks/viral-spike-baseline.md) explains them and lists the command for each run.

`results/checkpoint-2026-10-04/` holds the summaries of the same runs after the page load optimizations, on two instances, and the output of `./bench.sh compare` for each pair in `compare/`. [`docs/benchmarks/viral-spike-checkpoint.md`](../docs/benchmarks/viral-spike-checkpoint.md) explains them.

`results/page-views-2026-10-05/` holds the summaries of the page-view runs, the ramp of new TLS connections, and the repeated OG image ramps from October 5, 2026. [`docs/benchmarks/viral-spike-page-views.md`](../docs/benchmarks/viral-spike-page-views.md) explains them.

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
