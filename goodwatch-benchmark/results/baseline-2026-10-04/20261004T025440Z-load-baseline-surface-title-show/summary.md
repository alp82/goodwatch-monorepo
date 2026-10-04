# 20261004T025440Z-load-baseline-surface-title-show

Label: baseline-surface-title-show. Time: 2026-10-04T02:54:56.942Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: d742d9937868340d72ceb5c20101eab1be867f0c.

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s.

**Aborted:** http_req_duration{phase:main,step:s02}: p(95)<3000

80 requests; 1.382 req/s; 0% errors; p95 3713.744 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_show | 80 | 1.382 | 0 | 902.164 | 3713.744 | 4031.775 | 142.525 | 342.166 | 512.589 | 80/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 657.427 | 1711.014 | 2392.666 | 126.955 | 235.688 |
| s02 | 2 | 51 | 1.827 | 0 | 1332.985 | 3851.989 | 4123.4 | 153.238 | 411.596 |
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
| abusive | target | 8 | 12 | 38.963 | 44.324 | 2.927 | 3.18 | 34.126 | 9.408 | 10.062 | 11.939 | 39 |
| pgnode01 | data | 16 | 12 | 5.045 | 10.239 | 0.612 | 0.89 | 70.797 | 7.763 | 2.075 | 3.179 | 15 |
| pgnode02 | data | 16 | 12 | 5.503 | 7.626 | 0.55 | 0.6 | 71.503 | 6.915 | 7.533 | 70.533 | 15 |
| pgnode03 | data | 16 | 12 | 6.382 | 9.663 | 0.653 | 0.84 | 65.456 | 0.133 | 0.117 | 0.163 | 5 |
| gw-cache1 | data | 8 | 12 | 3.902 | 14.715 | 0.192 | 0.26 | 35.771 | 1.202 | 1.411 | 2.101 | 10 |
| host-5 | data | n/a | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| gw-cache3 | data | 8 | 12 | 7.001 | 20.382 | 0.518 | 0.68 | 35.503 | 1.146 | 1.521 | 2.274 | 9 |
| gw-vector1 | data | 16 | 12 | 6.79 | 8.91 | 1.118 | 1.29 | 39.701 | 0.11 | 0.155 | 0.195 | 6 |
| gw-worker3 | generator | 4 | 11 | 8.686 | 18.938 | 0.351 | 0.42 | 16.509 | 0.125 | 0.096 | 0.157 | 70 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 129.632 | 152.1 | 2636.373 | 2640.896 |
| abusive | coolify-proxy | 115.805 | 159.43 | 246.092 | 249.6 |

## Webapp process

From the webapp's own counters over 60.98 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 48.803 req/s in total: 1.328 from the benchmark and 47.475 of background traffic, of which 36.783 are the crawler loop. Server errors: 0 per second. Requests in flight: 9.583 on average, 26 at most. Event loop delay: 147.903 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 86.903 | 96.35 |
| webapp V8Worker | 26.397 | 46.072 |
| webapp libuv-worker | 22.841 | 29.256 |
| proxy | 112.397 | 133.469 |

The proxy accepted 43.361 connections per second on average, 49.381 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 1092 | 17.908 | 33.998 | 174.234 | 275.4 | 28.029 | 86.023 | 99.451 |
| /person/:personKey | 226 | 3.706 | 259.459 | 1170 | 2740 | 115.294 | 328.333 | 56.637 |
| /movie/:movieKey | 177 | 2.903 | 461.538 | 2050 | 4410 | 230.556 | 729.545 | 32.203 |
| /show/:showKey | 114 | 1.869 | 880.952 | 3931.25 | 4786.25 | 163.208 | 490.625 | 3.509 |
| /sign-up | 75 | 1.23 | 134.615 | 953.125 | 1750 | 29.762 | 125 | 72 |
| /api/related | 16 | 0.262 | 1272.727 | 1927.273 | 1985.455 | n/a | n/a | 0 |
| / | 13 | 0.213 | 36.111 | 1350 | 1870 | 36.111 | 135 | 92.308 |
| static | 6 | 0.098 | 100 | 190 | 198 | n/a | n/a | 100 |
| /sign-in | 3 | 0.049 | 75 | 285 | 297 | 25 | 47.5 | 100 |
| /api/search-config | 1 | 0.016 | 100 | 190 | 198 | n/a | n/a | 100 |
| /api/tonight | 1 | 0.016 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 1 | 0.016 | 1000 | 1900 | 1980 | n/a | n/a | 0 |
| /api/genres/all | 1 | 0.016 | 50 | 95 | 99 | n/a | n/a | 100 |
| /api/poster-impressions | 1 | 0.016 | 150 | 285 | 297 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 227 | 36 | 191 | 84.141 | 82.813 | 237.917 |
| person-fingerprint-baseline | 190 | 190 | 0 | 0 | n/a | n/a |
| user-settings | 298 | 297 | 1 | 0.336 | 25 | 47.5 |
| related-show | 306 | 141 | 165 | 53.922 | 70 | 495.714 |
| details-movie | 180 | 5 | 175 | 97.222 | 121.226 | 195.519 |
| related-movie | 306 | 141 | 165 | 53.922 | 87.5 | 873.077 |
| availability-evidence-v1 | 295 | 89 | 206 | 69.831 | 27.989 | 84.412 |
| details-show | 118 | 84 | 34 | 28.814 | 150 | 257.5 |
| episode-grid | 118 | 90 | 28 | 23.729 | 28 | 76.667 |
| genres-movie | 1 | 1 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 144 | 2.361 | 65.175 |
| grpc /qdrant.Points/Get 0 | 330 | 5.412 | 7.009 |
| grpc /qdrant.Points/UpdateBatch 0 | 2 | 0.033 | 16.651 |
