# 20261004T034007Z-load-baseline-latency-cold-longtail-2

**Smoke run. Not a baseline.**

Label: baseline-latency-cold-longtail-2. Time: 2026-10-04T03:40:32.937Z. Target: https://goodwatch.app. Path: private. Cache: cold. URL set: longtail. Git: 88af219ad16c3a75c7caf51916849256c1da8a5c.

Rate plan: 1 req/s for 120 s.

119 requests; 0.991 req/s; 0.84% errors; p95 2105.522 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| home | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| og_title | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| other | 15 | 0.125 | 0 | 265.291 | 1381.281 | 1619.594 | 173.402 | 856.639 | 1351.671 | 15/0/0/0/0 |
| title_movie | 76 | 0.633 | 1.316 | 589.609 | 1317.212 | 2401.434 | 334.577 | 640.144 | 724.065 | 75/0/1/0/0 |
| title_show | 28 | 0.233 | 0 | 967.769 | 2890.473 | 4077.868 | 466.166 | 643.697 | 869.471 | 28/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 119 | 0.992 | 0.84 | 659.662 | 2105.522 | 3536.402 | 344.046 | 644.831 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 25 | 37.259 | 44.277 | 3.451 | 4.18 | 34.176 | 7.153 | 10.887 | 16.226 | 37 |
| pgnode01 | data | 16 | 24 | 6.587 | 12.089 | 0.761 | 1.14 | 70.708 | 3.485 | 8.122 | 75.573 | 15 |
| pgnode02 | data | 16 | 24 | 6.125 | 10.098 | 1.088 | 1.64 | 72.37 | 5.13 | 5.974 | 72.665 | 16 |
| pgnode03 | data | 16 | 24 | 6.751 | 12.114 | 1.253 | 2.8 | 65.438 | 0.11 | 0.104 | 0.198 | 6 |
| gw-cache1 | data | 8 | 25 | 2.91 | 8.48 | 0.265 | 0.34 | 35.838 | 1.722 | 0.944 | 2.896 | 9 |
| gw-cache2 | data | 8 | 25 | 3.25 | 7.361 | 0.246 | 0.39 | 35.612 | 1.853 | 0.911 | 1.772 | 10 |
| gw-cache3 | data | 8 | 24 | 3.185 | 9.641 | 0.362 | 0.48 | 35.498 | 1.627 | 0.843 | 1.786 | 9 |
| gw-vector1 | data | 16 | 24 | 68.844 | 81.589 | 11.307 | 12.83 | 43.791 | 0.154 | 0.16 | 0.205 | 5 |
| gw-worker3 | generator | 4 | 24 | 9.16 | 25.25 | 0.308 | 0.45 | 17.374 | 0.16 | 0.107 | 0.175 | 26 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 105.232 | 136.41 | 2643.395 | 2649.088 |
| abusive | coolify-proxy | 115.7 | 138.2 | 248.496 | 249.9 |

## Webapp process

From the webapp's own counters over 123.796 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 48.943 req/s in total: 0.961 from the benchmark and 47.982 of background traffic, of which 37.739 are the crawler loop. Server errors: 0 per second. Requests in flight: 8.96 on average, 17 at most. Event loop delay: 184.341 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 83.212 | 96.412 |
| webapp libuv-worker | 20.151 | 26.624 |
| webapp V8Worker | 17.481 | 53.715 |
| proxy | 113.413 | 129.683 |

The proxy accepted 43.986 connections per second on average, 50.701 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 2290 | 18.498 | 30.243 | 141.867 | 197.048 | 27.249 | 72.44 | 100 |
| /movie/:movieKey | 430 | 3.473 | 393.069 | 1515.625 | 2850 | 206.148 | 498.395 | 39.07 |
| /person/:personKey | 399 | 3.223 | 211.875 | 846.795 | 1501.25 | 111.471 | 274.487 | 67.669 |
| /sign-up | 172 | 1.389 | 80 | 484 | 1140 | 28.477 | 97.692 | 84.302 |
| /show/:showKey | 62 | 0.501 | 766.667 | 3450 | 4690 | 334.483 | 778.571 | 12.903 |
| / | 26 | 0.21 | 30.952 | 170 | 448 | 28.261 | 78.333 | 96.154 |
| static | 24 | 0.194 | 26.087 | 49.565 | 88 | n/a | n/a | 100 |
| /api/related | 16 | 0.129 | 1333.333 | 1933.333 | 1986.667 | n/a | n/a | 6.25 |
| /:type/:category/:page | 14 | 0.113 | 233.333 | 1650 | 1930 | 175 | 1300 | 64.286 |
| /sign-in | 12 | 0.097 | 100 | 700 | 940 | 27.273 | 70 | 91.667 |
| /discover/:type? | 9 | 0.073 | 937.5 | 1887.5 | 1977.5 | 150 | 277.5 | 0 |
| /api/search-config | 2 | 0.016 | 50 | 190 | 198 | n/a | n/a | 100 |
| /api/tonight | 2 | 0.016 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 1 | 0.008 | 500 | 950 | 990 | n/a | n/a | 0 |
| /api/genres/all | 1 | 0.008 | 100 | 190 | 198 | n/a | n/a | 100 |
| /:type | 1 | 0.008 | 250 | 475 | 495 | 25 | 47.5 | 0 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 403 | 80 | 323 | 80.149 | 85.033 | 198.861 |
| person-fingerprint-baseline | 323 | 323 | 0 | 0 | n/a | n/a |
| user-settings | 519 | 516 | 3 | 0.578 | 25 | 47.5 |
| related-show | 513 | 128 | 385 | 75.049 | 68.75 | 404 |
| details-movie | 441 | 25 | 416 | 94.331 | 116.042 | 193.854 |
| related-movie | 513 | 128 | 385 | 75.049 | 93.75 | 471.034 |
| availability-evidence-v1 | 501 | 30 | 471 | 94.012 | 26.342 | 50.937 |
| details-show | 64 | 5 | 59 | 92.188 | 160.417 | 401.667 |
| episode-grid | 64 | 10 | 54 | 84.375 | 25.962 | 49.327 |
| genres-movie | 6 | 6 | 0 | 0 | n/a | n/a |
| media_fingerprint_v1:discover | 14 | 1 | 13 | 92.857 | 137.5 | 1350 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 770 | 6.22 | 5.562 |
| grpc /qdrant.Points/Recommend 0 | 368 | 2.973 | 72.542 |
| grpc /qdrant.Points/UpdateBatch 0 | 3 | 0.024 | 25.889 |
