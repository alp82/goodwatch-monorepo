# 20261004T025718Z-load-baseline-surface-person

Label: baseline-surface-person. Time: 2026-10-04T02:57:43.889Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 88af219ad16c3a75c7caf51916849256c1da8a5c.

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s.

**Aborted:** http_req_duration{phase:main,step:s05}: p(95)<3000

461 requests; 3.203 req/s; 0% errors; p95 5441.198 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| person | 461 | 3.203 | 0 | 219.16 | 5441.198 | 6850.669 | 50.349 | 216.484 | 464.523 | 461/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 130.187 | 415.729 | 647.563 | 45.332 | 70.757 |
| s02 | 2 | 68 | 1.943 | 0 | 152.091 | 444.596 | 802.374 | 45.819 | 99.575 |
| s03 | 4 | 135 | 3.857 | 0 | 171.683 | 985.904 | 1587.228 | 50.349 | 168.059 |
| s04 | 6 | 205 | 5.857 | 0 | 312.796 | 2106.768 | 6747.781 | 50.873 | 154.707 |
| s05 | 8 | 24 | 2.693 | 0 | 6366.966 | 6943.946 | 7254.656 | 338.316 | 874.907 |
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
| abusive | target | 8 | 29 | 37.578 | 52.07 | 3.21 | 4.44 | 34.077 | 4.98 | 8.503 | 13.933 | 42 |
| pgnode01 | data | 16 | 29 | 5.04 | 11.245 | 0.782 | 1.01 | 71.228 | 2.419 | 3.594 | 51.474 | 15 |
| pgnode02 | data | 16 | 29 | 5.028 | 11.153 | 0.576 | 0.97 | 71.504 | 2.331 | 2.929 | 32.814 | 15 |
| pgnode03 | data | 16 | 29 | 5.544 | 9.686 | 0.517 | 0.73 | 65.485 | 0.098 | 0.103 | 0.203 | 7 |
| gw-cache1 | data | 8 | 29 | 2.038 | 5.11 | 0.123 | 0.23 | 35.771 | 0.709 | 0.685 | 1.476 | 10 |
| gw-cache2 | data | 8 | 29 | 4.989 | 19.288 | 0.257 | 0.61 | 35.564 | 0.787 | 0.775 | 1.702 | 8 |
| gw-cache3 | data | 8 | 29 | 3.102 | 7.26 | 0.259 | 0.49 | 35.495 | 0.76 | 0.749 | 1.6 | 9 |
| gw-vector1 | data | 16 | 29 | 6.142 | 12.511 | 0.966 | 1.16 | 39.656 | 0.12 | 0.163 | 0.247 | 6 |
| gw-worker3 | generator | 4 | 29 | 5.664 | 13.229 | 0.149 | 0.31 | 16.285 | 0.082 | 0.087 | 0.125 | 73 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 132.394 | 293.68 | 2631.362 | 2634.752 |
| abusive | coolify-proxy | 115.823 | 153.04 | 245.834 | 257 |

## Webapp process

From the webapp's own counters over 146.887 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 53.694 req/s in total: 3.145 from the benchmark and 50.549 of background traffic, of which 37.097 are the crawler loop. Server errors: 0 per second. Requests in flight: 9.103 on average, 68 at most. Event loop delay: 131.65 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 78.993 | 96.743 |
| webapp V8Worker | 24.278 | 107.101 |
| webapp libuv-worker | 20.432 | 28.292 |
| proxy | 115.112 | 162.531 |

The proxy accepted 44.444 connections per second on average, 67.77 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 2690 | 18.313 | 31.963 | 181.455 | 407.5 | 27.893 | 86.49 | 97.881 |
| /person/:personKey | 1026 | 6.985 | 199.487 | 3318.421 | 8290 | 61.073 | 211.463 | 64.23 |
| /movie/:movieKey | 397 | 2.703 | 291.827 | 1832.857 | 4314.615 | 181.28 | 467.297 | 52.141 |
| /sign-up | 190 | 1.294 | 90.566 | 1812.5 | 4287.5 | 28.963 | 105.556 | 77.895 |
| static | 149 | 1.014 | 36.881 | 334.444 | 466.889 | n/a | n/a | 93.96 |
| / | 104 | 0.708 | 67.391 | 380 | 498.857 | 27.941 | 85 | 92.308 |
| /api/e | 75 | 0.511 | 622.093 | 1312.5 | 2750 | n/a | n/a | 12 |
| /api/tonight | 70 | 0.477 | 69.048 | 192.5 | 265 | n/a | n/a | 100 |
| /api/search-config | 69 | 0.47 | 102.5 | 385 | 477 | n/a | n/a | 91.304 |
| /api/og-image-warm | 61 | 0.415 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /show/:showKey | 21 | 0.143 | 483.333 | 3950 | 4790 | 262.5 | 950 | 23.81 |
| /sign-in | 11 | 0.075 | 87.5 | 445 | 489 | 27.5 | 72.5 | 81.818 |
| /api/related | 11 | 0.075 | 1083.333 | 1908.333 | 1981.667 | n/a | n/a | 0 |
| /api/genres/all | 3 | 0.02 | 37.5 | 185 | 197 | n/a | n/a | 100 |
| /api/poster-impressions | 2 | 0.014 | 100 | 190 | 198 | n/a | n/a | 100 |
| /api/movie/collection | 1 | 0.007 | 150 | 285 | 297 | n/a | n/a | 100 |
| /about | 1 | 0.007 | 150 | 285 | 297 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 534 | 121 | 413 | 77.341 | 78.623 | 192.714 |
| person-fingerprint-baseline | 413 | 413 | 0 | 0 | n/a | n/a |
| user-settings | 431 | 429 | 2 | 0.464 | 25 | 47.5 |
| related-show | 438 | 106 | 332 | 75.799 | 39.151 | 348 |
| details-movie | 405 | 20 | 385 | 95.062 | 109.33 | 192.225 |
| related-movie | 438 | 106 | 332 | 75.799 | 39.524 | 437.778 |
| availability-evidence-v1 | 425 | 22 | 403 | 94.824 | 26.305 | 49.98 |
| details-show | 26 | 2 | 24 | 92.308 | 144.444 | 460 |
| episode-grid | 26 | 5 | 21 | 80.769 | 32.813 | 99.375 |
| genres-movie | 3 | 3 | 0 | 0 | n/a | n/a |
| movie-collection | 1 | 0 | 1 | 100 | 50 | 95 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 176 | 1.198 | 58.022 |
| grpc /qdrant.Points/Get 0 | 666 | 4.534 | 6.787 |
| grpc /qdrant.Points/UpdateBatch 0 | 8 | 0.054 | 27.737 |
