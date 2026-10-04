# 20261004T210313Z-load-checkpoint-surface-og-share-list

Label: checkpoint-surface-og-share-list. Time: 2026-10-04T21:03:38.188Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 1 req/s for 25 s, then 2 req/s for 30 s, then 4 req/s for 30 s, then 6 req/s for 30 s, then 8 req/s for 30 s, then 10 req/s for 30 s, then 12 req/s for 30 s, then 14 req/s for 30 s, then 16 req/s for 30 s, then 18 req/s for 30 s, then 20 req/s for 30 s, then 25 req/s for 30 s, then 30 req/s for 30 s, then 35 req/s for 30 s, then 40 req/s for 30 s, then 45 req/s for 30 s, then 50 req/s for 30 s, then 55 req/s for 30 s, then 60 req/s for 30 s, then 65 req/s for 30 s, then 80 req/s for 30 s, then 100 req/s for 30 s, then 125 req/s for 30 s, then 150 req/s for 30 s, then 200 req/s for 30 s, then 250 req/s for 30 s, then 300 req/s for 30 s, then 400 req/s for 30 s, then 500 req/s for 30 s.

77354 requests; 89.419 req/s; 0% errors; p95 45.258 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| og_share_list | 77354 | 89.419 | 0 | 10.315 | 45.258 | 97.266 | 7.698 | 40.976 | 90.43 | 77354/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 24 | 0.96 | 0 | 12.214 | 16.716 | 17.296 | 9.137 | 12.34 |
| s02 | 2 | 58 | 1.933 | 0 | 10.825 | 22.16 | 40.869 | 7.926 | 19.207 |
| s03 | 4 | 115 | 3.833 | 0 | 11.355 | 18.905 | 23.954 | 8.5 | 14.178 |
| s04 | 6 | 175 | 5.833 | 0 | 10.859 | 17.713 | 31.417 | 8.049 | 13.606 |
| s05 | 8 | 235 | 7.833 | 0 | 11.09 | 22.198 | 33.361 | 8.171 | 18.828 |
| s06 | 10 | 295 | 9.833 | 0 | 10.918 | 20.562 | 55.718 | 8.123 | 17.682 |
| s07 | 12 | 355 | 11.833 | 0 | 10.983 | 26.288 | 38.444 | 8.139 | 23.451 |
| s08 | 14 | 415 | 13.833 | 0 | 11.126 | 28.283 | 43.658 | 8.226 | 24.927 |
| s09 | 16 | 475 | 15.833 | 0 | 11.035 | 26.46 | 43.856 | 8.301 | 22.523 |
| s10 | 18 | 535 | 17.833 | 0 | 11.129 | 32.646 | 55.416 | 8.328 | 28.541 |
| s11 | 20 | 595 | 19.833 | 0 | 11.201 | 24.163 | 39.923 | 8.29 | 21.204 |
| s12 | 25 | 737 | 24.567 | 0 | 11.121 | 23.01 | 46.442 | 8.379 | 19.589 |
| s13 | 30 | 888 | 29.6 | 0 | 10.955 | 24.322 | 50.337 | 8.137 | 21.155 |
| s14 | 35 | 1037 | 34.567 | 0 | 10.89 | 26.269 | 46.348 | 8.094 | 22.948 |
| s15 | 40 | 1188 | 39.6 | 0 | 11.17 | 28.328 | 53.44 | 8.365 | 25.692 |
| s16 | 45 | 1337 | 44.567 | 0 | 11.029 | 34.065 | 56.754 | 8.333 | 31.173 |
| s17 | 50 | 1487 | 49.567 | 0 | 11.015 | 27.364 | 52.952 | 8.121 | 23.499 |
| s18 | 55 | 1638 | 54.6 | 0 | 10.996 | 26.817 | 49.47 | 8.18 | 23.816 |
| s19 | 60 | 1787 | 59.567 | 0 | 10.916 | 24.408 | 48.917 | 7.993 | 21.247 |
| s20 | 65 | 1938 | 64.6 | 0 | 10.949 | 35.929 | 68.568 | 8.156 | 32.541 |
| s21 | 80 | 2362 | 78.733 | 0 | 10.669 | 27.079 | 47.471 | 7.996 | 23.888 |
| s22 | 100 | 2950 | 98.333 | 0 | 10.72 | 29.243 | 54.641 | 8.146 | 26.219 |
| s23 | 125 | 3687 | 122.9 | 0 | 10.505 | 29.426 | 52.589 | 7.884 | 26.534 |
| s24 | 150 | 4437 | 147.9 | 0 | 9.767 | 33.102 | 66.984 | 7.27 | 29.634 |
| s25 | 200 | 5875 | 195.833 | 0 | 9.813 | 30.228 | 62.51 | 7.278 | 26.692 |
| s26 | 250 | 7374 | 245.8 | 0 | 9.722 | 36.907 | 74.54 | 7.076 | 33.072 |
| s27 | 300 | 8875 | 295.833 | 0 | 9.514 | 38.527 | 67.655 | 6.996 | 34.123 |
| s28 | 400 | 11749 | 391.633 | 0 | 9.514 | 43.532 | 99.434 | 7.113 | 39.54 |
| s29 | 500 | 14731 | 491.033 | 0 | 12.112 | 87.027 | 154.192 | 9.466 | 79.536 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 172 | 20.557 | 46.687 | 1.74 | 3.87 | 34.222 | 66.404 | 125.674 | 706.454 | 9 |
| pgnode01 | data | 16 | 172 | 6.382 | 10.715 | 1.118 | 4.19 | 70.467 | 2.277 | 3.499 | 67.531 | 13 |
| pgnode02 | data | 16 | 172 | 6.346 | 13.152 | 1.197 | 3.25 | 71.569 | 2.866 | 3.172 | 71.711 | 14 |
| pgnode03 | data | 16 | 172 | 7.98 | 13.333 | 1.932 | 5.13 | 65.479 | 0.1 | 0.108 | 0.268 | 5 |
| gw-cache1 | data | 8 | 172 | 3.291 | 18.607 | 0.243 | 0.62 | 34.228 | 0.718 | 1.79 | 8.758 | 8 |
| gw-cache2 | data | 8 | 171 | 3.277 | 18.307 | 0.219 | 0.58 | 33.665 | 0.48 | 0.35 | 1.084 | 7 |
| gw-cache3 | data | 8 | 171 | 3.606 | 18.5 | 0.283 | 0.63 | 33.971 | 0.502 | 0.291 | 1.078 | 9 |
| gw-vector1 | target | 16 | 172 | 12.88 | 29.185 | 2.305 | 4.82 | 49.076 | 39.921 | 76.394 | 1293.987 | 9 |
| gw-worker3 | generator | 4 | 172 | 12.074 | 43.239 | 0.393 | 1.49 | 26.027 | 0.096 | 0.122 | 3.584 | 503 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 40.324 | 159.09 | 2218.127 | 2241.536 |
| abusive | coolify-proxy | 71.251 | 208.08 | 133.786 | 163.1 |
| gw-vector1 | gk4owk8-181159928589 | 42.026 | 176.25 | 2247.245 | 2323.456 |
| gw-vector1 | coolify-proxy | 12.18 | 54.73 | 41.383 | 68.13 |
| gw-vector1 | qdrant-main | 32.557 | 142.83 | 4054.885 | 4173.824 |

## Webapp process

From the webapp's own counters over 869.583 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 51.533 req/s in total: 88.956 from the benchmark and -37.424 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 0.884 on average, 7 at most. Event loop delay: 102.618 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 31.945 | 89.596 |
| webapp V8Worker | 3.801 | 26.166 |
| webapp libuv-worker | 3.416 | 7.524 |
| proxy | 68.623 | 200.961 |

The proxy accepted 11.731 connections per second on average, 19.036 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /og/lists/:id/:file | 38679 | 44.48 | 25.103 | 47.696 | 49.704 | n/a | n/a | 100 |
| /movie/:movieKey | 2028 | 2.332 | 143.467 | 240.124 | 290.509 | 138.305 | 197.542 | 99.753 |
| /person/:personKey | 1572 | 1.808 | 71.866 | 187.019 | 250.875 | 33.662 | 141.903 | 100 |
| /show/:showKey | 143 | 0.164 | 147.802 | 270.208 | 294.042 | 138.739 | 197.928 | 100 |
| static | 91 | 0.105 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 37 | 0.043 | 185 | 2225 | 4445 | n/a | n/a | 81.081 |
| / | 14 | 0.016 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/poster-impressions | 7 | 0.008 | 43.75 | 94.167 | 98.833 | n/a | n/a | 100 |
| /discover/:type? | 2 | 0.002 | 100 | 190 | 198 | 100 | 190 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 2042 | 269 | 1773 | 86.827 | 133.509 | 193.758 |
| related-cards | 726 | 181 | 545 | 75.069 | 70.266 | 98.585 |
| genres-movie | 1 | 1 | 0 | 0 | n/a | n/a |
| person-profile-v2 | 1560 | 453 | 1107 | 70.962 | 63.5 | 164.866 |
| person-fingerprint-baseline | 1107 | 1107 | 0 | 0 | n/a | n/a |
| details-show-v2 | 146 | 27 | 119 | 81.507 | 139.286 | 193.929 |
| episode-grid | 146 | 24 | 119 | 83.562 | 25.63 | 48.697 |
| movie-collection | 104 | 28 | 76 | 73.077 | 25 | 47.5 |
| share-list-view-v1 | 38680 | 38559 | 1 | 0.313 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 2102 | 2.417 | 1.884 |
| grpc /qdrant.Points/UpdateBatch 0 | 14 | 0.016 | 26.706 |
| grpc /qdrant.Points/Recommend 0 | 2100 | 2.415 | 25.991 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 102.809 req/s, of which 13.853 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 51.533 | 0 | 31.945 | 89.596 | 7 | 102.618 | 2252.438 |
| 10.0.0.20 | 392439b7 | 51.209 | 0 | 34.993 | 95.267 | 24 | 205.313 | 2274.824 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 0 | 0 | 0 | 2042 | 0 |
| 10.0.0.21 | /discover/:type? | 0 | 0 | 0 | 30 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 1572 | 0 |
| 10.0.0.21 | /show/:showKey | 0 | 1 | 0 | 145 | 0 |
| 10.0.0.21 | / | 13 | 1 | 0 | 0 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 5 | 0 |
| 10.0.0.21 | /explore/:type/:category/:text | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 0 | 0 | 1735 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 172 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 1663 | 0 |
| 10.0.0.20 | / | 14 | 1 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 29 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 6 | 0 |
| 10.0.0.20 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /sign-up | 0 | 0 | 0 | 3 | 0 |
