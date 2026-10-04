# 20261004T024824Z-load-baseline-surface-home

Label: baseline-surface-home. Time: 2026-10-04T02:48:40.971Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: d742d9937868340d72ceb5c20101eab1be867f0c.

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s.

**Aborted:** http_req_duration{phase:main,step:s05}: p(95)<3000

630 requests; 3.94 req/s; 0% errors; p95 2338.114 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home | 630 | 3.94 | 0 | 123.09 | 2338.114 | 3661.644 | 34.276 | 236.474 | 431.61 | 630/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 93.381 | 287.554 | 364.411 | 24.871 | 80.826 |
| s02 | 2 | 68 | 1.943 | 0 | 79.627 | 312.457 | 593.219 | 28.509 | 87.498 |
| s03 | 4 | 135 | 3.857 | 0 | 83.819 | 603.786 | 996.107 | 25.982 | 109.698 |
| s04 | 6 | 205 | 5.857 | 0 | 91.482 | 955.41 | 1415.151 | 27.439 | 141.366 |
| s05 | 8 | 193 | 7.75 | 0 | 842.926 | 3395.157 | 3870.41 | 94.356 | 379.567 |
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
| abusive | target | 8 | 32 | 37.735 | 55.069 | 3.435 | 4.09 | 33.957 | 5.693 | 9.298 | 15.788 | 40 |
| pgnode01 | data | 16 | 33 | 5.181 | 8.582 | 0.561 | 0.73 | 70.779 | 1.946 | 5.158 | 64.987 | 15 |
| pgnode02 | data | 16 | 32 | 5.108 | 9.753 | 1.022 | 2.61 | 71.541 | 3.501 | 3.811 | 69.019 | 16 |
| pgnode03 | data | 16 | 33 | 5.798 | 11.139 | 0.499 | 0.62 | 65.449 | 0.113 | 0.11 | 0.257 | 7 |
| gw-cache1 | data | 8 | 33 | 4.748 | 16.6 | 0.239 | 0.42 | 35.736 | 0.886 | 0.786 | 1.703 | 9 |
| gw-cache2 | data | 8 | 33 | 5.027 | 18.947 | 0.389 | 0.69 | 35.543 | 0.979 | 0.764 | 2.407 | 9 |
| gw-cache3 | data | 8 | 33 | 4.749 | 15.606 | 0.39 | 0.69 | 35.415 | 0.899 | 0.766 | 1.726 | 9 |
| gw-vector1 | data | 16 | 32 | 6.267 | 10.995 | 2.004 | 2.69 | 39.771 | 0.123 | 0.156 | 0.232 | 4 |
| gw-worker3 | generator | 4 | 32 | 6.419 | 14.902 | 0.303 | 0.41 | 16.487 | 0.097 | 0.09 | 0.133 | 71 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 113.858 | 207.22 | 2612.96 | 2619.392 |
| abusive | coolify-proxy | 115.094 | 171.83 | 250.134 | 260.7 |

## Webapp process

From the webapp's own counters over 162.999 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 54.761 req/s in total: 3.871 from the benchmark and 50.89 of background traffic, of which 36.442 are the crawler loop. Server errors: 0 per second. Requests in flight: 6.545 on average, 48 at most. Event loop delay: 138.99 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 77.317 | 97.389 |
| webapp V8Worker | 25.413 | 99.566 |
| webapp libuv-worker | 19.04 | 29.356 |
| proxy | 113.358 | 148.561 |

The proxy accepted 44.456 connections per second on average, 64.264 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 2929 | 17.969 | 30.536 | 157.646 | 255.39 | 27.12 | 71.497 | 99.624 |
| / | 744 | 4.564 | 101.739 | 1956.863 | 4362.286 | 30.373 | 114.531 | 72.312 |
| /person/:personKey | 652 | 4 | 199.541 | 1945.833 | 4348 | 92.544 | 276 | 66.564 |
| /movie/:movieKey | 529 | 3.245 | 292.045 | 1945.556 | 4806.5 | 178.497 | 542.647 | 51.985 |
| static | 215 | 1.319 | 38.393 | 176.724 | 261.667 | n/a | n/a | 99.535 |
| /sign-up | 197 | 1.209 | 93.182 | 1143.75 | 3030 | 28.143 | 85.735 | 79.695 |
| /api/e | 90 | 0.552 | 561.224 | 974.49 | 1550 | n/a | n/a | 5.556 |
| /api/tonight | 82 | 0.503 | 46.591 | 171.818 | 218 | n/a | n/a | 100 |
| /api/search-config | 81 | 0.497 | 72.917 | 239 | 338 | n/a | n/a | 98.765 |
| /api/og-image-warm | 77 | 0.472 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /show/:showKey | 33 | 0.202 | 696.429 | 3350 | 4670 | 257.692 | 891.667 | 21.212 |
| /sign-in | 19 | 0.117 | 91.667 | 2150 | 4430 | 26.389 | 105 | 89.474 |
| /api/related | 16 | 0.098 | 1428.571 | 1942.857 | 1988.571 | n/a | n/a | 0 |
| /api/genres/all | 3 | 0.018 | 37.5 | 92.5 | 98.5 | n/a | n/a | 100 |
| /api/poster-impressions | 3 | 0.018 | 150 | 285 | 297 | n/a | n/a | 100 |
| /:type | 1 | 0.006 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/movie/collection | 1 | 0.006 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /og/:first/:second | 1 | 0.006 | 250 | 475 | 495 | n/a | n/a | 0 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 596 | 119 | 477 | 80.034 | 79.717 | 199.38 |
| person-fingerprint-baseline | 477 | 477 | 0 | 0 | n/a | n/a |
| user-settings | 571 | 568 | 3 | 0.525 | 25 | 47.5 |
| related-show | 579 | 135 | 444 | 76.684 | 40.364 | 528.571 |
| details-movie | 537 | 27 | 510 | 94.972 | 108.824 | 193.199 |
| related-movie | 579 | 135 | 444 | 76.684 | 40.364 | 675 |
| availability-evidence-v1 | 570 | 30 | 540 | 94.737 | 26.112 | 49.613 |
| details-show | 35 | 3 | 32 | 91.429 | 140 | 197.6 |
| episode-grid | 34 | 6 | 28 | 82.353 | 28 | 76.667 |
| genres-movie | 3 | 3 | 0 | 0 | n/a | n/a |
| movie-collection | 1 | 0 | 1 | 100 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 888 | 5.448 | 4.691 |
| grpc /qdrant.Points/Recommend 0 | 276 | 1.693 | 69.714 |
| grpc /qdrant.Points/UpdateBatch 0 | 6 | 0.037 | 24.233 |
