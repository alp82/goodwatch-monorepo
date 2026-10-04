# Production baseline for the viral spike map

This page records how production behaved on October 4, 2026, before any change from the "Serve a viral traffic spike" map. Every later ticket compares against these numbers. Repeat the commands in [Repeat the runs](#repeat-the-runs) for an "after" comparison.

The run summaries are in [`goodwatch-benchmark/results/baseline-2026-10-04/`](../../goodwatch-benchmark/results/baseline-2026-10-04/). Where each metric lives is in [viral-spike-metrics.md](viral-spike-metrics.md).

## Summary

- **Break point, primary scenario:** production holds 2 benchmark requests per second and stops at 4, on top of about 50 background requests per second. The stop is the 3-second rule: p95 of the full response reached 4,384 ms. No request failed.
- **Latency:** no HTML surface except the home page meets the 300 ms target at any rate. At 2 requests per second, a warm movie page has a p95 of 832 ms for the full response and 216 ms for the first byte.
- **What saturates first:** the Node main thread. It is 79% busy with no benchmark load and reaches 94% to 106% at each stop. Crate, Redis, Qdrant, the network link, and the host CPU all stay far below their limits.
- **Lab Web Vitals:** mobile Lighthouse scores are 30 to 38. LCP is 9.8 to 16.6 seconds against a "good" limit of 2.5 seconds.
- **Distance to the destination:** 2 requests per second against 500, a p95 of 832 ms or more on title pages against 300 ms, and an LCP four to seven times over the limit.

## Conditions

| Item | Value |
| --- | --- |
| Date | Sunday, October 4, 2026 |
| Load runs | 02:38 to 03:42 UTC |
| Lighthouse | 03:43 to 03:57 UTC |
| Reference without benchmark load | 03:57 to 03:58 UTC |
| Commit deployed | `86e011c8` (from `goodwatch_build_info`), container started 01:24 UTC, no restart during the runs |
| Benchmark tooling | Branch `feat/241-baseline`, commits `d742d993` and `88af219a` |
| Serving host | abio (`10.0.0.21`), 8 cores, one `remix-serve` process behind Coolify's Traefik proxy |
| Generator | worker3 (`10.0.0.32`), 4 cores, k6 1.8.1 and Lighthouse 13.5.0 in Docker |
| Load path | Private network, through the proxy with TLS. k6 reuses connections. |
| Lighthouse path | Public |
| Total load time | 37.7 minutes across 16 runs, the longest 6.9 minutes |

## Method

All load runs use `goodwatch-benchmark/bench.sh` with GET requests only. Nothing was flushed, restarted, or deployed.

- **Ramp:** 1, 2, 4, 6, and so on up to 20 requests per second, then steps of 5. Each step lasts 30 seconds. One step lower than planned (1 request per second) was added, because the smoke runs stopped at 3.
- **Break point:** the step at which the default automatic stop triggers: p95 of the full response at 3,000 ms or more, or 2% errors. "Holds" names the last step that finished below both limits.
- **Surfaces:** one ramp per surface with `--urls surfaces --routes <route>`, and one ramp for the primary scenario with `--urls hot` (60% one movie page, 9 other entries, about 10% link-preview bots).
- **Warm:** fixed cookie and language, each URL fetched once before the measurement.
- **Cold:** the benchmark's cold mode (a new cookie per request, rotating languages), plus the long-tail set with `SEQUENTIAL=1`, where every request is a different title.
- **Host metrics:** `bench.sh` sampled abio, the three Crate hosts, the three Redis hosts, the Qdrant host, and worker3 every 5 seconds.
- **Webapp metrics:** with `BENCH_WEBAPP_PROBE=1`, `bench.sh` saved the webapp's `/metrics` before and after each run and computed the difference. It also sampled CPU time per thread of the webapp process, CPU time of the proxy, and the connections the proxy accepted.
- **After each run:** a wait of at least 60 seconds, then a check of the container's health, the in-flight gauge, and a request to `/` and to one title page.

Latency is k6's view from worker3: it includes the proxy, TLS on a reused connection, and 0.7 ms of network round trip. "Full" is the time to the last byte. "TTFB" is the time to the first byte.

## Background load

Every number on this page includes the standing traffic. The webapp's own counters give it per run: all finished requests minus the requests k6 sent.

| Run | Start (UTC) | Load s | Benchmark req/s | Background req/s | Of which crawler loop | Main thread avg / max % | Proxy avg / max % | In flight max | Loop delay max ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hot-warm` | 02:41 | 102 | 2.2 | 48.5 | 36.0 | 81 / 94 | 115 / 136 | 56 | 200 |
| `hot-warm-stop10s` | 02:44 | 134 | 2.6 | 53.9 | 37.5 | 88 / 106 | 121 / 174 | 121 | 931 |
| `surface-home` | 02:48 | 160 | 3.9 | 50.9 | 36.4 | 77 / 97 | 113 / 149 | 48 | 139 |
| `surface-title-movie` | 02:52 | 40 | 1.0 | 50.3 | 37.7 | 84 / 95 | 113 / 122 | 22 | 57 |
| `surface-title-show` | 02:54 | 58 | 1.3 | 47.5 | 36.8 | 87 / 96 | 112 / 133 | 26 | 148 |
| `surface-person` | 02:57 | 144 | 3.1 | 50.5 | 37.1 | 79 / 97 | 115 / 163 | 68 | 132 |
| `surface-discover` | 03:01 | 110 | 2.2 | 49.3 | 37.7 | 84 / 101 | 111 / 154 | 34 | 123 |
| `surface-share-list` | 03:05 | 206 | 4.9 | 49.1 | 36.4 | 81 / 97 | 115 / 161 | 39 | 147 |
| `surface-og-title` | 03:10 | 415 | 14.2 | 47.8 | 36.7 | 72 / 88 | 127 / 167 | 25 | 123 |
| `surface-og-share-list` | 03:19 | 415 | 14.2 | 49.4 | 36.9 | 75 / 93 | 119 / 158 | 34 | 103 |
| `latency-warm` (stopped) | 03:27 | 16 | 1.8 | 72.5 | 41.7 | 89 / 95 | 143 / 155 | 14 | 102 |
| `latency-cold` | 03:29 | 150 | 2.0 | 51.9 | 38.2 | 77 / 90 | 114 / 155 | 14 | 134 |
| `latency-warm-2` | 03:34 | 152 | 2.0 | 48.0 | 37.9 | 76 / 87 | 111 / 120 | 10 | 159 |
| `latency-cold-longtail` (stopped) | 03:38 | 12 | 0.4 | 79.2 | 47.3 | 90 / 99 | 150 / 151 | 55 | 129 |
| `latency-cold-longtail-2` | 03:40 | 120 | 1.0 | 48.0 | 37.7 | 83 / 96 | 113 / 130 | 17 | 184 |
| Reference, no benchmark | 03:57 | 0 | 0 | 54.1 | 37.9 | 79 / 89 | 116 / 146 | 11 | 168 |

CPU is in percent of one core. The benchmark rate is the average over the whole ramp, not the peak step. The crawler loop is `/person/:personKey` redirects plus `/browser-check`.

The background isn't flat. It rises from about 48 to 72 or 79 requests per second for 30 to 40 seconds every four to five minutes. In a burst, `/`, `/api/tonight`, `/api/search-config`, `/api/og-image-warm`, and `/api/e` each get about 3 requests per second, which is the pattern of clients that run the page's script. Two runs started inside a burst and stopped within 16 seconds (`latency-warm` and `latency-cold-longtail`). Both were repeated once. The client behind the bursts wasn't identified.

## Break point per surface

The default stop applies: p95 of the full response at 3,000 ms, or 2% errors. No run had an error, a timeout, or a 5xx response.

| Surface | URL | Holds (req/s) | p95 full there (ms) | Stops at (req/s) | p95 full at the stop (ms) | TTFB p95 at the stop (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| Primary scenario (`hot`) | Mix, 60% one movie page | 2 | 1,429 | 4 | 4,384 | 339 |
| Home | `/` | 6 | 955 | 8 | 3,395 | 380 |
| Movie page | `/movie/603-the-matrix` | 1 | 1,086 | 2 | 3,297 | 254 |
| Show page | `/show/1396-breaking-bad` | 1 | 1,711 | 2 | 3,852 | 412 |
| Person page | `/person/138-quentin-tarantino` | 6 | 2,107 | 8 | 6,944 | 875 |
| Discover | `/discover` | 4 | 2,224 | 6 | 5,753 | 231 |
| Share list page | The benchmark share list | 8 | 933 | 10 | 4,323 | 387 |
| Title OG image | `/og/movie/603-the-matrix.png` | 35 or more | 56 | Not reached | | |
| Share list OG image | The benchmark share list's preview | 35 or more | 181 | Not reached | | |

- The two OG image ramps ended at 35 requests per second because of the load time budget, not because of a stop. Both images came from the webapp's in-process cache.
- The stop needs a few seconds of samples, so a step can stop on 15 to 25 requests. Read each break point as plus or minus one step. The second primary run shows the spread: it passed 4 requests per second with a p95 of 2,584 ms.
- The benchmark share list has five titles. Its path is only in the ignored `config.env`.

### Primary scenario with the stop raised to 10 seconds

One more ramp of the `hot` set with `ABORT_P95_MS=10000`, to find where errors start:

| Step (req/s) | Achieved | Requests | Errors | Full p50 / p95 / p99 (ms) | TTFB p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- |
| 1 | 0.97 | 29 | 0 | 439 / 1,258 / 2,128 | 119 / 239 |
| 2 | 1.94 | 68 | 0 | 376 / 1,683 / 1,991 | 107 / 248 |
| 4 | 3.86 | 135 | 0 | 663 / 2,584 / 3,888 | 111 / 292 |
| 6 | 3.30 | 112 | 0 | 1,812 / 11,633 / 13,743 | 156 / 380 |

The run stopped at 6 requests per second on the 10-second limit, before any error or timeout. The slowest response took 14.1 seconds, against a 30-second client timeout. At that step the movie page alone had a p95 of 12,883 ms, 121 requests were in flight in the webapp, and the event loop ran up to 931 ms late. The error threshold of the destination ("no errors") was never the first limit: latency is.

## Latency per route

All times are in milliseconds, measured by k6 on worker3. The sample counts are small, because production can't take more load: treat p99 as the maximum of a few dozen requests.

### Warm, 2 requests per second across eight surfaces

Run `latency-warm-2`, 152 seconds, background 48.0 requests per second.

| Surface | Requests | Full p50 | Full p95 | Full p99 | TTFB p50 | TTFB p95 | TTFB p99 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 34 | 62 | 138 | 185 | 25 | 56 | 64 |
| Movie page | 50 | 292 | 832 | 978 | 105 | 216 | 261 |
| Show page | 37 | 415 | 876 | 950 | 120 | 254 | 429 |
| Person page | 36 | 142 | 352 | 903 | 44 | 107 | 150 |
| Discover | 45 | 218 | 890 | 1,123 | 104 | 202 | 267 |
| Share list page | 25 | 149 | 322 | 410 | 90 | 164 | 232 |
| Title OG image | 40 | 21 | 82 | 129 | 11 | 67 | 108 |
| Share list OG image | 32 | 33 | 129 | 170 | 29 | 125 | 167 |

### Cold mode, 2 requests per second across eight surfaces

Run `latency-cold`, 150 seconds, background 51.9 requests per second. Cold mode changes only the cookie and the language. No page cache exists, so warm and cold differ by the state of the data caches and by noise.

| Surface | Requests | Full p50 | Full p95 | Full p99 | TTFB p50 | TTFB p95 | TTFB p99 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 37 | 83 | 265 | 331 | 25 | 93 | 109 |
| Movie page | 35 | 313 | 806 | 1,044 | 112 | 253 | 343 |
| Show page | 35 | 561 | 1,216 | 1,480 | 128 | 278 | 350 |
| Person page | 41 | 157 | 458 | 974 | 49 | 113 | 163 |
| Discover | 41 | 226 | 687 | 793 | 110 | 267 | 357 |
| Share list page | 40 | 183 | 592 | 656 | 106 | 218 | 253 |
| Title OG image | 43 | 21 | 74 | 88 | 12 | 59 | 65 |
| Share list OG image | 27 | 39 | 122 | 191 | 36 | 119 | 188 |

### Cold data cache: long-tail titles, 1 request per second

Run `latency-cold-longtail-2`, 120 seconds, background 48.0 requests per second. Every request is a different sitemap URL. One request answered 404 (a title in the sitemap that no longer exists).

| Route | Requests | Full p50 | Full p95 | Full p99 | TTFB p50 | TTFB p95 | TTFB p99 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Movie pages | 76 | 590 | 1,317 | 2,401 | 335 | 640 | 724 |
| Show pages | 28 | 968 | 2,890 | 4,078 | 466 | 644 | 869 |
| Other sitemap pages | 15 | 265 | 1,381 | 1,620 | 173 | 857 | 1,352 |

A cold title page takes about twice as long as a warm one, and its first byte comes three times later (335 against 105 ms at p50).

### Warm, one surface alone at 1 request per second

The first step of each surface ramp, 24 to 29 requests each.

| Surface | Full p50 | Full p95 | Full p99 | TTFB p50 | TTFB p95 |
| --- | --- | --- | --- | --- | --- |
| Home | 93 | 288 | 364 | 25 | 81 |
| Movie page | 326 | 1,086 | 1,415 | 104 | 250 |
| Show page | 657 | 1,711 | 2,393 | 127 | 236 |
| Person page | 130 | 416 | 648 | 45 | 71 |
| Discover | 182 | 555 | 641 | 105 | 216 |
| Share list page | 167 | 655 | 882 | 102 | 236 |
| Title OG image | 21 | 38 | 74 | 11 | 28 |
| Share list OG image | 31 | 67 | 85 | 28 | 62 |

### Real traffic, no benchmark load

From the webapp's own histograms over 63 seconds at 03:57 UTC. These times are measured inside the Node process and exclude the proxy. Percentiles are estimates between bucket edges.

| Route pattern | Requests | Full p50 | Full p95 | Full p99 | Headers p50 | Headers p95 | Under 300 ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/movie/:movieKey` | 194 | 314 | 1,488 | 1,945 | 187 | 484 | 48.5% |
| `/show/:showKey` | 76 | 462 | 1,655 | 1,931 | 263 | 494 | 22.4% |
| `/person/:personKey` (2xx) | 245 | 194 | 899 | 1,694 | 87 | 253 | 71.4% |
| `/` | 44 | 38 | 160 | 780 | 30 | 84 | 97.7% |
| `/browser-check` | 1,174 | 30 | 114 | 191 | 27 | 59 | 100% |

Production misses the 300 ms target before the benchmark sends one request.

## What saturates first

### Verified

- **The Node main thread is the first limit.** It uses 79% of a core with no benchmark load (reference sample), 72% to 90% on average during the runs, and 94% to 106% in the last samples before each stop on an HTML surface. In the primary run with the raised stop, it went from 85% at 1 request per second to 95% and 106% at 6.
- **Requests queue inside the process.** Requests in flight rose from about 6 to 121, and the event loop delay from under 200 ms to 931 ms, at the step that stopped the raised run.
- **The first byte stays fast while the full response collapses.** At the 6 requests per second step, TTFB p95 was 380 ms and the full response p95 was 11,633 ms. The page shell goes out, and the rest of the streamed response waits for the main thread.
- **The other threads of the process have room.** The four libuv threads use 13% to 23% of a core together. The V8 worker threads use 8% to 62% on average, with peaks of 100% to 117% at the stops.
- **abio as a host is not saturated.** It averaged 35% to 48% of its 8 cores, with a maximum of 55% and a load of 5.8 at most.
- **The proxy uses more CPU than the webapp, but on several cores.** Traefik used 1.1 to 1.5 cores on average and up to 1.7. Its CPU follows the rate of new connections, not the benchmark rate: about 105% of a core at 40 accepted connections per second and about 150% at 65. The benchmark reuses connections, so it added almost none.
- **Crate is idle.** The three Crate hosts averaged 4% to 10% of 16 cores, with a maximum of 21%.
- **Redis is idle.** The three Redis hosts averaged 1% to 11% of 8 cores, with a maximum of 26%.
- **Qdrant is fast, and its host is sometimes busy with other work.** `Recommend` averaged 47 to 80 ms and `Get` 3 to 12 ms per call in 14 of 15 runs, at 1.1 to 3.0 and 4.0 to 6.7 calls per second. From 03:34 to 03:42 UTC the Qdrant host was 23% to 69% busy on 16 cores, against 6% to 9% before, with `UpdateBatch` writes of up to 2 seconds each. In the three runs of that window `Recommend` averaged 62, 166, and 73 ms. The 166 ms run also sat in a background burst. The job on that host wasn't identified.
- **The data cache misses most lookups.** With no benchmark load: 98% on `details-movie`, 97% on `details-show`, 98% on `availability-evidence-v1`, 77% on the related-title caches, and 74% on `person-profile-v2`. A miss on `details-movie` costs 111 ms at p50 and 194 ms at p95.
- **Cached OG images are cheap.** At 35 requests per second of one cached image, p95 stayed at 56 ms (title) and 181 ms (share list), and the main thread was at 72% and 75% on average, which is not above the background level.
- **The network is far from its limit.** A 4-second `iperf3` between abio and worker3 measured 7.0 Gbit/s on the private link. The highest send rate from abio in any run was 214 Mbit/s, at 35 title OG images per second (about 0.7 MB each). The generator used at most 25% of its 4 cores.

### Inferred

- **A page render costs main-thread time that production no longer has.** With 79% of the thread taken by the background, about 20% is left. The break points fit that: 1 to 2 title pages per second, or 6 to 8 light pages.
- **New TLS connections are the proxy's cost.** The two operating points above give about 20 to 25 ms of proxy CPU per accepted connection. The certificate has a 4096-bit RSA key, which makes each handshake expensive. At 500 new connections per second, that would be 10 to 12 cores, on a host with 8. This was not load-tested, because k6 reuses connections.
- **The crawler loop takes a large share of both limits.** It is 36 to 38 of about 50 background requests per second, and nearly every one of its requests opens a new connection.

### Not measured

- OG rendering on a cache miss under load. The benchmark is GET only, nothing was flushed, and the long-tail pass had no image entry among its 119 requests. The slow-path audit measured 250 to 470 ms of main-thread time per render.
- The rate of new TLS connections that the proxy can take. It needs a run without connection reuse.
- Any build on abio during a run. None ran.
- Main-thread time per request type, and the cause of the event-loop delay of 100 to 200 ms that every run showed.
- The public path under load, member traffic, and `POST /api/combined-search`.

## Lab Web Vitals

`./bench.sh lighthouse`, mobile profile with simulated throttling, three runs per page, median, public path, from worker3. Analytics requests weren't blocked.

| Page | Score | FCP | LCP | TBT | CLS | Speed index | Weight | Requests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 34 | 5.4 s | 9.8 s | 1.6 s | 0 | 6.6 s | 1.40 MB | 127 |
| Movie page | 30 | 3.4 s | 10.7 s | 8.4 s | 0 | 9.5 s | 16.9 MB | 949 |
| Show page | 31 | 3.6 s | 11.2 s | 10.3 s | 0 | 7.7 s | 39.2 MB | 1,172 |
| Person page | 38 | 3.2 s | 9.8 s | 2.0 s | 0 | 5.2 s | 2.96 MB | 239 |
| Discover | 31 | 4.8 s | 16.6 s | 3.1 s | 0.028 | 6.2 s | 2.55 MB | 294 |
| Share list page | 35 | 4.0 s | 10.5 s | 1.6 s | 0 | 6.0 s | 1.69 MB | 147 |

- The numbers match the front-end audit of the same day within noise. The share list page is new.
- Single runs vary: the show page scored 44, 31, and 29, with an LCP of 5.4, 11.2, and 22.5 seconds. Discover had a CLS of 0.154 in one of three runs.
- "Good" is an LCP of 2.5 seconds or less and a CLS of 0.1 or less. TBT stands in for INP, and 200 ms is the usual lab limit.

## Field Web Vitals

Not recorded: this needs a PostHog login, so it is an owner step. Run the query "p75 per landing route and device type" from [viral-spike-metrics.md](viral-spike-metrics.md#query-p75-per-landing-route-and-device-type) in PostHog's SQL editor, and add the rows for `/`, `/movie/:movieKey`, `/show/:showKey`, `/u/:handle/lists/:id`, and `/person/:personKey` with `device = Mobile` here. Events carry `landing_route_pattern` only since the deploy of October 4, 2026, so the first full week ends on October 11.

## Distance to the destination

| Target | Baseline | Gap |
| --- | --- | --- |
| 500 requests per second for one hour, no errors | The primary scenario holds 2 requests per second under the 3-second rule, and 4 before responses pass 10 seconds | 250 times |
| p95 under 300 ms, full response, cached pages | Movie 832 ms, show 876 ms, Discover 890 ms, person 352 ms, share list 322 ms, home 138 ms, at 2 requests per second | Home and the cached OG images meet it. Title pages are 2.8 times over at the lowest rate. |
| Good mobile Core Web Vitals on home, title, share list, and person pages | LCP 9.8 to 11.2 s, TBT 1.6 to 10.3 s, CLS 0 | LCP is 3.9 to 4.5 times over. CLS is good. |

## Repeat the runs

Set this in the ignored `goodwatch-benchmark/config.env`:

```sh
BENCH_SSH_JUMP='root@<jump host>'   # Only while the tunnel is down
BENCH_METRIC_HOSTS='10.0.0.21:target:coolify-proxy+gk4owk8,10.0.0.11:data,10.0.0.12:data,10.0.0.13:data,10.0.0.14:data,10.0.0.15:data,10.0.0.16:data,10.0.0.20:data'
BENCH_WEBAPP_PROBE=1
BENCH_NO_COUNTDOWN=1
SHARE_LIST_PATH='/u/<handle>/lists/<id>'
SHARE_LIST_OG_PATH='<path of the og:image in that page>'
```

Before each run, check that one webapp container runs and is healthy, that no build runs on abio, and that worker3 runs no other benchmark. Wait at least 60 seconds between runs.

```sh
cd goodwatch-benchmark
R=1,2,4,6,8,10,12,14,16,18,20,25,30,35,40,45,50,55,60,65

# Primary scenario, default stop, then with the stop at 10 seconds
./bench.sh load --mode ramp --rates $R --step-duration 30 --cache warm --urls hot --label baseline-hot-warm --raw --yes-ramp-production
ABORT_P95_MS=10000 ./bench.sh load --mode ramp --rates $R --step-duration 30 --cache warm --urls hot --label baseline-hot-warm-stop10s --raw --yes-ramp-production

# One ramp per HTML surface
for route in home title_movie:browser title_show person discover share_list; do
  ./bench.sh load --mode ramp --rates $R --step-duration 30 --cache warm --urls surfaces --routes $route --label baseline-surface-$route --raw --yes-ramp-production
done

# The two OG images, up to 35 requests per second
for route in og_title og_share_list; do
  ./bench.sh load --mode ramp --rates 1,2,4,6,8,10,12,14,16,18,20,25,30,35 --step-duration 25 --cache warm --urls surfaces --routes $route --label baseline-surface-$route --raw --yes-ramp-production
done

# Latency at 2 requests per second, warm and cold, then cold long-tail titles at 1
M=home,title_movie:browser,title_show,person,discover,share_list,og_title,og_share_list
./bench.sh load --mode ramp --rates 2 --step-duration 150 --cache warm --urls surfaces --routes $M --label baseline-latency-warm --raw --yes-ramp-production
./bench.sh load --mode ramp --rates 2 --step-duration 150 --cache cold --urls surfaces --routes $M --label baseline-latency-cold --raw --yes-ramp-production
./bench.sh longtail --seed baseline
SEQUENTIAL=1 ./bench.sh load --mode smoke --rate 1 --duration 120 --cache cold --urls longtail --label baseline-latency-cold-longtail --raw

# Lighthouse: copy lighthouse/urls.txt to an ignored file and add a share_list line
./bench.sh lighthouse --urls <urls file> --runs 3 --label baseline

# Compare one run with its baseline
./bench.sh compare results/baseline-2026-10-04/20261004T024106Z-load-baseline-hot-warm <after run>
```

When a surface holds more than the baseline's last step, extend `R` rather than starting higher. The compare script reads `summary.json`, so the committed summaries are enough.

To record the reference without benchmark load, run `scripts/webapp-probe.sh` on abio with `snapshot`, then `sample 5 60`, then `snapshot` again, and pass the files to `webappSummary()` in `scripts/webapp-metrics.mjs`.

## Limits of this baseline

- **Small samples.** Production stops at 2 to 10 requests per second, so most steps have 30 to 300 requests. Break points are plus or minus one step.
- **A moving background.** The background was 47.5 to 53.9 requests per second in the valid runs, with bursts to 79. An "after" run needs its own background rate from the webapp section of its summary.
- **One URL per surface.** The movie page is a popular title with a warm data cache. The long-tail pass is the only cold data.
- **Connection reuse.** k6 keeps connections open. Real visitors and bots open new ones, and the proxy pays for each.
- **A quiet hour.** Sunday, 02:38 to 03:58 UTC.
- **The probe reads the event loop gauge.** That gauge restarts on every scrape, so Grafana's samples of it cover shorter windows during these runs.

## Incidents and end state

No incident. No run produced an error, a 5xx response, or a failed health check. The webapp container didn't restart (same start time before and after, restart count 0). Production recovered within 61 to 81 seconds after every run. At 03:58 UTC the container was healthy with 8 requests in flight, and `/` answered in 0.18 seconds.

On worker3, the two benchmark images and the empty run directory remain, as before. The `iperf3` image was removed from both hosts.
