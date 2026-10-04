# 20261004T215442Z-load-checkpoint-page-view-movie

Label: checkpoint-page-view-movie. Time: 2026-10-04T21:55:05.988Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: page-view-movie. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 34 req/s for 30 s, then 68 req/s for 35 s, then 136 req/s for 35 s, then 272 req/s for 35 s, then 500 req/s for 35 s.

34007 requests; 199.824 req/s; 0% errors; p95 21.341 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 32994 | 193.872 | 0 | 3.758 | 21.398 | 40.977 | 3.242 | 20.696 | 40.296 | 32994/0/0/0/0 |
| title_movie | 1013 | 5.952 | 0 | 4.845 | 20.261 | 41.129 | 3.516 | 18.759 | 39.993 | 1013/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 34 | 1019 | 33.967 | 0 | 4.442 | 22.264 | 40.522 | 3.846 | 21.315 |
| s02 | 68 | 2295 | 65.571 | 0 | 4.368 | 18.956 | 40.6 | 3.878 | 18.233 |
| s03 | 136 | 4589 | 131.114 | 0 | 4.235 | 23.034 | 41.82 | 3.779 | 22.463 |
| s04 | 272 | 9178 | 262.229 | 0 | 3.871 | 17.224 | 34.067 | 3.391 | 16.518 |
| s05 | 500 | 16926 | 483.6 | 0 | 3.533 | 23.061 | 43.122 | 3.029 | 22.428 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 34 | 20.192 | 30.96 | 1.411 | 2.93 | 34.909 | 15.213 | 27.231 | 65.636 | 9 |
| pgnode01 | data | 16 | 34 | 9.894 | 15.564 | 2.031 | 3.3 | 70.43 | 3.277 | 3.833 | 6.894 | 11 |
| pgnode02 | data | 16 | 34 | 10.339 | 21.69 | 2.107 | 3.67 | 71.441 | 4.699 | 5.315 | 71.956 | 12 |
| pgnode03 | data | 16 | 34 | 15.275 | 30.51 | 2.77 | 4.19 | 66.2 | 8.423 | 0.722 | 2.882 | 5 |
| gw-cache1 | data | 8 | 34 | 3.95 | 16.033 | 0.281 | 0.59 | 33.917 | 0.682 | 0.377 | 0.995 | 8 |
| gw-cache2 | data | 8 | 34 | 1.811 | 6.303 | 0.18 | 0.39 | 33.347 | 0.695 | 0.445 | 0.915 | 7 |
| gw-cache3 | data | 8 | 35 | 2.958 | 16.348 | 0.135 | 0.3 | 33.632 | 0.65 | 0.404 | 0.85 | 9 |
| gw-vector1 | target | 16 | 34 | 11.998 | 19.068 | 1.99 | 2.66 | 48.951 | 0.121 | 0.23 | 0.502 | 6 |
| gw-worker3 | generator | 4 | 34 | 16.111 | 43.162 | 0.363 | 0.57 | 24.299 | 0.075 | 0.09 | 0.154 | 503 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 46.43 | 156.65 | 2279.334 | 2280.448 |
| abusive | coolify-proxy | 79.238 | 133.68 | 139.096 | 180.2 |
| gw-vector1 | gk4owk8-181159928589 | 40.522 | 84.47 | 2314.541 | 2316.288 |
| gw-vector1 | coolify-proxy | 18.462 | 45.37 | 40.489 | 45.94 |
| gw-vector1 | qdrant-main | 40.091 | 186.67 | 4076.273 | 4088.832 |

## Webapp process

From the webapp's own counters over 174.408 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 105.431 req/s in total: 195.181 from the benchmark and -89.75 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 0.971 on average, 4 at most. Event loop delay: 106.353 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 31.898 | 52.026 |
| webapp V8Worker | 5.504 | 25.716 |
| webapp libuv-worker | 3.989 | 6.132 |
| proxy | 75.39 | 128.185 |

The proxy accepted 13.386 connections per second on average, 44.426 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 16526 | 94.755 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 1088 | 6.238 | 49.455 | 219.63 | 302.182 | 48.712 | 194.956 | 98.989 |
| /person/:personKey | 376 | 2.156 | 78.425 | 191.552 | 265.5 | 43.584 | 178.138 | 99.734 |
| /show/:showKey | 131 | 0.751 | 156.111 | 284.565 | 412.667 | 147.525 | 253.333 | 97.71 |
| /api/e | 8 | 0.046 | 200 | 3800 | 4760 | n/a | n/a | 75 |
| / | 5 | 0.029 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 2 | 0.011 | 50 | 190 | 198 | 50 | 190 | 100 |
| /api/poster-impressions | 2 | 0.011 | 50 | 95 | 99 | n/a | n/a | 100 |
| /api/discover/results | 1 | 0.006 | 50 | 95 | 99 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 587 | 62 | 525 | 89.438 | 136.029 | 194.044 |
| related-cards | 274 | 47 | 227 | 82.847 | 70.588 | 123.636 |
| person-profile-v2 | 375 | 102 | 273 | 72.8 | 71.4 | 181.508 |
| person-fingerprint-baseline | 273 | 273 | 0 | 0 | n/a | n/a |
| details-show-v2 | 132 | 13 | 119 | 90.152 | 135 | 194.5 |
| episode-grid | 132 | 16 | 112 | 87.879 | 26.364 | 51.667 |
| movie-collection | 27 | 11 | 16 | 59.259 | 26.667 | 60 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 808 | 4.633 | 2.732 |
| grpc /qdrant.Points/UpdateBatch 0 | 4 | 0.023 | 25.969 |
| grpc /qdrant.Points/Recommend 0 | 802 | 4.598 | 25.881 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 210.593 req/s, of which 15.412 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 105.431 | 0 | 31.898 | 52.026 | 4 | 106.353 | 2280.441 |
| 10.0.0.20 | 392439b7 | 104.746 | 0 | 33.967 | 56.7 | 4 | 71.161 | 2368.77 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 509 | 0 | 0 | 587 | 0 |
| 10.0.0.21 | /discover/:type? | 1 | 0 | 0 | 26 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 377 | 0 |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 132 | 0 |
| 10.0.0.21 | / | 5 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /movie/:movieKey | 509 | 1 | 0 | 504 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 137 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 424 | 0 |
| 10.0.0.20 | / | 1 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 18 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
