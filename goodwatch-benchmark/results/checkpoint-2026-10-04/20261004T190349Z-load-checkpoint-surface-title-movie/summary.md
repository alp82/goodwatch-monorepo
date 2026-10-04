# 20261004T190349Z-load-checkpoint-surface-title-movie

Label: checkpoint-surface-title-movie. Time: 2026-10-04T19:04:14.453Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s, then 80 req/s for 35 s, then 100 req/s for 35 s, then 125 req/s for 35 s, then 150 req/s for 35 s, then 200 req/s for 35 s, then 250 req/s for 35 s, then 300 req/s for 35 s, then 400 req/s for 35 s, then 500 req/s for 35 s.

90472 requests; 89.57 req/s; 0% errors; p95 19.072 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 90472 | 89.57 | 0 | 4.804 | 19.072 | 41.27 | 3.433 | 17.289 | 39.429 | 90472/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 5.364 | 8.834 | 27.041 | 3.975 | 6.534 |
| s02 | 2 | 68 | 1.943 | 0 | 4.587 | 9.58 | 18.016 | 3.452 | 8.331 |
| s03 | 4 | 135 | 3.857 | 0 | 5.128 | 23.182 | 36.931 | 3.844 | 21.866 |
| s04 | 6 | 205 | 5.857 | 0 | 5.012 | 20.003 | 33.893 | 3.655 | 18.861 |
| s05 | 8 | 275 | 7.857 | 0 | 5.257 | 10.364 | 24.283 | 4.024 | 7.954 |
| s06 | 10 | 345 | 9.857 | 0 | 5.092 | 18.647 | 39.093 | 3.931 | 16.229 |
| s07 | 12 | 415 | 11.857 | 0 | 5.22 | 14.346 | 27.19 | 3.95 | 12.805 |
| s08 | 14 | 485 | 13.857 | 0 | 5.505 | 14.205 | 30.72 | 4.239 | 12.935 |
| s09 | 16 | 555 | 15.857 | 0 | 5.536 | 14.169 | 33.176 | 4.243 | 13.229 |
| s10 | 18 | 625 | 17.857 | 0 | 5.483 | 15.122 | 30.932 | 4.01 | 13.437 |
| s11 | 20 | 695 | 19.857 | 0 | 5.315 | 12.653 | 36.121 | 3.87 | 11.515 |
| s12 | 25 | 862 | 24.629 | 0 | 5.273 | 10.452 | 21.372 | 3.818 | 9.078 |
| s13 | 30 | 1038 | 29.657 | 0 | 5.402 | 15.439 | 37.839 | 3.97 | 12.888 |
| s14 | 35 | 1212 | 34.629 | 0 | 5.376 | 11.099 | 24.884 | 3.89 | 9.537 |
| s15 | 40 | 1387 | 39.629 | 0 | 5.515 | 15.531 | 31.018 | 3.99 | 13.875 |
| s16 | 45 | 1563 | 44.657 | 0 | 5.484 | 14.01 | 33.89 | 4.07 | 12.289 |
| s17 | 50 | 1737 | 49.629 | 0 | 5.409 | 11.898 | 23.145 | 3.941 | 9.998 |
| s18 | 55 | 1913 | 54.657 | 0 | 5.336 | 13.416 | 29.597 | 3.948 | 11.83 |
| s19 | 60 | 2087 | 59.629 | 0 | 5.284 | 16.201 | 34.467 | 3.929 | 14.304 |
| s20 | 65 | 2262 | 64.629 | 0 | 5.358 | 18.566 | 40.484 | 3.943 | 17.265 |
| s21 | 80 | 2763 | 78.943 | 0 | 5.327 | 16.489 | 39.039 | 3.957 | 14.789 |
| s22 | 100 | 3449 | 98.543 | 0 | 5.244 | 23.179 | 52.477 | 3.872 | 21.389 |
| s23 | 125 | 4312 | 123.2 | 0 | 5.099 | 19.803 | 40.619 | 3.784 | 18.489 |
| s24 | 150 | 5188 | 148.229 | 0 | 5.048 | 21.675 | 45.744 | 3.686 | 19.907 |
| s25 | 200 | 6874 | 196.4 | 0 | 4.902 | 20.114 | 49.725 | 3.598 | 18.574 |
| s26 | 250 | 8624 | 246.4 | 0 | 4.797 | 21.623 | 50.013 | 3.481 | 20.007 |
| s27 | 300 | 10374 | 296.4 | 0 | 4.671 | 20.245 | 44.118 | 3.384 | 18.393 |
| s28 | 400 | 13749 | 392.829 | 0 | 4.514 | 18.545 | 39.498 | 3.252 | 16.45 |
| s29 | 500 | 17246 | 492.743 | 0 | 4.447 | 20.301 | 40.651 | 3.146 | 18.218 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 201 | 15.864 | 36.359 | 1.425 | 2.71 | 33.732 | 21.076 | 37.682 | 200.881 | 10 |
| pgnode01 | data | 16 | 201 | 6.521 | 12.986 | 1.259 | 4.05 | 70.468 | 2.75 | 4.278 | 71.793 | 13 |
| pgnode02 | data | 16 | 200 | 6.893 | 17.199 | 1.476 | 3.3 | 71.535 | 3.065 | 3.435 | 72.342 | 14 |
| pgnode03 | data | 16 | 200 | 8.502 | 27.766 | 1.162 | 3.62 | 65.552 | 1.354 | 0.219 | 4.886 | 5 |
| gw-cache1 | data | 8 | 201 | 3.458 | 18.728 | 0.272 | 0.69 | 34.925 | 0.461 | 0.41 | 2.02 | 13 |
| gw-cache2 | data | 8 | 200 | 2.938 | 18.02 | 0.295 | 0.85 | 34.496 | 0.394 | 0.313 | 1.356 | 7 |
| gw-cache3 | data | 8 | 200 | 4.38 | 25.16 | 0.331 | 1.31 | 34.85 | 2.891 | 0.459 | 3.646 | 14 |
| gw-vector1 | target | 16 | 201 | 11.665 | 26.504 | 2.38 | 5.59 | 48.505 | 35.171 | 69.341 | 1182.602 | 8 |
| gw-worker3 | generator | 4 | 201 | 12.029 | 52.068 | 0.42 | 1.49 | 26.467 | 1.854 | 0.202 | 3.334 | 503 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 24.585 | 138.3 | 2143.089 | 2192.384 |
| abusive | coolify-proxy | 55.607 | 171.68 | 135.511 | 172.4 |
| gw-vector1 | gk4owk8-181159928589 | 35.076 | 158.24 | 2125.07 | 2168.832 |
| gw-vector1 | coolify-proxy | 11.496 | 45.09 | 36.784 | 43.12 |
| gw-vector1 | qdrant-main | 46.781 | 156 | 4115.079 | 4360.192 |

## Webapp process

From the webapp's own counters over 1014.488 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 50.456 req/s in total: 89.181 from the benchmark and -38.725 of background traffic, of which 0.003 are the crawler loop. Server errors: 0 per second. Requests in flight: 0.44 on average, 4 at most. Event loop delay: 267.31 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 18.268 | 49.499 |
| webapp V8Worker | 2.827 | 19.596 |
| webapp libuv-worker | 2.049 | 4.948 |
| proxy | 54.639 | 158.305 |

The proxy accepted 11.52 connections per second on average, 19.608 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /movie/:movieKey | 46902 | 46.232 | 25.855 | 49.124 | 172.588 | 25.824 | 49.066 | 99.998 |
| /person/:personKey | 1312 | 1.293 | 67.223 | 188.307 | 256.714 | 31.506 | 138.263 | 99.924 |
| /show/:showKey | 302 | 0.298 | 149.515 | 270.889 | 297.733 | 142.166 | 245.208 | 99.338 |
| static | 122 | 0.12 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 28 | 0.028 | 259.091 | 480 | 1720 | n/a | n/a | 82.143 |
| / | 17 | 0.017 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /:type/:category/:page | 13 | 0.013 | 29.545 | 83.75 | 96.75 | 50 | 95 | 100 |
| /discover/:type? | 4 | 0.004 | 133.333 | 193.333 | 198.667 | 133.333 | 193.333 | 100 |
| /sign-in | 2 | 0.002 | 50 | 95 | 99 | 25 | 47.5 | 100 |
| /og/:first/:second | 1 | 0.001 | 500 | 950 | 990 | n/a | n/a | 0 |
| /sign-up | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /og/:first | 1 | 0.001 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /taste | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /:type/:category | 1 | 0.001 | 500 | 950 | 990 | n/a | n/a | 0 |
| /:type | 1 | 0.001 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/taste/portrait | 1 | 0.001 | 250 | 475 | 495 | n/a | n/a | 0 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 1721 | 247 | 1474 | 85.648 | 131.203 | 193.543 |
| related-cards | 840 | 185 | 655 | 77.976 | 68.513 | 97.929 |
| genres-movie | 2 | 2 | 0 | 0 | n/a | n/a |
| person-profile-v2 | 1289 | 456 | 833 | 64.624 | 68.929 | 173.504 |
| person-fingerprint-baseline | 833 | 833 | 0 | 0 | n/a | n/a |
| details-show-v2 | 303 | 52 | 251 | 82.838 | 137.437 | 194.196 |
| episode-grid | 303 | 55 | 241 | 81.848 | 25.514 | 48.477 |
| movie-collection | 118 | 41 | 77 | 65.254 | 25.329 | 48.125 |
| media_fingerprint_v1:discover | 33 | 10 | 21 | 69.697 | 268.75 | 895 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 26 | 0.026 | 56.695 |
| grpc /qdrant.Points/Recommend 0 | 2926 | 2.884 | 25.873 |
| grpc /qdrant.Points/Get 0 | 2936 | 2.894 | 1.902 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 102.564 req/s, of which 13.383 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 50.456 | 0 | 18.268 | 49.499 | 4 | 267.31 | 2167.746 |
| 10.0.0.20 | 392439b7 | 52.1 | 0 | 25.533 | 47.476 | 5 | 410.703 | 2224.008 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 45206 | 1 | 0 | 1719 | 0 |
| 10.0.0.21 | /discover/:type? | 1 | 0 | 0 | 59 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 1314 | 0 |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 303 | 0 |
| 10.0.0.21 | / | 16 | 1 | 0 | 0 | 0 |
| 10.0.0.21 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 4 | 0 |
| 10.0.0.21 | /sign-up | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /:type/:category/:page | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /explore/:type/:category/:text | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.21 | /sign-in | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.21 | /taste | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 17 | 1 | 0 | 2 | 0 |
| 10.0.0.20 | /movie/:movieKey | 45268 | 0 | 0 | 2250 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 356 | 0 |
| 10.0.0.20 | /person/:personKey | 1 | 0 | 0 | 2114 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 73 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 11 | 0 |
| 10.0.0.20 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /explorer | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /:type/:category/:page | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-up | 0 | 0 | 0 | 2 | 0 |
