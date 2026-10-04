# 20261004T204614Z-load-checkpoint-surface-og-title

Label: checkpoint-surface-og-title. Time: 2026-10-04T20:46:38.772Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 1 req/s for 25 s, then 2 req/s for 30 s, then 4 req/s for 30 s, then 6 req/s for 30 s, then 8 req/s for 30 s, then 10 req/s for 30 s, then 12 req/s for 30 s, then 14 req/s for 30 s, then 16 req/s for 30 s, then 18 req/s for 30 s, then 20 req/s for 30 s, then 25 req/s for 30 s, then 30 req/s for 30 s, then 35 req/s for 30 s, then 40 req/s for 30 s, then 45 req/s for 30 s, then 50 req/s for 30 s, then 55 req/s for 30 s, then 60 req/s for 30 s, then 65 req/s for 30 s, then 80 req/s for 30 s, then 100 req/s for 30 s, then 125 req/s for 30 s, then 150 req/s for 30 s, then 200 req/s for 30 s, then 250 req/s for 30 s, then 300 req/s for 30 s, then 400 req/s for 30 s, then 500 req/s for 30 s.

77330 requests; 89.392 req/s; 0% errors; p95 106.77 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| og_title | 77330 | 89.392 | 0 | 10.811 | 106.77 | 210.762 | 8.395 | 104.503 | 208.313 | 77330/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 24 | 0.96 | 0 | 11.431 | 26.353 | 28.823 | 8.62 | 23.603 |
| s02 | 2 | 58 | 1.933 | 0 | 11.091 | 20.069 | 37.613 | 8.002 | 17.248 |
| s03 | 4 | 115 | 3.833 | 0 | 10.688 | 38.215 | 73.166 | 8.006 | 35.437 |
| s04 | 6 | 175 | 5.833 | 0 | 10.412 | 17.464 | 31.64 | 7.966 | 14.415 |
| s05 | 8 | 235 | 7.833 | 0 | 10.565 | 26.918 | 43.941 | 8.108 | 24.573 |
| s06 | 10 | 295 | 9.833 | 0 | 10.595 | 19.466 | 42.156 | 8.373 | 16.495 |
| s07 | 12 | 355 | 11.833 | 0 | 10.902 | 30.888 | 80.824 | 8.318 | 27.906 |
| s08 | 14 | 415 | 13.833 | 0 | 10.96 | 18.719 | 35.433 | 8.518 | 15.697 |
| s09 | 16 | 475 | 15.833 | 0 | 11.084 | 26.576 | 86.298 | 8.63 | 24.198 |
| s10 | 18 | 535 | 17.833 | 0 | 10.982 | 19.018 | 45.679 | 8.528 | 15.982 |
| s11 | 20 | 595 | 19.833 | 0 | 10.909 | 33.171 | 72.819 | 8.482 | 31.061 |
| s12 | 25 | 737 | 24.567 | 0 | 10.975 | 17.942 | 29.711 | 8.522 | 14.695 |
| s13 | 30 | 888 | 29.6 | 0 | 11.044 | 25.578 | 61.241 | 8.507 | 23.21 |
| s14 | 35 | 1037 | 34.567 | 0 | 10.805 | 16.198 | 27.935 | 8.305 | 13.357 |
| s15 | 40 | 1187 | 39.567 | 0 | 10.849 | 23.643 | 48.28 | 8.365 | 21.3 |
| s16 | 45 | 1338 | 44.6 | 0 | 10.792 | 17.307 | 38.24 | 8.437 | 14.504 |
| s17 | 50 | 1487 | 49.567 | 0 | 10.846 | 30.295 | 87.436 | 8.374 | 27.867 |
| s18 | 55 | 1638 | 54.6 | 0 | 10.614 | 20.525 | 37.421 | 8.151 | 17.489 |
| s19 | 60 | 1787 | 59.567 | 0 | 10.62 | 24.888 | 58.761 | 8.115 | 22.339 |
| s20 | 65 | 1938 | 64.6 | 0 | 10.406 | 17.084 | 32.657 | 8.039 | 14.148 |
| s21 | 80 | 2362 | 78.733 | 0 | 10.447 | 25.868 | 49.968 | 8.045 | 23.11 |
| s22 | 100 | 2950 | 98.333 | 0 | 10.185 | 18.804 | 35.087 | 7.985 | 16.058 |
| s23 | 125 | 3687 | 122.9 | 0 | 10.318 | 34.991 | 96.154 | 7.954 | 32.385 |
| s24 | 150 | 4437 | 147.9 | 0 | 9.819 | 19.155 | 36.872 | 7.569 | 16.214 |
| s25 | 200 | 5874 | 195.8 | 0 | 9.704 | 37.606 | 87.172 | 7.406 | 35.063 |
| s26 | 250 | 7374 | 245.8 | 0 | 9.214 | 24.747 | 46.997 | 6.997 | 22.397 |
| s27 | 300 | 8875 | 295.833 | 0 | 10.066 | 154.989 | 554.564 | 7.619 | 152.387 |
| s28 | 400 | 11748 | 391.6 | 0 | 11.764 | 82.627 | 109.875 | 9.566 | 80.142 |
| s29 | 500 | 14709 | 490.3 | 0 | 38.934 | 196.366 | 303.095 | 36.677 | 194.356 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 172 | 20.241 | 49.293 | 1.583 | 3.82 | 34.464 | 51.733 | 99.004 | 560.858 | 9 |
| pgnode01 | data | 16 | 172 | 6.745 | 25.827 | 1.2 | 3.95 | 70.512 | 3.393 | 3.946 | 67.628 | 13 |
| pgnode02 | data | 16 | 172 | 7.029 | 17.572 | 0.752 | 2.39 | 71.446 | 3.105 | 3.344 | 72.198 | 14 |
| pgnode03 | data | 16 | 172 | 7.619 | 19.347 | 0.936 | 2.66 | 65.5 | 0.095 | 0.13 | 4.259 | 5 |
| gw-cache1 | data | 8 | 172 | 3.082 | 18.2 | 0.24 | 0.51 | 34.472 | 0.383 | 0.318 | 1.192 | 8 |
| gw-cache2 | data | 8 | 171 | 3.286 | 21.836 | 0.266 | 0.6 | 33.911 | 0.378 | 0.285 | 0.967 | 7 |
| gw-cache3 | data | 8 | 172 | 3.63 | 21.036 | 0.287 | 0.6 | 34.218 | 0.404 | 0.257 | 0.92 | 9 |
| gw-vector1 | target | 16 | 172 | 10.725 | 24.304 | 1.981 | 3.8 | 48.685 | 0.127 | 0.237 | 1.036 | 7 |
| gw-worker3 | generator | 4 | 172 | 14.225 | 55.726 | 0.59 | 1.82 | 26.436 | 2.056 | 0.237 | 4.463 | 503 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 39.456 | 116.09 | 2244.453 | 2328.576 |
| abusive | coolify-proxy | 66.86 | 212.3 | 148.183 | 178.7 |
| gw-vector1 | gk4owk8-181159928589 | 46.899 | 175.93 | 2232.552 | 2271.232 |
| gw-vector1 | coolify-proxy | 12.738 | 60.9 | 40.861 | 66.8 |
| gw-vector1 | qdrant-main | 23.493 | 124.55 | 4038.537 | 4052.992 |

## Webapp process

From the webapp's own counters over 869.608 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 51.547 req/s in total: 88.926 from the benchmark and -37.379 of background traffic, of which 0.002 are the crawler loop. Server errors: 0 per second. Requests in flight: 2.552 on average, 34 at most. Event loop delay: 120.247 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 33.359 | 99.763 |
| webapp V8Worker | 3.974 | 24.592 |
| webapp libuv-worker | 3.226 | 7.333 |
| proxy | 64.41 | 194.005 |

The proxy accepted 11.454 connections per second on average, 22.177 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /og/:first/:second | 38761 | 44.573 | 25.812 | 49.042 | 91.036 | n/a | n/a | 99.995 |
| /movie/:movieKey | 2007 | 2.308 | 145.73 | 272.876 | 450.973 | 138.62 | 199.923 | 97.608 |
| /person/:personKey | 1415 | 1.627 | 69.203 | 185.801 | 272.045 | 33.359 | 128.273 | 99.435 |
| static | 224 | 0.258 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /show/:showKey | 204 | 0.235 | 170.408 | 411.429 | 745 | 146.032 | 282.333 | 91.176 |
| /api/e | 48 | 0.055 | 194.595 | 1866.667 | 7600 | n/a | n/a | 77.083 |
| / | 17 | 0.02 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 6 | 0.007 | 120 | 270 | 294 | 100 | 190 | 100 |
| /api/poster-impressions | 5 | 0.006 | 62.5 | 175 | 195 | n/a | n/a | 100 |
| /sign-in | 2 | 0.002 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-up | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/discover/results | 1 | 0.001 | 100 | 190 | 198 | n/a | n/a | 100 |
| /:type/:category/:page | 1 | 0.001 | 100 | 190 | 198 | 100 | 190 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 2024 | 272 | 1752 | 86.561 | 133.816 | 193.861 |
| related-cards | 685 | 176 | 509 | 74.307 | 75 | 177.162 |
| genres-movie | 2 | 2 | 0 | 0 | n/a | n/a |
| person-profile-v2 | 1391 | 408 | 983 | 70.669 | 60.812 | 149.235 |
| person-fingerprint-baseline | 983 | 983 | 0 | 0 | n/a | n/a |
| details-show-v2 | 207 | 41 | 166 | 80.193 | 139.706 | 194.632 |
| episode-grid | 206 | 37 | 165 | 82.039 | 26.741 | 64.167 |
| movie-collection | 73 | 27 | 46 | 63.014 | 25.556 | 48.556 |
| media_fingerprint_v1:discover | 1 | 0 | 1 | 100 | 100 | 190 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 18 | 0.021 | 26.713 |
| grpc /qdrant.Points/Get 0 | 1974 | 2.27 | 4.511 |
| grpc /qdrant.Points/Recommend 0 | 1974 | 2.27 | 28.546 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 102.353 req/s, of which 13.427 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 51.547 | 0 | 33.359 | 99.763 | 34 | 120.247 | 2250.934 |
| 10.0.0.20 | 392439b7 | 50.798 | 0 | n/a | n/a | 7 | 215.405 | 2271.293 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 0 | 0 | 0 | 2023 | 0 |
| 10.0.0.21 | /discover/:type? | 0 | 0 | 0 | 27 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 1417 | 0 |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 206 | 0 |
| 10.0.0.21 | / | 17 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 8 | 0 |
| 10.0.0.21 | /sign-up | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /:type/:category/:page | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /sign-in | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 1 | 0 | 1647 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 252 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 1265 | 0 |
| 10.0.0.20 | / | 92 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 20 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 4 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /sign-up | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /forgot-password | 0 | 0 | 0 | 1 | 0 |
