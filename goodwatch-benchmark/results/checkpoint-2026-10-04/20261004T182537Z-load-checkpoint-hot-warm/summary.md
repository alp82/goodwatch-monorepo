# 20261004T182537Z-load-checkpoint-hot-warm

Label: checkpoint-hot-warm. Time: 2026-10-04T18:26:01.952Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s, then 80 req/s for 35 s, then 100 req/s for 35 s, then 125 req/s for 35 s, then 150 req/s for 35 s, then 200 req/s for 35 s, then 250 req/s for 35 s, then 300 req/s for 35 s, then 400 req/s for 35 s, then 500 req/s for 35 s.

90475 requests; 89.541 req/s; 0% errors; p95 17.561 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 6408 | 6.342 | 0 | 4.421 | 16.078 | 37.566 | 3.513 | 15.109 | 36.628 | 6408/0/0/0/0 |
| home | 4517 | 4.47 | 0 | 4.25 | 15.89 | 38.633 | 3.424 | 15.103 | 37.471 | 4517/0/0/0/0 |
| og_person | 903 | 0.894 | 0 | 9.938 | 25.965 | 46.493 | 7.833 | 23.983 | 44.448 | 903/0/0/0/0 |
| og_share_list | 900 | 0.891 | 0 | 10.817 | 33.781 | 60.989 | 8.011 | 30.553 | 58.605 | 900/0/0/0/0 |
| og_title | 3692 | 3.654 | 0 | 10.371 | 27.994 | 59.743 | 7.91 | 25.285 | 56.273 | 3692/0/0/0/0 |
| person | 4596 | 4.549 | 0 | 4.422 | 15.377 | 36.471 | 3.469 | 14.301 | 35.607 | 4596/0/0/0/0 |
| share_list | 8225 | 8.14 | 0 | 4.356 | 16.25 | 34.554 | 3.464 | 15.018 | 33.696 | 8225/0/0/0/0 |
| title_movie | 56771 | 56.185 | 0 | 4.835 | 16.933 | 36.523 | 3.469 | 15.185 | 34.694 | 56771/0/0/0/0 |
| title_show | 4463 | 4.417 | 0 | 4.857 | 15.876 | 33.644 | 3.458 | 14.25 | 32.156 | 4463/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 5.933 | 63.993 | 82.175 | 4.707 | 62.664 |
| s02 | 2 | 68 | 1.943 | 0 | 5.545 | 17.245 | 41.7 | 4.113 | 14.13 |
| s03 | 4 | 135 | 3.857 | 0 | 5.649 | 18.943 | 40.796 | 4.367 | 17.116 |
| s04 | 6 | 205 | 5.857 | 0 | 5.34 | 13.081 | 25.708 | 4.126 | 11.382 |
| s05 | 8 | 275 | 7.857 | 0 | 5.943 | 16.63 | 204.977 | 4.64 | 15.311 |
| s06 | 10 | 345 | 9.857 | 0 | 5.66 | 14.855 | 29.422 | 4.467 | 13.081 |
| s07 | 12 | 415 | 11.857 | 0 | 5.538 | 13.004 | 21.903 | 4.244 | 11.283 |
| s08 | 14 | 485 | 13.857 | 0 | 5.543 | 13.777 | 26.24 | 4.413 | 11.718 |
| s09 | 16 | 555 | 15.857 | 0 | 5.572 | 12.959 | 31.236 | 4.431 | 10.986 |
| s10 | 18 | 625 | 17.857 | 0 | 5.775 | 17.154 | 38.313 | 4.524 | 13.69 |
| s11 | 20 | 695 | 19.857 | 0 | 5.449 | 14.04 | 36.953 | 4.294 | 11.194 |
| s12 | 25 | 862 | 24.629 | 0 | 5.768 | 16.85 | 37.65 | 4.407 | 15.078 |
| s13 | 30 | 1038 | 29.657 | 0 | 5.441 | 14.619 | 25.426 | 4.214 | 12.613 |
| s14 | 35 | 1212 | 34.629 | 0 | 5.521 | 13.697 | 24.872 | 4.178 | 10.784 |
| s15 | 40 | 1387 | 39.629 | 0 | 5.489 | 15.685 | 33.11 | 4.275 | 12.996 |
| s16 | 45 | 1563 | 44.657 | 0 | 5.443 | 15.409 | 32.277 | 4.285 | 13.457 |
| s17 | 50 | 1737 | 49.629 | 0 | 5.522 | 14.368 | 32.198 | 4.311 | 12.338 |
| s18 | 55 | 1913 | 54.657 | 0 | 5.478 | 13.874 | 26.649 | 4.291 | 11.789 |
| s19 | 60 | 2087 | 59.629 | 0 | 5.414 | 15.485 | 31.011 | 4.235 | 13.532 |
| s20 | 65 | 2263 | 64.657 | 0 | 5.384 | 14.907 | 31.403 | 4.215 | 13.072 |
| s21 | 80 | 2762 | 78.914 | 0 | 5.304 | 16.518 | 34.794 | 4.122 | 15.173 |
| s22 | 100 | 3450 | 98.571 | 0 | 5.313 | 17.418 | 34.976 | 4.142 | 16 |
| s23 | 125 | 4312 | 123.2 | 0 | 5.168 | 19.651 | 36.302 | 4.028 | 17.979 |
| s24 | 150 | 5187 | 148.2 | 0 | 5.111 | 15.641 | 33.212 | 3.929 | 13.675 |
| s25 | 200 | 6875 | 196.429 | 0 | 4.775 | 17.643 | 37.663 | 3.655 | 16.162 |
| s26 | 250 | 8624 | 246.4 | 0 | 4.733 | 16.969 | 33.647 | 3.606 | 15.501 |
| s27 | 300 | 10374 | 296.4 | 0 | 4.687 | 16.651 | 37.284 | 3.529 | 14.967 |
| s28 | 400 | 13749 | 392.829 | 0 | 4.488 | 18.805 | 46.984 | 3.299 | 17.156 |
| s29 | 500 | 17248 | 492.8 | 0 | 4.458 | 20.579 | 40.247 | 3.2 | 18.432 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 201 | 17.225 | 33.79 | 1.374 | 2.94 | 33.174 | 19.837 | 36.909 | 193.952 | 10 |
| pgnode01 | data | 16 | 201 | 7.042 | 20.252 | 1.194 | 3.62 | 70.608 | 4.799 | 3.384 | 34.017 | 13 |
| pgnode02 | data | 16 | 201 | 6.735 | 14.54 | 0.971 | 2.66 | 71.549 | 2.651 | 2.978 | 72.003 | 14 |
| pgnode03 | data | 16 | 201 | 7.569 | 15.287 | 1.3 | 4.4 | 65.434 | 0.083 | 0.103 | 0.279 | 5 |
| gw-cache1 | data | 8 | 201 | 2.948 | 19.167 | 0.25 | 0.58 | 35.24 | 0.383 | 0.381 | 2.085 | 8 |
| gw-cache2 | data | 8 | 200 | 4.249 | 25.542 | 0.368 | 1.23 | 34.99 | 2.233 | 0.484 | 5.414 | 7 |
| gw-cache3 | data | 8 | 201 | 3.228 | 17.596 | 0.322 | 0.67 | 34.898 | 0.388 | 0.283 | 1.963 | 9 |
| gw-vector1 | target | 16 | 201 | 9.412 | 22.186 | 1.773 | 3.78 | 48.137 | 0.118 | 0.214 | 1.013 | 8 |
| gw-worker3 | generator | 4 | 201 | 10.502 | 43.924 | 0.396 | 1.3 | 27.031 | 0.073 | 0.09 | 0.179 | 503 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 32.199 | 131.93 | 2083.534 | 2181.12 |
| abusive | coolify-proxy | 55.921 | 170.91 | 128.899 | 181.3 |
| gw-vector1 | gk4owk8-181159928589 | 30.417 | 180.25 | 2070.538 | 2084.864 |
| gw-vector1 | coolify-proxy | 11.196 | 49.97 | 34.179 | 45.59 |
| gw-vector1 | qdrant-main | 28.392 | 112.87 | 4039.512 | 4051.968 |

## Webapp process

From the webapp's own counters over 1015.882 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 52.079 req/s in total: 89.072 from the benchmark and -36.993 of background traffic, of which 0.001 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.124 on average, 4 at most. Event loop delay: 178.967 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 24.155 | 46.147 |
| webapp V8Worker | 3.774 | 18.219 |
| webapp libuv-worker | 2.885 | 5.544 |
| proxy | 55.086 | 160.514 |

The proxy accepted 11.607 connections per second on average, 22.795 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /movie/:movieKey | 30809 | 30.327 | 26.991 | 127.789 | 191.974 | 26.952 | 123.642 | 99.99 |
| /person/:personKey | 4443 | 4.374 | 38.514 | 160.636 | 195.415 | 31.483 | 116.2 | 99.932 |
| /u/:handle/lists/:id | 4094 | 4.03 | 25.006 | 47.512 | 49.512 | 25.006 | 47.512 | 100 |
| /discover/:type? | 3221 | 3.171 | 25.016 | 47.53 | 49.531 | 25.016 | 47.53 | 99.969 |
| /show/:showKey | 2543 | 2.503 | 28.205 | 157.332 | 220.531 | 27.981 | 153.305 | 100 |
| /og/:first/:second | 2321 | 2.285 | 25.032 | 47.561 | 49.564 | n/a | n/a | 99.957 |
| / | 2244 | 2.209 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /og/lists/:id/:file | 469 | 0.462 | 25.053 | 47.601 | 49.606 | n/a | n/a | 100 |
| static | 98 | 0.096 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 59 | 0.058 | 231.25 | 2050 | 4410 | n/a | n/a | 77.966 |
| /api/explorer/island | 14 | 0.014 | 200 | 472 | 494.4 | n/a | n/a | 64.286 |
| /api/explorer/card | 11 | 0.011 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /sign-up | 3 | 0.003 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/poster-impressions | 2 | 0.002 | 50 | 95 | 99 | n/a | n/a | 100 |
| /explorer | 2 | 0.002 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/explorer/pairs | 2 | 0.002 | 50 | 1900 | 1980 | n/a | n/a | 50 |
| /api/explorer/map | 2 | 0.002 | 50 | 190 | 198 | n/a | n/a | 100 |
| /:type/:category/:page | 2 | 0.002 | 100 | 190 | 198 | 100 | 190 | 100 |
| /api/tonight | 1 | 0.001 | 5000 | 9500 | 9900 | n/a | n/a | 0 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 2418 | 200 | 2218 | 91.729 | 132.774 | 193.662 |
| related-cards | 838 | 133 | 705 | 84.129 | 69.32 | 97.737 |
| person-profile-v2 | 2170 | 588 | 1582 | 72.903 | 64.607 | 152.166 |
| person-fingerprint-baseline | 1582 | 1582 | 0 | 0 | n/a | n/a |
| details-show-v2 | 302 | 41 | 261 | 86.424 | 135.891 | 194.035 |
| episode-grid | 301 | 45 | 251 | 85.05 | 25.098 | 47.686 |
| movie-collection | 108 | 28 | 80 | 74.074 | 25 | 47.5 |
| share-list-view-v1 | 561 | 506 | 1 | 9.804 | 25 | 47.5 |
| share-list-availability-v1 | 92 | 91 | 0 | 1.087 | 25 | 47.5 |
| media_fingerprint_v1:discover | 2 | 0 | 2 | 100 | 50 | 95 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 2456 | 2.418 | 24.597 |
| grpc /qdrant.Points/UpdateBatch 0 | 24 | 0.024 | 32.53 |
| grpc /qdrant.Points/Get 0 | 2476 | 2.437 | 1.571 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 102.783 req/s, of which 13.71 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 52.079 | 0 | 24.155 | 46.147 | 4 | 178.967 | 2145.867 |
| 10.0.0.20 | 392439b7 | 50.67 | 0 | 21.798 | 55.775 | 6 | 477.811 | 2142.105 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 28399 | 0 | 0 | 2418 | 0 |
| 10.0.0.21 | /discover/:type? | 3219 | 0 | 0 | 21 | 0 |
| 10.0.0.21 | /person/:personKey | 2256 | 0 | 0 | 2188 | 0 |
| 10.0.0.21 | /show/:showKey | 2243 | 0 | 0 | 301 | 0 |
| 10.0.0.21 | / | 2243 | 1 | 0 | 0 | 0 |
| 10.0.0.21 | /u/:handle/lists/:id | 3991 | 101 | 0 | 2 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 8 | 0 |
| 10.0.0.21 | /sign-up | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.21 | /explorer | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /:type/:category/:page | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.21 | /explore/:type/:category/:text | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 2307 | 2 | 0 | 2 | 0 |
| 10.0.0.20 | /movie/:movieKey | 28372 | 0 | 0 | 1731 | 0 |
| 10.0.0.20 | /show/:showKey | 2219 | 0 | 0 | 203 | 0 |
| 10.0.0.20 | /person/:personKey | 2339 | 0 | 0 | 1549 | 0 |
| 10.0.0.20 | /discover/:type? | 3190 | 0 | 0 | 35 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 4 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 4030 | 100 | 0 | 3 | 0 |
| 10.0.0.20 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /explorer | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-up | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /:type/:category | 0 | 0 | 0 | 1 | 0 |
