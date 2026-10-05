# 20261005T035617Z-load-pv-movie-private-reuse-duo-a

Label: pv-movie-private-reuse-duo-a. Time: 2026-10-05T03:56:38.978Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 30 visitors/s for 30 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 70 visitors/s for 35 s, then 80 visitors/s for 35 s, then 90 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<135

427235 requests; 2266.314 req/s; 0% errors; p95 158.479 ms; 161 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 427235 | 2266.314 | 0 | 16.024 | 158.479 | 1042.323 | 14.741 | 154.189 | 1036.145 | 424089/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 34162 | 1138.733 | 0 | 9.768 | 27.505 | 46.255 | 8.504 | 25.356 |
| s02 | 50 | 64600 | 1845.714 | 0 | 11.61 | 46.523 | 124.01 | 10.347 | 45.153 |
| s03 | 60 | 78850 | 2252.857 | 0 | 11.916 | 48.417 | 93.745 | 10.749 | 46.519 |
| s04 | 70 | 92150 | 2632.857 | 0 | 15.154 | 73.849 | 548.235 | 13.948 | 71.47 |
| s05 | 80 | 105443 | 3012.657 | 0 | 28.345 | 231.989 | 2407.911 | 26.869 | 226.744 |
| s06 | 90 | 52030 | 2810.099 | 0 | 33.299 | 638.327 | 3424.564 | 31.531 | 628.347 |

## Page views

One visitor is one iteration, on a reused connection. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

11152 visitors; 11152 complete page views; 0% failed page views; page view p95 599.35 ms; 233 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29.967 | 29.967 | 0 | 5.431 | 24.2 | 29 | 70 | 1138.733 | 0 | 3.767 | 23.578 | 37.302 |
| s02 | 50 | 48.571 | 48.571 | 0 | 8.244 | 45.771 | 34 | 115.05 | 1845.714 | 0 | 0 | 0 | 0 |
| s03 | 60 | 59.286 | 59.286 | 0 | 9.918 | 48.988 | 36 | 112.3 | 2252.857 | 0 | 0 | 0 | 0 |
| s04 | 70 | 69.286 | 69.286 | 0 | 13.041 | 72.295 | 43 | 217.6 | 2632.857 | 0 | 0 | 0 | 0 |
| s05 | 80 | 79.286 | 79.286 | 0 | 25.476 | 228.532 | 76 | 2113.7 | 3012.657 | 0 | 0.2 | 23.683 | 28.949 |
| s06 | 90 | 69.024 | 69.024 | 0 | 30.13 | 485.062 | 86 | 2046.65 | 2810.099 | 0 | 6.103 | 24.205 | 82.749 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 55.225 | 340.495 | 70.506 | 35.673 | 60.322 | 102.932 | 1.689 | 82.302 | 53.909 | 59.704 | 251.883 | 134.521 | 35.419 | 45.566 | 0.265 | 0.192 | 28.228 | 38.676 | 0.133 | 0.115 |
| s02 | 50 | 71.426 | 405.245 | 67.403 | 81.974 | 77.311 | 156.86 | 18.925 | 146.724 | 66.883 | 70.778 | 476.036 | 248.741 | 36.042 | 39.434 | 0.413 | 0.265 | 44.256 | 49.581 | 0.14 | 0.142 |
| s03 | 60 | 77.924 | 424.671 | 67.897 | 50.058 | 86.998 | 180.922 | 10.606 | 119.854 | 70.032 | 72.554 | 581.141 | 300.66 | 37.9 | 41.51 | 0.415 | 0.304 | 44.638 | 50.893 | 0.14 | 0.12 |
| s04 | 70 | 85.378 | 452.516 | 67.472 | 53.794 | 87.617 | 204.885 | 15.455 | 47.011 | 75.018 | 78.757 | 684.128 | 363.283 | 38.8 | 42.34 | 0.414 | 0.321 | 48.221 | 50.66 | 0.146 | 0.134 |
| s05 | 80 | 95.746 | 485.944 | 69.694 | 161.142 | 93.814 | 236.778 | 112.294 | 106.091 | 80.261 | 84.693 | 770.676 | 398.425 | 43.412 | 46.979 | 0.546 | 0.422 | 51.59 | 57.509 | 0.159 | 0.151 |
| s06 | 90 | 93.171 | 514.602 | 84.915 | 85.382 | 94.164 | 817.983 | 493.357 | 151.966 | 82.542 | 83.8 | 778.926 | 384.908 | 79.797 | 94.556 | 0.674 | 0.573 | 57.724 | 62.131 | 0.192 | 0.182 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 38 | 70.407 | 84.693 | 5.913 | 8.02 | 42.242 | 295.315 | 569.086 | 848.373 | 10 |
| gw-vector1 | target | 16 | 37 | 40.809 | 94.556 | 7.584 | 10.01 | 53.454 | 0.32 | 0.433 | 0.758 | 12 |
| gw-cache1 | data | 8 | 37 | 4.071 | 16.154 | 0.249 | 0.41 | 31.846 | 0.481 | 0.433 | 1.158 | 8 |
| gw-cache2 | data | 8 | 38 | 4.378 | 19.43 | 0.355 | 0.63 | 31.526 | 0.503 | 0.438 | 0.666 | 8 |
| gw-cache3 | data | 8 | 38 | 1.966 | 5.384 | 0.302 | 0.51 | 31.434 | 0.467 | 0.349 | 0.85 | 9 |
| gw-worker3 | generator | 4 | 38 | 44.566 | 62.131 | 1.713 | 2.72 | 21.376 | 0.137 | 0.146 | 0.238 | 270 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 85.158 | 117.48 | 3162.516 | 3163.136 |
| abusive | coolify-proxy | 423.308 | 536.19 | 405.924 | 956.8 |
| gw-vector1 | gk4owk8-011237769659 | 96.91 | 240.72 | 2462.997 | 2493.44 |
| gw-vector1 | coolify-proxy | 202.113 | 1081.02 | 167.855 | 815.4 |
| gw-vector1 | qdrant-main | 248.948 | 286.06 | 5016.022 | 5300.224 |

## Webapp process

From the webapp's own counters over 192.408 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 2275.404 req/s in total: 2221.041 from the benchmark and 54.364 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.351 on average, 7 at most. Event loop delay: 310.039 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 78.705 | 98.905 |
| webapp V8Worker | 4.802 | 24.526 |
| webapp libuv-worker | 2.827 | 5.726 |
| proxy | 429.631 | 514.602 |

The proxy accepted 69.393 connections per second on average, 87.95 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 419994 | 2182.825 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 11853 | 61.603 | 26.028 | 49.453 | 352.622 | 25.981 | 49.365 | 98.836 |
| /person/:personKey | 351 | 1.824 | 146.85 | 517.308 | 1298 | 26.332 | 51.937 | 84.046 |
| /show/:showKey | 169 | 0.878 | 220.732 | 888.75 | 1577.5 | 181.169 | 577.5 | 69.231 |
| /api/e | 4 | 0.021 | 300 | 480 | 496 | n/a | n/a | 50 |
| / | 1 | 0.005 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 169 | 27 | 138 | 84.024 | 146.018 | 241.429 |
| episode-grid | 169 | 23 | 144 | 86.391 | 32.883 | 128.333 |
| related-cards | 265 | 105 | 160 | 60.377 | 113.158 | 714.286 |
| details-movie-v2 | 508 | 101 | 384 | 80.118 | 148.892 | 258.514 |
| person-profile-v2 | 347 | 116 | 231 | 66.571 | 104.023 | 348.333 |
| person-fingerprint-baseline | 231 | 231 | 0 | 0 | n/a | n/a |
| movie-collection | 36 | 22 | 14 | 38.889 | 31.818 | 165 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 4 | 0.021 | 31.952 |
| grpc /qdrant.Points/Recommend 0 | 570 | 2.962 | 52.397 |
| grpc /qdrant.Points/Get 0 | 584 | 3.035 | 18.111 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 4516.704 req/s, of which 2295.663 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 3a45fcfd | 2275.404 | 0 | 78.705 | 98.905 | 7 | 310.039 | 3128.379 |
| 10.0.0.20 | 3a45fcfd | 2233.079 | 0 | 83.31 | 103.261 | 7 | 151.966 | 2432.738 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 169 | 0 |
| 10.0.0.21 | /movie/:movieKey | 11352 | 0 | 0 | 508 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 351 | 0 |
| 10.0.0.21 | /discover/:type? | 0 | 0 | 0 | 23 | 0 |
| 10.0.0.21 | / | 1 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 543 | 0 |
| 10.0.0.20 | /movie/:movieKey | 11261 | 0 | 0 | 602 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 156 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 18 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 5 | 0 | 0 | 0 | 0 |
