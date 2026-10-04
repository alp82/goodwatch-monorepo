# 20261004T031008Z-load-baseline-surface-og-title

Label: baseline-surface-og-title. Time: 2026-10-04T03:10:34.010Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 88af219ad16c3a75c7caf51916849256c1da8a5c.

Rate plan: 1 req/s for 25 s, then 2 req/s for 30 s, then 4 req/s for 30 s, then 6 req/s for 30 s, then 8 req/s for 30 s, then 10 req/s for 30 s, then 12 req/s for 30 s, then 14 req/s for 30 s, then 16 req/s for 30 s, then 18 req/s for 30 s, then 20 req/s for 30 s, then 25 req/s for 30 s, then 30 req/s for 30 s, then 35 req/s for 30 s.

5939 requests; 14.309 req/s; 0% errors; p95 74.82 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| og_title | 5939 | 14.309 | 0 | 20.396 | 74.82 | 130.139 | 11.103 | 65.76 | 116.398 | 5939/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 24 | 0.96 | 0 | 20.99 | 37.792 | 74.268 | 10.861 | 28.266 |
| s02 | 2 | 58 | 1.933 | 0 | 19.835 | 52.974 | 169.755 | 9.906 | 43.228 |
| s03 | 4 | 115 | 3.833 | 0 | 20.366 | 65.165 | 81.497 | 11.897 | 52.465 |
| s04 | 6 | 175 | 5.833 | 0 | 22.244 | 78.044 | 106.858 | 12.131 | 67.476 |
| s05 | 8 | 235 | 7.833 | 0 | 22.247 | 79.339 | 105.481 | 12.233 | 67.583 |
| s06 | 10 | 295 | 9.833 | 0 | 22.304 | 99.489 | 129.944 | 12.964 | 88.974 |
| s07 | 12 | 355 | 11.833 | 0 | 20.39 | 66.832 | 99.602 | 10.932 | 55.354 |
| s08 | 14 | 415 | 13.833 | 0 | 20.296 | 59.926 | 109.586 | 10.922 | 50.314 |
| s09 | 16 | 475 | 15.833 | 0 | 20.927 | 88.359 | 155.183 | 11.103 | 74.427 |
| s10 | 18 | 535 | 17.833 | 0 | 20.4 | 77.796 | 128.274 | 11.069 | 67.983 |
| s11 | 20 | 595 | 19.833 | 0 | 20.469 | 58.913 | 105.876 | 11.345 | 50.091 |
| s12 | 25 | 737 | 24.567 | 0 | 19.618 | 75.679 | 120.51 | 10.964 | 66.899 |
| s13 | 30 | 888 | 29.6 | 0 | 20.733 | 103.12 | 228.749 | 11.153 | 88.243 |
| s14 | 35 | 1037 | 34.567 | 0 | 19.363 | 56.118 | 97.963 | 10.52 | 48.502 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 82 | 35.409 | 45.776 | 2.632 | 3.57 | 34.242 | 5.682 | 89.288 | 214.377 | 39 |
| pgnode01 | data | 16 | 83 | 4.896 | 9.05 | 0.714 | 1.39 | 70.677 | 2.01 | 4.32 | 67.117 | 15 |
| pgnode02 | data | 16 | 82 | 4.752 | 8.368 | 1.11 | 4.24 | 72.365 | 2.969 | 3.119 | 69.243 | 16 |
| pgnode03 | data | 16 | 82 | 5.022 | 11.06 | 0.787 | 1.89 | 65.462 | 0.116 | 0.095 | 0.194 | 7 |
| gw-cache1 | data | 8 | 82 | 4.093 | 20.307 | 0.302 | 0.62 | 35.793 | 0.836 | 0.64 | 1.614 | 11 |
| gw-cache2 | data | 8 | 83 | 2.855 | 17 | 0.189 | 0.44 | 35.912 | 2.51 | 2.804 | 3.869 | 10 |
| gw-cache3 | data | 8 | 83 | 4.937 | 18.487 | 0.407 | 0.88 | 35.503 | 0.896 | 0.654 | 2.753 | 9 |
| gw-vector1 | data | 16 | 82 | 9.039 | 23.16 | 1.416 | 2.87 | 39.774 | 46.769 | 126.826 | 1343.174 | 8 |
| gw-worker3 | generator | 4 | 82 | 9.825 | 23.23 | 0.225 | 0.53 | 16.13 | 0.133 | 0.111 | 0.211 | 43 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 88.381 | 170.59 | 2645.254 | 2649.088 |
| abusive | coolify-proxy | 128.1 | 171.66 | 257.484 | 263 |

## Webapp process

From the webapp's own counters over 418.241 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 62.014 req/s in total: 14.202 from the benchmark and 47.812 of background traffic, of which 36.747 are the crawler loop. Server errors: 0 per second. Requests in flight: 3.566 on average, 25 at most. Event loop delay: 122.606 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 71.575 | 88.413 |
| webapp libuv-worker | 13.213 | 19.449 |
| webapp V8Worker | 8.052 | 27.316 |
| proxy | 126.575 | 167.053 |

The proxy accepted 42.893 connections per second on average, 54.87 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 7544 | 18.037 | 26.866 | 69.784 | 154.62 | 25.611 | 48.661 | 99.934 |
| /og/:first/:second | 5943 | 14.209 | 25.776 | 48.975 | 91.517 | n/a | n/a | 99.983 |
| /person/:personKey | 1281 | 3.063 | 157.743 | 484.667 | 949.896 | 85.362 | 199.988 | 87.432 |
| /movie/:movieKey | 1237 | 2.958 | 244.906 | 851.993 | 1410.952 | 164.176 | 304.828 | 66.613 |
| /sign-up | 534 | 1.277 | 60.778 | 287.727 | 638.333 | 25.772 | 48.967 | 95.506 |
| static | 250 | 0.598 | 27.174 | 70.833 | 98.611 | n/a | n/a | 100 |
| / | 156 | 0.373 | 26.897 | 70 | 172 | 25.556 | 48.556 | 100 |
| /show/:showKey | 146 | 0.349 | 400 | 951.136 | 1513.333 | 218.182 | 430 | 32.192 |
| /api/e | 83 | 0.198 | 416.949 | 901.562 | 1170 | n/a | n/a | 8.434 |
| /api/search-config | 73 | 0.175 | 27.239 | 73.5 | 127 | n/a | n/a | 100 |
| /api/tonight | 73 | 0.175 | 25.704 | 48.838 | 81.75 | n/a | n/a | 100 |
| /api/og-image-warm | 65 | 0.155 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/related | 42 | 0.1 | 690.476 | 1737.5 | 1947.5 | n/a | n/a | 9.524 |
| /sign-in | 29 | 0.069 | 59.375 | 193.571 | 855 | 25.893 | 49.196 | 96.552 |
| /api/genres/all | 5 | 0.012 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/poster-impressions | 4 | 0.01 | 50 | 190 | 198 | n/a | n/a | 100 |
| /:type | 2 | 0.005 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /discover/:type? | 1 | 0.002 | 100 | 190 | 198 | n/a | n/a | 100 |
| /og/:first | 1 | 0.002 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 1250 | 247 | 1003 | 80.24 | 73.307 | 183.927 |
| person-fingerprint-baseline | 1003 | 1003 | 0 | 0 | n/a | n/a |
| user-settings | 1418 | 1411 | 6 | 0.494 | 25 | 47.5 |
| related-show | 1439 | 321 | 1118 | 77.693 | 35.069 | 192.793 |
| details-movie | 1272 | 52 | 1220 | 95.912 | 99.224 | 190.444 |
| related-movie | 1439 | 321 | 1118 | 77.693 | 35.069 | 268.704 |
| availability-evidence-v1 | 1387 | 68 | 1319 | 95.097 | 25.522 | 48.493 |
| details-show | 149 | 16 | 133 | 89.262 | 124.713 | 193.506 |
| episode-grid | 146 | 28 | 118 | 80.822 | 25.431 | 48.319 |
| genres-movie | 5 | 5 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 570 | 1.363 | 50.632 |
| grpc /qdrant.Points/Get 0 | 2236 | 5.346 | 3.322 |
| grpc /qdrant.Points/UpdateBatch 0 | 8 | 0.019 | 25.208 |
