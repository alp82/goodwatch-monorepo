# 20261005T033324Z-load-pv-movie-public-duo-a

Label: pv-movie-public-duo-a. Time: 2026-10-05T03:33:44.965Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 30 visitors/s for 30 s, then 40 visitors/s for 35 s, then 45 visitors/s for 35 s, then 50 visitors/s for 35 s, then 55 visitors/s for 35 s, then 60 visitors/s for 35 s.

**k6 failed:** exit 105.

333235 requests; 1727.198 req/s; 0% errors; p95 260.144 ms; 89 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 333235 | 1727.198 | 0 | 17.152 | 260.144 | 706.133 | 14.584 | 205.882 | 596.47 | 333226/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 34162 | 1138.733 | 0 | 9.136 | 27.551 | 54.413 | 7.759 | 24.764 |
| s02 | 40 | 52250 | 1492.857 | 0 | 11.01 | 36.59 | 89.317 | 9.319 | 32.558 |
| s03 | 45 | 59394 | 1696.971 | 0 | 15.378 | 70.745 | 124.739 | 12.982 | 64.223 |
| s04 | 50 | 66006 | 1885.886 | 0 | 16.513 | 61.748 | 115.142 | 13.97 | 53.694 |
| s05 | 55 | 72678 | 2076.514 | 0 | 35.815 | 240.923 | 616.839 | 29.615 | 193.71 |
| s06 | 60 | 48745 | 1392.714 | 0 | 122.014 | 755.301 | 1305.317 | 97.086 | 633.881 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

8769 visitors; 8769 complete page views; 0% failed page views; page view p95 1125.2 ms; 17542 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29.967 | 29.967 | 0 | 4.831 | 24.814 | 56 | 93 | 1138.733 | 0 | 59.933 | 22.039 | 33.18 |
| s02 | 40 | 39.286 | 39.286 | 0 | 6.12 | 31.715 | 62 | 114 | 1492.857 | 0 | 78.571 | 23.333 | 39.037 |
| s03 | 45 | 44.657 | 44.657 | 0 | 10.318 | 66.609 | 75 | 221 | 1696.971 | 0 | 89.314 | 23.967 | 55.029 |
| s04 | 50 | 49.629 | 49.629 | 0 | 11.506 | 53.356 | 79 | 180.2 | 1885.886 | 0 | 99.257 | 24.622 | 51.603 |
| s05 | 55 | 54.657 | 54.657 | 0 | 28.305 | 187.979 | 133 | 908 | 2076.514 | 0 | 108.857 | 30.108 | 241.995 |
| s06 | 60 | 36.629 | 36.629 | 0 | 115.895 | 681.476 | 645 | 2239.9 | 1392.714 | 0 | 73.829 | 119.54 | 966.359 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 48.647 | 475.737 | 185.953 | 38.786 | 53.69 | 93.325 | 8.409 | 278.32 | 68.125 | 77.317 | 264.771 | 142.741 | 34.241 | 38.128 | 0.29 | 0.254 | 40.185 | 50.863 | 4.432 | 126.829 |
| s02 | 40 | 55.293 | 541.101 | 225.284 | 56.677 | 59.866 | 129.33 | 0.236 | 53.466 | 84.362 | 85.758 | 395.996 | 201.637 | 31.016 | 33.532 | 0.399 | 0.239 | 50.704 | 53.148 | 6.495 | 191.104 |
| s03 | 45 | 64.496 | 580.862 | 243.478 | 54.646 | 75.111 | 135.987 | 14.078 | 148.034 | 89.185 | 93.934 | 437.971 | 227.83 | 35.211 | 36.92 | 0.469 | 0.28 | 54.718 | 59.206 | 7.127 | 210.886 |
| s04 | 50 | 68.489 | 612.49 | 264.599 | 81.908 | 70.807 | 151.129 | 5.229 | 98.227 | 92.27 | 93.559 | 499.317 | 265.905 | 35.483 | 39.721 | 0.374 | 0.261 | 56.065 | 58.717 | 8.108 | 241.638 |
| s05 | 55 | 75.177 | 630.13 | 287.02 | 218.42 | 78.415 | 162.519 | 34.867 | 146.461 | 96.462 | 98.098 | 541.983 | 286.988 | 37.056 | 41.227 | 0.444 | 0.35 | 60.029 | 62.378 | 9.485 | 260.814 |
| s06 | 60 | 55.382 | 471.241 | 193.475 | 92.329 | 54.429 | 122.799 | 237.076 | 70.833 | 88.701 | 99.311 | 411.303 | 216.306 | 34.338 | 38.311 | 0.429 | 0.324 | 64.22 | 73.439 | 8.992 | 263.997 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 39 | 86.618 | 99.311 | 6.912 | 9.68 | 35.253 | 225.636 | 428.727 | 574.074 | 10 |
| gw-vector1 | target | 16 | 38 | 34.969 | 41.227 | 5.827 | 8.52 | 50.85 | 0.282 | 0.408 | 0.693 | 11 |
| gw-cache1 | data | 8 | 38 | 4.408 | 16.435 | 0.337 | 0.6 | 32.035 | 0.508 | 0.487 | 1.083 | 8 |
| gw-cache2 | data | 8 | 39 | 4.922 | 19.081 | 0.362 | 0.72 | 31.733 | 0.587 | 0.387 | 1.009 | 8 |
| gw-cache3 | data | 8 | 39 | 7.366 | 27.678 | 0.442 | 1.09 | 32.681 | 9.667 | 0.876 | 6.217 | 9 |
| gw-worker3 | generator | 4 | 39 | 53.656 | 73.439 | 1.774 | 2.62 | 20.459 | 213.369 | 7.343 | 12.822 | 138 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 72.306 | 158.34 | 2211.105 | 2213.888 |
| abusive | coolify-proxy | 557.161 | 656.51 | 340.551 | 785.2 |
| gw-vector1 | gk4owk8-011237769659 | 85.969 | 190.79 | 2303.623 | 2315.264 |
| gw-vector1 | coolify-proxy | 141.894 | 216.95 | 96.841 | 154.4 |
| gw-vector1 | qdrant-main | 268.953 | 397.82 | 5531.648 | 5830.656 |

## Webapp process

From the webapp's own counters over 196.447 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 1669.702 req/s in total: 1696.88 from the benchmark and -27.178 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.053 on average, 4 at most. Event loop delay: 218.42 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 63.32 | 88.122 |
| webapp V8Worker | 8.455 | 21.398 |
| webapp libuv-worker | 2.439 | 4.112 |
| proxy | 576.017 | 687.011 |

The proxy accepted 245.046 connections per second on average, 302.908 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 312746 | 1592.012 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 8963 | 45.626 | 26.34 | 58.351 | 257.581 | 26.259 | 49.893 | 99.554 |
| /person/:personKey | 647 | 3.294 | 100.204 | 297.187 | 488.692 | 27.213 | 91.869 | 95.209 |
| /show/:showKey | 55 | 0.28 | 163.889 | 390 | 478 | 143.75 | 293.75 | 90.909 |
| /api/e | 6 | 0.031 | 240 | 294 | 298.8 | n/a | n/a | 100 |
| / | 5 | 0.025 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-up | 1 | 0.005 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 55 | 17 | 34 | 69.091 | 148.649 | 194.865 |
| episode-grid | 55 | 13 | 38 | 76.364 | 26.25 | 49.875 |
| related-cards | 176 | 74 | 102 | 57.955 | 84.286 | 363.333 |
| details-movie-v2 | 501 | 99 | 391 | 80.24 | 136.817 | 195.129 |
| person-profile-v2 | 643 | 173 | 470 | 73.095 | 74.268 | 185.096 |
| person-fingerprint-baseline | 470 | 470 | 0 | 0 | n/a | n/a |
| movie-collection | 24 | 15 | 9 | 37.5 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| rest POST /collections/{collection_name}/points 200 | 2 | 0.01 | 6.222 |
| rest POST /collections/{collection_name}/points/query/batch 200 | 4 | 0.02 | 72.031 |
| grpc /qdrant.Points/Get 0 | 598 | 3.044 | 6.607 |
| grpc /qdrant.Points/UpdateBatch 0 | 15 | 0.076 | 1529.39 |
| grpc /qdrant.Points/Recommend 0 | 402 | 2.046 | 40.86 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 3348.079 req/s, of which 1651.199 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 1669.702 | 0 | 63.32 | 88.122 | 4 | 218.42 | 2259.48 |
| 10.0.0.20 | 3a45fcfd | 1678.404 | 0 | 66.883 | 87.812 | 5 | 278.32 | 2273.523 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 0 | 0 | 0 | 55 | 0 |
| resolve address | /movie/:movieKey | 8465 | 0 | 0 | 502 | 0 |
| resolve address | /person/:personKey | 0 | 0 | 0 | 647 | 0 |
| resolve address | /discover/:type? | 0 | 0 | 0 | 1 | 0 |
| resolve address | /sign-up | 0 | 0 | 0 | 1 | 0 |
| resolve address | / | 4 | 1 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 3 | 0 |
| resolve address | /:type/:category | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 324 | 0 |
| 10.0.0.20 | /movie/:movieKey | 8530 | 0 | 0 | 409 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 58 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.20 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 2 | 0 | 0 | 0 | 1 |
| 10.0.0.20 | /explore/:type/:category/:text | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-up | 0 | 1 | 0 | 1 | 0 |
