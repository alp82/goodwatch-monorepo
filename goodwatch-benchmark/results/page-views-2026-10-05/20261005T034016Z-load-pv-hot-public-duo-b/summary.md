# 20261005T034016Z-load-pv-hot-public-duo-b

Label: pv-hot-public-duo-b. Time: 2026-10-05T03:40:38.667Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 20 visitors/s for 30 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 55 visitors/s for 35 s, then 60 visitors/s for 35 s, then 65 visitors/s for 35 s, then 70 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<105

65063 requests; 814.965 req/s; 0% errors; p95 1534.194 ms; 120 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 5688 | 71.247 | 0 | 53.464 | 1516.848 | 3080.816 | 51.698 | 1499.234 | 3080.126 | 5444/0/0/0/0 |
| home | 4203 | 52.646 | 0 | 128.244 | 1697.918 | 2932.207 | 126.479 | 1657.467 | 2931.996 | 3986/0/0/0/0 |
| og_person | 21 | 0.263 | 0 | 284.26 | 1371.48 | 1418.905 | 282.917 | 1368.329 | 1404.768 | 21/0/0/0/0 |
| og_share_list | 17 | 0.213 | 0 | 195.123 | 1533.844 | 1600.73 | 191.753 | 1530.794 | 1597.257 | 17/0/0/0/0 |
| og_title | 71 | 0.889 | 0 | 157.461 | 1705.241 | 5819.918 | 131.099 | 1612.286 | 5801.359 | 71/0/0/0/0 |
| person | 2557 | 32.028 | 0 | 44.402 | 1115.796 | 1746.596 | 40.69 | 1114.69 | 1746.234 | 2520/0/0/0/0 |
| share_list | 4062 | 50.88 | 0 | 49.542 | 1677.485 | 4657.267 | 44.294 | 1613.385 | 4654.288 | 3996/0/0/0/0 |
| title_movie | 45337 | 567.881 | 0 | 42.763 | 1534.491 | 3820.436 | 40.108 | 1522.713 | 3818.924 | 44249/0/0/0/0 |
| title_show | 3107 | 38.918 | 0 | 56.117 | 1238.666 | 3071.022 | 49.474 | 1237.929 | 3070.846 | 3073/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 20104 | 670.133 | 0 | 16.776 | 393.437 | 1315.432 | 14.777 | 391.765 |
| s02 | 30 | 34108 | 974.514 | 0 | 50.646 | 1876.417 | 4691.556 | 47.521 | 1864.446 |
| s03 | 40 | 10851 | 731.43 | 0 | 390.161 | 1681.477 | 1955.232 | 376.297 | 1666.054 |
| s04 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s05 | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s06 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s07 | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s08 | 70 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

1895 visitors; 1712 complete page views; 0% failed page views; page view p95 3507.35 ms; 3781 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 19.967 | 18.133 | 0 | 12.748 | 339.911 | 85 | 1143.15 | 670.133 | 0 | 37.933 | 23.261 | 36.324 |
| s02 | 30 | 28.686 | 25.971 | 0 | 99.468 | 2383.352 | 361 | 4856.2 | 974.514 | 0 | 55.114 | 23.281 | 42.237 |
| s03 | 40 | 19.683 | 17.458 | 0 | 468.686 | 1702.586 | 1443 | 2674.2 | 731.43 | 0 | 48.128 | 24.914 | 104.206 |
| s04 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s05 | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s06 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s07 | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s08 | 70 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 70.906 | 378.359 | 145.53 | 270.98 | 64.454 | 57.769 | 15.887 | 259.446 | 65.438 | 72.157 | 183.865 | 96.647 | 53.268 | 58.775 | 0.391 | 0.224 | 30.729 | 41.285 | 3.171 | 87.921 |
| s02 | 30 | 92.067 | 444.355 | 181.636 | 0 | 93.102 | 94.4 | 125.816 | 346.739 | 80.345 | 82.152 | 275.807 | 153.749 | 57.923 | 64.926 | 0.329 | 0.251 | 40.315 | 46.749 | 4.795 | 132.404 |
| s03 | 40 | 98.845 | 348.141 | 136.557 | 0.218 | 114.652 | 105.488 | 517.69 | 850.318 | 77.096 | 84.613 | 222.236 | 117.049 | 78.207 | 81.943 | 0.363 | 0.3 | 37.925 | 41.654 | 4.215 | 109.839 |
| s04 | 50 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s05 | 55 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s06 | 60 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s07 | 65 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s08 | 70 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 16 | 71.879 | 84.613 | 4.179 | 5.88 | 41.574 | 118.854 | 219.641 | 337.448 | 10 |
| gw-vector1 | target | 16 | 16 | 57.607 | 74.472 | 11.236 | 11.92 | 53.706 | 0.234 | 0.35 | 0.628 | 8 |
| gw-cache1 | data | 8 | 16 | 5.832 | 16.187 | 0.341 | 0.48 | 32.078 | 0.43 | 3.773 | 5.55 | 9 |
| gw-cache2 | data | 8 | 17 | 5.812 | 18.916 | 0.319 | 0.59 | 31.749 | 0.451 | 0.561 | 0.837 | 8 |
| gw-cache3 | data | 8 | 17 | 3.109 | 8.676 | 0.287 | 0.37 | 31.658 | 0.486 | 0.412 | 1.271 | 10 |
| gw-worker1 | generator | 4 | 16 | 34.976 | 46.749 | 0.709 | 1.25 | 19.261 | 104.459 | 3.815 | 5.354 | 176 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 102.751 | 188.66 | 3030.592 | 3112.96 |
| abusive | coolify-proxy | 397.579 | 502.35 | 416.944 | 621.5 |
| gw-vector1 | gk4owk8-011237769659 | 89.065 | 117.53 | 2274.56 | 2298.88 |
| gw-vector1 | coolify-proxy | 78.122 | 117.48 | 137.525 | 245.8 |
| gw-vector1 | qdrant-main | 690.317 | 923.8 | 6401.728 | 6425.6 |

## Webapp process

From the webapp's own counters over 83.576 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 801.435 req/s in total: 786.335 from the benchmark and 15.1 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 5.067 on average, 13 at most. Event loop delay: 348.05 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 82.657 | 98.584 |
| webapp V8Worker | 38.159 | 62.758 |
| webapp libuv-worker | 2.88 | 4.06 |
| proxy | 411.249 | 502.756 |

The proxy accepted 164.344 connections per second on average, 205.62 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 62107 | 743.117 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 1427 | 17.074 | 28.887 | 715.104 | 2324.375 | 28.764 | 574.02 | 92.292 |
| /person/:personKey | 311 | 3.721 | 92.073 | 2084.375 | 4416.875 | 26.932 | 111 | 72.026 |
| /u/:handle/lists/:id | 206 | 2.465 | 25.122 | 47.732 | 49.741 | 25 | 47.5 | 100 |
| /discover/:type? | 131 | 1.567 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /show/:showKey | 121 | 1.448 | 31.842 | 1190 | 3185 | 31.51 | 695 | 83.471 |
| / | 108 | 1.292 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/living-room/picks | 104 | 1.244 | 666.667 | 1752.941 | 1997.647 | n/a | n/a | 0 |
| /og/:first/:second | 92 | 1.101 | 27.381 | 135 | 316 | n/a | n/a | 98.913 |
| /og/lists/:id/:file | 17 | 0.203 | 30.357 | 257.5 | 291.5 | n/a | n/a | 100 |
| /api/poster-impressions | 3 | 0.036 | 62.5 | 96.25 | 99.25 | n/a | n/a | 100 |
| /api/e | 1 | 0.012 | 150 | 285 | 297 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 28 | 6 | 21 | 78.571 | 188.889 | 950 |
| episode-grid | 28 | 5 | 23 | 82.143 | 35.938 | 285 |
| related-cards | 93 | 36 | 57 | 61.29 | 316.667 | 3575 |
| details-movie-v2 | 209 | 43 | 159 | 79.426 | 175.949 | 928.125 |
| person-profile-v2 | 213 | 60 | 153 | 71.831 | 100 | 1457.143 |
| person-fingerprint-baseline | 153 | 153 | 0 | 0 | n/a | n/a |
| movie-collection | 20 | 11 | 9 | 45 | 58.333 | 177.5 |
| share-list-view-v1 | 15 | 9 | 0 | 40 | 100 | 460 |
| share-list-availability-v1 | 9 | 9 | 0 | 0 | n/a | n/a |
| streaming-providers | 105 | 105 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 194 | 2.321 | 49.769 |
| grpc /qdrant.Points/Recommend 0 | 192 | 2.297 | 84.494 |
| grpc /qdrant.Points/UpdateBatch 0 | 2 | 0.024 | 19.932 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 1644.783 req/s, of which 858.448 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 801.435 | 0 | 82.657 | 98.584 | 13 | 348.05 | 3046.129 |
| 10.0.0.20 | 3a45fcfd | 833.877 | 0 | 78.212 | 99.533 | 12 | 850.318 | 2373.523 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 93 | 0 | 0 | 28 | 0 |
| resolve address | /movie/:movieKey | 1222 | 0 | 0 | 209 | 0 |
| resolve address | /person/:personKey | 97 | 0 | 0 | 216 | 0 |
| resolve address | /u/:handle/lists/:id | 183 | 21 | 0 | 2 | 0 |
| resolve address | / | 108 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| resolve address | /discover/:type? | 131 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /person/:personKey | 90 | 0 | 0 | 170 | 0 |
| 10.0.0.20 | /movie/:movieKey | 1310 | 0 | 0 | 194 | 0 |
| 10.0.0.20 | /show/:showKey | 100 | 0 | 0 | 32 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 167 | 11 | 0 | 2 | 0 |
| 10.0.0.20 | / | 107 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 144 | 0 | 0 | 0 | 0 |
