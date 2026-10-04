# 20261004T184436Z-load-checkpoint-surface-home

Label: checkpoint-surface-home. Time: 2026-10-04T18:45:00.558Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s, then 80 req/s for 35 s, then 100 req/s for 35 s, then 125 req/s for 35 s, then 150 req/s for 35 s, then 200 req/s for 35 s, then 250 req/s for 35 s, then 300 req/s for 35 s, then 400 req/s for 35 s, then 500 req/s for 35 s.

90469 requests; 89.569 req/s; 0% errors; p95 18.119 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home | 90469 | 89.569 | 0 | 4.267 | 18.119 | 40.653 | 3.466 | 17.171 | 39.723 | 90469/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 4.372 | 7.413 | 11.382 | 3.656 | 6.026 |
| s02 | 2 | 68 | 1.943 | 0 | 4.397 | 7.183 | 130.117 | 3.733 | 6.335 |
| s03 | 4 | 135 | 3.857 | 0 | 4.386 | 16.114 | 26.18 | 3.499 | 15.512 |
| s04 | 6 | 205 | 5.857 | 0 | 4.729 | 24.229 | 37.518 | 3.845 | 23.488 |
| s05 | 8 | 275 | 7.857 | 0 | 5.065 | 15.569 | 35.911 | 4.233 | 14.844 |
| s06 | 10 | 345 | 9.857 | 0 | 5.102 | 17.644 | 48.151 | 4.237 | 16.936 |
| s07 | 12 | 415 | 11.857 | 0 | 4.762 | 17.778 | 35.825 | 3.962 | 17.092 |
| s08 | 14 | 485 | 13.857 | 0 | 4.94 | 22.103 | 37.77 | 4.188 | 21.061 |
| s09 | 16 | 555 | 15.857 | 0 | 5.124 | 19.627 | 36.952 | 4.231 | 18.436 |
| s10 | 18 | 625 | 17.857 | 0 | 5.269 | 20.746 | 41.595 | 4.403 | 19.848 |
| s11 | 20 | 695 | 19.857 | 0 | 5.085 | 15.431 | 29.898 | 4.24 | 13.961 |
| s12 | 25 | 862 | 24.629 | 0 | 5.034 | 15.535 | 37.802 | 4.152 | 14.449 |
| s13 | 30 | 1037 | 29.629 | 0 | 4.774 | 15.494 | 33.03 | 4.022 | 14.474 |
| s14 | 35 | 1213 | 34.657 | 0 | 4.817 | 14.588 | 34.382 | 4.04 | 13.723 |
| s15 | 40 | 1387 | 39.629 | 0 | 4.963 | 16.546 | 32.767 | 4.139 | 15.637 |
| s16 | 45 | 1562 | 44.629 | 0 | 4.922 | 15.52 | 30.361 | 4.129 | 14.477 |
| s17 | 50 | 1738 | 49.657 | 0 | 4.953 | 15.98 | 42.918 | 4.095 | 15.173 |
| s18 | 55 | 1912 | 54.629 | 0 | 4.847 | 18.927 | 40.758 | 4.062 | 18 |
| s19 | 60 | 2088 | 59.657 | 0 | 4.978 | 17.949 | 39.199 | 4.191 | 16.988 |
| s20 | 65 | 2262 | 64.629 | 0 | 4.747 | 15.749 | 27.773 | 3.966 | 14.799 |
| s21 | 80 | 2762 | 78.914 | 0 | 4.65 | 17.784 | 39.188 | 3.899 | 17.035 |
| s22 | 100 | 3450 | 98.571 | 0 | 4.812 | 16.122 | 37.097 | 4.092 | 15.31 |
| s23 | 125 | 4312 | 123.2 | 0 | 4.723 | 17.454 | 36.95 | 3.938 | 16.648 |
| s24 | 150 | 5187 | 148.2 | 0 | 4.621 | 17.532 | 37.395 | 3.811 | 16.632 |
| s25 | 200 | 6873 | 196.371 | 0 | 4.513 | 18.637 | 43.163 | 3.752 | 17.765 |
| s26 | 250 | 8624 | 246.4 | 0 | 4.399 | 19.835 | 66.104 | 3.59 | 18.619 |
| s27 | 300 | 10374 | 296.4 | 0 | 4.144 | 18.548 | 42.047 | 3.423 | 17.603 |
| s28 | 400 | 13748 | 392.8 | 0 | 3.917 | 15.781 | 33.209 | 3.176 | 14.924 |
| s29 | 500 | 17246 | 492.743 | 0 | 3.868 | 21.373 | 44.946 | 3.069 | 20.354 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 201 | 18.089 | 39.372 | 1.579 | 3.35 | 33.648 | 11.177 | 16.347 | 75.312 | 10 |
| pgnode01 | data | 16 | 201 | 7.765 | 12.889 | 1.54 | 3.53 | 70.438 | 2.741 | 4.295 | 66.699 | 11 |
| pgnode02 | data | 16 | 201 | 8.638 | 16.01 | 1.026 | 2.81 | 71.553 | 3.612 | 3.894 | 72.974 | 14 |
| pgnode03 | data | 16 | 200 | 9.957 | 18.332 | 1.051 | 2.83 | 65.435 | 0.096 | 0.12 | 1.438 | 3 |
| gw-cache1 | data | 8 | 201 | 3.692 | 20.533 | 0.22 | 0.67 | 35.105 | 0.469 | 0.341 | 1.379 | 8 |
| gw-cache2 | data | 8 | 200 | 3.046 | 16.708 | 0.225 | 0.58 | 34.626 | 0.479 | 0.318 | 1.806 | 7 |
| gw-cache3 | data | 8 | 200 | 3.352 | 18.711 | 0.288 | 0.96 | 34.736 | 0.452 | 0.317 | 2.158 | 9 |
| gw-vector1 | target | 16 | 201 | 10.481 | 21.717 | 1.76 | 3.27 | 48.272 | 0.13 | 0.217 | 0.518 | 8 |
| gw-worker3 | generator | 4 | 201 | 11.701 | 49.558 | 0.408 | 1.31 | 26.245 | 1.826 | 0.201 | 2.386 | 503 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 33.517 | 129.58 | 2116.695 | 2150.4 |
| abusive | coolify-proxy | 53.989 | 149.71 | 134.186 | 168.3 |
| gw-vector1 | gk4owk8-181159928589 | 33.446 | 155.02 | 2092.669 | 2102.272 |
| gw-vector1 | coolify-proxy | 10.656 | 47.6 | 35.379 | 46.36 |
| gw-vector1 | qdrant-main | 38.727 | 104.54 | 4044.754 | 4052.992 |

## Webapp process

From the webapp's own counters over 1014.959 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 52.274 req/s in total: 89.137 from the benchmark and -36.863 of background traffic, of which 0.002 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.005 on average, 4 at most. Event loop delay: 178.181 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 24.599 | 45.656 |
| webapp V8Worker | 3.907 | 20.095 |
| webapp libuv-worker | 3.143 | 5.36 |
| proxy | 51.884 | 136.881 |

The proxy accepted 12.495 connections per second on average, 22.656 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | 45159 | 44.493 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /movie/:movieKey | 2534 | 2.497 | 145.237 | 225.636 | 287.067 | 141.044 | 197.399 | 99.842 |
| /person/:personKey | 1937 | 1.908 | 73.206 | 184.241 | 199.925 | 35.663 | 147.92 | 99.897 |
| /show/:showKey | 783 | 0.771 | 151.157 | 260.479 | 293.798 | 144.811 | 206.429 | 99.745 |
| static | 175 | 0.172 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 44 | 0.043 | 183.333 | 966.667 | 7800 | n/a | n/a | 81.818 |
| /discover/:type? | 10 | 0.01 | 166.667 | 400 | 480 | 166.667 | 400 | 90 |
| /api/poster-impressions | 4 | 0.004 | 50 | 95 | 99 | n/a | n/a | 100 |
| /sign-in | 3 | 0.003 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/discover/results | 1 | 0.001 | 150 | 285 | 297 | n/a | n/a | 100 |
| /:type/:category | 1 | 0.001 | 250 | 475 | 495 | 250 | 475 | 0 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 2567 | 239 | 2328 | 90.69 | 132.605 | 193.628 |
| related-cards | 1162 | 194 | 968 | 83.305 | 68.889 | 97.359 |
| genres-movie | 16 | 16 | 0 | 0 | n/a | n/a |
| person-profile-v2 | 1921 | 533 | 1388 | 72.254 | 64.663 | 157.436 |
| person-fingerprint-baseline | 1388 | 1388 | 0 | 0 | n/a | n/a |
| details-show-v2 | 787 | 80 | 707 | 89.835 | 136.552 | 193.98 |
| episode-grid | 787 | 114 | 658 | 85.515 | 25.924 | 49.257 |
| movie-collection | 124 | 32 | 92 | 74.194 | 25.556 | 48.556 |
| media_fingerprint_v1:discover | 16 | 0 | 16 | 100 | 150 | 340 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 3794 | 3.738 | 1.545 |
| grpc /qdrant.Points/UpdateBatch 0 | 22 | 0.022 | 27.991 |
| grpc /qdrant.Points/Recommend 0 | 3758 | 3.703 | 24.527 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 104 req/s, of which 14.864 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 52.274 | 0 | 24.599 | 45.656 | 4 | 178.181 | 2157.324 |
| 10.0.0.20 | 392439b7 | 51.691 | 0 | 25.794 | 49.536 | 6 | 407.033 | 2160.805 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 0 | 0 | 0 | 2567 | 0 |
| 10.0.0.21 | /discover/:type? | 1 | 0 | 0 | 33 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 1939 | 0 |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 787 | 0 |
| 10.0.0.21 | / | 45159 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 19 | 0 |
| 10.0.0.21 | static | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.21 | /sign-in | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.21 | /:type/:category | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /movie/:movieKey | 1 | 0 | 0 | 2333 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 735 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 1733 | 0 |
| 10.0.0.20 | / | 45347 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 1 | 0 | 28 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 22 | 0 |
| 10.0.0.20 | /:type/:category/:page | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.20 | /sign-up | 0 | 0 | 0 | 1 | 0 |
