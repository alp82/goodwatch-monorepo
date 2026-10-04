# 20261004T192308Z-load-checkpoint-surface-title-show

Label: checkpoint-surface-title-show. Time: 2026-10-04T19:23:33.548Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s, then 80 req/s for 35 s, then 100 req/s for 35 s, then 125 req/s for 35 s, then 150 req/s for 35 s, then 200 req/s for 35 s, then 250 req/s for 35 s, then 300 req/s for 35 s, then 400 req/s for 35 s, then 500 req/s for 35 s.

90472 requests; 89.573 req/s; 0% errors; p95 21.721 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_show | 90472 | 89.573 | 0 | 4.807 | 21.721 | 85.189 | 3.395 | 19.858 | 82.709 | 90472/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 5.657 | 11.263 | 22.414 | 3.963 | 9.311 |
| s02 | 2 | 68 | 1.943 | 0 | 5.308 | 21.543 | 27.377 | 3.466 | 19.59 |
| s03 | 4 | 135 | 3.857 | 0 | 5.26 | 20.78 | 40.818 | 3.94 | 19.51 |
| s04 | 6 | 205 | 5.857 | 0 | 5.396 | 18.376 | 36.386 | 3.948 | 16.958 |
| s05 | 8 | 275 | 7.857 | 0 | 5.465 | 13.679 | 31.193 | 4.114 | 12.071 |
| s06 | 10 | 345 | 9.857 | 0 | 5.335 | 15.012 | 40.523 | 4.102 | 13.655 |
| s07 | 12 | 415 | 11.857 | 0 | 5.017 | 13.237 | 25.254 | 3.705 | 12.13 |
| s08 | 14 | 485 | 13.857 | 0 | 5.571 | 15.983 | 37.301 | 4.24 | 14.697 |
| s09 | 16 | 555 | 15.857 | 0 | 5.578 | 11.646 | 24.736 | 4.208 | 9.829 |
| s10 | 18 | 625 | 17.857 | 0 | 5.586 | 15.474 | 36.612 | 4.208 | 13.684 |
| s11 | 20 | 695 | 19.857 | 0 | 5.634 | 15.125 | 37.115 | 4.184 | 12.911 |
| s12 | 25 | 862 | 24.629 | 0 | 5.334 | 16.77 | 38.092 | 4.051 | 15.352 |
| s13 | 30 | 1038 | 29.657 | 0 | 5.603 | 16.864 | 38.075 | 4.126 | 15.077 |
| s14 | 35 | 1212 | 34.629 | 0 | 5.446 | 17.436 | 36.387 | 4.016 | 16.061 |
| s15 | 40 | 1387 | 39.629 | 0 | 5.43 | 21.073 | 41.495 | 3.99 | 19.55 |
| s16 | 45 | 1563 | 44.657 | 0 | 5.488 | 14.694 | 36.63 | 4.024 | 13.091 |
| s17 | 50 | 1737 | 49.629 | 0 | 5.306 | 15.213 | 30.137 | 3.948 | 13.458 |
| s18 | 55 | 1913 | 54.657 | 0 | 5.392 | 15.893 | 40.447 | 3.908 | 14.338 |
| s19 | 60 | 2087 | 59.629 | 0 | 5.345 | 15.296 | 31.563 | 3.966 | 13.541 |
| s20 | 65 | 2262 | 64.629 | 0 | 5.42 | 16.188 | 40.515 | 4.011 | 14.629 |
| s21 | 80 | 2763 | 78.943 | 0 | 5.246 | 15.508 | 39.086 | 3.88 | 13.872 |
| s22 | 100 | 3449 | 98.543 | 0 | 5.231 | 16.856 | 35.648 | 3.835 | 15.36 |
| s23 | 125 | 4313 | 123.229 | 0 | 4.989 | 14.415 | 33.948 | 3.692 | 12.969 |
| s24 | 150 | 5187 | 148.2 | 0 | 5.2 | 24.128 | 239.792 | 3.823 | 22.524 |
| s25 | 200 | 6874 | 196.4 | 0 | 4.924 | 17.009 | 41.886 | 3.587 | 15.334 |
| s26 | 250 | 8624 | 246.4 | 0 | 4.73 | 17.099 | 37.816 | 3.417 | 15.41 |
| s27 | 300 | 10374 | 296.4 | 0 | 4.512 | 15.573 | 37.2 | 3.185 | 13.906 |
| s28 | 400 | 13749 | 392.829 | 0 | 4.547 | 51.51 | 1597.144 | 3.148 | 48.929 |
| s29 | 500 | 17246 | 492.743 | 0 | 4.391 | 26.213 | 59.673 | 3.066 | 23.764 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 201 | 19.371 | 40.864 | 1.569 | 3.16 | 33.791 | 24.21 | 40.577 | 212.12 | 10 |
| pgnode01 | data | 16 | 201 | 7.361 | 15.46 | 1.802 | 6.2 | 70.445 | 2.914 | 4.574 | 67.768 | 13 |
| pgnode02 | data | 16 | 201 | 8.197 | 20.837 | 1.886 | 4.54 | 71.624 | 4.777 | 3.878 | 72.273 | 14 |
| pgnode03 | data | 16 | 200 | 8.786 | 19.153 | 1.215 | 3.1 | 65.432 | 0.09 | 0.106 | 0.23 | 5 |
| gw-cache1 | data | 8 | 201 | 3.506 | 18.383 | 0.235 | 0.62 | 34.902 | 0.64 | 0.563 | 12.303 | 8 |
| gw-cache2 | data | 8 | 200 | 3.673 | 20.089 | 0.269 | 0.82 | 34.395 | 0.669 | 0.623 | 18.842 | 7 |
| gw-cache3 | data | 8 | 200 | 3.682 | 19.501 | 0.279 | 0.88 | 34.51 | 0.743 | 0.696 | 29.418 | 9 |
| gw-vector1 | target | 16 | 201 | 21.182 | 81.399 | 3.34 | 12.42 | 49.657 | 0.118 | 0.219 | 0.541 | 7 |
| gw-worker3 | generator | 4 | 201 | 10.522 | 36.462 | 0.429 | 1.14 | 25.859 | 0.081 | 0.093 | 0.188 | 503 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 36.75 | 251.72 | 2127.678 | 2203.648 |
| abusive | coolify-proxy | 59.498 | 162.76 | 139.38 | 246.9 |
| gw-vector1 | gk4owk8-181159928589 | 26.648 | 150.68 | 2173.825 | 2286.592 |
| gw-vector1 | coolify-proxy | 10.299 | 48.88 | 37.629 | 88.61 |
| gw-vector1 | qdrant-main | 217.901 | 1241.79 | 4687.495 | 5687.296 |

## Webapp process

From the webapp's own counters over 1015.32 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 53.24 req/s in total: 89.108 from the benchmark and -35.868 of background traffic, of which 0.002 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.275 on average, 5 at most. Event loop delay: 1024.382 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 26.381 | 57.092 |
| webapp V8Worker | 4.644 | 32.793 |
| webapp libuv-worker | 3.326 | 5.528 |
| proxy | 59.137 | 157.181 |

The proxy accepted 12.749 connections per second on average, 20.816 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /show/:showKey | 45524 | 44.837 | 25.168 | 47.818 | 49.832 | 25.155 | 47.795 | 99.985 |
| /person/:personKey | 3106 | 3.059 | 74.798 | 188.29 | 258.369 | 39.855 | 163.495 | 99.871 |
| /movie/:movieKey | 2477 | 2.44 | 146.661 | 248.498 | 292.928 | 142.073 | 199.284 | 99.637 |
| static | 130 | 0.128 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 36 | 0.035 | 168.75 | 446.667 | 820 | n/a | n/a | 88.889 |
| / | 21 | 0.021 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 7 | 0.007 | 183.333 | 430 | 486 | 183.333 | 430 | 85.714 |
| /api/poster-impressions | 6 | 0.006 | 37.5 | 92.5 | 98.5 | n/a | n/a | 100 |
| /:type/:category/:page | 3 | 0.003 | 750 | 1850 | 1970 | 750 | 1850 | 33.333 |
| /api/living-room/picks | 1 | 0.001 | 150 | 285 | 297 | n/a | n/a | 100 |
| /api/discover/results | 1 | 0.001 | 100 | 190 | 198 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 2500 | 243 | 2257 | 90.28 | 133.074 | 193.846 |
| related-cards | 980 | 155 | 825 | 84.184 | 72.989 | 131.4 |
| genres-movie | 2 | 2 | 0 | 0 | n/a | n/a |
| person-profile-v2 | 3093 | 738 | 2355 | 76.14 | 63.724 | 166.435 |
| person-fingerprint-baseline | 2355 | 2355 | 0 | 0 | n/a | n/a |
| details-show-v2 | 318 | 49 | 269 | 84.591 | 139.773 | 194.795 |
| episode-grid | 318 | 50 | 264 | 84.277 | 25.67 | 48.774 |
| movie-collection | 237 | 84 | 153 | 64.557 | 25 | 47.5 |
| media_fingerprint_v1:discover | 3 | 0 | 3 | 100 | 750 | 1850 |
| streaming-providers | 1 | 1 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 3238 | 3.189 | 2.929 |
| grpc /qdrant.Points/Recommend 0 | 3004 | 2.959 | 30.628 |
| grpc /qdrant.Points/UpdateBatch 0 | 57 | 0.056 | 1091.035 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 104.34 req/s, of which 15.232 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 53.24 | 0 | 26.381 | 57.092 | 5 | 1024.382 | 2253.398 |
| 10.0.0.20 | 392439b7 | 51.096 | 0 | 22.225 | 73.031 | 4 | 1159.648 | 2359.195 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 1 | 0 | 0 | 2500 | 0 |
| 10.0.0.21 | /discover/:type? | 0 | 1 | 0 | 44 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 3107 | 0 |
| 10.0.0.21 | /show/:showKey | 45206 | 0 | 0 | 318 | 0 |
| 10.0.0.21 | / | 21 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /:type | 0 | 0 | 0 | 9 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 11 | 0 |
| 10.0.0.21 | /:type/:category/:page | 0 | 0 | 0 | 5 | 0 |
| 10.0.0.21 | static | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /:type/:category | 0 | 0 | 0 | 6 | 0 |
| 10.0.0.20 | / | 18 | 0 | 0 | 3 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 0 | 0 | 1844 | 0 |
| 10.0.0.20 | /show/:showKey | 45267 | 3 | 0 | 274 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 1697 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 28 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 5 | 0 |
| 10.0.0.20 | /:type | 0 | 0 | 0 | 8 | 0 |
| 10.0.0.20 | /:type/:category/:page | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-up | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /:type/:category | 0 | 0 | 0 | 2 | 0 |
