# 20261004T030119Z-load-baseline-surface-discover

Label: baseline-surface-discover. Time: 2026-10-04T03:01:44.170Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 88af219ad16c3a75c7caf51916849256c1da8a5c.

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s.

**Aborted:** http_req_duration{phase:main,step:s04}: p(95)<3000

249 requests; 2.265 req/s; 0% errors; p95 2169.659 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 249 | 2.265 | 0 | 323.022 | 2169.659 | 5445.298 | 106.971 | 273.463 | 350.799 | 249/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 182.117 | 555.234 | 640.658 | 105.419 | 215.958 |
| s02 | 2 | 68 | 1.943 | 0 | 202.997 | 645.093 | 1054.889 | 97.587 | 190.862 |
| s03 | 4 | 135 | 3.857 | 0 | 623.077 | 2224.346 | 2495.884 | 113.232 | 307.006 |
| s04 | 6 | 17 | 1.714 | 0 | 772.037 | 5753.271 | 5797.111 | 106.91 | 231.254 |
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
| abusive | target | 8 | 22 | 38.775 | 52.078 | 3.402 | 3.94 | 33.851 | 5.051 | 8.428 | 13.381 | 44 |
| pgnode01 | data | 16 | 22 | 4.958 | 9.917 | 0.955 | 1.61 | 70.707 | 1.993 | 2.093 | 3.426 | 17 |
| pgnode02 | data | 16 | 22 | 4.16 | 6.865 | 0.485 | 0.7 | 72.336 | 1.148 | 1.3 | 2.497 | 15 |
| pgnode03 | data | 16 | 22 | 7.391 | 19.271 | 1.068 | 1.56 | 66.41 | 7.688 | 0.491 | 1.947 | 8 |
| gw-cache1 | data | 8 | 22 | 3.072 | 7.25 | 0.328 | 0.56 | 35.769 | 0.904 | 0.767 | 1.865 | 9 |
| gw-cache2 | data | 8 | 22 | 1.647 | 4.871 | 0.096 | 0.19 | 35.885 | 2.475 | 2.507 | 3.559 | 9 |
| gw-cache3 | data | 8 | 22 | 2.952 | 6.733 | 0.29 | 0.39 | 35.472 | 0.806 | 0.738 | 1.43 | 9 |
| gw-vector1 | data | 16 | 22 | 6.476 | 10.543 | 1.219 | 1.55 | 39.708 | 0.124 | 0.158 | 0.224 | 8 |
| gw-worker3 | generator | 4 | 22 | 7.709 | 14.006 | 0.339 | 0.45 | 16.424 | 0.127 | 0.1 | 0.143 | 72 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 140.315 | 226.73 | 2578.572 | 2605.056 |
| abusive | coolify-proxy | 119.009 | 146.39 | 248.714 | 257.3 |

## Webapp process

From the webapp's own counters over 113.136 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 51.558 req/s in total: 2.21 from the benchmark and 49.348 of background traffic, of which 37.654 are the crawler loop. Server errors: 0 per second. Requests in flight: 9.478 on average, 34 at most. Event loop delay: 123.131 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 83.837 | 100.518 |
| webapp V8Worker | 26.758 | 86.694 |
| webapp libuv-worker | 16.913 | 21.387 |
| proxy | 111.272 | 154.459 |

The proxy accepted 45.098 connections per second on average, 66.338 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 2088 | 18.456 | 36.838 | 197.49 | 295.21 | 29.508 | 93.618 | 99.186 |
| /person/:personKey | 439 | 3.88 | 270.556 | 1964.815 | 4491.5 | 115.839 | 374.444 | 56.036 |
| /discover/:type? | 250 | 2.21 | 330 | 2450 | 6875 | 69.832 | 194.355 | 47.6 |
| /sign-up | 150 | 1.326 | 126.316 | 1766.667 | 3875 | 33.482 | 107.143 | 68 |
| /movie/:movieKey | 147 | 1.299 | 316.667 | 2618.75 | 4823.75 | 184.81 | 493.75 | 48.299 |
| /show/:showKey | 132 | 1.167 | 700 | 4011.765 | 4943.529 | 290.244 | 1266.667 | 15.152 |
| static | 74 | 0.654 | 64.286 | 226 | 285.2 | n/a | n/a | 100 |
| / | 59 | 0.521 | 47.581 | 305 | 705 | 35.294 | 98.333 | 94.915 |
| /api/e | 41 | 0.362 | 460.87 | 935.937 | 987.187 | n/a | n/a | 4.878 |
| /api/tonight | 37 | 0.327 | 51.923 | 183 | 263 | n/a | n/a | 100 |
| /api/search-config | 36 | 0.318 | 88.889 | 320 | 464 | n/a | n/a | 94.444 |
| /api/og-image-warm | 33 | 0.292 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /sign-in | 7 | 0.062 | 750 | 1883.333 | 1976.667 | 75 | 188.333 | 28.571 |
| /api/genres/all | 1 | 0.009 | 100 | 190 | 198 | n/a | n/a | 100 |
| /api/poster-impressions | 1 | 0.009 | 150 | 285 | 297 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 419 | 79 | 340 | 81.146 | 83.775 | 242.105 |
| person-fingerprint-baseline | 340 | 340 | 0 | 0 | n/a | n/a |
| user-settings | 284 | 282 | 2 | 0.704 | 25 | 47.5 |
| related-show | 284 | 58 | 226 | 79.577 | 46.694 | 491.429 |
| details-movie | 151 | 4 | 147 | 97.351 | 118.333 | 191.833 |
| related-movie | 284 | 58 | 226 | 79.577 | 47.083 | 668.75 |
| availability-evidence-v1 | 280 | 5 | 275 | 98.214 | 27.174 | 74.265 |
| details-show | 133 | 1 | 132 | 99.248 | 134.409 | 198.28 |
| episode-grid | 133 | 9 | 124 | 93.233 | 28.44 | 98.889 |
| genres-movie | 1 | 1 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 4 | 0.035 | 24.612 |
| grpc /qdrant.Points/Get 0 | 450 | 3.978 | 7.655 |
| grpc /qdrant.Points/Recommend 0 | 178 | 1.573 | 59.89 |
