# 20261005T041235Z-load-og-ramp-og-title

Label: og-ramp-og-title. Time: 2026-10-05T04:12:56.848Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 50 req/s for 25 s, then 100 req/s for 30 s, then 200 req/s for 30 s, then 300 req/s for 30 s, then 400 req/s for 30 s, then 500 req/s for 30 s, then 650 req/s for 30 s, then 800 req/s for 30 s, then 1000 req/s for 30 s, then 1250 req/s for 30 s.

154143 requests; 522.427 req/s; 0% errors; p95 28.301 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| og_title | 154143 | 522.427 | 0 | 5.157 | 28.301 | 51.894 | 2.853 | 22.403 | 45.464 | 154143/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 50 | 1246 | 49.84 | 0 | 5.518 | 22.233 | 42.172 | 3.159 | 18.432 |
| s02 | 100 | 2872 | 95.733 | 0 | 5.611 | 22.458 | 51.562 | 3.411 | 19.802 |
| s03 | 200 | 5744 | 191.467 | 0 | 5.16 | 20.613 | 39.746 | 3.074 | 17.799 |
| s04 | 300 | 8743 | 291.433 | 0 | 5.083 | 21.526 | 42.761 | 2.855 | 17.891 |
| s05 | 400 | 11744 | 391.467 | 0 | 4.938 | 25.657 | 53.279 | 2.871 | 21.435 |
| s06 | 500 | 14744 | 491.467 | 0 | 4.932 | 23.482 | 45.941 | 2.705 | 19.448 |
| s07 | 650 | 19115 | 637.167 | 0 | 4.735 | 23.131 | 42.047 | 2.607 | 18.53 |
| s08 | 800 | 23616 | 787.2 | 0 | 4.91 | 27.015 | 50.436 | 2.714 | 21.686 |
| s09 | 1000 | 29488 | 982.933 | 0 | 5.146 | 31.725 | 55.977 | 2.825 | 24.306 |
| s10 | 1250 | 36831 | 1227.7 | 0 | 6.074 | 34.793 | 56.435 | 3.226 | 26.693 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 50 | 20.921 | 247.16 | 113.736 | 32.953 | 30.484 | 10.704 | 0.641 | 45.667 | 42.921 | 46.501 | 64.456 | 33.692 | 59.846 | 67.12 | 0.175 | 0.107 | 21.484 | 25.773 | 0.094 | 0.076 |
| s02 | 100 | 25.604 | 189.458 | 67.766 | 62.313 | 34.325 | 14.331 | 1.527 | 62.772 | 34.911 | 39.051 | 116.631 | 60.222 | 75.46 | 80.756 | 0.257 | 0.11 | 18.896 | 23.193 | 0.109 | 0.111 |
| s03 | 200 | 27.172 | 218.165 | 66.546 | 37.508 | 32.984 | 22.088 | 0.69 | 46.06 | 36.336 | 37.729 | 225.189 | 118.25 | 68.567 | 78.625 | 0.302 | 0.168 | 25.175 | 29.119 | 0.121 | 0.118 |
| s04 | 300 | 33.052 | 239.278 | 64.866 | 39.605 | 37.855 | 29.312 | 1.178 | 84.661 | 41.488 | 43.389 | 334.875 | 175.519 | 56.694 | 60.707 | 0.206 | 0.124 | 28.006 | 33.351 | 0.12 | 0.093 |
| s05 | 400 | 34.954 | 254.828 | 64.215 | 46.028 | 43.652 | 39.706 | 0.592 | 63.034 | 43.091 | 45.751 | 442.741 | 230.992 | 61.403 | 66.213 | 0.208 | 0.155 | 34.955 | 42.147 | 0.149 | 0.145 |
| s06 | 500 | 39.568 | 279.145 | 64.581 | 84.792 | 40.794 | 38.771 | 1.233 | 58.053 | 45.134 | 48.32 | 545.03 | 283.97 | 71.074 | 73.669 | 0.22 | 0.117 | 44.749 | 47.275 | 0.166 | 0.161 |
| s07 | 650 | 39.805 | 307.17 | 64.084 | 46.29 | 44.478 | 49.65 | 0.887 | 49.009 | 49.94 | 52.901 | 705.744 | 365.638 | 59.619 | 70.788 | 0.202 | 0.113 | 44.591 | 48.348 | 0.164 | 0.158 |
| s08 | 800 | 46.941 | 324.192 | 64.631 | 67.097 | 45.915 | 58.856 | 0.854 | 44.094 | 54.275 | 56.215 | 870.449 | 453.627 | 65.675 | 72.234 | 727.73 | 8.38 | 50.506 | 52.149 | 0.193 | 0.189 |
| s09 | 1000 | 48.036 | 344.025 | 62.942 | 56.218 | 53.099 | 67.347 | 0.247 | 107.926 | 54.833 | 57.202 | 1087.211 | 565.279 | 64.409 | 68.058 | 678.591 | 211.355 | 56.624 | 59.109 | 0.212 | 0.212 |
| s10 | 1250 | 56.372 | 372.833 | 63.825 | 61.854 | 57.57 | 84.882 | 0.737 | 51.107 | 60.119 | 61.072 | 1358.437 | 705.086 | 44.879 | 50.504 | 479.613 | 483.153 | 64.949 | 69.366 | 0.245 | 0.285 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 59 | 45.884 | 61.072 | 4.089 | 5.91 | 36.252 | 290.352 | 558.056 | 1372.012 | 9 |
| gw-vector1 | target | 16 | 59 | 63.036 | 80.756 | 10.75 | 12.84 | 55.556 | 67.416 | 183.46 | 1122.665 | 10 |
| gw-cache1 | data | 8 | 59 | 3.262 | 18.116 | 0.169 | 0.47 | 31.567 | 0.464 | 0.42 | 1.891 | 8 |
| gw-cache2 | data | 8 | 59 | 3.279 | 20.44 | 0.265 | 0.56 | 31.364 | 0.873 | 0.423 | 1.057 | 7 |
| gw-cache3 | data | 8 | 59 | 3.849 | 18.261 | 0.218 | 0.62 | 31.232 | 0.628 | 0.325 | 0.703 | 11 |
| gw-worker3 | generator | 4 | 59 | 38.587 | 69.366 | 1.583 | 2.63 | 31.718 | 0.153 | 0.156 | 0.267 | 1253 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 41.044 | 81.82 | 2353.95 | 2404.352 |
| abusive | coolify-proxy | 277.154 | 410.55 | 349.437 | 381.6 |
| gw-vector1 | gk4owk8-011237769659 | 56.131 | 196.42 | 2382.293 | 2383.872 |
| gw-vector1 | coolify-proxy | 42.223 | 93.58 | 115.139 | 125 |
| gw-vector1 | qdrant-main | 770.662 | 1227.99 | 5710.536 | 6824.96 |

## Webapp process

From the webapp's own counters over 299.996 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 289.297 req/s in total: 513.82 from the benchmark and -224.523 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.39 on average, 5 at most. Event loop delay: 84.792 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 37.572 | 60.449 |
| webapp V8Worker | 4.625 | 22.151 |
| webapp libuv-worker | 2.393 | 4.11 |
| proxy | 275.786 | 375.48 |

The proxy accepted 68.432 connections per second on average, 118.681 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /og/:first/:second | 76899 | 256.333 | 25.006 | 47.511 | 49.512 | n/a | n/a | 99.999 |
| /movie/:movieKey | 601 | 2.003 | 134.741 | 251.583 | 291.65 | 128.788 | 197.652 | 99.834 |
| /person/:personKey | 488 | 1.627 | 77.987 | 193.5 | 270.154 | 25.942 | 49.289 | 99.795 |
| /show/:showKey | 93 | 0.31 | 127 | 253.5 | 290.7 | 114.423 | 194.904 | 100 |
| static | 67 | 0.223 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| / | 6 | 0.02 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/e | 6 | 0.02 | 150 | 285 | 297 | n/a | n/a | 100 |
| /api/poster-impressions | 3 | 0.01 | 37.5 | 92.5 | 98.5 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 94 | 32 | 56 | 65.957 | 136.735 | 193.673 |
| episode-grid | 94 | 23 | 69 | 75.532 | 25.357 | 48.179 |
| related-cards | 315 | 115 | 200 | 63.492 | 80 | 170.588 |
| details-movie-v2 | 608 | 143 | 436 | 76.48 | 137.432 | 193.986 |
| person-profile-v2 | 486 | 161 | 325 | 66.872 | 74.569 | 180.208 |
| person-fingerprint-baseline | 325 | 325 | 0 | 0 | n/a | n/a |
| movie-collection | 42 | 24 | 18 | 42.857 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 734 | 2.447 | 41.144 |
| grpc /qdrant.Points/UpdateBatch 0 | 6 | 0.02 | 88.746 |
| grpc /qdrant.Points/Get 0 | 736 | 2.453 | 4.237 |
| grpc /qdrant.Points/Scroll 0 | 43 | 0.143 | 251.292 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 580.891 req/s, of which 67.071 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 3a45fcfd | 289.297 | 0 | 37.572 | 60.449 | 5 | 84.792 | 2325.57 |
| 10.0.0.20 | 3a45fcfd | 290.678 | 0 | 41.785 | 59.538 | 3 | 107.926 | 2432.887 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 94 | 0 |
| 10.0.0.21 | /movie/:movieKey | 0 | 1 | 0 | 606 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 488 | 0 |
| 10.0.0.21 | /discover/:type? | 0 | 0 | 0 | 32 | 0 |
| 10.0.0.21 | / | 5 | 1 | 0 | 0 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 862 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 0 | 0 | 781 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 101 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 42 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 4 | 0 | 0 | 0 | 0 |
