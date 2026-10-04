# 20261004T194232Z-load-checkpoint-surface-person

Label: checkpoint-surface-person. Time: 2026-10-04T19:42:57.072Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s, then 80 req/s for 35 s, then 100 req/s for 35 s, then 125 req/s for 35 s, then 150 req/s for 35 s, then 200 req/s for 35 s, then 250 req/s for 35 s, then 300 req/s for 35 s, then 400 req/s for 35 s, then 500 req/s for 35 s.

90475 requests; 89.575 req/s; 0% errors; p95 20.774 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| person | 90475 | 89.575 | 0 | 4.409 | 20.774 | 45.425 | 3.45 | 19.686 | 44.226 | 90475/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 5.391 | 10.931 | 14.013 | 4.041 | 7.273 |
| s02 | 2 | 68 | 1.943 | 0 | 4.672 | 9.987 | 18.877 | 3.639 | 8.834 |
| s03 | 4 | 135 | 3.857 | 0 | 4.756 | 17.606 | 31.878 | 3.606 | 16.512 |
| s04 | 6 | 205 | 5.857 | 0 | 4.74 | 14.769 | 26.455 | 3.753 | 13.73 |
| s05 | 8 | 275 | 7.857 | 0 | 5.099 | 20.037 | 35.302 | 4.043 | 18.748 |
| s06 | 10 | 345 | 9.857 | 0 | 4.939 | 17.102 | 38.413 | 3.968 | 15.803 |
| s07 | 12 | 415 | 11.857 | 0 | 5.097 | 21.375 | 39.055 | 4.067 | 20.273 |
| s08 | 14 | 485 | 13.857 | 0 | 5.029 | 15.2 | 27.461 | 4.088 | 14.506 |
| s09 | 16 | 555 | 15.857 | 0 | 4.962 | 21.329 | 40.791 | 4.04 | 20.429 |
| s10 | 18 | 625 | 17.857 | 0 | 5.108 | 17.87 | 36.593 | 4.114 | 16.222 |
| s11 | 20 | 695 | 19.857 | 0 | 4.885 | 16.597 | 42.961 | 3.927 | 15.348 |
| s12 | 25 | 862 | 24.629 | 0 | 5.018 | 16.86 | 42.406 | 3.958 | 15.492 |
| s13 | 30 | 1038 | 29.657 | 0 | 4.98 | 18.669 | 40.256 | 3.979 | 17.532 |
| s14 | 35 | 1212 | 34.629 | 0 | 5.045 | 24.714 | 44.547 | 4.017 | 23.841 |
| s15 | 40 | 1388 | 39.657 | 0 | 4.872 | 18.983 | 36.622 | 3.869 | 17.939 |
| s16 | 45 | 1562 | 44.629 | 0 | 4.769 | 17.051 | 38.92 | 3.803 | 15.982 |
| s17 | 50 | 1738 | 49.657 | 0 | 4.831 | 17.933 | 39.527 | 3.851 | 17.084 |
| s18 | 55 | 1912 | 54.629 | 0 | 4.791 | 13.135 | 29.805 | 3.812 | 12.003 |
| s19 | 60 | 2087 | 59.629 | 0 | 4.84 | 15.836 | 33.44 | 3.822 | 14.918 |
| s20 | 65 | 2263 | 64.657 | 0 | 4.846 | 16.594 | 36.821 | 3.9 | 15.565 |
| s21 | 80 | 2762 | 78.914 | 0 | 5.035 | 17.248 | 49.34 | 4.02 | 15.914 |
| s22 | 100 | 3450 | 98.571 | 0 | 4.929 | 17.41 | 35.607 | 3.988 | 16.333 |
| s23 | 125 | 4312 | 123.2 | 0 | 4.774 | 17.91 | 38.674 | 3.833 | 16.954 |
| s24 | 150 | 5188 | 148.229 | 0 | 4.747 | 21.02 | 44.215 | 3.812 | 20.015 |
| s25 | 200 | 6874 | 196.4 | 0 | 4.588 | 21.676 | 47.474 | 3.65 | 20.584 |
| s26 | 250 | 8625 | 246.429 | 0 | 4.422 | 19.238 | 44.952 | 3.498 | 18.349 |
| s27 | 300 | 10374 | 296.4 | 0 | 4.406 | 21.005 | 41.167 | 3.481 | 19.973 |
| s28 | 400 | 13749 | 392.829 | 0 | 4.093 | 24.006 | 64.737 | 3.201 | 22.981 |
| s29 | 500 | 17247 | 492.771 | 0 | 3.855 | 24.11 | 48.458 | 2.937 | 23.069 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 201 | 18.344 | 33.36 | 1.537 | 2.95 | 34.73 | 13.902 | 24.978 | 122.052 | 10 |
| pgnode01 | data | 16 | 201 | 8.972 | 24.296 | 1.226 | 4.11 | 70.545 | 4.652 | 3.956 | 68.183 | 13 |
| pgnode02 | data | 16 | 200 | 8.788 | 15.436 | 1.571 | 3.62 | 71.5 | 3.268 | 3.741 | 72.149 | 14 |
| pgnode03 | data | 16 | 200 | 10.426 | 19.476 | 1.885 | 4.96 | 65.424 | 0.097 | 0.111 | 0.253 | 3 |
| gw-cache1 | data | 8 | 201 | 3.359 | 16.166 | 0.247 | 0.63 | 34.831 | 0.564 | 0.413 | 1.517 | 8 |
| gw-cache2 | data | 8 | 200 | 3.259 | 18.465 | 0.319 | 0.66 | 34.259 | 0.62 | 0.4 | 1.481 | 7 |
| gw-cache3 | data | 8 | 200 | 3.668 | 19.004 | 0.265 | 0.61 | 34.513 | 0.592 | 0.357 | 1.952 | 9 |
| gw-vector1 | target | 16 | 201 | 39.642 | 81.797 | 8.31 | 14.53 | 51.531 | 0.116 | 0.23 | 0.661 | 8 |
| gw-worker3 | generator | 4 | 201 | 12.097 | 52.273 | 0.49 | 1.67 | 26.444 | 1.803 | 0.205 | 3.535 | 503 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 34.615 | 142.56 | 2295.803 | 2379.776 |
| abusive | coolify-proxy | 57.759 | 155.29 | 140.032 | 164.7 |
| gw-vector1 | gk4owk8-181159928589 | 35.363 | 207.34 | 2272.704 | 2325.504 |
| gw-vector1 | coolify-proxy | 10.161 | 38.28 | 40.202 | 45.86 |
| gw-vector1 | qdrant-main | 504.998 | 1151.64 | 5037.163 | 5903.36 |

## Webapp process

From the webapp's own counters over 1014.888 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 53.484 req/s in total: 89.149 from the benchmark and -35.665 of background traffic, of which 0.006 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.33 on average, 6 at most. Event loop delay: 203.74 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 27.727 | 46.875 |
| webapp libuv-worker | 3.78 | 6.725 |
| webapp V8Worker | 2.963 | 23.865 |
| proxy | 56.776 | 145.221 |

The proxy accepted 13.673 connections per second on average, 24.173 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /person/:personKey | 48429 | 47.719 | 26.292 | 49.955 | 145.183 | 26.114 | 49.616 | 99.983 |
| /movie/:movieKey | 2459 | 2.423 | 144.877 | 240.332 | 290.515 | 140.16 | 197.818 | 99.756 |
| /show/:showKey | 793 | 0.781 | 154.584 | 271.48 | 296.856 | 148.284 | 241.769 | 99.496 |
| static | 190 | 0.187 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 37 | 0.036 | 258.333 | 2225 | 4445 | n/a | n/a | 83.784 |
| / | 17 | 0.017 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/poster-impressions | 8 | 0.008 | 60 | 96 | 99.2 | n/a | n/a | 100 |
| /discover/:type? | 4 | 0.004 | 50 | 190 | 198 | 50 | 190 | 100 |
| /sign-up | 2 | 0.002 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /:type/:category/:page | 2 | 0.002 | 100 | 190 | 198 | 100 | 190 | 100 |
| /og/:first/:second | 1 | 0.001 | 500 | 950 | 990 | n/a | n/a | 0 |
| /disclaimer | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/discover/results | 1 | 0.001 | 100 | 190 | 198 | n/a | n/a | 100 |
| /sign-in | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /:type | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /about | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /how-it-works | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 2487 | 257 | 2230 | 89.666 | 134.234 | 193.851 |
| related-cards | 1263 | 227 | 1036 | 82.027 | 76.621 | 127.826 |
| genres-movie | 2 | 2 | 0 | 0 | n/a | n/a |
| person-profile-v2 | 3167 | 730 | 2437 | 76.95 | 63.483 | 162.597 |
| person-fingerprint-baseline | 2437 | 2437 | 0 | 0 | n/a | n/a |
| details-show-v2 | 798 | 70 | 728 | 91.228 | 136.791 | 194.796 |
| episode-grid | 798 | 101 | 683 | 87.343 | 25.217 | 47.912 |
| movie-collection | 149 | 43 | 106 | 71.141 | 25.238 | 47.952 |
| media_fingerprint_v1:discover | 2 | 0 | 2 | 100 | 100 | 190 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 22 | 0.022 | 30.163 |
| grpc /qdrant.Points/Recommend 0 | 4132 | 4.071 | 36.355 |
| grpc /qdrant.Points/Get 0 | 4138 | 4.077 | 1.945 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 104.808 req/s, of which 15.659 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 53.484 | 0 | 27.727 | 46.875 | 6 | 203.74 | 2371.633 |
| 10.0.0.20 | 392439b7 | 51.326 | 0 | 25.003 | 49.885 | 5 | 324.719 | 2180.039 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 0 | 0 | 0 | 2486 | 0 |
| 10.0.0.21 | /discover/:type? | 1 | 1 | 0 | 26 | 0 |
| 10.0.0.21 | /person/:personKey | 45256 | 1 | 0 | 3179 | 0 |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 798 | 0 |
| 10.0.0.21 | / | 17 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 8 | 0 |
| 10.0.0.21 | /sign-up | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.21 | /disclaimer | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /:type/:category/:page | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.21 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /about | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /how-it-works | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 0 | 0 | 2021 | 0 |
| 10.0.0.20 | /show/:showKey | 1 | 0 | 0 | 759 | 0 |
| 10.0.0.20 | /person/:personKey | 45222 | 0 | 0 | 1470 | 0 |
| 10.0.0.20 | / | 17 | 1 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 34 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 7 | 0 |
| 10.0.0.20 | /how-it-works | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 4 | 0 |
| 10.0.0.20 | /sign-up | 0 | 0 | 0 | 5 | 0 |
| 10.0.0.20 | /forgot-password | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /disclaimer | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /watch-next | 0 | 0 | 0 | 1 | 0 |
