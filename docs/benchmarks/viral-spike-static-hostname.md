# Page views with the static hostname on production

This page reports the page view runs after production switched to the static hostname (`STATIC_ASSETS=auto`): what a page view still costs the origin, what holds, and what limits it now. It belongs to the "Serve a viral traffic spike" map and to the ticket "Switch production to the static hostname and rerun the page view benchmark". The earlier state is in [Full page views and new TLS connections on production](viral-spike-page-views.md). How the static hostname works is in [static-assets.md](../static-assets.md).

The run summaries are in [`goodwatch-benchmark/results/static-hostname-2026-10-09/`](../../goodwatch-benchmark/results/static-hostname-2026-10-09/). The scenario is described under "Page views" in the [benchmark README](../../goodwatch-benchmark/README.md#page-views).

## Summary

- **No limit of the origin was found with the static hostname.** Movie page views ran without a failed request up to 120 per second, with abio at 34% of its 8 cores. The two generators are the limit: steps up to 80 page views per second are valid, and at 100 and 120 a generator used 89% to 98% of its cores.
- **With the files from the origin, today's build holds 120 movie page views per second and fails at 140** (54 failed page views, page view p95 over 3.6 seconds, vector1's main thread at 99%). That is the same pair of instances, the same hour, and `--files origin`.
- **A movie page view now sends the origin 3 requests instead of 37:** the document and the favicon from the visitor, and the web manifest through the CDN, which doesn't store it. The visitor opens 1 connection to the origin instead of 2.
- **Per movie page view at the origin, static hostname against origin files:** 8 ms against 25 ms of proxy CPU on abio, 54 KB against 619 KB sent by abio, and Node main-thread time that is too small to read from the ramp (6.9 ms with origin files).
- **The movie page's document alone holds 500 per second on new connections,** the destination's rate: document p95 27 to 44 ms, no failed request, abio at 47% of 8 cores, its proxy at 2.2 cores, the main threads at 39% and 68%. This run sends no files at all, so it is the origin's share of a page view without the favicon and the manifest.
- **The primary mix ran clean up to 80 visitors per second and without a site error up to 100,** the highest planned step. abio stayed at 33% CPU or less. Four of 311,596 requests to the static hostname were answered with a 5xx status.
- **The static hostname never answered 403 or 429,** and no challenge page, in 920,000 requests from two addresses at up to 4,100 requests per second. Every file but the web manifest was a cache hit (73 of 74 files, sampled before and after the runs).
- **The benchmark script opened 36 connections per page view instead of 4** in `--files page` mode until this lane fixed it, see [The connection storm in the page-view scenario](#the-connection-storm-in-the-page-view-scenario). Every number on this page is from after the fix.
- **A deploy ended the measurement.** `7f64aeb2` reached both instances at 11:43 to 11:45 UTC. One supplementary run overlapped it and isn't used.

## Conditions

| Item | Value |
| --- | --- |
| Date | Friday, October 9, 2026, 11:08 to 11:40 UTC |
| Commit deployed | `42c2db2e` on both instances, containers started at about 10:58 and 11:00 UTC, no restart during the valid runs |
| Static assets | `STATIC_ASSETS=auto`, `goodwatch_static_assets_in_use{mode="auto"}` at 1 on both instances before every valid run |
| Serving | Two `remix-serve` processes: abio (`10.0.0.21`, 8 cores, also the proxy) and vector1 (`10.0.0.20`, 16 cores). The static hostname is a CDN in front of the same origin |
| Certificate | ECDSA P-256 (read with `openssl s_client`). On October 5 it was RSA 4096, so a handshake costs the proxy less than in the earlier report |
| Generators | worker3 (`10.0.0.32`) and worker1 (`10.0.0.30`), 4 cores each, half of each step's rate each, k6 1.8.1 in Docker |
| Path | Public, new connections: every visitor does a full TLS handshake on every connection |
| Page assets | One capture of the deployed build (11:08 UTC), passed to every run with `--page-assets` |
| Stop rules | 1% of requests or page views failed, document p95 above 3,000 ms, page view p95 above 10,000 ms, or dropped iterations above 5% of the highest step |
| Step length | 30 seconds, 25 for the document ramp. Each step's resource numbers leave out its first 5 seconds |
| Background traffic | abio's proxy accepts 25 to 30 new connections per second and uses 0.3 to 0.4 cores without benchmark load (the fits' intercepts) |

- **Before every run:** `./bench.sh smoke --commit 42c2db2e` on the public route, the commit and the gauge read from both containers, and a check that neither generator has a lock or a benchmark container.
- **A step is valid only when its generators have room.** A generator above about 80% of its cores delays its own requests, so such a step's latencies describe the generator.
- **No run overlapped the Crate backup** (minutes 3 to 8) or the TMDB copy windows.

## What a page view sends

Captured with headless Chromium on worker3, mobile viewport, empty profile, public path.

| | Movie page, files from the static hostname | Movie page, files from the origin | Primary mix, per visitor, static hostname |
| --- | --- | --- | --- |
| Requests to the site | 2 (the document and `/favicon-32x32.png`) | 37 | 2.03 |
| Requests to the static hostname | 35 | 0 | 30.58 |
| Captured bytes from the site | 51 KB | 567 KB | 41 KB |
| Captured bytes from the static hostname | 516 KB | 0 | 467 KB |
| Connections to the site | 1 | 2 | 1 |
| Connections to the static hostname | 3 | 0 | 2.53 |
| Site's share of requests and bytes | 5.4% and 9.0% | 100% | 6.2% and 8.1% |

- **Three connections to the static hostname:** one for the scripts, the stylesheet, the font, and the manifest (24 requests, the benchmark's main group), one for images (5 requests), and one that Chrome opened with HTTP/3 for the six late scripts. k6 sends the third one over HTTP/2.
- **Not sent, as before:** `POST /api/e` and `POST /api/poster-impressions`, which the movie page now sends too.
- **Requests to other hosts** (TMDB images, analytics): 14 per movie page view, 342 KB. They never reach the site.

### What the origin still receives

Counted by the two instances' own route counters over the movie ramp (17,476 visitors):

| Route counter | abio | vector1 | Per page view |
| --- | --- | --- | --- |
| `/movie/:movieKey` | 9,400 | 9,348 | 1.07 (with the warm-up and background) |
| `static` | 26,261 | 8,776 | 2.00 |

- **Two file requests per page view still reach the origin.** One is the favicon, which stays on the site's host by design. The other arrives through the CDN.
- **The one through the CDN is the web manifest.** `site.webmanifest` is the only one of the 74 captured files that the CDN answers with `CF-Cache-Status: DYNAMIC`. The other 73 answered `HIT` from both generators, before the first run and after the last. The app sends the manifest with `public, max-age=3600`, so a cache rule for it on the static hostname would remove that request. That is an owner step.
- **Requests for the static hostname reach abio's instance only.** vector1's 8,776 are the favicon's half. The 17,500 more on abio are the manifest's. Whether that is intended wasn't checked.
- **In the primary mix** the two instances counted 19,251 `static` requests for 9,152 page views, which is 2.1 per page view.

## Movie page with the static hostname

`--files page`, two generators. Rates are visitors per second. Where two values are separated by a comma, they are the two generators.

| Visitors per second | Page views per second | Failed page views | Failed requests, site / static hostname | Document p50 / p95 ms | Page view p50 / p95 ms | Requests per second, site / static hostname | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | Highest loop delay ms, abio / vector1 | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | 19.9 | 0 | 0 / 0 | 5 / 23, 6 / 23 | 116 / 171, 120 / 175 | 40 / 698 | 80 | 44 | 35 | 9 | 43 | 32 / 127 | 21 | 18 | 26, 28 |  |
| 40 | 38.6 | 0 | 0 / 0 | 5 / 21, 6 / 20 | 114 / 161, 117 / 163 | 77 / 1,350 | 154 | 62 | 33 | 11 | 34 | 47 / 57 | 24 | 27 | 45, 48 |  |
| 60 | 58.6 | 0 | 0 / 0 | 6 / 20, 6 / 23 | 113 / 176, 118 / 175 | 117 / 2,050 | 234 | 75 | 36 | 16 | 33 | 34 / 104 | 25 | 35 | 59, 63 |  |
| 80 | 78.6 | 0 | 0 / 0 | 6 / 22, 6 / 22 | 113 / 162, 116 / 167 | 157 / 2,750 | 314 | 92 | 33 | 16 | 38 | 37 / 99 | 27 | 44 | 70, 76 | Holds. Last step with both generators under 80% |
| 100 | 98.6 | 0 | 0 / 0 | 7 / 32, 12 / 65 | 115 / 175, 136 / 389 | 197 / 3,449 | 394 | 106 | 39 | 19 | 43 | 30 / 76 | 31 | 56 | 80, 89 | No failed request. worker1 near its limit |
| 120 | 118.6 | 0 | 0 / 0 | 8 / 31, 25 / 99 | 121 / 191, 204 / 666 | 237 / 4,144 | 473 | 120 | 47 | 21 | 37 | 45 / 55 | 34 | 64 | 89, 98 | No failed request. Generators saturated: latencies not valid |
| 150 | 114.8 | 0 | 0 / 0 | 29 / 98, 71 / 295 | 234 / 555, 1,363 / 2,507 | 236 / 4,048 | 467 | 95 | 54 | 16 | 35 | 47 / 49 | 34 | 51 | 99, 100 | Not valid: worker1 stopped on dropped iterations, both generators at 99% to 100% |

Dropped iterations: 654. Requests: 646,789, of which 611,730 to the static hostname. None failed.

- **What holds:** 80 page views per second, with a document p95 of 22 ms and a page view p95 of 162 to 167 ms. Nothing at the origin changes between 20 and 120: the main threads stay at 33% to 47%, which is their level without the benchmark, and abio's CPU goes from 21% to 34%.
- **What limits it:** the generators. A visitor now opens 4 connections instead of 2, and one visitor per second costs a generator about 59 ms of CPU (43 ms with the files from the origin). Two 4-core generators are full at 100 to 120 page views per second.
- **The page view takes longer for the benchmark than with origin files** (113 to 120 ms at the median, against 45 to 57 ms). The generator stands 1 ms from the origin and 17 to 30 ms from the CDN, and the first request to the static hostname goes out alone. This says nothing about a visitor.
- **Not raised further.** The plan was to go on above 150 only after a clean run up to 150, and the generators didn't get there.

## Movie page with the files from the origin

`--files origin` on the same build: the comparison with the state before the switch.

| Visitors per second | Page views per second | Failed page views | Failed requests, site / static hostname | Document p50 / p95 ms | Page view p50 / p95 ms | Requests per second, site / static hostname | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | Highest loop delay ms, abio / vector1 | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | 19.9 | 0 | 0 / 0 | 6 / 23, 5 / 28 | 49 / 83, 50 / 91 | 738 / 0 | 40 | 113 | 40 | 43 | 48 | 80 / 127 | 33 | 107 | 16, 19 |  |
| 40 | 38.6 | 0 | 0 / 0 | 8 / 162, 6 / 169 | 55 / 525, 51 / 446 | 1,427 / 0 | 77 | 188 | 61 | 74 | 81 | 183 / 290 | 46 | 200 | 36, 37 | A stall of 180 to 290 ms on both instances |
| 60 | 58.6 | 0 | 0 / 0 | 5 / 30, 5 / 34 | 45 / 92, 46 / 108 | 2,167 / 0 | 117 | 240 | 56 | 97 | 63 | 95 / 69 | 53 | 301 | 45, 51 |  |
| 80 | 78.6 | 0 | 0 / 0 | 9 / 165, 11 / 176 | 51 / 1,954, 59 / 1,875 | 2,907 / 0 | 157 | 296 | 60 | 142 | 82 | 203 / 303 | 60 | 403 | 53, 57 | A stall of 200 to 300 ms on both instances: page view p95 1.9 s |
| 100 | 98.6 | 0 | 0 / 0 | 10 / 66, 10 / 65 | 54 / 179, 56 / 176 | 3,647 / 0 | 197 | 322 | 80 | 158 | 84 | 106 / 141 | 68 | 497 | 62, 66 |  |
| 120 | 118.6 | 0 | 0 / 0 | 13 / 54, 15 / 62 | 57 / 142, 66 / 165 | 4,387 / 0 | 237 | 364 | 83 | 183 | 84 | 146 / 68 | 69 | 595 | 70, 77 | Holds |
| 140 | 135.3 | 54 | 350 / 0 | 22 / 223, 24 / 228 | 88 / 3,830, 96 / 3,652 | 5,065 / 0 | 275 | 404 | 91 | 329 | 99 | 109 / 151 | 76 | 665 | 77, 80 | Fails: 1.0% and 1.25% of page views failed |
| 150 | 128.0 | 0 | 0 / 0 | 39 / 535, 35 / 399 | 127 / 3,662, 108 / 568 | 4,855 / 0 | 268 | n/a | n/a | 753 | 102 | n/a / 201 | 73 | 542 | 76, 83 | Stopped by the rule after 10 to 14 seconds |

Dropped iterations: 189. Requests: 778,290.

- **Break point:** 120 page views per second hold (page view p95 142 to 165 ms). At 140 the stop rule fired: 54 of about 4,800 page views failed, 342 requests got no answer (the longest waited for the 30-second limit), and 8 were answered with a 5xx status. Neither instance's 5xx counter moved, so those answers came from a proxy.
- **What limits it:** the Node main threads, at 83% and 84% at 120 and 91% and 99% at 140. abio's CPU is at 69% to 76%. On October 5 the host's CPU was the limit at 100, because the RSA 4096 handshakes used most of it.
- **The earlier figure of about 140 was measured over the private path with reused connections.** On the public path with new connections, the earlier report held 100, and today's build holds 120.
- **Two steps show a stall** of 180 to 300 ms of event loop delay on both instances at once, at 40 and at 80 visitors per second, about a minute apart. vector1's proxy accepted 18 to 22 connections per second in exactly those steps and almost none in the others. The cause wasn't looked into. The step at 60 shows that the rate itself isn't the reason.

## Primary scenario (`hot` mix) with the static hostname

The mix is 60% movie page, 8% share list page, 7% Discover, 5% each for home, show, and person pages, and 10% link-preview bots. `--files page`, two generators.

| Visitors per second | Page views per second | Failed page views | Failed requests, site / static hostname | Document p50 / p95 ms | Page view p50 / p95 ms | Requests per second, site / static hostname | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | Highest loop delay ms, abio / vector1 | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | 17.9 | 0 | 0 / 0 | 5 / 17, 5 / 19 | 123 / 193, 127 / 240 | 40 / 605 | 70 | 41 | 30 | 8 | 32 | 45 / 46 | 26 | 18 | 25, 23 |  |
| 40 | 34.8 | 2 | 0 / 2 | 5 / 20, 5 / 22 | 117 / 171, 122 / 182 | 79 / 1,182 | 136 | 58 | 30 | 12 | 33 | 40 / 55 | 29 | 28 | 39, 47 | Two 5xx answers from the static hostname |
| 60 | 52.2 | 0 | 0 / 0 | 5 / 28, 6 / 29 | 118 / 176, 130 / 196 | 119 / 1,771 | 206 | 75 | 35 | 16 | 44 | 45 / 124 | 27 | 47 | 57, 81 |  |
| 80 | 71.3 | 1 | 0 / 1 | 5 / 23, 6 / 29 | 113 / 185, 126 / 212 | 160 / 2,424 | 278 | 90 | 32 | 17 | 30 | 282 / 50 | 29 | 45 | 67, 77 | Holds. One 5xx answer from the static hostname |
| 100 | 87.8 | 0 | 0 / 1 | 5 / 24, 7 / 43 | 113 / 167, 129 / 241 | 199 / 3,007 | 346 | 96 | 41 | 21 | 44 | 115 / 107 | 33 | 52 | 73, 83 | No site error. worker1 near its limit. One 5xx answer from the static hostname |

Dropped iterations: 0. Requests: 332,303, of which 311,596 to the static hostname. The ramp ended at its highest planned step.

- **What holds:** 80 visitors per second (71 page views plus the bot requests), with a document p95 of 23 to 29 ms and a page view p95 of 185 to 212 ms. At 100 the site answered every request, with a document p95 of 24 and 43 ms.
- **What limits it:** the generators, as for the movie page. The origin is at its idle level: abio's CPU at 26% to 33%, the main threads at 30% to 44%.
- **Four 5xx answers from the static hostname** in 311,596 requests, in three different steps, none on the site's host. The movie ramp had none in 611,730. The summary doesn't keep the status code or the file of a failed request, so whether they were the CDN's own answers or passed on from the origin isn't known. Neither instance's 5xx counter moved. They aren't a rate limit: a limit answers 429 or 403, and the count doesn't grow with the rate.
- **Before the switch,** the same mix held 110 visitors per second with abio's CPU at 92% (October 5). It wasn't repeated with `--files origin` today.

## Documents alone

This run isn't in the ticket. It answers what the two-generator limit leaves open: whether the origin takes its share of 500 page views per second. `urls/movie-document.json` is the movie page as a single request: every visitor opens a connection, does a full handshake, requests the document with the cache identity header, and closes. No file is requested from any host.

| Visitors per second | Documents per second | Failed requests | Document p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | Highest loop delay ms, abio / vector1 | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 50 | 49.9 | 0 | 5 / 25, 6 / 25 | 50 | 53 | 40 | 10 | 35 | 42 / 44 | 22 | 31 | 15, 19 |  |
| 100 | 95.9 | 0 | 5 / 26, 5 / 26 | 96 | 83 | 33 | 15 | 41 | 43 / 52 | 28 | 53 | 26, 24 |  |
| 150 | 145.8 | 0 | 5 / 25, 6 / 22 | 146 | 105 | 32 | 20 | 40 | 36 / 54 | 29 | 74 | 32, 31 |  |
| 200 | 195.8 | 0 | 6 / 25, 6 / 27 | 196 | 130 | 34 | 22 | 40 | 81 / 74 | 34 | 96 | 39, 44 |  |
| 250 | 245.8 | 0 | 6 / 23, 5 / 24 | 246 | 151 | 39 | 27 | 46 | 48 / 56 | 36 | 118 | 48, 52 |  |
| 300 | 295.9 | 0 | 6 / 25, 6 / 23 | 296 | 172 | 41 | 32 | 43 | 106 / 45 | 41 | 139 | 56, 58 |  |
| 350 | 345.8 | 0 | 6 / 54, 6 / 47 | 346 | 188 | 48 | 35 | 63 | 108 / 128 | 42 | 157 | 63, 68 |  |
| 400 | 395.8 | 0 | 5 / 20, 6 / 24 | 396 | 199 | 37 | 38 | 41 | 40 / 65 | 44 | 182 | 67, 71 |  |
| 450 | 445.8 | 0 | 7 / 61, 7 / 72 | 446 | 217 | 53 | 46 | 73 | 106 / 201 | 49 | 208 | 71, 75 |  |
| 500 | 495.5 | 0 | 6 / 27, 7 / 44 | 496 | 215 | 39 | 46 | 68 | 28 / 87 | 47 | 207 | 77, 83 | Holds. worker1 near its limit |

Dropped iterations: 0. Requests: 81,111. None failed.

- **500 documents per second on new connections hold.** The document p95 stays between 20 and 72 ms over the whole ramp, and no step is slower than the one before it for a reason that grows with the rate.
- **Room at 500:** abio's CPU is at 47% of 8 cores, its proxy at 2.2 cores, and the main threads at 39% and 68%. vector1's main thread moved between 41% and 73% over the last four steps without following the rate, so the background decides that number.
- **What this run leaves out of a page view's cost at the origin:** the favicon (500 small requests per second on the same connections), the manifest through the CDN (500 per second, on abio's instance alone today), and the two POSTs that the benchmark never sends.

## Cost per page view at the origin

Straight lines through the steps in which both generators stayed under 80% (static hostname: 20 to 80 page views per second, origin files: 20 to 120, documents: 50 to 450). Read each as plus or minus 30%: the static hostname's line has four points, and the background moved.

| Resource | Movie page view, static hostname | Movie page view, files from the origin | Document alone |
| --- | --- | --- | --- |
| Proxy CPU on abio | 8.1 ms | 24.7 ms | 4.1 ms |
| Proxy CPU on vector1 | 1.3 ms | 14.4 ms | 0.9 ms |
| Node main-thread time, both instances | No slope to read (67% to 78% of a core for both together at every valid step) | 6.9 ms (3.9 on abio, 3.0 on vector1) | 1.0 ms |
| All CPU on abio | 6.9 ms | 29.2 ms | 5.0 ms |
| Sent by abio | 54 KB (0.43 Mbit/s per page view per second) | 619 KB (4.95 Mbit/s) | 55 KB (0.44 Mbit/s) |
| Connections accepted by abio's proxy | 0.92 | 1.97 | 1.02 |
| Requests that reach the origin | 3 | 37 | 1 |

- **The proxy's work per page view fell to a third, the bytes to an eleventh.** What is left of the bytes is the document: the document ramp sends the same 54 to 55 KB.
- **The "all CPU" line of the static hostname is below its proxy line.** That is the fit's uncertainty, not a finding.
- **The manifest arrives without a new connection.** The proxy accepted 0.92 connections per page view, so the CDN reuses its connections to the origin.
- **Against October 5** (53 ms of proxy CPU on abio and 621 KB per movie page view): today's origin-files line already shows the ECDSA certificate (24.7 ms), and the static hostname takes it to 8 ms.

## Conclusions

### The page view rate that holds with the static hostname

- **Measured with whole page views:** 80 movie page views per second and 80 visitors per second of the primary mix hold on the two instances, with every step valid. Up to 120 movie page views and 100 visitors of the mix per second, no request to the site failed, and the origin's CPU barely moved.
- **Measured for the origin's share:** the pair answers 500 movie documents per second on new connections with a p95 under 50 ms and abio at 47% CPU.
- **Not measured:** whole page views above 120 per second. That needs about 10 generator cores per 100 page views per second, so about 50 cores for 500, or a generator that doesn't fetch the files.

### What limits it now

- **In this measurement, the generators.** Nothing at the origin was near a limit in any run with the static hostname.
- **At the origin, by extrapolation:** at 500 movie page views per second, abio's proxy would use 2.2 cores (the document ramp, measured) to 4.3 cores (the page view line, extrapolated from 80), and abio would send 210 to 225 Mbit/s. The Node main threads would carry 500 documents (measured: 39% and 68%) plus 1,000 small file requests per second, which is about 0.3 cores more at the 0.3 ms per file from [Static assets served by the webapp process](viral-spike-static-assets.md), with the manifest's half on abio alone. So the first limit would be a Node main thread, most likely vector1's, and this is an estimate.
- **Outside the origin:** the CDN answered everything that was asked of it. Whether it limits one address above 4,100 requests per second wasn't tested, and a spike's visitors don't share an address.

### OG images

**They don't need to move for the destination.** Reasons, from the numbers:

- **Rate:** the primary mix sends 0.06 OG image requests per visitor (605 in 10,181 visitors), so 30 per second at 500 visitors per second. On October 5 the pair answered 1,250 per second with the main threads at 50% to 65%, at about 0.6 ms of main-thread time each.
- **Bytes:** an OG image is about 136 KB (title) to 173 KB (share list), from the October 5 ramps. At 0.06 per visitor that is about 8 KB of the 56 KB that abio sends per visitor of the mix, or about 35 Mbit/s at 500 visitors per second.
- **Cost of moving:** a `meta` function doesn't run inside the render, so an OG image's address can't follow the per-instance fallback as the other files do (see [static-assets.md](../static-assets.md)). A crawler that got the static address during an outage would get no image.

Moving them becomes worth it if link-preview bots grow far beyond a tenth of the visitors, or if the origin's uplink turns out to be the limit. Neither shows in these numbers.

### Instances for 500 page views per second

- **With the static hostname up: the two instances that run today,** as far as this measurement reaches. That is measured for 500 documents per second and estimated for the rest of a page view. A third instance isn't needed for capacity by these numbers. It would take the load off vector1's main thread, which is the least certain number here.
- **Before relying on two,** three things should be measured or removed: the error tracking POST (500 per second, each forwarded by Node to the vendor), the poster impressions POST (500 writes per second on title pages), and the manifest request through the CDN.
- **With the static hostname down, no number of instances behind today's proxy is enough.** In a fallback the pair holds 120 movie page views per second. 500 would need about 9 instances for the main threads, about 12 proxy cores on abio's 8, and about 2.5 Gbit/s from one host. So the destination depends on the static hostname, and the "10 minutes on the origin" alert is the signal that capacity is back at 120.

## The connection storm in the page-view scenario

The first movie ramp with `--files page` stopped at 20 visitors per second, with both generators at 87% to 100% CPU at 10 visitors per second each.

- **Cause:** k6 sends a page's files as one batch. Go's HTTP client starts one connection for every request that finds none open, and the static hostname has none when the batch starts. With the files on the site, the document had opened the connection before the batch.
- **Measured on worker3** (TCP connections opened by the host over a run of 59 visitors): 2,146 before the fix, which is 36 per visitor, and 239 after, which is 4.05. The summary's "TLS handshakes" didn't show it, because it counts requests that report a handshake, and most of the extra connections never carried a request.
- **Fix:** in `k6/load.js`, the first request to a host without a connection goes out alone, and the rest follow as one batch. This is what a browser's `preconnect` does. A unit test in `scripts/k6-load.test.mjs` covers it. `scripts/test-page-view.sh`, which needs Docker, wasn't run.
- **Affected:** every earlier `--files page` run, including this ticket's smoke run at 08:50 UTC. Runs with the files on the site were never affected, so the reports of October 5 stand.
- **The fix is on this branch only** until it's merged. The two stopped runs are in the results folder as `sh-movie-page-1-a` and `-b`, and the three counting runs as `sh-gen-check`, `-check2` (before the fix), and `-check3` (after).

## Not measured or not verified

- **Whole page views above 120 per second with the static hostname,** and the primary mix above 100 visitors per second.
- **The primary mix with `--files origin` on today's build.**
- **The status code and the file of the four 5xx answers from the static hostname.** The summary keeps a count per route only. The per-host status table in `summary.json` is empty (all zeros), also for successful requests, so the failed requests per host on this page come from the hosts' error rates.
- **Cloudflare's cache status during a run.** k6 doesn't record response headers per request. The status was sampled with one request per captured file from each generator, before the first and after the last run.
- **The CDN's behavior on a cold cache,** in other regions, or right after a deploy, when every file name is new. The generators stand in one data center and reach one edge location.
- **The error tracking POST and the poster impressions POST** under load. Neither is ever sent by the benchmark.
- **The primary mix's documents alone.** The run `sh-hot-documents` (500 visitors per second reached, no failed request, document p95 28 to 42 ms) started 15 seconds after vector1's new container for `7f64aeb2` was created, so it isn't valid. It started because the lane's pre-run check printed its failure without stopping the command that followed.
- **A fallback under load:** the switch to the origin while page views arrive, and the 36 seconds before it.
- **The stalls at 40 and 80 visitors per second in the origin-files ramp,** and why requests for the static hostname reach abio's instance only.
- **Returning visitors, other browsers, and more than one cache identity,** as in the earlier report.
- **The time a real visitor needs.** The page view durations here are a generator's, 1 ms from the origin.

## Incidents and end state

- **Real visitors were affected** for about 45 seconds in the origin-files ramp (the steps at 140 and 150: page view p95 over 3.6 seconds, 350 benchmark requests failed), and for a few seconds each in its two stalls. No run with the static hostname slowed the site.
- **The connection storm reached the CDN and the origin's proxy:** about 36 connections per visitor for about a minute at up to 20 visitors per second in the first ramp, and in two short counting runs at 2 visitors per second.
- **A deploy happened at the end:** `7f64aeb2` was pushed at 11:41:30 UTC, abio's new container was created at 11:43:15 and vector1's at 11:44:06. All valid runs ended by 11:39:45. Measuring stopped there.
- **End state at 11:49 UTC:** both instances on `7f64aeb2`, the gauge at 1 on both, the smoke check passed on the public route and on each instance. Each instance's 5xx counter stayed at 0 over every run.
- **Generators:** no container and no lock left on worker3 or worker1.

## Repeat the runs

```sh
cd goodwatch-benchmark
SHA=$(git rev-parse origin/main)
export ABORT_ERROR_RATE=0.01
export BENCH_METRIC_HOSTS='10.0.0.21:target:coolify-proxy+gk4owk8,10.0.0.20:target:coolify-proxy+gk4owk8'
export BENCH_WEBAPP_PROBE=1 BENCH_WEBAPP_PROBE_EXTRA='10.0.0.20'

# Before each run. Stop when it fails: a deploy invalidates a run.
./bench.sh smoke --commit $SHA

# One capture of the deployed build for all runs
./bench.sh load --scenario page-view --mode smoke --rate 1 --duration 15 --urls hot --path public --label capture
CAPTURE=results/<that run>/page-view-capture.json

# Movie page views with the static hostname, then with the files from the origin. Rates are per generator.
./bench.sh load --scenario page-view --mode ramp --rates 10,20,30,40,50,60,75 --step-duration 30 --urls hot \
  --routes title_movie:browser --path public --files page --page-assets $CAPTURE --allow-above-500 \
  --yes-ramp-production --label movie-page
./bench.sh load --scenario page-view --mode ramp --rates 10,20,30,40,50,60,70,75 --step-duration 30 --urls hot \
  --routes title_movie:browser --path public --files origin --page-assets $CAPTURE --allow-above-500 \
  --yes-ramp-production --label movie-origin

# The primary mix with the static hostname
./bench.sh load --scenario page-view --mode ramp --rates 10,20,30,40,50 --step-duration 30 --urls hot \
  --path public --files page --page-assets $CAPTURE --allow-above-500 --yes-ramp-production --label hot-page

# The movie page's document alone
./bench.sh load --scenario page-view --mode ramp --rates 25,50,75,100,125,150,175,200,225,250 --step-duration 25 \
  --urls urls/movie-document.json --path public --yes-ramp-production --label movie-document
```

Each command ran twice at the same moment, the second time with `BENCH_GENERATOR=10.0.0.30 BENCH_METRIC_HOSTS= BENCH_WEBAPP_PROBE=0` (see "Two generators" in the README). The rates in the tables are the sum of both. `--allow-above-500` is needed because the limit counts requests, not visitors: 75 visitors per second are 2,775 requests per second.

To sample the CDN's cache status, request every static file of the capture once from a generator and count the `CF-Cache-Status` values.
