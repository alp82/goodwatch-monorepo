# Full page views and new TLS connections on production

This page reports the first load runs that send what a browser sends: a new TLS connection per visitor, the document with the cache identity header, and the files and API requests of the page. It belongs to the "Serve a viral traffic spike" map and covers two tickets: "Make the load benchmark send full page views with the cache identity header" and "Measure and cut the proxy's cost for new TLS connections".

It is the input for the owner's decisions about what goes in front of the proxy and where static files are served from. It gives the numbers and the options and doesn't decide.

The run summaries are in [`goodwatch-benchmark/results/page-views-2026-10-05/`](../../goodwatch-benchmark/results/page-views-2026-10-05/). The scenario is described under "Page views" in the [benchmark README](../../goodwatch-benchmark/README.md#page-views).

## Summary

- **A movie page view on the public path with new connections holds at 100 page views per second,** is slow at 110, and fails at 120. The limit is the CPU of the host that runs the proxy: 92% to 96% of abio's 8 cores, of which the proxy uses 6.1 to 6.3. The destination is 500.
- **The primary scenario's mix holds only 30 visitors per second** with a document p95 under 300 ms, and fails at 80. The limit there isn't the proxy. It is the home page's `POST /api/living-room/picks?view=pool`, which costs about 350 ms of Node main-thread time per home page view. The home page alone holds 2 page views per second. A later change cut this request, see [The home page's pool request after the fix](#the-home-pages-pool-request-after-the-fix). With the change deployed, the home page holds 60 and the mix 110, see [After the home pool fix](#after-the-home-pool-fix).
- **The same mix without the home page behaves like the movie page:** it holds 100 visitors per second, and the host CPU on abio is the limit.
- **Over the private path with reused connections, a movie page view holds at 140 per second,** and both Node main threads are the limit (85% to 88%, and 94% to 96% at the failing step). So TLS handshakes cost about 40 page views per second of today's capacity.
- **A new TLS connection costs 14 to 16 ms of proxy CPU** (measured, 25 to 400 new connections per second). The baseline estimated 20 to 25 ms. abio's 8 cores are full at about 470 to 500 new connections per second.
- **Almost all of that is the certificate's RSA 4096 signature.** The same proxy needs 4.0 ms for a handshake with its RSA 2048 default certificate and 0.8 ms for a resumed handshake.
- **A browser opens two connections per page view, not one:** Chrome fetches the web app manifest on its own connection. 500 page views per second are 1,000 handshakes per second.
- **Per movie page view, measured:** 53 ms of proxy CPU on abio (about half of it the two handshakes), 17 ms of proxy CPU on vector1, 9 ms of Node main-thread time across both instances, and 621 KB sent by abio.
- **OG images:** both ramps passed 1,250 requests per second without an error, with main threads at 50% to 65%. At 500 they were at 38% to 42% (88% to 97% in the checkpoint).
- **A 10-minute hold** at 80 visitors per second (the mix without the home page, public path, new connections): 47,994 visitors, 1.58 million requests, no failed request, page view p95 between 94 and 132 ms in every 30-second slice.
- **No run sent the error tracking POST** that every real page view sends, because the app forwards it to the vendor. Its cost is not in any number here.

## Conditions

| Item | Value |
| --- | --- |
| Date | Monday, October 5, 2026, 03:16 to 04:42 UTC |
| Commit deployed | `3a45fcfd` on both instances, started at about 01:12 UTC, no restart and no deploy during the runs |
| Serving | Two `remix-serve` processes: abio (`10.0.0.21`, 8 cores) and vector1 (`10.0.0.20`, 16 cores, shared with Qdrant). abio's proxy (Traefik 2.10.7, built with Go 1.21.5) terminates TLS and balances across both. Requests for vector1 also pass through vector1's proxy (Traefik 3.6). |
| Generators | worker3 (`10.0.0.32`, 4 cores) for every run. worker1 (`10.0.0.30`, 4 cores, idle) as a second generator for the runs marked "two generators". k6 1.8.1 in Docker. |
| Paths | Public: the site's name with normal DNS, from the generators' public interfaces. Private: the private network to abio's proxy, with TLS. |
| Background traffic | About 8 requests per second finished by abio's webapp in the first run. The proxy on abio accepts 65 to 67 new connections per second and uses 1.4 to 1.5 cores with no benchmark load. |
| Stop rules | 1% of requests or page views failed, document p95 above 3,000 ms, page view p95 above 10,000 ms, or dropped iterations above 5% of the highest step. |
| Step length | 30 seconds, 20 for the home page ramp, 25 for the OG images. Each step's resource numbers leave out its first 5 seconds. |

- **Before every run:** `./bench.sh smoke --commit 3a45fcfd` on the public route and on each instance, a check that the generator runs no other benchmark container, and the cache nodes' memory (30% to 32% in every check).
- **The idle proxy isn't idle.** The 65 new connections per second are the outside crawler from "End the crawler loop on filtered person pages". Every run's proxy numbers include it. In the checkpoint, the proxy accepted 12 connections per second and used 0.3 to 0.4 cores.
- **A step is valid only when its generator has room.** The first movie ramp ran from worker3 alone and reached 87% to 92% of its 4 cores at 100 and 125 visitors per second, so those two steps aren't used. The ramp was repeated from two generators, which stayed at or below 67%.

### Changes to the benchmark scripts

- `./bench.sh load --scenario page-view` is new: visitors per second, each with a new connection and a whole page view. `--connections reuse` keeps connections, `--allow-above-500` lifts the request limit, and `--urls handshake` measures new connections alone.
- The list of requests per page comes from a real page load in headless Chromium at the start of a run (`page-view/capture.mjs`).
- Every load summary has a "Resources per step" table: main thread and proxy CPU per instance, accepted connections, host CPU, network, and generator CPU.
- `SLICE_SECONDS` reports a long plateau in slices.
- `scripts/test-page-view.sh` checks the scenario against a local HTTP/2 stub with TLS: one connection per visitor, no resumed TLS session, and the identity header on pages only.

## What a page view sends

Captured with headless Chromium 154 on worker3, mobile viewport, empty profile, public path, 10 seconds after the load event.

| Surface | Requests to the site's host | Of which sent by the benchmark | Connections to the site's host | Bytes from the site's host | Body of the error tracking POST | Requests to other hosts |
| --- | --- | --- | --- | --- | --- | --- |
| Movie page | 39 | 38 | 2 | 563 KB | 55 KB | 13 |
| Show page | 39 | 38 | 2 | 569 KB | 52 KB | 11 |
| Home | 42 | 41 | 2 | 732 KB | 52 KB | 16 |
| Person page | 29 | 28 | 2 | 477 KB | 38 KB | 11 |
| Discover | 45 | 43 | 2 | 562 KB | 75 KB | 22 |
| Share list page | 26 | 25 | 2 | 519 KB | 58 KB | 31 |

- **Movie page, by type:** 1 document, 28 scripts, 1 stylesheet, 1 font, 5 images, the manifest, the icon, and 1 POST. Six of the scripts and the POST load about 4.5 to 5.7 seconds after the navigation starts, with the analytics and error tracking code. A Lighthouse report ends before that, which is why the checkpoint counted 34 requests and 453 KB.
- **Two connections:** the document and 37 more requests share one HTTP/2 connection. `site.webmanifest` arrives on a second connection, because Chrome fetches a manifest without credentials. Each is a full TLS 1.3 handshake.
- **API requests:** home sends `POST /api/living-room/picks?view=pool` (104 bytes sent, 16 KB received, `private, no-store`). It only reads, so the benchmark replays it. Discover sends `POST /api/poster-impressions`, which writes and isn't replayed. No anonymous page sends a GET to an API endpoint at load.
- **Not sent by the benchmark:** `POST /api/e`, the error tracking tunnel. The route forwards every envelope with the right project key to the vendor, so a replay can't be told from real events there, and a wrong key takes another code path and logs an error. Every page view sends one with a 38 to 75 KB body, it reaches Node uncached, and Node calls out for each.
- **Other hosts** (TMDB images, the analytics host, Google's tag) don't reach the site's proxy and aren't modeled.

### The cache identity header

Every page request of the benchmark carries `GW-Cache-Identity: anon;US;en`. The last response of each page before the run:

| Page | `Cache-Control` | `Vary` | `GW-Page-Cache` | `GW-Cache-Identity` |
| --- | --- | --- | --- | --- |
| `share_list:browser` | `public, max-age=0, s-maxage=10, stale-while-revalidate=10` | `GW-Cache-Identity, Accept-Encoding` | `hit` | `anon;US;en` |
| `title_movie:bot` | `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400` | `GW-Cache-Identity, Accept-Encoding` | `hit` | `anon;US;en` |
| `title_movie:browser` | `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400` | `GW-Cache-Identity, Accept-Encoding` | `hit` | `anon;US;en` |
| `title_show:browser` | `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400` | `GW-Cache-Identity, Accept-Encoding` | `hit` | `anon;US;en` |
| `discover:browser` | `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400` | `GW-Cache-Identity, Accept-Encoding` | `hit` | `anon;US;en` |
| `home:browser` | `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400` | `GW-Cache-Identity, Accept-Encoding` | `hit` | `anon;US;en` |
| `person:browser` | `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400` | `GW-Cache-Identity, Accept-Encoding` | `hit` | `anon;US;en` |
| `share_list:bot` | `public, max-age=0, s-maxage=10, stale-while-revalidate=10` | `GW-Cache-Identity, Accept-Encoding` | `hit` | `anon;US;en` |

All of them arrived over HTTP/2 with TLS 1.3 and `TLS_AES_128_GCM_SHA256`. The app answers with the shared policy and its page store answers the page, as [cache-identity.md](../cache-identity.md) says. Every one of these responses also carried the balanced route's `Set-Cookie: gw_instance=...`, also `/health/live`. The checkpoint's note stands: a cache in front that follows the rule "never store a response with `Set-Cookie`" stores nothing until that cookie is gone from anonymous responses.

## New TLS connections

### What the proxy negotiates

Read with `openssl s_client` from worker3 over the public path.

| Item | Value |
| --- | --- |
| Certificate key | RSA, 4,096 bits, from Let's Encrypt, valid until December 14, 2026. Three certificates in the chain |
| Why RSA 4096 | The proxy's certificate resolver has no `keyType` setting, and Traefik's default is `RSA4096` |
| Protocol and cipher | TLS 1.3, `TLS_AES_128_GCM_SHA256`, key exchange X25519, signature RSA-PSS with SHA-256 |
| With TLS 1.2 | `ECDHE-RSA-AES128-GCM-SHA256`, X25519 |
| Application protocol | HTTP/2 (`h2`). No `Alt-Svc` header, so no HTTP/3 |
| HTTP/2 streams per connection | 50 (`http2.maxConcurrentStreams` in the proxy's start options). A page view sends at most 41 at once |
| Session resumption | Works: a second TLS 1.3 connection with the saved session reports `Reused` |
| Without a server name | The proxy answers with its self-signed default certificate, RSA 2,048 bits |

### Ramp of new connections

`--urls handshake --scenario page-view`: each visitor opens a connection, does a full handshake, sends `GET /health/live` (33 bytes, answered before Express), and closes. Public path, worker3 alone.

| Visitors per second | Connections per second | Failed requests | Request p50 / p95 ms | Handshake p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 25 | 25.0 | 0 | 4 / 14 | 24 / 35 | 25 | 195 | 22 | 9 | 29 | 36 | 8 | 12 |  |
| 50 | 48.2 | 0 | 4 / 15 | 23 / 34 | 48 | 244 | 18 | 12 | 32 | 41 | 10 | 17 |  |
| 100 | 96.4 | 0 | 4 / 17 | 23 / 35 | 96 | 335 | 24 | 15 | 29 | 51 | 12 | 26 |  |
| 150 | 146.4 | 0 | 3 / 16 | 22 / 33 | 146 | 414 | 20 | 19 | 31 | 61 | 14 | 34 |  |
| 200 | 196.4 | 0 | 3 / 18 | 22 / 34 | 196 | 491 | 21 | 22 | 36 | 70 | 18 | 48 |  |
| 250 | 246.4 | 0 | 4 / 24 | 22 / 36 | 246 | 551 | 26 | 25 | 30 | 79 | 20 | 52 |  |
| 300 | 296.4 | 0 | 6 / 35 | 23 / 51 | 296 | 634 | 23 | 28 | 35 | 89 | 23 | 59 | Holds |
| 400 | 392.8 | 0 | 23 / 80 | 36 / 155 | 393 | 723 | 22 | 33 | 35 | 98 | 28 | 68 | Holds, host CPU at 98% |
| 500 | 412.1 | 1 | 167 / 1,094 | 448 / 1,681 | 412 | 741 | 18 | 29 | 27 | 100 | 29 | 73 | Fails: 412 of 500 reached |

Dropped iterations: 758. Requests: 58,983.

- **Break point:** 300 new connections per second from the benchmark hold with a request p95 of 35 ms. 400 hold with the host at 98% CPU and a handshake p95 of 155 ms. At 500 the proxy reached 412 and the stop rule fired. With the background, the proxy accepted 369, 466, and 504 connections per second in those steps.
- **What limits it:** CPU on abio. The proxy used 7.2 to 7.4 of 8 cores at the last two steps. Both Node main threads stayed at their idle level, so the app isn't involved.
- **Cost per connection:** a straight line through the first eight steps is 14.3 ms of proxy CPU per accepted connection (15.7 ms through the first seven). That includes the one small request.
- **The generator** used 73% of its 4 cores at the last step and 68% at 400.

### What the 14 ms are

Three kinds of handshake against the same proxy, 20 seconds each, four `openssl s_time` clients on worker3 in a closed loop, public path, no request sent. `s_time` sends no server name, so the proxy answers with its RSA 2048 default certificate.

| Handshake | Connections per second accepted | Proxy CPU | Proxy CPU per connection, above the idle level |
| --- | --- | --- | --- |
| None (idle before and after) | 65 to 67 | 144% to 149% of a core | |
| Full, TLS 1.2, RSA 2048 default certificate | 464 | 310% | 4.0 ms |
| Full, TLS 1.3, RSA 2048 default certificate | 476 | 324% | 4.3 ms |
| Resumed with a session ticket, TLS 1.2 | 1,232 | 243% | 0.8 ms |
| Full, TLS 1.3, RSA 4096 certificate, plus one request (the ramp above) | 91 to 466 | 195% to 723% | 14.3 ms |

- **The signature is the cost.** A resumed handshake has no signature and costs 0.8 ms. An RSA 2048 signature adds about 3.2 ms, and the RSA 4096 signature about 13 ms.
- **For scale, `openssl speed` on worker3** (the same CPU model name as abio): one RSA 4096 signature takes 6.1 ms, RSA 2048 1.15 ms, and ECDSA P-256 0.036 ms. Traefik signs with Go's implementation, which the numbers above show to be about two to three times slower than OpenSSL for RSA.
- **The `s_time` run with `-reuse` and TLS 1.3 didn't resume** (it cost the same as a full handshake), so the resumed number is from TLS 1.2 only.

## Full page views on the public path with new connections

Rates are visitors per second. A visitor with a page view opens two connections. Where two values are separated by a comma, they are the two generators.

### Movie page

First ramp, worker3 alone. Its steps up to 60 are valid, and the cost per page view below is fitted through them.

| Visitors per second | Page views per second | Failed page views | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 5.0 | 0 | 5 / 26 | 63 / 87 | 10 | 181 | 22 | 17 | 34 | 32 | 29 | 14 |  |
| 10 | 9.7 | 0 | 5 / 17 | 64 / 83 | 19 | 228 | 26 | 29 | 35 | 39 | 55 | 20 |  |
| 20 | 19.3 | 0 | 5 / 17 | 59 / 82 | 39 | 296 | 28 | 46 | 42 | 46 | 103 | 34 |  |
| 30 | 29.3 | 0 | 5 / 17 | 57 / 79 | 59 | 344 | 36 | 59 | 41 | 55 | 152 | 46 |  |
| 40 | 39.3 | 0 | 5 / 18 | 56 / 84 | 79 | 400 | 41 | 80 | 51 | 61 | 197 | 54 |  |
| 50 | 49.3 | 0 | 5 / 20 | 55 / 81 | 99 | 435 | 43 | 96 | 52 | 66 | 252 | 60 |  |
| 60 | 59.3 | 0 | 5 / 26 | 58 / 99 | 119 | 479 | 47 | 109 | 62 | 71 | 302 | 69 | Holds |
| 80 | 78.5 | 0 | 10 / 57 | 71 / 224 | 157 | 562 | 55 | 142 | 75 | 84 | 399 | 81 | Generator near its limit |
| 100 | 98.6 | 0 | 27 / 125 | 131 / 440 | 197 | 609 | 62 | 177 | 80 | 92 | 482 | 87 | Generator saturated: not valid |
| 125 | 98.4 | 0 | 228 / 723 | 1,066 / 2,108 | 203 | 652 | 82 | 198 | 84 | 99 | 539 | 92 | Stopped. Generator saturated: not valid |

Dropped iterations: 241. Requests: 577,720.

Repeat from two generators (worker3 and worker1, half the rate each):

| Visitors per second | Page views per second | Failed page views | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 60 | 59.9 | 0 | 5 / 25, 5 / 26 | 56 / 93, 59 / 99 | 120 | 476 | 49 | 93 | 54 | 68 | 265 | 40, 42 |  |
| 80 | 78.6 | 0 | 6 / 32, 6 / 32 | 62 / 114, 64 / 116 | 157 | 541 | 55 | 129 | 60 | 84 | 396 | 51, 54 |  |
| 90 | 89.3 | 0 | 10 / 67, 10 / 61 | 75 / 221, 77 / 218 | 179 | 581 | 64 | 136 | 75 | 89 | 438 | 55, 57 |  |
| 100 | 99.3 | 0 | 12 / 53, 12 / 51 | 79 / 180, 82 / 183 | 199 | 612 | 68 | 151 | 71 | 92 | 499 | 56, 60 | Holds |
| 110 | 109.3 | 0 | 28 / 188, 29 / 214 | 133 / 908, 142 / 928 | 218 | 630 | 75 | 163 | 78 | 96 | 542 | 60, 62 | Slow: page view p95 over 900 ms |
| 120 | 83.5 | 0 | 116 / 681, 208 / 730 | 645 / 2,240, 1,060 / 2,463 | 174 | 471 | 55 | 123 | 54 | 89 | 411 | 64, 65 | Fails: 84 of 120 reached |

Dropped iterations: 185. Requests: 643,689.

- **Break point:** 100 page views per second hold (page view p95 180 ms, no failed request). At 110 the page view p95 is over 900 ms. At 120 the stop rule fired on dropped iterations, and 84 page views per second were completed.
- **What limits it:** abio's CPU, at 92% to 96% of 8 cores. The proxy uses 6.1 to 6.3 cores of that, the Node process 0.7, and the rest is the host's other work. The main threads are at 68% to 78%, so Node is second in line and not far behind.
- **No request failed** in either ramp. Overload shows as waiting, then as iterations that k6 couldn't start.

### Primary scenario (`hot` mix)

The mix is 60% movie page, 8% share list page, 7% Discover, 5% each for home, show, and person pages, and 10% link-preview bots (two documents and four OG images). On average one visitor sends 33.3 requests on 1.9 connections.

Low rates, worker3 alone:

| Visitors per second | Page views per second | Failed page views | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 8.7 | 0 | 5 / 64 | 56 / 308 | 19 | 217 | 34 | 22 | 40 | 42 | 50 | 16 |  |
| 20 | 17.3 | 0 | 5 / 207 | 59 / 498 | 37 | 276 | 55 | 39 | 54 | 53 | 99 | 30 |  |
| 25 | 21.6 | 0 | 6 / 239 | 59 / 442 | 47 | 295 | 56 | 42 | 53 | 56 | 119 | 30 |  |
| 30 | 26.9 | 0 | 7 / 280 | 67 / 604 | 56 | 333 | 63 | 51 | 63 | 59 | 145 | 35 | Last step with document p95 under 300 ms |
| 35 | 31.1 | 0 | 29 / 397 | 117 / 1,318 | 65 | 346 | 80 | 53 | 72 | 63 | 163 | 34 | Document p95 over 300 ms |

Dropped iterations: 20. Requests: 134,540.

Higher rates, two generators:

| Visitors per second | Page views per second | Failed page views | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40 | 36.1 | 0 | 10 / 330, 13 / 340 | 81 / 989, 85 / 1,143 | 76 | 385 | 73 | 57 | 66 | 65 | 179 | 28, 31 | Document p95 over 300 ms |
| 60 | 51.5 | 0 | 93 / 2,249, 99 / 2,383 | 367 / 4,600, 361 / 4,856 | 110 | 444 | 92 | 94 | 92 | 80 | 272 | 41, 40 | Document p95 over 2 s |
| 80 | 32.8 | 0 | 420 / 1,680, 469 / 1,703 | 1,339 / 2,538, 1,443 / 2,674 | 90 | 386 | 106 | 99 | 94 | 81 | 240 | 35, 38 | Fails: 36 of 80 reached |

Dropped iterations: 234. Requests: 128,190.

- **Break point:** the document p95 stays under 300 ms up to 30 visitors per second (27 page views per second). At 35 to 40 it is 330 to 400 ms, at 60 it is over 2 seconds, and at 80 the run stops. No request failed.
- **What limits it:** the Node main threads, at 63% at 30 visitors per second and 92% at 60. The proxy and the host have room (abio at 59% to 80%).
- **Why:** the home page's pool request. In the webapp's own histogram for the two-generator run, `/api/living-room/picks` has a p50 of 667 ms and a p95 of 1,753 ms at 1.2 requests per second per instance, and nothing else in the mix is above 50 ms at the median. While one runs, the event loop is blocked: the loop delay reached 1,228 ms.

### Home page alone

| Visitors per second | Page views per second | Failed page views | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1.0 | 0 | 4 / 15 | 430 / 535 | 2 | 149 | 44 | 8 | 45 | 35 | 15 | 4 |  |
| 2 | 1.9 | 0 | 5 / 16 | 396 / 551 | 4 | 161 | 70 | 9 | 45 | 43 | 21 | 10 | Holds |
| 3 | 2.9 | 0 | 10 / 313 | 476 / 1,742 | 6 | 181 | 60 | 15 | 90 | 41 | 28 | 6 | Document p95 over 300 ms |
| 4 | 3.9 | 0 | 39 / 330 | 737 / 2,752 | 8 | 179 | 98 | 12 | 72 | 50 | 34 | 9 |  |
| 5 | 4.8 | 0 | 109 / 832 | 960 / 6,460 | 10 | 186 | 95 | 13 | 73 | 51 | 35 | 15 | Page view p95 over 6 s |
| 6 | 3.2 | 0 | 195 / 769 | 1,186 / 2,901 | 9 | n/a | n/a | 14 | 70 | 51 | 37 | 10 | Fails |

Dropped iterations: 8. Requests: 16,963.

- **The home page holds 2 page views per second.** At 3 the document p95 is over 300 ms, because documents wait behind pool requests.
- **Cost:** the two main threads together rose by 39, 65, and 100 points of a core at 0.9, 1.9, and 2.9 page views per second. That is 340 to 420 ms of main-thread time per home page view, of which the files are about 10 ms.
- **The pool request takes 357 to 403 ms at the median for the client** at 1 to 3 page views per second, so a home page view takes 400 to 480 ms where a movie page view takes 60.

### The mix without the home page

The same mix with the home entry removed (`--routes` with every other route), two generators.

| Visitors per second | Page views per second | Failed page views | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 60 | 54.3 | 0 | 7 / 31, 7 / 35 | 63 / 116, 63 / 120 | 114 | 426 | 53 | 81 | 53 | 83 | 273 | 36, 39 |  |
| 80 | 69.8 | 0 | 8 / 76, 8 / 80 | 63 / 316, 62 / 304 | 149 | 529 | 66 | 96 | 64 | 85 | 360 | 45, 44 |  |
| 90 | 79.3 | 0 | 10 / 53, 10 / 52 | 69 / 160, 70 / 159 | 169 | 564 | 68 | 108 | 66 | 87 | 394 | 45, 51 |  |
| 100 | 89.3 | 0 | 12 / 64, 13 / 68 | 79 / 209, 79 / 206 | 188 | 596 | 65 | 110 | 65 | 90 | 451 | 52, 51 | Holds |
| 110 | 97.9 | 0 | 23 / 152, 23 / 165 | 108 / 634, 111 / 778 | 207 | 618 | 76 | 124 | 74 | 95 | 494 | 52, 53 | Slow: page view p95 over 600 ms |
| 120 | 106.1 | 0 | 35 / 241, 35 / 252 | 163 / 1,091, 165 / 1,060 | 225 | 643 | 71 | 138 | 70 | 97 | 518 | 56, 56 | Slow: page view p95 over 1 s |
| 130 | 73.1 | 0 | 297 / 859, 275 / 1,064 | 1,425 / 2,940, 1,390 / 2,837 | 175 | n/a | n/a | n/a | n/a | 95 | 440 | 52, 56 | Fails: 82 of 130 reached |

Dropped iterations: 229. Requests: 659,746.

- **Break point:** 100 visitors per second hold (89 page views plus 10 bot requests per second). 110 and 120 answer every request but slowly, and 130 fails.
- **What limits it:** abio's CPU, at 90% to 97%, as for the movie page.

## The same page views over the private path with reused connections

`--path private --connections reuse`: each k6 virtual user keeps its connection, so a step has almost no handshakes. Everything else is the same.

### Movie page, two generators

| Visitors per second | Page views per second | Failed page views | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 60 | 59.9 | 0 | 5 / 24, 6 / 25 | 29 / 70, 31 / 72 | 8 | 340 | 55 | 103 | 60 | 54 | 252 | 28, 62 |  |
| 100 | 97.1 | 0 | 8 / 46, 8 / 47 | 34 / 115, 35 / 124 | 0 | 405 | 71 | 157 | 77 | 67 | 476 | 44, 48 |  |
| 120 | 118.6 | 0 | 10 / 49, 10 / 55 | 36 / 112, 38 / 135 | 0 | 425 | 78 | 181 | 87 | 70 | 581 | 45, 47 |  |
| 140 | 138.6 | 0 | 13 / 72, 13 / 68 | 43 / 218, 45 / 199 | 0 | 453 | 85 | 205 | 88 | 75 | 684 | 48, 51 | Holds |
| 160 | 158.6 | 0 | 25 / 229, 26 / 246 | 76 / 2,114, 78 / 2,368 | 0 | 486 | 96 | 237 | 94 | 80 | 771 | 52, 56 | Slow: page view p95 over 2 s |
| 180 | 137.1 | 0 | 30 / 485, 33 / 929 | 86 / 2,047, 90 / 2,727 | 14 | 515 | 93 | 818 | 94 | 83 | 779 | 58, 58 | Fails: 137 of 180 reached |

Dropped iterations: 355. Requests: 853,604.

### Primary scenario, worker3 alone

| Visitors per second | Page views per second | Failed page views | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 8.9 | 0 | 5 / 135 | 35 / 399 | 2 | 183 | 40 | 20 | 47 | 40 | 53 | 12 |  |
| 20 | 17.4 | 0 | 5 / 231 | 32 / 486 | 0 | 189 | 48 | 31 | 53 | 57 | 96 | 17 | Last step with document p95 under 300 ms |
| 30 | 26.3 | 0 | 12 / 325 | 49 / 1,037 | 0 | 232 | 76 | 48 | 64 | 53 | 140 | 28 | Document p95 over 300 ms |
| 40 | 35.1 | 0 | 21 / 520 | 71 / 2,184 | 1 | 269 | 76 | 60 | 72 | 55 | 183 | 32 |  |

Dropped iterations: 27. Requests: 112,184.

### The mix without the home page, two generators

| Visitors per second | Page views per second | Failed page views | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 60 | 53.7 | 0 | 5 / 23, 5 / 25 | 29 / 64, 30 / 71 | 8 | 323 | 49 | 92 | 59 | 51 | 229 | 28, 32 |  |
| 100 | 86.8 | 0 | 6 / 44, 7 / 42 | 30 / 110, 32 / 104 | 0 | 375 | 73 | 135 | 68 | 63 | 425 | 36, 37 |  |
| 120 | 106.5 | 0 | 8 / 53, 8 / 61 | 33 / 154, 34 / 156 | 0 | 410 | 74 | 167 | 79 | 68 | 508 | 45, 43 |  |
| 140 | 123.3 | 0 | 11 / 65, 11 / 70 | 39 / 166, 40 / 190 | 0 | 429 | 77 | 170 | 87 | 69 | 604 | 45, 49 | Holds |
| 160 | 141.8 | 7 | 17 / 273, 17 / 288 | 57 / 1,773, 58 / 2,235 | 1 | 452 | 83 | 218 | 95 | 75 | 693 | 52, 55 | Fails: 8 page views failed, p95 over 1.7 s |
| 180 | 122.5 | 1 | 30 / 1,039, 33 / 1,028 | 82 / 2,330, 87 / 3,319 | 10 | 476 | 83 | 651 | 90 | 79 | 643 | 50, 54 | Fails |

Dropped iterations: 325. Requests: 749,710.

- **Movie page:** 140 page views per second hold. At 160 the page view p95 is over 2 seconds. The Node main threads are the limit: 85% to 88% at 140 and 94% to 96% at 160, with abio's CPU at 75% to 80%.
- **Primary scenario:** the same limit as on the public path, at the same rate. The pool request doesn't care about TLS.
- **The mix without home:** 140 visitors per second hold. At 160 and 180, eight page views failed: of 13 failed requests, six were answered with a 5xx status and the others got no answer. Neither instance's 5xx counter moved, so those answers came from a proxy or from the page store's busy answer. They weren't traced further.
- **vector1's proxy** used 6.5 to 8.2 cores in the failing steps (2.0 to 2.4 in the step before). It wasn't looked into.

### TLS cost, from the difference

| Movie page views per second | abio proxy, new connections on the public path | abio proxy, reused connections on the private path | Difference | New connections per second | Per new connection |
| --- | --- | --- | --- | --- | --- |
| 60 | 476% | 340% | 136 points | 120 | 11.3 ms |
| 100 | 612% | 405% | 207 points | 199 | 10.4 ms |

The difference gives 10 to 11 ms per handshake, and the ramp of connections alone gives 14 to 16 ms including a request and the connection's setup and close. The two paths also differ in the network interface, so read the first as a cross-check of the second.

## Cost per page view

Fitted through the steps of the first movie ramp from 5 to 60 page views per second (public path, new connections), where nothing was saturated. Read each as plus or minus 20%: the background moved between runs.

| Resource | Per movie page view | What it is made of |
| --- | --- | --- |
| Proxy CPU on abio | 53 ms | Two handshakes at 11 to 14 ms each, and 38 requests at about 0.7 ms each |
| Node main-thread time, both instances | 9.4 ms (4.6 on abio, 4.8 on vector1) | 38 requests at about 0.25 ms each. The document is a stored page |
| Proxy CPU on vector1 | 17 ms | Its half of the visitors: about 0.9 ms per request that it forwards |
| All CPU on abio | 56 ms | Proxy plus its Node process |
| Bytes sent by abio | 621 KB (5.0 Mbit/s per page view per second) | 563 KB of responses in the capture, plus TLS, TCP, and HTTP/2 framing |
| New TLS connections | 2 | The page's connection and the manifest's |

- **With reused connections,** the proxy on abio needs 14 ms for each added page view between 60 and 140 per second, and 29 ms per page view on average between idle and 60. It gets cheaper per request as the rate grows.
- **A visitor of the primary mix** costs 25 ms of main-thread time (13.9 on abio, 10.8 on vector1, fitted from 10 to 30 visitors per second), against 9.4 for the movie page. The difference is the pool request: 5% of the visitors at about 350 ms.
- **Idle levels today:** abio uses 2.5 of its 8 cores before any benchmark load (the proxy 1.5 to 1.8, the Node process 0.2, the rest other containers). That leaves about 5.5 cores, which is 98 movie page views at 56 ms. The measured break point is 100.

### Extrapolated to 500 page views per second

These lines are straight lines through rates up to 60 to 140 page views per second. They are estimates, not measurements.

| Resource | At 500 movie page views per second | Available today |
| --- | --- | --- |
| New TLS connections | 1,000 per second, about 14 cores of proxy CPU with the RSA 4096 certificate | Full at about 470 to 500 per second on abio (measured) |
| Proxy CPU on abio for the requests | About 13 cores | 8 cores, shared |
| Node main-thread time | 4.7 cores, which is 6 processes at 80% | 2 processes |
| Bytes | 2.5 Gbit/s | 1.7 Gbit/s was sent in the OG ramp over the private network. The public uplink's limit isn't verified |
| Home pool requests, at the primary mix's 5% | 25 per second, about 9 cores of main-thread time | Fails at 3 per second |
| Error tracking POSTs | 500 per second with 19 to 37 MB of request bodies per second, each forwarded to the vendor | Not measured |

## Compared with the checkpoint's extrapolation

| Item | Checkpoint (extrapolated from 14.7 page views per second on reused connections) | Measured here |
| --- | --- | --- |
| First-time movie page views per second | 60 to 90 | 100 on the public path with new connections. 140 on the private path with reused connections |
| What limits it | The proxy on abio at 90, the main threads at 60 | abio's CPU with new connections (the proxy uses three quarters of it). The main threads with reused connections |
| Primary scenario | Not estimated with files | 30 visitors per second, limited by the home page's pool request, which the checkpoint's request list didn't contain |
| Proxy CPU on abio per page view | About 50 ms, without handshakes | 53 ms with two handshakes. 14 to 29 ms without |
| Node main-thread time per page view | About 20 ms | 9.4 ms |
| Proxy CPU per new TLS connection | 20 to 25 ms (the baseline's estimate) | 14 to 16 ms |
| Connections per page view | Not considered | 2 |
| Requests and bytes per page view | 34 requests, 453 KB | 39 requests (38 sent), 563 KB, because the late scripts load after Lighthouse's window |
| OG images | Two instances full at about 500 per second | 1,250 per second with the main threads at 50% to 65% |

The checkpoint's range was close for the movie page, for partly different reasons: it overestimated the cost per request in the proxy and in Node, and didn't count the handshakes or the second connection.

## OG images again

The checkpoint's two ramps (`--urls surfaces --routes og_title` and `og_share_list`, private path, reused connections, 25 seconds per step), with fewer steps and continued past 500. Since "Serve a cached OG card without reading it from Redis on every request", a hot card is answered before Express.

### Title card

| Requests per second | p50 / p95 / p99 ms | Errors | abio main thread % | vector1 main thread % | abio proxy % | vector1 proxy % | abio sends Mbit/s | Generator CPU % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 50 | 6 / 22 / 42 | 0 | 21 | 30 | 247 | 11 | 64 | 21 |
| 100 | 6 / 22 / 52 | 0 | 26 | 34 | 189 | 14 | 117 | 19 |
| 200 | 5 / 21 / 40 | 0 | 27 | 33 | 218 | 22 | 225 | 25 |
| 300 | 5 / 22 / 43 | 0 | 33 | 38 | 239 | 29 | 335 | 28 |
| 400 | 5 / 26 / 53 | 0 | 35 | 44 | 255 | 40 | 443 | 35 |
| 500 | 5 / 23 / 46 | 0 | 40 | 41 | 279 | 39 | 545 | 45 |
| 650 | 5 / 23 / 42 | 0 | 40 | 44 | 307 | 50 | 706 | 45 |
| 800 | 5 / 27 / 50 | 0 | 47 | 46 | 324 | 59 | 870 | 51 |
| 1,000 | 5 / 32 / 56 | 0 | 48 | 53 | 344 | 67 | 1,087 | 57 |
| 1,250 | 6 / 35 / 56 | 0 | 56 | 58 | 373 | 85 | 1,358 | 65 |

Requests: 154,143. Dropped iterations: 0.

### Share list card

| Requests per second | p50 / p95 / p99 ms | Errors | abio main thread % | vector1 main thread % | abio proxy % | vector1 proxy % | abio sends Mbit/s | Generator CPU % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 50 | 6 / 19 / 40 | 0 | 26 | 28 | 247 | 12 | 76 | 23 |
| 100 | 6 / 17 / 39 | 0 | 29 | 23 | 179 | 16 | 140 | 12 |
| 200 | 6 / 20 / 39 | 0 | 35 | 31 | 225 | 26 | 274 | 20 |
| 300 | 5 / 20 / 37 | 0 | 38 | 37 | 236 | 34 | 414 | 28 |
| 400 | 5 / 19 / 37 | 0 | 38 | 35 | 275 | 40 | 553 | 36 |
| 500 | 5 / 21 / 45 | 0 | 42 | 38 | 282 | 46 | 692 | 39 |
| 650 | 5 / 24 / 46 | 0 | 45 | 43 | 321 | 56 | 870 | 43 |
| 800 | 5 / 35 / 68 | 0 | 48 | 47 | 325 | 59 | 1,106 | 53 |
| 1,000 | 6 / 32 / 56 | 0 | 52 | 45 | 356 | 68 | 1,382 | 60 |
| 1,250 | 8 / 40 / 70 | 0 | 65 | 50 | 394 | 78 | 1,729 | 65 |

Requests: 154,203. Dropped iterations: 0.

- **No break point up to 1,250 requests per second.** The ramps ended there because abio was sending 1.4 and 1.7 Gbit/s, not because anything failed.
- **Main thread at 500 per second:** 40% and 41% (title), 42% and 38% (share list). The checkpoint measured 97% on abio for the title card and 88% and 92% for the share list card.
- **Per card:** the main threads rose by about 0.6 ms per card that an instance answered (3.1 to 3.6 ms in the checkpoint). That is the factor of 5 that the change measured locally.
- **p95 at 500:** 23 and 21 ms (196 and 87 ms in the checkpoint).

## Ten minutes at 80 visitors per second

The mix without the home page, public path, new connections, two generators at 40 visitors per second each, `SLICE_SECONDS=30`. The primary mix itself wasn't held: its highest passing rate is 30 visitors per second, and the pool request's stalls would hide everything else.

| Item | Value |
| --- | --- |
| Visitors | 47,994, of which 42,972 complete page views (71.6 per second) |
| Requests | 1,578,438, none failed, no dropped iteration |
| New TLS connections | 90,940 (152 per second) |
| Page view p95, whole run | 115 and 119 ms |
| abio | Proxy 5.3 cores, main thread 58% on average and 75% at most, host CPU 81%, 359 Mbit/s sent |
| vector1 | Proxy 1.3 cores, main thread 67% on average and 81% at most |
| Event loop delay, highest | 227 ms on abio, 283 ms on vector1 |
| Generators | 42% and 45% of 4 cores |

Per 30-second slice, the two generators separated by a comma:

| From second | Visitors | Failed page views | First request p50 / p95 / p99 / max ms | Page view p50 / p95 / p99 / max ms |
| --- | --- | --- | --- | --- |
| 0 | 2,398 | 0 | 7 / 31 / 55 / 109, 7 / 31 / 55 / 97 | 59 / 106 / 175 / 439, 59 / 109 / 157 / 321 |
| 30 | 2,400 | 0 | 7 / 36 / 61 / 249, 6 / 31 / 52 / 137 | 56 / 117 / 194 / 352, 58 / 118 / 200 / 376 |
| 60 | 2,400 | 0 | 7 / 33 / 64 / 197, 7 / 39 / 74 / 209 | 58 / 113 / 247 / 392, 61 / 122 / 283 / 464 |
| 90 | 2,400 | 0 | 7 / 43 / 87 / 219, 8 / 39 / 69 / 224 | 60 / 130 / 223 / 540, 62 / 132 / 183 / 573 |
| 120 | 2,400 | 0 | 6 / 34 / 71 / 462, 7 / 36 / 216 / 589 | 59 / 112 / 236 / 999, 60 / 118 / 544 / 969 |
| 150 | 2,400 | 0 | 6 / 35 / 55 / 81, 6 / 33 / 55 / 86 | 56 / 109 / 151 / 233, 58 / 115 / 151 / 367 |
| 180 | 2,400 | 0 | 7 / 39 / 75 / 265, 6 / 34 / 89 / 236 | 57 / 125 / 302 / 512, 57 / 130 / 315 / 605 |
| 210 | 2,400 | 0 | 7 / 32 / 74 / 334, 6 / 35 / 76 / 352 | 57 / 121 / 228 / 665, 57 / 130 / 225 / 689 |
| 240 | 2,400 | 0 | 6 / 30 / 51 / 291, 6 / 33 / 56 / 120 | 58 / 110 / 170 / 378, 58 / 111 / 164 / 293 |
| 270 | 2,400 | 0 | 6 / 34 / 65 / 448, 6 / 32 / 69 / 397 | 57 / 106 / 238 / 622, 57 / 104 / 216 / 717 |
| 300 | 2,400 | 0 | 7 / 34 / 54 / 89, 7 / 36 / 61 / 174 | 59 / 119 / 168 / 254, 59 / 122 / 176 / 221 |
| 330 | 2,400 | 0 | 7 / 38 / 85 / 284, 7 / 39 / 77 / 593 | 57 / 128 / 274 / 877, 58 / 130 / 247 / 888 |
| 360 | 2,400 | 0 | 7 / 33 / 69 / 109, 6 / 38 / 67 / 114 | 58 / 121 / 189 / 239, 58 / 123 / 206 / 553 |
| 390 | 2,400 | 0 | 6 / 33 / 69 / 380, 7 / 37 / 105 / 216 | 56 / 110 / 187 / 719, 59 / 125 / 324 / 579 |
| 420 | 2,400 | 0 | 7 / 31 / 123 / 334, 7 / 37 / 85 / 265 | 57 / 111 / 394 / 784, 59 / 119 / 319 / 706 |
| 450 | 2,400 | 0 | 7 / 35 / 60 / 127, 7 / 41 / 68 / 175 | 57 / 114 / 190 / 324, 60 / 123 / 191 / 286 |
| 480 | 2,400 | 0 | 6 / 28 / 49 / 154, 6 / 27 / 50 / 123 | 53 / 97 / 133 / 230, 56 / 101 / 131 / 277 |
| 510 | 2,400 | 0 | 7 / 37 / 72 / 374, 7 / 39 / 79 / 389 | 58 / 127 / 219 / 490, 60 / 128 / 290 / 582 |
| 540 | 2,400 | 0 | 6 / 25 / 47 / 153, 6 / 25 / 49 / 161 | 55 / 94 / 144 / 294, 57 / 99 / 135 / 319 |
| 570 | 2,396 | 0 | 7 / 41 / 65 / 555, 8 / 39 / 82 / 563 | 59 / 122 / 240 / 756, 60 / 123 / 226 / 704 |


- **Share list pages expired about 60 times per instance** in the hold (10 seconds fresh, 10 stale). Across both instances, 4,431 share list page requests were hits, 137 were answered stale while one render ran, and 4 were misses. No slice shows it.
- **Title pages didn't expire:** their lifetime is 30 minutes, and the hold is 10.
- **No title snapshot reload fell into the hold** or into a measured step. Both instances loaded snapshot `20261005T033912Z` at 03:40:12 and 03:40:21 UTC (1,513 and 1,545 ms each), during the setup of the primary scenario's two-generator run and 20 seconds before its first step.
- **The highest single page view** took 999 ms, and the highest first request 593 ms.

## Options for cutting the proxy's TLS cost

Nothing on the live proxy was changed. "Saves" is measured where it says so, and otherwise an estimate from the numbers above.

| Option | Evidence | What it would save | What the owner would do |
| --- | --- | --- | --- |
| An ECDSA certificate instead of RSA 4096 | Measured: 14.3 ms per connection with RSA 4096, 4.0 ms with RSA 2048, 0.8 ms without a signature. `openssl speed`: an ECDSA P-256 signature is 0.036 ms. Traefik's documentation: `keyType` is optional, defaults to `RSA4096`, and accepts `EC256`, `EC384`, `RSA2048`, `RSA4096`, `RSA8192` | Estimated: about 13 of 14 ms per new connection, so a full handshake near 1 ms. Per movie page view, about 25 of the proxy's 53 ms. Today's 65 crawler connections per second would cost about 0.1 cores instead of about 0.9. abio's CPU would then allow about 170 movie page views per second, and the Node main threads become the limit at about 140 | Add `--certificatesresolvers.letsencrypt.acme.keytype=EC256` to the proxy's start options in Coolify and restart the proxy. The documentation doesn't say what happens to a certificate that is already issued: expect the RSA certificate to stay until its renewal (30 days before December 14, 2026) unless its entry is removed from the resolver's storage. Check with `openssl s_client` afterwards |
| RSA 2048 instead of RSA 4096 | Measured: 4.0 ms per connection with the default certificate | About 10 of 14 ms per connection | The same setting with `RSA2048`. No reason to prefer it over ECDSA unless a client can't use ECDSA |
| An ECDSA certificate next to the RSA one | The resolver has one `keyType`. Traefik's TLS documentation describes one certificate store and no choice of certificate by the client's abilities | Nothing beyond the ECDSA certificate. Every browser that speaks TLS 1.3 accepts ECDSA | Not needed |
| TLS session resumption and tickets | Verified: the proxy already resumes TLS 1.3 sessions. Measured: a resumed TLS 1.2 handshake costs 0.8 ms. Traefik's TLS options (`minVersion`, `maxVersion`, `cipherSuites`, `curvePreferences`, `sniStrict`, `alpnProtocols`, `clientAuth`) have no session setting | Already in effect for returning visitors. Nothing for a first-time visitor's first connection, which is what a spike is made of. Whether Chrome resumes for the manifest's connection wasn't measured | Nothing |
| Traefik 2.10 to 3 | vector1 runs 3.6. Its proxy isn't in the TLS path, so no handshake number exists for it. The signature cost comes from Go's RSA code, and 2.10.7 is built with Go 1.21 | Not measured. With an ECDSA certificate the signature no longer matters | Change the proxy version in Coolify and check the dynamic configuration (`goodwatch-balance.yaml`) against the v3 migration guide. Measure before and after with `--urls handshake` |
| HTTP/3 | Traefik 2.10's documentation: experimental, needs the `experimental` section, `http3` on the entry point, UDP on the same port, and only TLS routers. Today's responses carry no `Alt-Svc` | No CPU: HTTP/3 uses the same TLS 1.3 handshake and the same signature. It saves visitors a round trip. Not measured, and k6 can't send it | Proxy start options plus a firewall rule for UDP 443 |
| More proxy hosts | Measured: one core takes about 70 new connections per second with RSA 4096, and abio's 8 cores are full at about 100 movie page views per second | Linear with cores. 500 movie page views per second need about 27 proxy cores with RSA 4096 and about 14 with ECDSA (extrapolated), plus the bytes | Several hosts with the public name, DNS or a load balancer in front, and certificates on each. The Node processes still need to grow from 2 to about 6 |
| A layer in front that terminates TLS (a CDN, or a cache or file server with its own certificate) | Measured per movie page view at the origin: 53 ms of proxy CPU, 9 ms of Node time, 621 KB, 2 handshakes. 37 of 38 requests are static files with a long lifetime, and the document is `s-maxage=1800` with the identity header | Nearly all of it for stored responses: the origin sees one connection per edge instead of two per visitor, and only misses and revalidations. Not removed: the home pool POST (about 350 ms of main-thread time each), the error tracking POST, pages that aren't stored, and the first fetch per edge location | The decision "Choose the page cache layer". Before it stores anything: the balanced route must stop setting `gw_instance` on anonymous responses, and the layer must compute `GW-Cache-Identity` |
| Static files off the Node process, behind the proxy | Measured: 9.4 ms of Node time per page view, almost all static files | The Node part only: the main threads' limit moves from about 140 page views per second up. The proxy's 53 ms and the bytes stay | The decision "Decide where static assets are served from" |

Two findings that aren't proxy options but decide the primary scenario first:

- **The home page's pool request** limits the primary mix at 30 visitors per second, in front of or behind any proxy or CDN, because it is a POST with `private, no-store`. The map already lists "whether the home page's pool request moves into the loader" as an open owner question.
- **The crawler's connections** use about 0.9 of the proxy's 1.5 idle cores at 14 ms each (estimated from the rate). An ECDSA certificate is the change that makes them cheap, which is what the owner asked for in the ticket.

## The home page's pool request after the fix

The numbers above are from before this change. The pool request's cost was one pass over the title snapshot per request, and it now runs once per snapshot version and UTC day in each process.

- **Where the time went:** a CPU profile of a local production build puts 99% of the request's time under `getLivingRoomPool`: 66% in the walk over all 238,894 titles of the snapshot (`facts` builds a genre list and a mood list for every title), and 33% in sorting the titles that pass and filtering them once per mood. The title cards, the service list, and the taste together are under 1%.
- **What the result depends on:** the snapshot version, the day, the visitor's country and services, and the guest progress in the request body (rated, skipped, and Want to See titles, and the taste they give). An anonymous visitor without progress gets the order by popularity.
- **The change:** `app/server/living-room/pool-keys.server.ts` keeps the titles that pass the pool's conditions, in popularity order, per snapshot version and day. They are the same for everyone. Each request still leaves out the viewer's own seen, skipped, and Want to See titles and reads its lists off the front. A viewer with a taste still gets their own ranking and sort on every request, without the walk over the snapshot. No response is stored, so the request stays a POST with `private, no-store`, and a member's answer is computed from the member's own data as before.
- **Not changed:** the first request after a new snapshot version or after midnight UTC pays the walk once in each process.

Measured on a development machine (faster cores than production's), one process of a local production build at `85603eab` and at the fix, with its own single-node Valkey that holds a copy of the title snapshot, and production Crate read only. Main-thread CPU time is from `/proc`, less the idle process's 11 ms per second. Each run follows 30 warm-up requests, with the body the benchmark replays (an anonymous visitor without progress).

| Build | Requests per second | Requests | Main-thread ms per request | Client p50 / p95 ms |
| --- | --- | --- | --- | --- |
| Before | 2 | 60 | 42.1 | 41 / 49 |
| Before | 5 | 100 | 41.5 | 39 / 43 |
| After | 5 | 100 | 2.1 | 3 / 4 |
| After | 50 | 1,500 | 2.4 | 2 / 3 |

- **The response is the same** before and after: the same 23 titles in the same order, the same pairs, and the same catalog. Only the order of the services within a title differs between any two processes, because it follows the order in which Crate returned them when the process loaded the country's availability.
- **Not measured:** the same request costs about 350 ms on a production instance where it costs 42 ms here, so the absolute numbers don't carry over. By the same ratio the request would cost about 20 ms there, most of it the request's own handling (reading the body, 23 title cards from the cache, and 44 KB of JSON). The load runs on production were repeated later, see [After the home pool fix](#after-the-home-pool-fix).

## Not measured or not verified

- **The error tracking POST** (`/api/e`) under load: 500 per second at the destination, each forwarded by Node to the vendor.
- **A handshake with an ECDSA certificate on this proxy.** The estimate comes from the resumed handshake plus the signature time.
- **A deploy during a load run,** a build on abio during a run, and a soak longer than the 30-minute page lifetime. The longest run is 10 minutes.
- **A title snapshot reload inside a measured step.**
- **Rates above 140 to 180 page views per second,** which need more than two 4-core generators.
- **The public uplink's limit.** The highest rate sent over the public path was 542 Mbit/s.
- **Browsers other than Chrome.** A browser that doesn't fetch the manifest opens one connection per page view.
- **Returning visitors:** browser caches, resumed TLS sessions, and the sticky cookie on a second visit.
- **More than one cache identity.** Every page request sent `anon;US;en`, so each URL is one stored page per instance.
- **Which component sent the six 5xx answers** in the failing step of the private mix, and why vector1's proxy used 6.5 to 8.2 cores in the failing private steps.
- **The request timing of a real browser.** k6 sends a page's requests at once after the document. A browser spreads them over about five seconds.

## Incidents and end state

- **No deploy and no restart** happened during the runs. Both instances ran `3a45fcfd` throughout.
- **Real visitors were affected** in the failing steps: for about 30 to 60 seconds each, in eight ramps, the site answered slowly (document p95 from 0.5 to 2.4 seconds). Each ramp stopped at its first failing step, and the smoke check passed on the public route and on both instances before the next run.
- **Benchmark requests that failed:** 1 of 58,983 in the handshake ramp's last step, and 13 of 749,710 in the last two steps of the private mix. None in any other run, and none in a step that this page calls "holds".
- **End state at 04:44 UTC:** both containers healthy, the smoke check passed three times, each instance's 5xx counter at 0 since its start, and the cache nodes at 30% to 31% memory.
- **Generators:** no container left on worker3 or worker1. On worker1, the k6 image and the work directory that the runs created were removed. worker3 keeps its benchmark images and an empty run directory, as before.

## Repeat the runs

Settings in the ignored `goodwatch-benchmark/config.env`:

```sh
BENCH_METRIC_HOSTS='10.0.0.21:target:coolify-proxy+gk4owk8,10.0.0.20:target:coolify-proxy+gk4owk8+qdrant,10.0.0.14:data,10.0.0.15:data,10.0.0.16:data'
BENCH_WEBAPP_PROBE=1
BENCH_WEBAPP_PROBE_EXTRA='10.0.0.20'
```

```sh
cd goodwatch-benchmark
SHA=$(git rev-parse origin/main)
export ABORT_ERROR_RATE=0.01

# Before each run
./bench.sh smoke --commit $SHA && ./bench.sh smoke --host abio --commit $SHA && ./bench.sh smoke --host vector1 --commit $SHA

# New TLS connections alone
./bench.sh load --scenario page-view --mode ramp --rates 25,50,100,150,200,250,300,400,500 --step-duration 30 \
  --urls handshake --path public --label tls-handshake-public --yes-ramp-production

# Movie page views, public path, new connections. Above 60 per second, use two generators (see the README)
./bench.sh load --scenario page-view --mode ramp --rates 5,10,20,30,40,50,60 --step-duration 30 \
  --urls hot --routes title_movie:browser --path public --allow-above-500 --yes-ramp-production --label pv-movie-public-new

# The primary scenario, the home page alone, and the mix without home
./bench.sh load --scenario page-view --mode ramp --rates 10,20,25,30,35 --step-duration 30 \
  --urls hot --path public --allow-above-500 --yes-ramp-production --label pv-hot-public-low
./bench.sh load --scenario page-view --mode ramp --rates 1,2,3,4,5,6,8 --step-duration 20 \
  --urls hot --routes home:browser --path public --allow-above-500 --yes-ramp-production --label pv-home-public-new
./bench.sh load --scenario page-view --mode ramp --rates 30,40,45,50,55,60,65 --step-duration 30 --urls hot \
  --routes title_movie,share_list,title_show,person,discover,og_title,og_person,og_share_list \
  --path public --allow-above-500 --yes-ramp-production --label pv-hot-nohome-public

# The same over the private path with reused connections
./bench.sh load --scenario page-view --connections reuse --mode ramp --rates 30,50,60,70,80,90 --step-duration 30 \
  --urls hot --routes title_movie:browser --path private --allow-above-500 --yes-ramp-production --label pv-movie-private-reuse

# OG images
./bench.sh load --mode ramp --rates 50,100,200,300,400,500,650,800,1000,1250 --step-duration 25 \
  --urls surfaces --routes og_title --path private --allow-above-500 --yes-ramp-production --label og-ramp-og-title

# Ten minutes at one rate, reported in 30-second slices
SLICE_SECONDS=30 ./bench.sh load --scenario page-view --mode ramp --rates 40 --step-duration 600 --urls hot \
  --routes title_movie,share_list,title_show,person,discover,og_title,og_person,og_share_list \
  --path public --allow-above-500 --yes-ramp-production --label pv-hot-nohome-public-hold
```

The rates of the two-generator runs in the tables above are the sum of both generators: each generator ran half of each step.

Full and resumed handshakes without a request, four clients for 20 seconds each, while reading the proxy's CPU time and accepted connections on abio:

```sh
openssl s_time -connect <site>:443 -new -tls1_2 -time 20
openssl s_time -connect <site>:443 -reuse -tls1_2 -time 20
```

## After the home pool fix

Three ramps were repeated with `833a2e53` deployed, the commit that keeps the pool's candidates per process. Everything above this section is from before that commit.

- **The home page alone holds 60 page views per second,** where it held 2. It is slow at 80 and fails at 100.
- **The primary mix holds 110 visitors per second** on the public path with new connections, where it held 30. It is slow at 120 and fails at 130. That is the limit that the mix without the home page had before.
- **The limit of the mix is now abio's CPU, not the pool request:** 92% of 8 cores at 110 visitors per second and 98% at 120, of which the proxy uses 6.4 to 6.5 cores. The main threads are at 67% to 78%.
- **Over the private path with reused connections, the mix holds 160 visitors per second.** At 180 and 200 the page view p95 is over 1 second, with both main threads at 93%. No stop rule fired up to 200, the highest planned step.
- **No answer carried `GW-Page-Cache: busy`** in any step of the three ramps.

### Conditions of these runs

| Item | Value |
| --- | --- |
| Date | Monday, October 5, 2026, 05:31 to 05:48 UTC |
| Commit deployed | `833a2e53` on both instances, no restart and no deploy during the runs |
| Generators | worker3 and worker1, half of each step's rate each, for all three ramps |
| Commands | The page-view commands under [Repeat the runs](#repeat-the-runs), with higher rates. Home: `--rates 2,5,10,20,30,40,50,60 --step-duration 20` per generator. Mix, public: `--rates 15,30,40,45,50,55,60,65 --step-duration 30` per generator. Mix, private with `--connections reuse`: `--rates 20,40,50,60,70,80,90,100 --step-duration 30` per generator |
| Page assets | One capture of the deployed build, from a 15-second run at 1 visitor per second, passed to every run with `--page-assets` |
| Stop rules and step lengths | As before |
| Background traffic | 50 to 80 requests per second finished by the two instances together, and 65 to 85 new connections per second at abio's proxy |

- **Before and after every ramp:** `./bench.sh smoke --commit 833a2e53` passed on the public route, on abio, and on vector1.
- **One change to the benchmark scripts:** `summary.json` now counts the 503 answers with `GW-Page-Cache: busy` as `page_cache_busy`, per step. The requests that the scripts send didn't change.
- **The earlier home ramp and the earlier low rates of the mix ran from worker3 alone.** These ramps ran from two generators from the first step, so the per-step rates differ from the earlier tables.

### What holds, before and after

Rates are visitors per second, summed over both generators. All values are measured.

| Run | Step | Before (`3a45fcfd`) | After (`833a2e53`) |
| --- | --- | --- | --- |
| Home page alone, public path, new connections | Highest step that holds | 2 | 60 |
| | First slow step | 3 (document p95 313 ms) | 80 (page view p95 2.1 s) |
| | First failing step | 6 | 100 (68 reached) |
| | What limits it | The pool request on the Node main threads | vector1's main thread (100% at 80), with abio's main thread (88%) and abio's CPU (91%) close behind |
| Primary mix, public path, new connections | Highest step that holds | 30 (document p95 under 300 ms) | 110 (document p95 52 to 61 ms) |
| | First slow step | 35 (document p95 397 ms) | 120 (page view p95 0.8 to 1.1 s) |
| | First failing step | 80 (36 reached) | 130 (89 reached) |
| | What limits it | The pool request on the Node main threads | abio's CPU (92% to 98%), most of it the proxy |
| Primary mix, private path, reused connections | Highest step that holds | 20 (document p95 under 300 ms) | 160 |
| | First slow step | 30 (document p95 325 ms) | 180 (page view p95 1.1 s) |
| | First failing step | Not reached at 40 | Not reached at 200 |
| | What limits it | The pool request on the Node main threads | Both Node main threads (89% to 93%) |

The pool request in the webapp's own histogram, on abio, over a whole ramp:

| Run | Before: p50 / p95 ms | After: p50 / p95 ms |
| --- | --- | --- |
| Primary mix, public path, two generators | 667 / 1,753 | 31 / 123 |
| Home page alone | Not recorded in this document (357 to 403 ms at the median for the client) | 41 / 243 |

These are wall times that include the overloaded steps, not main-thread time.

### Home page alone, after

Public path, new connections, two generators. In the columns with two values separated by a comma, the values are the two generators.

| Visitors per second | Page views per second | Failed page views | 5xx answers | Of which `GW-Page-Cache: busy` | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | 3.9 | 0 | 0 | 0 | 5 / 18, 5 / 29 | 75 / 108, 75 / 106 | 8 | 197 | 31 | 17 | 34 | 35 | 32 | 6, 6 |  |
| 10 | 9.4 | 0 | 0 | 0 | 5 / 17, 6 / 23 | 76 / 120, 75 / 108 | 19 | 244 | 35 | 32 | 47 | 45 | 71 | 14, 12 |  |
| 20 | 19.0 | 0 | 0 | 0 | 5 / 33, 5 / 39 | 76 / 153, 76 / 158 | 38 | 308 | 46 | 56 | 56 | 53 | 133 | 18, 19 |  |
| 40 | 38.0 | 0 | 0 | 0 | 6 / 30, 5 / 32 | 76 / 160, 74 / 178 | 76 | 415 | 61 | 87 | 71 | 67 | 259 | 34, 30 |  |
| 60 | 58.0 | 0 | 0 | 0 | 10 / 46, 9 / 47 | 97 / 247, 94 / 257 | 116 | 495 | 72 | 129 | 88 | 79 | 387 | 40, 42 | Holds |
| 80 | 76.8 | 0 | 0 | 0 | 47 / 147, 36 / 129 | 287 / 2,119, 231 / 2,081 | 155 | 564 | 88 | 164 | 100 | 91 | 488 | 49, 47 | Slow: page view p95 over 2 s |
| 100 | 68.3 | 0 | 0 | 0 | 105 / 510, 84 / 430 | 529 / 1,713, 477 / 3,361 | 165 | n/a | n/a | n/a | n/a | 94 | 515 | 53, 54 | Fails: 68 of 100 reached |

Dropped iterations: 132. Requests: 244,848. The planned step at 120 didn't start.

- **Break point:** 60 page views per second hold, with a document p95 of 47 ms and a page view p95 of about 250 ms. At 80 every request is answered, but the page view p95 is over 2 seconds. At 100 the stop rule fired on dropped iterations. The rates between 60 and 80 weren't measured.
- **What limits it:** the Node main threads first. vector1's is at 100% at 80 page views per second and abio's at 88%. abio's CPU is at 91% in the same step, so the proxy's limit is close behind.
- **Errors:** no page view failed and no answer had a 5xx status. Nine requests of the failing step got no answer before the run stopped.
- **A home page view is fast again for the visitor:** 75 ms at the median up to 40 page views per second, where it took 400 to 480 ms.

### Primary scenario (`hot` mix), after

Public path, new connections, two generators.

| Visitors per second | Page views per second | Failed page views | 5xx answers | Of which `GW-Page-Cache: busy` | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 30 | 27.1 | 0 | 0 | 0 | 5 / 18, 5 / 18 | 54 / 78, 54 / 83 | 57 | 357 | 39 | 62 | 50 | 57 | 157 | 20, 21 |  |
| 60 | 51.6 | 0 | 0 | 0 | 5 / 24, 5 / 21 | 55 / 93, 55 / 89 | 110 | 475 | 47 | 102 | 61 | 71 | 269 | 39, 39 |  |
| 80 | 69.7 | 0 | 0 | 0 | 7 / 29, 7 / 34 | 59 / 110, 59 / 119 | 149 | 554 | 59 | 130 | 66 | 82 | 364 | 46, 48 |  |
| 90 | 79.9 | 0 | 0 | 0 | 9 / 61, 9 / 56 | 66 / 203, 66 / 197 | 170 | 578 | 63 | 144 | 76 | 87 | 411 | 48, 50 |  |
| 100 | 88.9 | 0 | 0 | 0 | 12 / 58, 12 / 59 | 75 / 184, 77 / 195 | 189 | 601 | 65 | 154 | 80 | 91 | 458 | 52, 49 |  |
| 110 | 98.4 | 0 | 0 | 0 | 15 / 61, 12 / 52 | 83 / 218, 79 / 171 | 208 | 637 | 67 | 158 | 77 | 92 | 493 | 51, 58 | Holds |
| 120 | 107.0 | 0 | 0 | 0 | 44 / 293, 36 / 174 | 222 / 1,110, 174 / 843 | 226 | 653 | 71 | 175 | 78 | 98 | 549 | 59, 82 | Slow: page view p95 about 1 s. One generator near its limit |
| 130 | 80.2 | 0 | 0 | 0 | 301 / 1,109, 177 / 800 | 1,548 / 2,638, 853 / 2,410 | 189 | n/a | n/a | n/a | n/a | 99 | 474 | 52, 85 | Fails: 89 of 130 visitors reached |

Dropped iterations: 250. Requests: 712,409.

- **Break point:** 110 visitors per second hold (98 page views plus the bot requests), with a document p95 of 52 to 61 ms and a page view p95 of about 200 ms. At 120 the page view p95 is about 1 second. At 130 the stop rule fired on dropped iterations.
- **What limits it:** abio's CPU, at 92% at 110 visitors per second, 98% at 120, and 99% at 130. The proxy uses 6.4 to 6.5 of the 8 cores. The main threads are at 67% to 78%, so Node is second in line, as for the movie page.
- **The same limit as the mix without the home page had before the fix** (100 held, 110 and 120 were slow, 130 failed). The home page no longer changes what the mix holds.
- **The generator on worker1 used 82% and 85% of its cores at 120 and 130,** where worker3 used 59% and 52%. In the earlier runs both stayed under 65% at these rates, and the reason for the difference wasn't looked into. Read the latencies of those two steps with that in mind. abio's CPU was at 98% to 99% in both, so the steps aren't the generator's failure alone, and the step at 110 is clean (51% and 58%).
- **Errors:** no request failed and no answer had a 5xx status.

### Primary scenario over the private path with reused connections, after

`--path private --connections reuse`, two generators.

| Visitors per second | Page views per second | Failed page views | 5xx answers | Of which `GW-Page-Cache: busy` | Document p50 / p95 ms | Page view p50 / p95 ms | New TLS connections per second | abio proxy % | abio main thread % | vector1 proxy % | vector1 main thread % | abio CPU % of 8 cores | abio sends Mbit/s | Generator CPU % | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40 | 35.9 | 0 | 0 | 0 | 5 / 21, 5 / 24 | 31 / 68, 32 / 70 | 8 | 296 | 46 | 76 | 44 | 50 | 199 | 23, 25 |  |
| 80 | 69.9 | 0 | 0 | 0 | 5 / 25, 5 / 20 | 28 / 63, 29 / 59 | 0 | 371 | 59 | 127 | 62 | 59 | 371 | 33, 35 |  |
| 100 | 88.9 | 0 | 0 | 0 | 6 / 24, 6 / 26 | 30 / 68, 31 / 67 | 0 | 389 | 67 | 160 | 66 | 64 | 456 | 43, 41 |  |
| 120 | 106.7 | 0 | 0 | 0 | 8 / 35, 8 / 35 | 34 / 90, 34 / 93 | 0 | 421 | 72 | 171 | 80 | 68 | 546 | 42, 44 |  |
| 140 | 124.3 | 0 | 0 | 0 | 9 / 42, 9 / 40 | 36 / 110, 36 / 108 | 0 | 436 | 84 | 198 | 79 | 71 | 606 | 49, 50 |  |
| 160 | 142.3 | 0 | 0 | 0 | 18 / 69, 15 / 61 | 57 / 347, 53 / 189 | 0 | 461 | 89 | 218 | 92 | 76 | 713 | 53, 56 | Holds |
| 180 | 162.3 | 1 | 1 | 0 | 19 / 98, 20 / 104 | 63 / 1,122, 63 / 1,168 | 0 | 498 | 93 | 250 | 93 | 80 | 816 | 56, 59 | Slow: page view p95 over 1 s |
| 200 | 170.9 | 0 | 0 | 0 | 23 / 106, 27 / 98 | 70 / 1,279, 80 / 1,273 | 0 | 465 | 85 | 261 | 93 | 81 | 837 | 59, 62 | Slow. 191 of 200 visitors reached |

Dropped iterations: 4. Requests: 1,159,432.

- **Break point:** 160 visitors per second hold, with a page view p95 of 190 to 350 ms. At 180 and 200 the documents still arrive within about 100 ms at p95, but the page view p95 is over 1 second.
- **No stop rule fired.** The ramp ended at its highest planned step, so the first failing step on this path isn't measured. The plan wasn't extended, because production already answered slowly at 180.
- **What limits it:** both Node main threads, at 89% to 92% at 160 and 93% at 180, with abio's CPU at 76% to 81%. This is the limit the mix without the home page had before the fix (140 held, 160 failed).
- **One 5xx answer** in 1.16 million requests, at 180 visitors per second. It didn't carry `GW-Page-Cache: busy`, and neither instance's 5xx counter moved, so it came from a proxy. It wasn't traced further.
- **vector1's proxy** used 2.5 to 2.6 cores at 180 and 200. The 6.5 to 8.2 cores of the earlier failing private steps didn't recur.
- **The last step is short on one generator:** the run on worker3 was stopped about 3 seconds before its end, when the run on worker1 finished. That is the reason for 191 instead of 200.

### The pool request's main-thread cost in production

Measured: the two main threads together, in percent of one core, over the valid steps of the home ramp.

| Page views per second | Before: both main threads % | After: both main threads % |
| --- | --- | --- |
| 1.0 | 89 | Not run |
| 1.9 | 115 | Not run |
| 2.9 | 150 | Not run |
| 3.9 | 170 | 65 |
| 9.4 | Not run | 82 |
| 19.0 | Not run | 101 |
| 38.0 | Not run | 132 |
| 58.0 | Not run | 159 |

Derived from these values, not measured directly:

- **A home page view costs 15 to 17 ms of main-thread time across both instances,** from the slope between 19 and 58 and between 3.9 and 58 page views per second. Before, it cost 340 to 420 ms.
- **The pool request costs at most about 6 to 8 ms of that.** A movie page view costs 9 ms (see [Cost per page view](#cost-per-page-view)), and a home page view sends three more files than a movie page view plus the pool request. The request wasn't profiled on its own in production.
- **The estimate of about 20 ms** in [The home page's pool request after the fix](#the-home-pages-pool-request-after-the-fix) was too high.

### Not measured in these runs

- **The home page between 60 and 80 page views per second,** and the mix between 110 and 120.
- **The first failing step of the mix on the private path.**
- **The first pool request after a new snapshot version or after midnight UTC** under load. Each process pays the walk over the snapshot once then.
- **A visitor with guest progress or a member.** The replayed body is an anonymous visitor without progress, who gets the order by popularity without a ranking of their own.
- **The movie page and the mix without the home page.** They weren't repeated, because the fix doesn't touch them.

### Incidents and end state of these runs

- **Real visitors were affected** in the slow and failing steps: for about 40 seconds in the home ramp, about 60 seconds in the public mix, and about 70 seconds in the private mix, pages loaded slowly (page view p95 from 1 to 3.4 seconds). Documents stayed under 1.2 seconds at p95.
- **Benchmark requests that failed:** nine without an answer in the failing step of the home ramp, and one 5xx answer in the private mix at 180 visitors per second. None in a step that this section calls "holds".
- **End state at 05:48 UTC:** the smoke check passed on the public route and on both instances, and each instance's 5xx counter was at 0 over every run.
- **Generators:** no container left on worker3 or worker1. On worker1, the k6 image and the work directory that the runs created were removed. worker3 keeps its benchmark images and an empty run directory, as before.
