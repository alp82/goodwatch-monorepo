# 20261005T035617Z-load-pv-movie-private-reuse-duo-b

Label: pv-movie-private-reuse-duo-b. Time: 2026-10-05T03:56:40.110Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 30 visitors/s for 30 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 70 visitors/s for 35 s, then 80 visitors/s for 35 s, then 90 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<135

426369 requests; 2260.26 req/s; 0% errors; p95 160.653 ms; 194 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 426369 | 2260.26 | 0 | 16.755 | 160.653 | 1008.135 | 15.32 | 156.902 | 1005.746 | 423747/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 34162 | 1138.733 | 0 | 10.007 | 27.126 | 42.97 | 8.542 | 25.615 |
| s02 | 50 | 64600 | 1845.714 | 0 | 12.718 | 47.675 | 175.991 | 11.436 | 46.266 |
| s03 | 60 | 78850 | 2252.857 | 0 | 12.614 | 55.764 | 107.092 | 11.332 | 53.816 |
| s04 | 70 | 92150 | 2632.857 | 0 | 15.531 | 66.712 | 175.035 | 14.225 | 65.177 |
| s05 | 80 | 105441 | 3012.6 | 0 | 28.101 | 225.471 | 2295.784 | 26.414 | 221.149 |
| s06 | 90 | 51166 | 2745.374 | 0 | 35.072 | 716.927 | 3233.172 | 32.965 | 705.696 |

## Page views

One visitor is one iteration, on a reused connection. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

11142 visitors; 11142 complete page views; 0% failed page views; page view p95 624.9 ms; 273 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29.967 | 29.967 | 0 | 6.218 | 25.033 | 31 | 72 | 1138.733 | 0 | 3.767 | 23.151 | 33.807 |
| s02 | 50 | 48.571 | 48.571 | 0 | 7.745 | 47.097 | 35 | 124.1 | 1845.714 | 0 | 0 | 0 | 0 |
| s03 | 60 | 59.286 | 59.286 | 0 | 9.822 | 55.489 | 38 | 134.6 | 2252.857 | 0 | 0 | 0 | 0 |
| s04 | 70 | 69.286 | 69.286 | 0 | 12.78 | 68.011 | 45 | 198.8 | 2632.857 | 0 | 0 | 0 | 0 |
| s05 | 80 | 79.286 | 79.286 | 0 | 26.4 | 245.59 | 78 | 2368.1 | 3012.6 | 0 | 0.257 | 24.079 | 35.872 |
| s06 | 90 | 68.036 | 68.036 | 0 | 33.16 | 928.588 | 90 | 2726.9 | 2745.374 | 0 | 8.102 | 23.674 | 51.017 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 55.439 | 337.688 | 68.667 | 35.247 | 60.988 | 102.382 | 2.99 | 42.39 | 54.813 | 58.484 | 263.516 | 140.207 | 35.517 | 44.984 | 0.27 | 0.194 | 61.949 | 65.537 | 1.835 | 30.735 |
| s02 | 50 | 72.883 | 405.852 | 67.747 | 52.221 | 78.075 | 156.308 | 19.017 | 43.439 | 66.672 | 71.908 | 482.299 | 250.641 | 36 | 40.048 | 0.422 | 0.259 | 47.907 | 56.182 | 0.162 | 0.182 |
| s03 | 60 | 78.329 | 424.053 | 68.705 | 58.971 | 86.16 | 177.547 | 13.573 | 111.99 | 70.276 | 72.608 | 581.842 | 301.03 | 37.987 | 40.013 | 0.425 | 0.313 | 47.32 | 52.588 | 0.138 | 0.168 |
| s04 | 70 | 85.461 | 448.995 | 66.157 | 90.69 | 87.697 | 203.367 | 14.689 | 131.65 | 74.597 | 78.933 | 666.844 | 357.305 | 38.785 | 41.993 | 0.412 | 0.319 | 51.267 | 54.746 | 0.155 | 0.195 |
| s05 | 80 | 96.114 | 486.998 | 70.489 | 355.39 | 93.931 | 231.463 | 127.047 | 95.212 | 80.689 | 84.896 | 776.864 | 401.449 | 43.447 | 47.117 | 0.532 | 0.411 | 55.752 | 62.994 | 0.161 | 0.207 |
| s06 | 90 | 90.584 | 513.438 | 81.855 | 34.69 | 94.144 | 965.931 | 497.125 | 159.962 | 81.781 | 85.479 | 739.511 | 358.736 | 84.625 | 92.232 | 0.646 | 0.553 | 57.816 | 61.494 | 0.158 | 0.203 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 38 | 70.603 | 85.479 | 5.913 | 8.02 | 42.257 | 295.726 | 570.948 | 844.532 | 10 |
| gw-vector1 | target | 16 | 38 | 42.235 | 92.232 | 7.762 | 14.33 | 53.58 | 0.324 | 0.436 | 0.766 | 14 |
| gw-cache1 | data | 8 | 38 | 3.992 | 17.085 | 0.246 | 0.41 | 31.834 | 0.479 | 0.449 | 1.134 | 8 |
| gw-cache2 | data | 8 | 37 | 4.375 | 18.898 | 0.358 | 0.63 | 31.524 | 0.499 | 0.435 | 0.881 | 8 |
| gw-cache3 | data | 8 | 38 | 1.969 | 5.989 | 0.302 | 0.51 | 31.454 | 0.468 | 0.351 | 0.878 | 9 |
| gw-worker1 | generator | 4 | 38 | 52.876 | 65.537 | 2.283 | 3.11 | 20.028 | 5.373 | 0.445 | 1.907 | 304 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 84.603 | 118.16 | 3162.489 | 3165.184 |
| abusive | coolify-proxy | 431.468 | 536.19 | 411.487 | 956.8 |
| gw-vector1 | gk4owk8-011237769659 | 98.428 | 240.72 | 2461.912 | 2492.416 |
| gw-vector1 | coolify-proxy | 228.499 | 1081.02 | 184.277 | 815.4 |
| gw-vector1 | qdrant-main | 248.298 | 286.06 | 5024.876 | 5300.224 |

## Webapp process

From the webapp's own counters over 192.438 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 2275.017 req/s in total: 2216.203 from the benchmark and 58.814 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.486 on average, 13 at most. Event loop delay: 355.39 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 78.954 | 101.16 |
| webapp V8Worker | 4.828 | 25.343 |
| webapp libuv-worker | 2.841 | 6.134 |
| proxy | 430.24 | 513.438 |

The proxy accepted 69.173 connections per second on average, 81.855 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 419994 | 2182.493 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 11852 | 61.589 | 26.025 | 49.448 | 352.649 | 25.979 | 49.361 | 98.836 |
| /person/:personKey | 351 | 1.824 | 146.85 | 517.308 | 1298 | 26.328 | 51.551 | 84.046 |
| /show/:showKey | 169 | 0.878 | 220.732 | 888.75 | 1577.5 | 180.921 | 577.5 | 69.231 |
| /api/e | 4 | 0.021 | 300 | 480 | 496 | n/a | n/a | 50 |
| / | 1 | 0.005 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 169 | 28 | 137 | 83.432 | 145.982 | 242.143 |
| episode-grid | 169 | 24 | 143 | 85.799 | 32.955 | 129.167 |
| related-cards | 265 | 106 | 159 | 60 | 116.667 | 716.071 |
| details-movie-v2 | 508 | 101 | 384 | 80.118 | 148.892 | 258.514 |
| person-profile-v2 | 346 | 115 | 231 | 66.763 | 104.023 | 348.333 |
| person-fingerprint-baseline | 231 | 231 | 0 | 0 | n/a | n/a |
| movie-collection | 36 | 22 | 14 | 38.889 | 31.818 | 165 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 578 | 3.004 | 52.329 |
| grpc /qdrant.Points/Get 0 | 594 | 3.087 | 17.832 |
| grpc /qdrant.Points/UpdateBatch 0 | 4 | 0.021 | 31.952 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 4515.862 req/s, of which 2299.659 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 3a45fcfd | 2275.017 | 0 | 78.954 | 101.16 | 13 | 355.39 | 3128.633 |
| 10.0.0.20 | 3a45fcfd | 2241.235 | 0 | 83.513 | 101.128 | 11 | 159.962 | 2431.52 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 169 | 0 |
| 10.0.0.21 | /movie/:movieKey | 11352 | 0 | 0 | 508 | 0 |
| 10.0.0.21 | /person/:personKey | 1 | 0 | 0 | 350 | 0 |
| 10.0.0.21 | /discover/:type? | 0 | 0 | 0 | 23 | 0 |
| 10.0.0.21 | / | 1 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 541 | 0 |
| 10.0.0.20 | /movie/:movieKey | 11261 | 0 | 0 | 603 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 155 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 17 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 5 | 0 | 0 | 0 | 0 |
