# 20261004T202649Z-load-checkpoint-surface-share-list

Label: checkpoint-surface-share-list. Time: 2026-10-04T20:27:13.689Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s, then 80 req/s for 35 s, then 100 req/s for 35 s, then 125 req/s for 35 s, then 150 req/s for 35 s, then 200 req/s for 35 s, then 250 req/s for 35 s, then 300 req/s for 35 s, then 400 req/s for 35 s, then 500 req/s for 35 s.

90469 requests; 89.565 req/s; 0% errors; p95 20.478 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| share_list | 90469 | 89.565 | 0 | 4.4 | 20.478 | 41.554 | 3.511 | 19.42 | 40.396 | 90469/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 5.243 | 32.144 | 41.034 | 4.341 | 30.89 |
| s02 | 2 | 68 | 1.943 | 0 | 5.159 | 24.839 | 45.428 | 4.031 | 23.658 |
| s03 | 4 | 135 | 3.857 | 0 | 4.823 | 18.864 | 33.945 | 3.836 | 17.799 |
| s04 | 6 | 205 | 5.857 | 0 | 4.39 | 13.928 | 37.395 | 3.474 | 12.979 |
| s05 | 8 | 275 | 7.857 | 0 | 5.007 | 24.832 | 46.714 | 4.125 | 23.863 |
| s06 | 10 | 345 | 9.857 | 0 | 4.939 | 21.052 | 37.356 | 4.049 | 20.155 |
| s07 | 12 | 415 | 11.857 | 0 | 5.021 | 24.966 | 43.734 | 4.178 | 23.881 |
| s08 | 14 | 485 | 13.857 | 0 | 5.056 | 17.192 | 35.739 | 4.142 | 16.427 |
| s09 | 16 | 555 | 15.857 | 0 | 5.038 | 20.777 | 42.374 | 4.173 | 19.785 |
| s10 | 18 | 625 | 17.857 | 0 | 5.084 | 19.988 | 40.265 | 4.216 | 19.044 |
| s11 | 20 | 695 | 19.857 | 0 | 5 | 20.834 | 43.309 | 4.135 | 20.052 |
| s12 | 25 | 862 | 24.629 | 0 | 5.205 | 21.191 | 40.956 | 4.252 | 20.139 |
| s13 | 30 | 1037 | 29.629 | 0 | 5.161 | 18.583 | 35.189 | 4.249 | 17.672 |
| s14 | 35 | 1213 | 34.657 | 0 | 5.043 | 23.807 | 45.026 | 4.13 | 22.959 |
| s15 | 40 | 1387 | 39.629 | 0 | 4.957 | 21.556 | 45.324 | 4.029 | 20.782 |
| s16 | 45 | 1563 | 44.657 | 0 | 4.858 | 19.487 | 35.724 | 3.977 | 18.465 |
| s17 | 50 | 1737 | 49.629 | 0 | 5.092 | 20.179 | 39.446 | 4.195 | 19.078 |
| s18 | 55 | 1912 | 54.629 | 0 | 5.077 | 20.61 | 35.391 | 4.173 | 19.711 |
| s19 | 60 | 2088 | 59.657 | 0 | 5.046 | 20.96 | 36.233 | 4.155 | 19.966 |
| s20 | 65 | 2262 | 64.629 | 0 | 5.165 | 22.79 | 62.141 | 4.23 | 21.324 |
| s21 | 80 | 2762 | 78.914 | 0 | 4.89 | 18.965 | 37.504 | 3.998 | 17.88 |
| s22 | 100 | 3450 | 98.571 | 0 | 4.898 | 20.604 | 40.201 | 3.958 | 19.505 |
| s23 | 125 | 4312 | 123.2 | 0 | 4.689 | 19.004 | 36.488 | 3.809 | 18.082 |
| s24 | 150 | 5187 | 148.2 | 0 | 4.72 | 20.398 | 39.386 | 3.839 | 19.157 |
| s25 | 200 | 6874 | 196.4 | 0 | 4.504 | 18.583 | 38.465 | 3.671 | 17.602 |
| s26 | 250 | 8624 | 246.4 | 0 | 4.424 | 22.134 | 42.547 | 3.563 | 21.272 |
| s27 | 300 | 10373 | 296.371 | 0 | 4.397 | 21.718 | 42.476 | 3.525 | 20.654 |
| s28 | 400 | 13748 | 392.8 | 0 | 4.096 | 16.97 | 34.745 | 3.261 | 15.774 |
| s29 | 500 | 17246 | 492.743 | 0 | 3.929 | 22.795 | 49.076 | 3.089 | 21.659 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 201 | 17.959 | 33.3 | 1.455 | 2.7 | 34.118 | 11.38 | 19.94 | 92.961 | 9 |
| pgnode01 | data | 16 | 201 | 9.835 | 48.051 | 1.653 | 4 | 70.442 | 8.625 | 13.669 | 678.94 | 13 |
| pgnode02 | data | 16 | 200 | 11.482 | 66.224 | 1.306 | 3.14 | 71.421 | 10.709 | 11.019 | 421.721 | 12 |
| pgnode03 | data | 16 | 200 | 13.105 | 30.239 | 3.043 | 6.94 | 65.762 | 2.729 | 0.293 | 2.666 | 5 |
| gw-cache1 | data | 8 | 201 | 3.321 | 17.158 | 0.259 | 0.65 | 34.693 | 0.593 | 0.379 | 1.693 | 8 |
| gw-cache2 | data | 8 | 200 | 2.991 | 18.534 | 0.211 | 0.63 | 34.135 | 0.557 | 0.428 | 1.349 | 7 |
| gw-cache3 | data | 8 | 201 | 3.125 | 19.588 | 0.224 | 0.58 | 34.496 | 0.557 | 0.302 | 1.781 | 9 |
| gw-vector1 | target | 16 | 200 | 11.767 | 24.031 | 2.431 | 5.57 | 48.643 | 0.119 | 0.222 | 0.999 | 7 |
| gw-worker3 | generator | 4 | 201 | 9.708 | 32.207 | 0.327 | 1.08 | 25.708 | 0.076 | 0.09 | 0.272 | 503 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 34.647 | 129.37 | 2182.552 | 2194.432 |
| abusive | coolify-proxy | 58.225 | 144.77 | 135.9 | 161.2 |
| gw-vector1 | gk4owk8-181159928589 | 43.378 | 197.16 | 2212.972 | 2291.712 |
| gw-vector1 | coolify-proxy | 11.193 | 45.99 | 39.79 | 47.7 |
| gw-vector1 | qdrant-main | 52.68 | 155.23 | 4045.583 | 4059.136 |

## Webapp process

From the webapp's own counters over 1014.325 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 52.016 req/s in total: 89.192 from the benchmark and -37.176 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.225 on average, 10 at most. Event loop delay: 179.885 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 25.696 | 48.563 |
| webapp V8Worker | 4.405 | 24.178 |
| webapp libuv-worker | 3.44 | 5.75 |
| proxy | 56.213 | 136.746 |

The proxy accepted 13.674 connections per second on average, 21.762 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /u/:handle/lists/:id | 45259 | 44.62 | 25.001 | 47.501 | 49.501 | 25.001 | 47.501 | 100 |
| /movie/:movieKey | 2308 | 2.275 | 150.837 | 287.692 | 1930.667 | 144.983 | 266.937 | 96.317 |
| /person/:personKey | 1832 | 1.806 | 73.549 | 195.576 | 295.857 | 34.986 | 159.854 | 99.127 |
| /show/:showKey | 839 | 0.827 | 154.03 | 288.333 | 2483 | 147.619 | 271.509 | 96.544 |
| static | 131 | 0.129 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 30 | 0.03 | 204.545 | 1750 | 8500 | n/a | n/a | 73.333 |
| / | 20 | 0.02 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 5 | 0.005 | 166.667 | 875 | 975 | 166.667 | 875 | 80 |
| /api/poster-impressions | 5 | 0.005 | 75 | 275 | 295 | n/a | n/a | 100 |
| /sign-up | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/discover/results | 1 | 0.001 | 150 | 285 | 297 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 2335 | 224 | 2111 | 90.407 | 138.217 | 198.694 |
| related-cards | 1401 | 203 | 1198 | 85.51 | 69.937 | 98.37 |
| person-profile-v2 | 1815 | 521 | 1294 | 71.295 | 67.058 | 179.458 |
| person-fingerprint-baseline | 1294 | 1294 | 0 | 0 | n/a | n/a |
| details-show-v2 | 842 | 91 | 751 | 89.192 | 137.207 | 198.099 |
| episode-grid | 842 | 125 | 713 | 85.154 | 26.634 | 68.523 |
| movie-collection | 167 | 40 | 127 | 76.048 | 25.4 | 48.26 |
| share-list-view-v1 | 101 | 65 | 1 | 35.644 | 25.714 | 48.857 |
| share-list-availability-v1 | 101 | 101 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 4908 | 4.839 | 24.646 |
| grpc /qdrant.Points/Get 0 | 4944 | 4.874 | 1.734 |
| grpc /qdrant.Points/UpdateBatch 0 | 23 | 0.023 | 42.563 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 104.781 req/s, of which 15.589 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 52.016 | 0 | 25.696 | 48.563 | 10 | 179.885 | 2236.813 |
| 10.0.0.20 | 392439b7 | 52.763 | 0 | 31.283 | 53.999 | 9 | 235.066 | 2260.988 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 0 | 0 | 0 | 2335 | 0 |
| 10.0.0.21 | /discover/:type? | 0 | 0 | 0 | 28 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 1832 | 0 |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 842 | 0 |
| 10.0.0.21 | / | 19 | 1 | 0 | 0 | 0 |
| 10.0.0.21 | /u/:handle/lists/:id | 45031 | 226 | 0 | 2 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 8 | 0 |
| 10.0.0.21 | /sign-up | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 0 | 0 | 2989 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 793 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 2021 | 0 |
| 10.0.0.20 | / | 15 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 30 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 8 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 44958 | 254 | 0 | 2 | 0 |
| 10.0.0.20 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /how-it-works | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /:type/:category/:page | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /sign-up | 0 | 0 | 0 | 1 | 0 |
