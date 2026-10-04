# 20261004T212523Z-load-checkpoint-latency-cold

Label: checkpoint-latency-cold. Time: 2026-10-04T21:25:48.103Z. Target: https://goodwatch.app. Path: private. Cache: cold. URL set: surfaces. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 2 req/s for 150 s.

299 requests; 1.993 req/s; 0% errors; p95 131.625 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 41 | 0.273 | 0 | 5.952 | 184.49 | 202.385 | 5.107 | 183.311 | 201.178 | 41/0/0/0/0 |
| home | 37 | 0.247 | 0 | 6.649 | 60.027 | 77.787 | 5.751 | 53.408 | 76.386 | 37/0/0/0/0 |
| og_share_list | 33 | 0.22 | 0 | 11.004 | 21.273 | 32.774 | 7.999 | 14.088 | 26.287 | 33/0/0/0/0 |
| og_title | 34 | 0.227 | 0 | 11.055 | 27.434 | 36.062 | 8.525 | 24.993 | 34.189 | 34/0/0/0/0 |
| person | 37 | 0.247 | 0 | 9.961 | 60.671 | 66.167 | 8.819 | 59.466 | 64.806 | 37/0/0/0/0 |
| share_list | 38 | 0.253 | 0 | 33.749 | 93.933 | 107.223 | 32.872 | 87.784 | 95.65 | 38/0/0/0/0 |
| title_movie | 39 | 0.26 | 0 | 8.505 | 201.507 | 278.016 | 5.516 | 199.607 | 275.804 | 39/0/0/0/0 |
| title_show | 40 | 0.267 | 0 | 8.373 | 236.45 | 242.928 | 6.228 | 234.854 | 241.117 | 40/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 299 | 1.993 | 0 | 11.379 | 131.625 | 236.389 | 8.739 | 130.415 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 30 | 14.55 | 23.473 | 1.094 | 1.57 | 34.494 | 4.076 | 4.664 | 6.159 | 8 |
| pgnode01 | data | 16 | 30 | 7.087 | 10.821 | 1.51 | 2.18 | 70.456 | 2.713 | 3.437 | 13.339 | 11 |
| pgnode02 | data | 16 | 30 | 7.158 | 11.814 | 0.879 | 1.9 | 71.575 | 4.358 | 5.22 | 70.906 | 14 |
| pgnode03 | data | 16 | 30 | 8.921 | 13.891 | 1.88 | 2.54 | 65.498 | 0.091 | 0.105 | 0.145 | 3 |
| gw-cache1 | data | 8 | 30 | 10.183 | 24.528 | 0.641 | 0.98 | 35.494 | 16.984 | 1.61 | 4.893 | 8 |
| gw-cache2 | data | 8 | 30 | 4.611 | 18.739 | 0.24 | 0.58 | 33.558 | 0.558 | 0.478 | 0.936 | 7 |
| gw-cache3 | data | 8 | 29 | 2.028 | 5.655 | 0.266 | 0.5 | 33.803 | 0.512 | 0.45 | 1.102 | 9 |
| gw-vector1 | target | 16 | 30 | 10.466 | 15.674 | 1.347 | 1.68 | 49.121 | 0.112 | 0.202 | 0.415 | 6 |
| gw-worker3 | generator | 4 | 30 | 4.626 | 13.7 | 0.275 | 0.41 | 19.365 | 0.082 | 0.09 | 0.144 | 22 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 23.907 | 44.75 | 2271.369 | 2305.024 |
| abusive | coolify-proxy | 32.543 | 51.22 | 93.661 | 95.4 |
| gw-vector1 | gk4owk8-181159928589 | 42.447 | 156.85 | 2264.303 | 2269.184 |
| gw-vector1 | coolify-proxy | 3.697 | 8.27 | 39.691 | 40.14 |
| gw-vector1 | qdrant-main | 36.654 | 86.97 | 4062.891 | 4072.448 |

## Webapp process

From the webapp's own counters over 153.54 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 7.646 req/s in total: 1.947 from the benchmark and 5.699 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 0.633 on average, 2 at most. Event loop delay: 102.29 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 17.973 | 28.843 |
| webapp V8Worker | 3.833 | 28.843 |
| webapp libuv-worker | 3.021 | 5.148 |
| proxy | 30.944 | 40.787 |

The proxy accepted 11.974 connections per second on average, 15.66 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /person/:personKey | 375 | 2.442 | 69.275 | 190.979 | 262.5 | 34.981 | 162.36 | 100 |
| /movie/:movieKey | 245 | 1.596 | 136.89 | 235.526 | 287.105 | 131.928 | 198.614 | 100 |
| /show/:showKey | 54 | 0.352 | 112.5 | 255 | 291 | 112 | 246 | 100 |
| /discover/:type? | 23 | 0.15 | 38.333 | 171.25 | 194.25 | 38.333 | 171.25 | 100 |
| /u/:handle/lists/:id | 17 | 0.111 | 26.563 | 57.5 | 91.5 | 26.563 | 57.5 | 100 |
| /og/lists/:id/:file | 17 | 0.111 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /og/:first/:second | 16 | 0.104 | 28.571 | 600 | 920 | n/a | n/a | 87.5 |
| / | 14 | 0.091 | 26.923 | 65 | 93 | 25 | 47.5 | 100 |
| /api/e | 4 | 0.026 | 150 | 285 | 297 | n/a | n/a | 100 |
| static | 2 | 0.013 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /sign-in | 1 | 0.007 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /how-it-works | 1 | 0.007 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 239 | 43 | 196 | 82.008 | 132.534 | 193.253 |
| related-cards | 115 | 31 | 84 | 73.043 | 70.896 | 99.104 |
| person-profile-v2 | 358 | 112 | 246 | 68.715 | 69.215 | 174.796 |
| person-fingerprint-baseline | 246 | 246 | 0 | 0 | n/a | n/a |
| details-show-v2 | 41 | 11 | 30 | 73.171 | 144.444 | 194.444 |
| episode-grid | 41 | 12 | 29 | 70.732 | 27.885 | 75.833 |
| movie-collection | 17 | 8 | 9 | 52.941 | 25 | 47.5 |
| share-list-view-v1 | 31 | 27 | 1 | 12.903 | 25 | 47.5 |
| share-list-availability-v1 | 14 | 13 | 1 | 7.143 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 420 | 2.735 | 1.38 |
| grpc /qdrant.Points/Recommend 0 | 418 | 2.722 | 24.754 |
| grpc /qdrant.Points/UpdateBatch 0 | 4 | 0.026 | 29.597 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 17.214 req/s, of which 15.266 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 7.646 | 0 | 17.973 | 28.843 | 2 | 102.29 | 2255.336 |
| 10.0.0.20 | 392439b7 | 9.567 | 0 | 27.595 | 43.353 | 3 | 117.495 | 2277.531 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 8 | 0 | 0 | 237 | 0 |
| 10.0.0.21 | / | 7 | 0 | 0 | 7 | 0 |
| 10.0.0.21 | /discover/:type? | 15 | 0 | 0 | 31 | 0 |
| 10.0.0.21 | /person/:personKey | 6 | 0 | 0 | 368 | 0 |
| 10.0.0.21 | /show/:showKey | 13 | 0 | 0 | 41 | 0 |
| 10.0.0.21 | /u/:handle/lists/:id | 3 | 0 | 0 | 14 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /how-it-works | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 21 | 0 | 0 | 8 | 0 |
| 10.0.0.20 | /movie/:movieKey | 18 | 0 | 0 | 474 | 0 |
| 10.0.0.20 | /show/:showKey | 11 | 0 | 0 | 40 | 0 |
| 10.0.0.20 | /person/:personKey | 14 | 0 | 0 | 413 | 0 |
| 10.0.0.20 | /discover/:type? | 10 | 0 | 0 | 22 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 3 | 0 | 0 | 18 | 0 |
| 10.0.0.20 | /taste/quiz | 0 | 0 | 0 | 1 | 0 |
