# 20261004T200433Z-load-checkpoint-surface-discover

Label: checkpoint-surface-discover. Time: 2026-10-04T20:04:57.736Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s, then 80 req/s for 35 s, then 100 req/s for 35 s, then 125 req/s for 35 s, then 150 req/s for 35 s, then 200 req/s for 35 s, then 250 req/s for 35 s, then 300 req/s for 35 s, then 400 req/s for 35 s, then 500 req/s for 35 s.

90475 requests; 89.576 req/s; 0% errors; p95 18.162 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 90475 | 89.576 | 0 | 4.332 | 18.162 | 40.554 | 3.409 | 17 | 39.401 | 90475/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 4.654 | 26.408 | 165.291 | 3.441 | 25.27 |
| s02 | 2 | 68 | 1.943 | 0 | 5.171 | 13.785 | 17.7 | 4.094 | 12.875 |
| s03 | 4 | 135 | 3.857 | 0 | 4.448 | 13.81 | 27.145 | 3.426 | 12.657 |
| s04 | 6 | 205 | 5.857 | 0 | 4.653 | 8.606 | 17.671 | 3.719 | 7.44 |
| s05 | 8 | 275 | 7.857 | 0 | 4.895 | 16.974 | 26.565 | 3.997 | 15.88 |
| s06 | 10 | 345 | 9.857 | 0 | 4.926 | 10.213 | 30.491 | 4.028 | 8.751 |
| s07 | 12 | 415 | 11.857 | 0 | 5.012 | 18.292 | 33.022 | 4.13 | 17.086 |
| s08 | 14 | 485 | 13.857 | 0 | 5.106 | 17.618 | 37.948 | 4.163 | 16.094 |
| s09 | 16 | 555 | 15.857 | 0 | 5.067 | 19.411 | 46.1 | 4.082 | 18.372 |
| s10 | 18 | 625 | 17.857 | 0 | 4.987 | 14.592 | 30.045 | 4.064 | 13.781 |
| s11 | 20 | 695 | 19.857 | 0 | 4.855 | 24.457 | 46.932 | 3.927 | 23.483 |
| s12 | 25 | 862 | 24.629 | 0 | 4.964 | 17.353 | 35.325 | 4 | 16.315 |
| s13 | 30 | 1038 | 29.657 | 0 | 4.657 | 19.1 | 47.929 | 3.754 | 18.372 |
| s14 | 35 | 1212 | 34.629 | 0 | 4.701 | 16.397 | 33.82 | 3.731 | 15.252 |
| s15 | 40 | 1388 | 39.657 | 0 | 4.674 | 12.817 | 31.158 | 3.73 | 11.777 |
| s16 | 45 | 1562 | 44.629 | 0 | 4.76 | 13.689 | 33.149 | 3.796 | 12.554 |
| s17 | 50 | 1737 | 49.629 | 0 | 4.831 | 16.5 | 34.399 | 3.848 | 15.291 |
| s18 | 55 | 1913 | 54.657 | 0 | 4.934 | 24.102 | 47.123 | 3.976 | 23.099 |
| s19 | 60 | 2087 | 59.629 | 0 | 4.852 | 14.446 | 32.954 | 3.888 | 13.378 |
| s20 | 65 | 2263 | 64.657 | 0 | 4.856 | 17.431 | 37.874 | 3.902 | 16.531 |
| s21 | 80 | 2762 | 78.914 | 0 | 4.612 | 15.736 | 32.095 | 3.737 | 14.82 |
| s22 | 100 | 3450 | 98.571 | 0 | 4.741 | 18.488 | 42.327 | 3.864 | 17.509 |
| s23 | 125 | 4312 | 123.2 | 0 | 4.676 | 18.135 | 42.78 | 3.791 | 17.23 |
| s24 | 150 | 5187 | 148.2 | 0 | 4.874 | 19.379 | 38.861 | 3.952 | 18.232 |
| s25 | 200 | 6875 | 196.429 | 0 | 4.587 | 19.817 | 65.367 | 3.711 | 18.834 |
| s26 | 250 | 8624 | 246.4 | 0 | 4.445 | 15.761 | 35.202 | 3.552 | 14.707 |
| s27 | 300 | 10375 | 296.429 | 0 | 4.25 | 16.867 | 36.667 | 3.391 | 15.831 |
| s28 | 400 | 13749 | 392.829 | 0 | 3.949 | 18.727 | 43.446 | 3.093 | 17.668 |
| s29 | 500 | 17247 | 492.771 | 0 | 3.931 | 19.918 | 42.787 | 3.037 | 18.603 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 201 | 18.102 | 41.65 | 1.438 | 2.61 | 34.171 | 14.088 | 21.899 | 107.399 | 10 |
| pgnode01 | data | 16 | 201 | 15.707 | 66.398 | 2.563 | 4.69 | 70.535 | 35.951 | 70.308 | 745.345 | 15 |
| pgnode02 | data | 16 | 200 | 18.084 | 70.677 | 2.865 | 5.26 | 71.48 | 49.299 | 48.892 | 466.614 | 14 |
| pgnode03 | data | 16 | 200 | 15.43 | 44.706 | 2.606 | 4.4 | 65.418 | 0.098 | 0.116 | 1.496 | 5 |
| gw-cache1 | data | 8 | 201 | 5.314 | 25.532 | 0.453 | 1.18 | 35.221 | 5.631 | 0.686 | 6.928 | 8 |
| gw-cache2 | data | 8 | 200 | 3.084 | 20.98 | 0.271 | 0.71 | 34.175 | 0.518 | 0.378 | 1.381 | 7 |
| gw-cache3 | data | 8 | 201 | 2.135 | 16.469 | 0.174 | 0.61 | 34.795 | 0.542 | 0.264 | 1.98 | 9 |
| gw-vector1 | target | 16 | 201 | 37.742 | 77.136 | 6.827 | 11.68 | 50.936 | 35.537 | 70.022 | 1258.318 | 9 |
| gw-worker3 | generator | 4 | 201 | 9.613 | 34.838 | 0.407 | 1.52 | 25.893 | 0.074 | 0.089 | 0.209 | 503 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 31.699 | 132.37 | 2156.106 | 2275.328 |
| abusive | coolify-proxy | 54.696 | 160.04 | 138.363 | 164.9 |
| gw-vector1 | gk4owk8-181159928589 | 31.235 | 171.07 | 2162.785 | 2189.312 |
| gw-vector1 | coolify-proxy | 9.883 | 42.33 | 40.418 | 52.35 |
| gw-vector1 | qdrant-main | 469.621 | 1186.03 | 4782.432 | 5283.84 |

## Webapp process

From the webapp's own counters over 1014.519 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 52.408 req/s in total: 89.181 from the benchmark and -36.773 of background traffic, of which 0.001 are the crawler loop. Server errors: 0 per second. Requests in flight: 2.535 on average, 12 at most. Event loop delay: 221.435 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 24.332 | 50.277 |
| webapp V8Worker | 4.265 | 26.112 |
| webapp libuv-worker | 2.949 | 5.334 |
| proxy | 53.601 | 146.657 |

The proxy accepted 12.484 connections per second on average, 17.639 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /discover/:type? | 45171 | 44.525 | 25.002 | 47.504 | 49.504 | 25.002 | 47.504 | 99.998 |
| /person/:personKey | 2506 | 2.47 | 78.759 | 891.071 | 2594 | 37.298 | 267.329 | 90.702 |
| /movie/:movieKey | 2303 | 2.27 | 161.906 | 2735 | 4860.846 | 156.508 | 2685.547 | 82.414 |
| /show/:showKey | 260 | 0.256 | 173.438 | 3666.667 | 9000 | 160.191 | 3697.368 | 80 |
| static | 231 | 0.228 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 44 | 0.043 | 250 | 297.143 | 1560 | n/a | n/a | 97.727 |
| / | 20 | 0.02 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/poster-impressions | 2 | 0.002 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /sign-up | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /watch-next | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-in | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /:type/:category | 1 | 0.001 | 500 | 950 | 990 | 500 | 950 | 0 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 2314 | 251 | 2063 | 89.153 | 153.709 | 2925 |
| related-cards | 962 | 154 | 808 | 83.992 | 75.728 | 125.66 |
| genres-movie | 18 | 18 | 0 | 0 | n/a | n/a |
| person-profile-v2 | 2492 | 655 | 1837 | 73.716 | 72.483 | 1142.958 |
| person-fingerprint-baseline | 1837 | 1837 | 0 | 0 | n/a | n/a |
| details-show-v2 | 265 | 39 | 226 | 85.283 | 156.863 | 3689.474 |
| episode-grid | 265 | 39 | 222 | 85.283 | 30.707 | 1543.75 |
| movie-collection | 189 | 55 | 134 | 70.899 | 25.969 | 49.341 |
| media_fingerprint_v1:discover | 16 | 0 | 16 | 100 | 240 | 866.667 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 3100 | 3.056 | 1.987 |
| grpc /qdrant.Points/Recommend 0 | 3092 | 3.048 | 34.126 |
| grpc /qdrant.Points/UpdateBatch 0 | 15 | 0.015 | 51.985 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 103.908 req/s, of which 14.727 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 52.408 | 0 | 24.332 | 50.277 | 12 | 221.435 | 2220.512 |
| 10.0.0.20 | 392439b7 | 51.495 | 0.002 | 23.127 | 45.477 | 11 | 608.621 | 2244.184 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 1 | 1 | 0 | 2313 | 0 |
| 10.0.0.21 | / | 17 | 1 | 0 | 2 | 0 |
| 10.0.0.21 | /discover/:type? | 45164 | 3 | 0 | 30 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 2508 | 0 |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 265 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 6 | 0 |
| 10.0.0.21 | /sign-up | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /:type/:category | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /watch-next | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 0 | 0 | 1968 | 0 |
| 10.0.0.20 | /show/:showKey | 1 | 0 | 0 | 215 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 1 | 0 | 1894 | 0 |
| 10.0.0.20 | / | 16 | 1 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 45313 | 0 | 0 | 25 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 11 | 0 |
| 10.0.0.20 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /:type/:category/:page | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-up | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /explore/:type/:category/:text | 0 | 0 | 0 | 1 | 0 |
