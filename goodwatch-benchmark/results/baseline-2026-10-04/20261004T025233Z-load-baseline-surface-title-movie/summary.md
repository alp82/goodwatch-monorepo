# 20261004T025233Z-load-baseline-surface-title-movie

Label: baseline-surface-title-movie. Time: 2026-10-04T02:52:49.188Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: d742d9937868340d72ceb5c20101eab1be867f0c.

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s.

**Aborted:** http_req_duration{phase:main,step:s02}: p(95)<3000

44 requests; 1.102 req/s; 0% errors; p95 2934.413 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 44 | 1.102 | 0 | 552.364 | 2934.413 | 3312.759 | 115.7 | 250.167 | 303.463 | 44/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 326.471 | 1086.244 | 1414.659 | 104.029 | 249.997 |
| s02 | 2 | 15 | 1.512 | 0 | 1416.596 | 3296.879 | 3329.815 | 135.324 | 254.303 |
| s03 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s04 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s05 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s06 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s07 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s08 | 14 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s09 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s10 | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s11 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s12 | 25 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s13 | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s14 | 35 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s15 | 40 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s16 | 45 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s17 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s18 | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s19 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s20 | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 8 | 39.208 | 46.332 | 3.337 | 3.71 | 34.072 | 8.525 | 9.723 | 10.933 | 42 |
| pgnode01 | data | 16 | 8 | 5.372 | 9.137 | 1.268 | 1.38 | 70.685 | 2.027 | 2.185 | 2.855 | 13 |
| pgnode02 | data | 16 | 8 | 5.731 | 8.804 | 0.474 | 0.57 | 71.501 | 1.675 | 1.988 | 2.365 | 14 |
| pgnode03 | data | 16 | 8 | 5.721 | 8.469 | 0.875 | 1.17 | 65.432 | 0.096 | 0.109 | 0.189 | 5 |
| gw-cache1 | data | 8 | 8 | 2.507 | 5.843 | 0.155 | 0.21 | 35.69 | 1.152 | 0.905 | 1.747 | 9 |
| gw-cache2 | data | 8 | 8 | 1.873 | 5.817 | 0.105 | 0.15 | 35.535 | 1.168 | 3.727 | 6.014 | 8 |
| host-6 | data | n/a | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| gw-vector1 | data | 16 | 8 | 6.939 | 10.001 | 1.324 | 1.44 | 39.671 | 0.101 | 0.159 | 0.206 | 4 |
| gw-worker3 | generator | 4 | 8 | 6.166 | 11.535 | 0.331 | 0.55 | 16.176 | 0.119 | 0.089 | 0.116 | 49 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 163.315 | 221.54 | 2630.656 | 2634.752 |
| abusive | coolify-proxy | 117.718 | 132.85 | 249.362 | 250.5 |

## Webapp process

From the webapp's own counters over 43.011 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 51.335 req/s in total: 1.046 from the benchmark and 50.289 of background traffic, of which 37.734 are the crawler loop. Server errors: 0 per second. Requests in flight: 9.222 on average, 22 at most. Event loop delay: 56.743 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 84.372 | 94.532 |
| webapp V8Worker | 25.007 | 64.991 |
| webapp libuv-worker | 20.356 | 23.146 |
| proxy | 112.675 | 121.71 |

The proxy accepted 43.719 connections per second on average, 51.008 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 803 | 18.669 | 31.564 | 149.766 | 199.953 | 27.202 | 72.591 | 100 |
| /movie/:movieKey | 195 | 4.534 | 454.054 | 2340.909 | 4468.182 | 180.625 | 467.667 | 35.385 |
| /person/:personKey | 154 | 3.58 | 284.615 | 984.783 | 1780 | 119.048 | 296.316 | 52.597 |
| static | 99 | 2.302 | 26.33 | 50.625 | 101 | n/a | n/a | 100 |
| /sign-up | 42 | 0.976 | 215.385 | 862.5 | 1580 | 29.167 | 89 | 76.19 |
| /show/:showKey | 13 | 0.302 | 708.333 | 3050 | 4610 | 250 | 675 | 15.385 |
| / | 10 | 0.232 | 35.714 | 250 | 290 | 28.125 | 77.5 | 100 |
| /sign-in | 4 | 0.093 | 100 | 280 | 296 | 25 | 47.5 | 100 |
| /api/search-config | 2 | 0.046 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/tonight | 2 | 0.046 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 2 | 0.046 | 500 | 950 | 990 | n/a | n/a | 0 |
| /api/poster-impressions | 2 | 0.046 | 50 | 290 | 298 | n/a | n/a | 100 |
| /discover/:type? | 2 | 0.046 | 1000 | 4700 | 4940 | 200 | 290 | 0 |
| /api/og-image-warm | 1 | 0.023 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/genres/all | 1 | 0.023 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/discover/results | 1 | 0.023 | 150 | 285 | 297 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 151 | 30 | 121 | 80.132 | 87.5 | 213.333 |
| person-fingerprint-baseline | 121 | 121 | 0 | 0 | n/a | n/a |
| user-settings | 214 | 213 | 1 | 0.467 | 25 | 47.5 |
| related-show | 214 | 71 | 143 | 66.822 | 42.56 | 247.5 |
| details-movie | 200 | 50 | 150 | 75 | 114.943 | 192.529 |
| related-movie | 214 | 71 | 143 | 66.822 | 43.072 | 385.556 |
| availability-evidence-v1 | 210 | 50 | 160 | 76.19 | 26.144 | 49.673 |
| details-show | 14 | 0 | 14 | 100 | 107.143 | 190.714 |
| episode-grid | 14 | 1 | 13 | 92.857 | 27.083 | 67.5 |
| genres-movie | 1 | 1 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 108 | 2.511 | 46.906 |
| grpc /qdrant.Points/UpdateBatch 0 | 3 | 0.07 | 26.228 |
| grpc /qdrant.Points/Get 0 | 290 | 6.742 | 5.076 |
