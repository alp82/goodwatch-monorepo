# Checkpoint after the page load optimizations

This page repeats the runs of the [production baseline](viral-spike-baseline.md) after the first round of changes from the "Serve a viral traffic spike" map, with the same commands, scenarios, and stop rules. It is the input for two owner decisions: "Choose the page cache layer" and "Decide where static assets are served from". It gives the inputs and doesn't decide.

The run summaries and the output of `./bench.sh compare` for each pair of runs are in [`goodwatch-benchmark/results/checkpoint-2026-10-04/`](../../goodwatch-benchmark/results/checkpoint-2026-10-04/).

## Summary

- **Break points:** no ramp stopped. Every HTML surface, the primary scenario, and both OG images held 500 requests per second, the highest step that the benchmark's safety limit allows. The baseline stopped at 2 to 10 requests per second on HTML surfaces. No benchmark request failed in 822,715 requests.
- **Latency of cached pages:** the p95 of the full response is 12 to 38 ms at 2 requests per second and 20 to 26 ms at 500. The baseline was 138 to 890 ms at 2. The 300 ms target is met on every surface.
- **Latency of pages that aren't stored:** a long-tail movie page has a p95 of 278 ms (1,317 ms in the baseline), a show page 357 ms (2,890 ms).
- **Main thread:** 17% to 24% busy per instance without benchmark load (79% in the baseline, on one instance), and 40% to 49% at 500 cached HTML requests per second. OG images are the exception: 88% to 97% at 500 per second.
- **What limits a page view now:** not the HTML. A first-time movie page view is 34 requests to the webapp host. Measured per request, that's about 50 ms of CPU in the proxy on abio and about 20 ms of Node main-thread time per page view. Extrapolated, two instances behind one proxy serve about 60 to 90 such page views per second, against a destination of 500.
- **Lab Web Vitals:** mobile Lighthouse scores are 65 to 84 (30 to 38 in the baseline, with a setup that isn't comparable). LCP is 3.8 to 4.2 s on the four landing surfaces, against a limit of 2.5 s. CLS is good. TBT is over the limit on title pages.
- **Found on the way:** the title snapshot reload stalls both instances for about one second at the same moment, the balanced route sets a cookie on every response, Crate answered slowly for 30 minutes without benchmark load, and the hourly Crate backup fails.

## Conditions

| Item | Baseline | Checkpoint |
| --- | --- | --- |
| Date | Sunday, October 4, 2026, 02:38 to 03:58 UTC | Sunday, October 4, 2026, 18:25 to 21:59 UTC |
| Commit deployed | `86e011c8` | `392439b7` on both instances, started 18:11 and 18:12 UTC, no restart during the runs |
| Serving | One `remix-serve` process on abio (`10.0.0.21`, 8 cores) behind Coolify's Traefik proxy | Two processes: abio and vector1 (`10.0.0.20`, 16 cores, shared with Qdrant). abio's proxy balances across both. Requests for vector1 pass through vector1's proxy too. |
| Generator | worker3 (`10.0.0.32`), 4 cores, k6 1.8.1 and Lighthouse 13.5.0 in Docker | The same |
| Load path | Private network, through abio's proxy with TLS. k6 reuses connections. | The same |
| Sticky cookie | None | The balanced route sets `gw_instance`. k6 keeps no cookies, so its requests alternate between the instances. |
| Background traffic | 47.5 to 53.9 requests per second, of which 36 to 38 were a crawler loop | 13.4 to 15.7 requests per second. The crawler loop is gone. |
| Lighthouse path | Public | Public |
| Total load time | 37.7 minutes across 16 runs | 156.5 minutes across 13 runs |

### What the benchmark sends to the page cache

- **No `GW-Cache-Identity` header.** The app then takes the identity from `Accept-Language`, answers `private, max-age=0`, and its in-process page cache still stores and serves the page (see [page-cache.md](../page-cache.md)). Every cached page in this checkpoint is such a "keyed" entry. A checked response carried `GW-Page-Cache: hit`, `GW-Cache-Identity: anon;US;en`, and `Vary: Accept-Language, Accept-Encoding`.
- **Warm mode** sends one fixed `Accept-Language`, so each URL is one stored page per instance. Bot requests send no `Accept-Language` and get the same `anon;US;en` page.
- **Cold mode** rotates five languages and a new cookie per request. The cookie doesn't matter any more. Five languages are five stored pages per URL and instance, and a page is stored on its second request within 60 seconds. With about 40 requests per surface, a large share of them are renders.
- **The long-tail run** requests every URL once. Nothing is stored, so it measures the path without the page cache.

### Changes to the benchmark scripts

- `bench.sh` reads the webapp's metrics and thread CPU on further instances with `BENCH_WEBAPP_PROBE_EXTRA`. The summary gets a "Webapp instances" section with the page cache counters per route.
- `scripts/webapp-probe.sh` picks the `remix-serve` process. It picked "the process with the most threads" before, which can be a short-lived child of the OG card renderer. This cost vector1's thread CPU in one run (the title OG image).

## Method

The commands are the baseline's (see [Repeat the runs](viral-spike-baseline.md#repeat-the-runs)), with these differences:

- **Ramp:** the baseline's steps up to 65 requests per second, then 80, 100, 125, 150, 200, 250, 300, 400, and 500. Each step lasts 30 seconds (25 for the OG images). 500 is the limit without `BENCH_ALLOW_ABOVE_500`, which wasn't set.
- **The second primary run** with the stop raised to 10 seconds wasn't repeated, because the first one never reached a stop.
- **OG images:** ramped to 500 per second. The baseline ended them at 35 for its time budget.
- **One added run:** a ramp of full movie page views (see [A full page view](#a-full-page-view)).
- **Before every run:** `./bench.sh smoke --commit 392439b7` on the public route and on each instance, a check that worker3 runs no other benchmark container, and the cache nodes' memory.
- **During the runs:** a watch on both instances' container health and 5xx counters every 30 seconds.

## Break point per surface

The default stop applies: p95 of the full response at 3,000 ms, or 2% errors. Rates are requests per second, times are in ms.

| Surface | Baseline: holds | Baseline: stops at | Baseline: p95 at the stop | Checkpoint: holds | Errors | p50 / p95 / p99 at 500 | TTFB p95 at 500 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Primary scenario (`hot`) | 2 | 4 | 4,384 | 500 or more | 0 of 90,475 | 4 / 21 / 40 | 18 |
| Home | 6 | 8 | 3,395 | 500 or more | 0 of 90,469 | 4 / 21 / 45 | 20 |
| Movie page | 1 | 2 | 3,297 | 500 or more | 0 of 90,472 | 4 / 20 / 41 | 18 |
| Show page | 1 | 2 | 3,852 | 500 or more | 0 of 90,472 | 4 / 26 / 60 | 24 |
| Person page | 6 | 8 | 6,944 | 500 or more | 0 of 90,475 | 4 / 24 / 48 | 23 |
| Discover | 4 | 6 | 5,753 | 500 or more | 0 of 90,475 | 4 / 20 / 43 | 19 |
| Share list page | 8 | 10 | 4,323 | 500 or more | 0 of 90,469 | 4 / 23 / 49 | 22 |
| Title OG image | 35 or more | Not reached | | 500, at its limit | 0 of 77,330 | 39 / 196 / 303 | 194 |
| Share list OG image | 35 or more | Not reached | | 500, at its limit | 0 of 77,354 | 12 / 87 / 154 | 80 |

- No run dropped an iteration, timed out, or got a 5xx response. The generator used at most 56% of its 4 cores.
- **Not a break point:** an HTML surface at 500 requests per second leaves each main thread half idle, so the real stop is above what was measured. Extrapolated from the cost per request below, the two instances reach 85% of their main threads at about 1,000 to 1,400 HTML requests per second.
- **The OG images are near their stop at 500.** The main threads were 88% to 97% busy, and the title image's p50 rose from 10 to 39 ms in the last step.
- **The worst step of an HTML ramp** was the show page at 400 requests per second: p95 52 ms, p99 1,597 ms. Both instances loaded a new title snapshot in that step (see [Incidents](#incidents-and-end-state)).

### Primary scenario by step

| Step (req/s) | Baseline: p50 / p95 | Checkpoint: p50 / p95 / p99 | TTFB p95 | abio main thread % | vector1 main thread % | abio proxy % |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 292 / 1,017 | 6 / 64 / 82 | 63 | 21 | 14 | 30 |
| 2 | 297 / 1,429 | 6 / 17 / 42 | 14 | 18 | 14 | 31 |
| 4 | 574 / 4,384, stopped | 6 / 19 / 41 | 17 | 21 | 16 | 37 |
| 20 | | 5 / 14 / 37 | 11 | 17 | 20 | 32 |
| 65 | | 5 / 15 / 31 | 13 | 27 | 20 | 53 |
| 100 | | 5 / 17 / 35 | 16 | 26 | 32 | 66 |
| 200 | | 5 / 18 / 38 | 16 | 25 | 36 | 90 |
| 300 | | 5 / 17 / 37 | 15 | 33 | 38 | 115 |
| 400 | | 4 / 19 / 47 | 17 | 35 | 46 | 132 |
| 500 | | 4 / 21 / 40 | 18 | 43 | 49 | 156 |

CPU is in percent of one core, averaged over the step.

### Page cache answers in the ramps

From the webapp's counters on both instances. Background requests for the same route pattern count too, which is why the movie, show, and person routes show misses: crawlers walk titles and people that nobody else asks for.

| Run | Benchmark requests for the surface | Hits | Stale | Misses on that route, with background |
| --- | --- | --- | --- | --- |
| Primary scenario, movie page | 56,771 | 56,771 | 0 | 4,149 |
| Primary scenario, share list page | 8,225 | 8,021 | 201 | 5 |
| Primary scenario, home | 4,517 | 4,550 | 3 | 2 |
| Share list ramp | 90,469 | 89,989 | 480 | 4 |

- Every benchmark request for a movie page was a hit: the pre-run smoke checks had already stored the page.
- The share list page lives 10 seconds fresh and 10 more seconds stale. It was rendered once per 10 seconds and instance, whatever the rate.
- Each process held 59 to 309 pages. The store's bound is 2,000 pages.

## Latency per route

All times are in ms, measured by k6 on worker3 through the proxy.

### Warm, 2 requests per second across eight surfaces

Run `latency-warm`, 150 seconds. Every benchmark page request was answered from the store.

| Surface | Requests | Full p50: baseline | Checkpoint | Full p95: baseline | Checkpoint | Full p99: baseline | Checkpoint | TTFB p95: baseline | Checkpoint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 44 | 62 | 4 | 138 | 13 | 185 | 18 | 56 | 13 |
| Movie page | 37 | 292 | 5 | 832 | 19 | 978 | 21 | 216 | 13 |
| Show page | 36 | 415 | 6 | 876 | 12 | 950 | 17 | 254 | 10 |
| Person page | 38 | 142 | 5 | 352 | 35 | 903 | 45 | 107 | 34 |
| Discover | 34 | 218 | 5 | 890 | 13 | 1,123 | 18 | 202 | 12 |
| Share list page | 43 | 149 | 5 | 322 | 38 | 410 | 53 | 164 | 37 |
| Title OG image | 34 | 21 | 12 | 82 | 31 | 129 | 67 | 67 | 28 |
| Share list OG image | 33 | 33 | 12 | 129 | 34 | 170 | 51 | 125 | 31 |

### Cold mode, 2 requests per second across eight surfaces

Run `latency-cold`, 150 seconds. With five languages, the p50 is a stored page and the p95 is a render: on the home route, 28 requests were hits and 15 were renders.

| Surface | Requests | Full p50: baseline | Checkpoint | Full p95: baseline | Checkpoint | Full p99: baseline | Checkpoint | TTFB p95: baseline | Checkpoint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 37 | 83 | 7 | 265 | 60 | 331 | 78 | 93 | 53 |
| Movie page | 39 | 313 | 9 | 806 | 202 | 1,044 | 278 | 253 | 200 |
| Show page | 40 | 561 | 8 | 1,216 | 236 | 1,480 | 243 | 278 | 235 |
| Person page | 37 | 157 | 10 | 458 | 61 | 974 | 66 | 113 | 59 |
| Discover | 41 | 226 | 6 | 687 | 184 | 793 | 202 | 267 | 183 |
| Share list page | 38 | 183 | 34 | 592 | 94 | 656 | 107 | 218 | 88 |
| Title OG image | 34 | 21 | 11 | 74 | 27 | 88 | 36 | 59 | 25 |
| Share list OG image | 33 | 39 | 11 | 122 | 21 | 191 | 33 | 119 | 14 |

A render of a well-known title with a warm data cache takes about 200 to 240 ms from the generator. The first byte and the last byte now arrive together, because the HTML leaves in one piece per React pass.

### Long-tail titles, 1 request per second

Run `latency-cold-longtail`, 120 seconds. Every request is a different sitemap URL, so no page is stored. The data cache missed 86% to 87% of the movie lookups and 79% to 82% of the show lookups. One request answered 404, as in the baseline (a title in the sitemap that no longer exists).

| Route | Requests | Full p50: baseline | Checkpoint | Full p95: baseline | Checkpoint | Full p99: baseline | Checkpoint | TTFB p50: baseline | Checkpoint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Movie pages | 76 | 590 | 199 | 1,317 | 278 | 2,401 | 309 | 335 | 197 |
| Show pages | 28 | 968 | 242 | 2,890 | 357 | 4,078 | 390 | 466 | 239 |
| Other sitemap pages | 15 | 265 | 211 | 1,381 | 657 | 1,620 | 1,105 | 173 | 209 |

### One surface alone at 1 request per second

The first step of each surface ramp, 24 to 29 requests each.

| Surface | Full p50: baseline | Checkpoint | Full p95: baseline | Checkpoint | TTFB p95: baseline | Checkpoint |
| --- | --- | --- | --- | --- | --- | --- |
| Home | 93 | 4 | 288 | 7 | 81 | 6 |
| Movie page | 326 | 5 | 1,086 | 9 | 250 | 7 |
| Show page | 657 | 6 | 1,711 | 11 | 236 | 9 |
| Person page | 130 | 5 | 416 | 11 | 71 | 7 |
| Discover | 182 | 5 | 555 | 26 | 216 | 25 |
| Share list page | 167 | 5 | 655 | 32 | 236 | 31 |
| Title OG image | 21 | 11 | 38 | 26 | 28 | 24 |
| Share list OG image | 31 | 12 | 67 | 17 | 62 | 12 |

### Real traffic, no benchmark load

From the webapp's own histograms over 70 seconds at 21:34 UTC. These times are measured inside the Node process and exclude the proxy. Almost all of this traffic is crawlers on titles and people that aren't stored.

| Route pattern | Baseline: requests | Full p50 | Full p95 | Under 300 ms | Checkpoint: requests (abio, vector1) | Full p50 | Full p95 | Under 300 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/movie/:movieKey` | 194 | 314 | 1,488 | 48.5% | 100, 209 | 147, 147 | 244, 261 | 100%, 99.5% |
| `/show/:showKey` | 76 | 462 | 1,655 | 22.4% | 22, 17 | 154, 161 | 278, 330 | 100%, 94.1% |
| `/person/:personKey` (2xx) | 245 | 194 | 899 | 71.4% | 131, 148 | 76, 80 | 188, 193 | 100%, 100% |

## Main-thread utilization and the webapp process

CPU is in percent of one core. "Main thread" is average and maximum over the run. The benchmark rate is the average over the whole ramp.

| Run | Start (UTC) | Benchmark req/s | Background req/s: baseline | Checkpoint | Main thread avg / max: baseline | abio | vector1 | abio proxy avg / max: baseline | Checkpoint | In flight max: baseline | abio, vector1 | Loop delay max ms: abio, vector1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hot-warm` | 18:26 | 89.1 | 48.5 | 13.7 | 81 / 94 | 24 / 46 | 22 / 56 | 115 / 136 | 55 / 161 | 56 | 4, 6 | 179, 478 |
| `surface-home` | 18:45 | 89.1 | 50.9 | 14.9 | 77 / 97 | 25 / 46 | 26 / 50 | 113 / 149 | 52 / 137 | 48 | 4, 6 | 178, 407 |
| `surface-title-movie` | 19:04 | 89.2 | 50.3 | 13.4 | 84 / 95 | 18 / 49 | 26 / 47 | 113 / 122 | 55 / 158 | 22 | 4, 5 | 267, 411 |
| `surface-title-show` | 19:23 | 89.1 | 47.5 | 15.2 | 87 / 96 | 26 / 57 | 22 / 73 | 112 / 133 | 59 / 157 | 26 | 5, 4 | 1,024, 1,160 |
| `surface-person` | 19:42 | 89.1 | 50.5 | 15.7 | 79 / 97 | 28 / 47 | 25 / 50 | 115 / 163 | 57 / 145 | 68 | 6, 5 | 204, 325 |
| `surface-discover` | 20:04 | 89.2 | 49.3 | 14.7 | 84 / 101 | 24 / 50 | 23 / 45 | 111 / 154 | 54 / 147 | 34 | 12, 11 | 221, 609 |
| `surface-share-list` | 20:27 | 89.2 | 49.1 | 15.6 | 81 / 97 | 26 / 49 | 31 / 54 | 115 / 161 | 56 / 137 | 39 | 10, 9 | 180, 235 |
| `surface-og-title` | 20:46 | 88.9 | 47.8 | 13.4 | 72 / 88 | 33 / 100 | Not read | 127 / 167 | 64 / 194 | 25 | 34, 7 | 120, 215 |
| `surface-og-share-list` | 21:03 | 89.0 | 49.4 | 13.9 | 75 / 93 | 32 / 90 | 35 / 95 | 119 / 158 | 69 / 201 | 34 | 7, 24 | 103, 205 |
| `latency-warm` | 21:20 | 1.9 | 48.0 | 15.1 | 76 / 87 | 16 / 27 | 26 / 38 | 111 / 120 | 33 / 40 | 10 | 2, 3 | 43, 191 |
| `latency-cold` | 21:25 | 1.9 | 51.9 | 15.3 | 77 / 90 | 18 / 29 | 28 / 43 | 114 / 155 | 31 / 41 | 14 | 2, 3 | 102, 117 |
| `latency-cold-longtail` | 21:30 | 1.0 | 48.0 | 15.6 | 83 / 96 | 22 / 34 | 28 / 38 | 113 / 130 | 33 / 42 | 17 | 2, 3 | 154, 68 |
| Reference, no benchmark | 21:34 | 0 | 54.1 | 14.1 | 79 / 89 | 17 / 28 | 24 / 32 | 116 / 146 | 31 / 42 | 11 | 3, 7 | 44, 47 |

- **Without benchmark load, a main thread is 17% to 24% busy** (79% in the baseline). abio rendered 3.6 uncached pages per second in the reference window, which is about 45 ms of main-thread time per render.
- **The proxy on abio idles at 0.3 to 0.4 cores** (1.1 to 1.5 in the baseline). It accepts 12 connections per second (40 to 65 in the baseline). That fits the baseline's estimate of 20 to 25 ms of proxy CPU per new connection.
- **Memory:** each process holds 2.15 to 2.37 GB. The cache nodes used 34% to 38% of their memory in every run, and Valkey's hosts never passed 26% CPU.
- **Other hosts:** abio averaged 14% to 21% of its 8 cores (maximum 49%). The Crate hosts averaged 6% to 18% (maximum 71%, in the slow period described under [Incidents](#incidents-and-end-state)). vector1 averaged 9% to 40% of its 16 cores: Qdrant used up to 12 cores there for an import between about 19:35 and 20:25 UTC.
- **Network:** the highest send rate from abio was 706 Mbit/s, at 500 share list OG images per second.

### CPU per request

A straight line through the steps of each ramp gives the CPU per request. Read these as plus or minus 30%: the background moves, and the idle level differs by run.

| Requests | Main thread per request, abio | Main thread per request, vector1 | abio's proxy per request | vector1's proxy per request it forwards |
| --- | --- | --- | --- | --- |
| Stored HTML pages (seven ramps) | 0.6 to 1.2 ms | 0.8 to 1.5 ms | 2.0 to 2.6 ms | 1.4 to 1.7 ms |
| OG images from the cache nodes (132 KB each) | 3.2 to 3.6 ms | 3.1 ms | 3.3 to 3.5 ms | 1.7 to 1.8 ms |
| Full movie page view, per request (33 of 34 are static files) | 0.7 ms | 0.5 ms | 1.5 ms | 1.5 ms |

- **The proxy uses more CPU per request than the app.** At 500 stored pages per second, Traefik on abio used 1.2 to 1.6 cores, and each Node main thread 0.4 to 0.5.
- **An OG image costs three to five times as much as a stored page,** on the main thread and in the proxy. The app reads 132 KB from Valkey for every request and holds no copy in the process.

## A full page view

The destination counts page views with their static and API requests. The baseline's scenarios send only the document, so one run was added: `--urls` with the 34 requests that Lighthouse saw a first-time visitor's browser send to the webapp host for the movie page (1 document, 24 scripts, 1 stylesheet, 1 font, 5 images, the manifest, and the icon: 453 KB together). All weights are equal, so 34 requests per second are one page view per second. No request to an API endpoint is in the list: an anonymous movie page view sends none with GET.

| Step (req/s) | Page views per second | p50 / p95 / p99 | abio main thread % | vector1 main thread % | abio proxy % | vector1 proxy % |
| --- | --- | --- | --- | --- | --- | --- |
| 34 | 1 | 4 / 22 / 41 | 26 | 32 | 63 | 6 |
| 68 | 2 | 4 / 19 / 41 | 24 | 28 | 43 | 8 |
| 136 | 4 | 4 / 23 / 42 | 33 | 35 | 65 | 14 |
| 272 | 8 | 4 / 17 / 34 | 35 | 31 | 87 | 25 |
| 500 | 14.7 | 4 / 23 / 43 | 42 | 44 | 121 | 40 |

No request failed in 34,007. The run reuses connections and the files aren't cached by the client, so it models first-time visitors without the cost of their TLS handshakes.

Per page view, from the fitted cost per request:

| Resource | Per movie page view | At 500 page views per second | Available today |
| --- | --- | --- | --- |
| Requests to the webapp host | 34 | 17,000 per second | 500 per second measured |
| Proxy CPU on abio | About 50 ms | About 25 cores | 8 cores, shared with the app and other containers |
| Node main-thread time | About 20 ms | About 10 cores, which is 12 processes at 85% | 2 processes |
| Proxy CPU on vector1, for its half | About 25 ms | About 12 cores | 16 cores, shared with Qdrant |
| Bytes from the webapp host | 453 KB | 226 MB per second, or 1.8 Gbit/s | Uplink speed not verified |

These lines are extrapolated from rates up to 500 requests per second. They are estimates, not break points.

## What saturates first

### Verified

- **Nothing saturated at 500 stored HTML pages per second.** Main threads were at 40% to 49%, the proxy on abio at 1.2 to 1.6 cores, and at most 12 requests were in flight per instance.
- **The main thread saturates first on OG images.** At 500 per second it was 97% busy on abio for the title image, and 88% on abio and 92% on vector1 for the share list image, with up to 34 requests in flight.
- **A title snapshot reload blocks the event loop for about one second.** Both instances loaded snapshot `20261004T193833Z` in the same second (238,539 titles, 1,149 ms on abio, of which 406 ms were the read from Redis). The per-minute log lines show stalls of 1,044 and 1,180 ms. The show page ramp was at 400 requests per second then: its p99 was 1,597 ms, and no request failed.
- **Crate, Valkey, and Qdrant didn't limit any run.** A stored page sends no statement, and the OG images read only Valkey.
- **The generator isn't the limit:** 56% of 4 cores at most, and no dropped iteration.

### Inferred

- **Stored HTML alone would reach about 1,000 to 1,400 requests per second on two instances,** from 0.6 to 1.5 ms of main-thread time per request and an idle level of 17% to 24%.
- **With static files, the first limit is between 60 and 90 first-time page views per second.** Two main threads have about 1.3 cores left, which is 60 page views at 20 ms each. The proxy on abio has about 4.5 of its 8 cores left, which is 90 page views at 50 ms each.
- **Pages that aren't stored:** a render costs about 45 ms of main-thread time, so the two processes render about 35 to 40 uncached pages per second together, of which crawlers use about 9 today.
- **New connections:** real visitors open their own connections. The baseline's estimate of 20 to 25 ms of proxy CPU per TLS handshake fits today's idle proxy, and would mean 10 to 12 cores at 500 new visitors per second.

### Not measured

- Rates above 500 requests per second, so no surface has a measured break point.
- New TLS connections per request, the public path under load, and HTTP/2 behavior of real browsers.
- Requests with the `GW-Cache-Identity` header, which only a cache in front would send.
- `POST` requests of a page view (the error tracking tunnel) and `POST /api/combined-search`.
- OG rendering on a miss, member traffic, and a deploy or a build on abio during a run.
- One instance alone. All load ran through the balanced route.

## Lab Web Vitals

`./bench.sh lighthouse` and `./bench.sh budget`, mobile profile with simulated throttling, three runs per page, median, public path, from worker3.

**The baseline numbers aren't comparable with the new ones.** Since the baseline, `lighthouse/run.sh` starts Chromium with `--hide-scrollbars`, which removed a first paint that was observed about one second late. The [render path budget](viral-spike-render-path-budget.md#what-changed) holds the same build measured with both setups: the old setup read 0 to 13 score points lower and up to 1.3 s more LCP.

| Page | Baseline, old setup: score / LCP / TBT | First budget run, new setup (`78d91b1e`) | Checkpoint, `lighthouse` run | Checkpoint, `budget` run | CLS | Observed FCP | Requests to the host | Total bytes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 34 / 9.8 s / 1.6 s | 83 / 3.83 s / 92 ms | 84 / 3.77 s / 97 ms | 83 / 3.76 s / 95 ms | 0 | 492 ms | 37 | 717 KB |
| Movie page | 30 / 10.7 s / 8.4 s | 67 / 3.86 s / 614 ms | 67 / 3.85 s / 658 ms | 69 / 3.93 s / 453 ms | 0 | 541 ms | 34 | 487 KB |
| Show page | 31 / 11.2 s / 10.3 s | 63 / 4.16 s / 597 ms | 69 / 4.16 s / 506 ms | 65 / 4.15 s / 645 ms | 0 | 559 ms | 34 | 542 KB |
| Person page | 38 / 9.8 s / 2.0 s | 80 / 4.07 s / 186 ms | 77 / 4.08 s / 231 ms | 78 / 4.08 s / 225 ms | 0 | 457 ms | 28 | 568 KB |
| Discover | 31 / 16.6 s / 3.1 s | 70 / 4.98 s / 292 ms | 70 / 5.19 s / 274 ms | 69 / 5.20 s / 292 ms | 0.028 | 402 ms | 39 | 1,170 KB |
| Share list page | 35 / 10.5 s / 1.6 s | 85 / 3.84 s / 48 ms | 84 / 3.87 s / 42 ms | 81 / 4.15 s / 43 ms | 0.010 | 519 ms | 26 | 572 KB |

- **`./bench.sh budget` passed: 90 of 90 lines**, run `20261004T214439Z-lighthouse-budget`. The last four columns are from that run.
- **Weight against the baseline:** a movie page view went from 949 requests and 16.9 MB to 45 requests and 0.5 MB, and a show page view from 1,172 requests and 39.2 MB to 43 requests and 0.56 MB. These numbers don't depend on the setup.
- **Disturbed runs:** in the `lighthouse` run, the CPU benchmark fell below 1,050 in 5 of 18 runs (832 and 962 on the person page, 790 on the share list, 1,020 on Discover, 1,043 on the movie page). The person page's median comes from two disturbed runs there. The `budget` run right after it is the repeat: its medians had a CPU benchmark of 1,046 (home) to 1,272, and its person page reads 78 with a TBT of 225 ms. No observed FCP was above 700 ms in the `lighthouse` run, and the `budget` run's medians were 402 to 559 ms.
- **The server's part is gone:** Lighthouse measured a server response time of 3 to 5 ms on five surfaces and 72 ms on the share list page.

Field Web Vitals aren't recorded here: that's the owner's query in PostHog, as in the baseline.

## Distance to the destination

| Target | Baseline | Checkpoint | What's left |
| --- | --- | --- | --- |
| 500 page views per second for one hour, no errors. A page view includes its static and API requests | The primary scenario held 2 document requests per second | 500 document requests per second held for 30 seconds per surface, 0 errors in 822,715 requests. With static files: 14.7 movie page views per second measured, 60 to 90 extrapolated | A factor of 6 to 8 in requests through the proxy and the Node processes. One hour wasn't run |
| p95 under 300 ms, full response, cached pages | Movie 832 ms, show 876 ms, Discover 890 ms, person 352 ms, share list 322 ms, home 138 ms, at 2 requests per second | 12 to 38 ms at 2 requests per second, 20 to 26 ms at 500 | Met for stored pages. A page that isn't stored: movie 278 ms, show 357 ms |
| Good mobile Core Web Vitals on home, title, share list, and person pages | LCP 9.8 to 11.2 s, TBT 1.6 to 10.3 s, CLS 0 (old setup) | LCP 3.76 to 4.16 s, TBT 43 to 658 ms, CLS 0 to 0.010 | LCP is 1.3 to 1.7 s over the 2.5 s limit on all four. TBT is over 200 ms on title pages (453 to 658 ms) and on the person page (225 to 231 ms). CLS is good. Lab data only |

### What only a request-level cache or more instances could fix

None of the following is in the app's page render any more. The numbers are the inputs. The choices are the owner's.

| Gap | Size | What removes it | What doesn't |
| --- | --- | --- | --- |
| Static requests on the Node main thread | 33 requests and about 20 ms of main-thread time per first-time page view. 500 page views per second need about 10 cores | Serving the files without Node (a file server behind the proxy, or a CDN), or about 12 instances | A page cache for HTML: the document is 1 of 34 requests |
| Requests through the proxy on abio | About 50 ms of proxy CPU per first-time page view. 500 page views per second need about 25 cores, on a host with 8 | Anything that answers before Traefik: a CDN, or a cache or file server that terminates TLS itself. Or several proxy hosts | More webapp instances behind the same proxy. A cache behind the proxy |
| New TLS connections | Not measured. Estimated at 20 to 25 ms of proxy CPU each | A CDN, or a cheaper certificate key than RSA 4096 | Everything behind the proxy |
| Bytes | 453 KB per movie page view from the host: 1.8 Gbit/s at 500 per second | A CDN | Everything on the same uplink |
| OG images | 3.1 to 3.6 ms of main-thread time and 3.3 to 3.5 ms of proxy CPU each. Two instances are full at about 500 per second. In the primary scenario they are 6% of the requests, 30 per second at 500 | A cache in front that honors `s-maxage=604800`, a CDN, or a copy in the process | Nothing needed at the primary scenario's share |
| Stored HTML | 0.6 to 1.5 ms of main-thread time per request. 500 per second use half of two main threads | A cache in front would take it to zero. More instances divide it | Not a limit at 500 per second |
| The first request for a URL, per instance and after every deploy | One render (about 200 to 240 ms) per URL, language, and instance. Each push to `main` empties both stores | A cache in front that outlives a deploy and is shared by the instances | More instances: each has its own store |
| Pages that never repeat (crawlers on the long tail) | 14 requests per second today, 87% data cache misses, 35 to 40 renders per second possible | More instances. A cache in front only with long lifetimes, and crawlers rarely repeat a URL | The in-process cache: by design it doesn't store them |
| The title snapshot reload | About 1 second on every instance at the same moment. The snapshot before this one was four hours older | A cache in front would hide it for stored pages. More instances don't, unless they reload at different times | |

### Inputs for "Choose the page cache layer"

- **The in-process cache already answers hot HTML** with a p95 of about 20 ms at 500 requests per second. A cache in front would save 0.6 to 1.5 ms of main-thread time per document request.
- **It would add:** one stored copy for all instances, copies that survive a deploy, no simultaneous one-second stall for stored pages, cached OG images, and room for long lifetimes.
- **Where it sits decides what it relieves.** Behind Traefik, it relieves only Node. Traefik's 2.0 to 2.6 ms per document request stay.
- **The balanced route sets `Set-Cookie: gw_instance=...` on every response**, also on responses with `public` and `s-maxage` (seen on a page requested with `GW-Cache-Identity` and on an OG image). [cache-identity.md](../cache-identity.md) says that a front cache never stores a response with `Set-Cookie`. A cache in front of abio's proxy would store nothing until the route stops setting the cookie on anonymous responses, or the cache is told to drop that one cookie.
- **Nothing sends `GW-Cache-Identity` today**, so every anonymous page is `private, max-age=0`. The shared policy has only been checked by single requests.
- **Each instance stores its own pages.** With two instances, a URL in a new language renders up to four times before both stores answer it (two requests per instance for admission).

### Inputs for "Decide where static assets are served from"

- **Static files are 33 of 34 requests of a first-time movie page view, and 26 to 39 requests per page view on the other surfaces.**
- **Measured cost in production:** 0.5 to 0.7 ms of Node main-thread time and 1.5 ms of proxy CPU on abio per request in the page view mix, with a p95 of 17 to 23 ms up to 500 requests per second.
- **A file server behind the proxy** removes the Node part (about 20 ms per page view) and keeps the proxy part (about 50 ms per page view) and the bytes.
- **A CDN for assets** removes both and the bytes, after the first fetch per edge location. The hashed files are `immutable` already.
- **More instances** divide the Node part only.

## Where production disagrees with the per-change measurements

| Measurement on one process on worker3 | Production, two instances through the proxy | Likely reason |
| --- | --- | --- |
| [Page cache](viral-spike-page-cache.md): a stored page costs 0.5 to 0.8 ms of main-thread time. One process holds the hot mix at 2,000 requests per second, with the main thread at 45% at 500 | 0.6 to 1.5 ms per request. At 250 requests per second per instance, the main thread is at 43% to 49%. Extrapolated: 1,000 to 1,400 per second for both instances | Not isolated. Candidates: 14 background requests per second take 17% to 24% of each main thread, the mix's OG images cost 3.1 to 3.6 ms each here, and requests arrive through one or two proxies. The number of connections isn't the cause: each container accepted 9 connections for 126 to 150 responses |
| [Static assets](viral-spike-static-assets.md): 0.24 to 0.31 ms of main-thread time per static request under load, 3,000 per second per process | 0.5 to 0.7 ms per request in the page view mix | Not isolated. Same candidates. The static document also didn't measure the proxy, which costs more than Node per request |
| [OG images](viral-spike-og-images.md): no rate for cached cards. The baseline held 35 per second without a change in the main thread | 3.1 to 3.6 ms of main-thread time per cached card. Two instances are full at about 500 per second | Each request reads the card from Valkey |
| [Render profile](viral-spike-render-profile.md): after its fixes, 97.6% of movie responses under 300 ms in production | 99.5% to 100% of uncached movie responses under 300 ms, p95 244 to 261 ms | Agrees. Later changes (cast cap, shorter miss path) and less background load |
| [Render path budget](viral-spike-render-path-budget.md): first run 63 to 85, LCP 3.83 to 4.98 s | 65 to 84, LCP 3.76 to 5.20 s | Agrees within the spread between runs |

## Limits of this checkpoint

- **No break point was measured.** The ramps end at the safety limit. Everything above 500 requests per second is a straight line through lower rates.
- **30 seconds per step.** The destination is one hour. Lifetimes of 30 minutes, snapshot reloads every 4 hours, and deploys don't show in a step.
- **Connection reuse and the private path,** as in the baseline.
- **Keyed pages only.** No request carried `GW-Cache-Identity`.
- **A different hour and a different background.** The baseline ran at 02:38 UTC with 50 background requests per second, this run at 18:25 UTC with 14.
- **One URL per surface,** and stored pages for all of them. The long-tail run is the only one without the page cache.
- **The cost per request is a fit** over a moving background, plus or minus 30%.
- **vector1's thread CPU is missing for the title OG image run.** The share list OG image run has it.

## Incidents and end state

- **No benchmark request failed,** no instance restarted, and both containers stayed healthy. The smoke check passed before every run on the public route and on both instances.
- **Three background requests answered 500 on vector1** at 20:01, 20:12, and 20:14 UTC: crawler requests for one movie and two people that nobody had asked for before. Each waited 10 seconds for Crate and ran into the app's timeout. From 20:00 to 20:30 UTC, 4% to 6% of abio's Crate statements took longer than 500 ms (8 of about 66,000 in the 100 minutes before). The Crate hosts used up to 71% of their CPU and sent up to 745 Mbit/s then. The first 500 came between two runs, and the stored pages of the running ramp (Discover) send no statement, so the benchmark didn't cause it. The job behind it wasn't identified. The smoke check on vector1 ran with the log line for that error skipped from then on.
- **The hourly Crate backup fails.** The backup log on the first Crate host shows a `RepositoryException` for every snapshot from 17:05 to 20:05 UTC. Not related to the runs, and not looked into.
- **The title snapshot reload** at 19:39 UTC, described above.
- **End state:** both instances healthy on `392439b7`, 5xx counters at 0 (abio) and 3 (vector1). On worker3, the benchmark images and the empty run directory remain, as before.

## Repeat the runs

Use the baseline's settings and commands, with these additions in the ignored `goodwatch-benchmark/config.env`:

```sh
BENCH_METRIC_HOSTS='10.0.0.21:target:coolify-proxy+gk4owk8,10.0.0.11:data,10.0.0.12:data,10.0.0.13:data,10.0.0.14:data,10.0.0.15:data,10.0.0.16:data,10.0.0.20:target:coolify-proxy+gk4owk8+qdrant'
BENCH_WEBAPP_PROBE=1
BENCH_WEBAPP_PROBE_EXTRA='10.0.0.20'
```

```sh
cd goodwatch-benchmark
R=1,2,4,6,8,10,12,14,16,18,20,25,30,35,40,45,50,55,60,65,80,100,125,150,200,250,300,400,500
SHA=$(git rev-parse origin/main)

# Before each run
./bench.sh smoke --commit $SHA && ./bench.sh smoke --host abio --commit $SHA && ./bench.sh smoke --host vector1 --commit $SHA

# Primary scenario and one ramp per surface, as in the baseline, with the longer rate list
./bench.sh load --mode ramp --rates $R --step-duration 30 --cache warm --urls hot --label checkpoint-hot-warm --raw --yes-ramp-production

# A full movie page view: a URL set with the document and each same-origin file of its Lighthouse report, weight 1 each
./bench.sh load --mode ramp --rates 34,68,136,272,500 --step-duration 30 --cache warm --urls <file.json> --label checkpoint-page-view-movie --raw --yes-ramp-production

# Web Vitals
./bench.sh lighthouse --urls <urls file with the share list> --runs 3 --label checkpoint
./bench.sh budget

# Compare one run with its baseline
./bench.sh compare results/baseline-2026-10-04/20261004T024106Z-load-baseline-hot-warm results/checkpoint-2026-10-04/20261004T182537Z-load-checkpoint-hot-warm
```

The file names of the static assets change with every build, so the page view URL set isn't in Git: build it from the `network-requests` audit of a Lighthouse report of the same deploy.
