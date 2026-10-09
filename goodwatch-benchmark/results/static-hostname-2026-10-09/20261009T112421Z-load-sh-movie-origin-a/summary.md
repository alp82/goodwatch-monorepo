# 20261009T112421Z-load-sh-movie-origin-a

Label: sh-movie-origin-a. Time: 2026-10-09T11:24:53.750Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34 (dirty).

Rate plan: 10 visitors/s for 30 s, then 20 visitors/s for 35 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 70 visitors/s for 35 s, then 75 visitors/s for 35 s.

**Aborted:** page_view_failed{phase:main,step:s07}: rate<0.01

390907 requests; 1536.047 req/s; 0.047% errors; p95 146.428 ms; 84 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 390907 | 1536.047 | 0.047 | 16.29 | 146.428 | 1207.326 | 14.783 | 143.282 | 1206.068 | 390510/0/0/5/177 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 11063 | 368.767 | 0 | 11.085 | 31.113 | 51.817 | 9.675 | 29.037 |
| s02 | 20 | 24975 | 713.571 | 0 | 13.841 | 167.968 | 2761.789 | 12.503 | 165.406 |
| s03 | 30 | 37925 | 1083.571 | 0 | 10.379 | 33.714 | 67.865 | 9.11 | 31.899 |
| s04 | 40 | 50870 | 1453.429 | 0 | 13.953 | 162.778 | 3243.124 | 12.663 | 161.409 |
| s05 | 50 | 63825 | 1823.571 | 0 | 14.076 | 66.432 | 132.816 | 12.761 | 63.86 |
| s06 | 60 | 76775 | 2193.571 | 0 | 15.188 | 57.671 | 98.624 | 13.782 | 55.006 |
| s07 | 70 | 88715 | 2534.714 | 0.205 | 26.116 | 235.938 | 3757.81 | 24.102 | 232.992 |
| s08 | 75 | 36759 | 2537.049 | 0 | 37.029 | 504.745 | 3434.815 | 34.985 | 496.591 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

10561 visitors; 10531 complete page views; 0.284% failed page views; page view p95 947 ms; 21151 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9.967 | 9.967 | 0 | 5.794 | 23.251 | 49 | 83.2 | 368.767 | 0 | 19.933 | 13.9 | 25.913 |
| s02 | 20 | 19.286 | 19.286 | 0 | 8.259 | 161.648 | 55 | 524.6 | 713.571 | 0 | 38.571 | 13.788 | 25.815 |
| s03 | 30 | 29.286 | 29.286 | 0 | 5.313 | 29.997 | 45 | 91.8 | 1083.571 | 0 | 58.571 | 12.106 | 21.008 |
| s04 | 40 | 39.286 | 39.286 | 0 | 9.376 | 164.705 | 51 | 1954.4 | 1453.429 | 0 | 78.429 | 11.87 | 21.296 |
| s05 | 50 | 49.286 | 49.286 | 0 | 10.458 | 65.683 | 54 | 178.8 | 1823.571 | 0 | 98.571 | 11.491 | 20.875 |
| s06 | 60 | 59.286 | 59.286 | 0 | 12.863 | 53.574 | 57 | 142 | 2193.571 | 0 | 118.571 | 11.265 | 21.011 |
| s07 | 70 | 68.571 | 67.714 | 1.25 | 22.392 | 223.463 | 88 | 3830.5 | 2534.714 | 0.205 | 137.714 | 11.364 | 23.355 |
| s08 | 75 | 68.121 | 68.121 | 0 | 38.566 | 535.186 | 127 | 3661.8 | 2537.049 | 0 | 137.209 | 10.966 | 22.594 |

### By host

Files: origin. Pages name the static hostname. Static hostname: static.goodwatch.app.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 390907 | 1536.047 | 0.047 | 16.29 | 146.428 | 14.783 | 143.282 | 21151 | 37 | 567 | 2 |
| Static hostname | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 14 | 342 | n/a |

Site share of site and static traffic: 100% of requests and 100% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 40.439 | 113.078 | 66.619 | 79.877 | 48.479 | 43.254 | 2.239 | 126.538 | 33.03 | 38.829 | 106.781 | 62.657 | 15.35 | 19.904 | 0.232 | 0.998 | 15.912 | 17.771 | 1.733 | 47.524 |
| s02 | 20 | 60.827 | 188.42 | 116.149 | 182.768 | 81.475 | 74.355 | 22.411 | 290.378 | 46.095 | 50.941 | 199.825 | 109.984 | 22.349 | 28.645 | 0.257 | 1.478 | 35.65 | 39.37 | 3.268 | 89.79 |
| s03 | 30 | 55.929 | 240.028 | 144.68 | 95.081 | 62.534 | 97.191 | 0.276 | 68.998 | 52.896 | 56.606 | 300.644 | 151.776 | 25.585 | 33.125 | 2.217 | 8.365 | 45.465 | 48.808 | 4.954 | 139.705 |
| s04 | 40 | 59.768 | 295.829 | 179.581 | 203.216 | 81.832 | 141.786 | 18.329 | 303.486 | 59.681 | 68.78 | 402.513 | 225.839 | 36.026 | 40.968 | 1.954 | 12.904 | 52.886 | 58.105 | 6.607 | 188.205 |
| s05 | 50 | 80.125 | 322.315 | 235.565 | 106.288 | 84.449 | 158.14 | 31.1 | 140.956 | 68.27 | 73.671 | 497.439 | 259.883 | 26.021 | 26.873 | 0.405 | 0.885 | 61.529 | 67.986 | 8.216 | 235.082 |
| s06 | 60 | 82.719 | 364.359 | 261.748 | 146.33 | 83.963 | 183.371 | 3.507 | 68.277 | 69.104 | 71.096 | 594.549 | 309.839 | 27.068 | 29.291 | 0.415 | 1.148 | 69.581 | 73.265 | 9.86 | 283.538 |
| s07 | 70 | 91.494 | 403.857 | 302.863 | 108.647 | 99.341 | 329.374 | 196.567 | 150.525 | 76.48 | 79.934 | 665.381 | 352.188 | 38.76 | 50.483 | 0.567 | 1.446 | 77.038 | 81.412 | 11.265 | 325.835 |
| s08 | 75 | n/a | n/a | n/a | n/a | 101.795 | 753.401 | 272.44 | 201.118 | 72.788 | 72.788 | 541.907 | 280.88 | 48.434 | 59.972 | 0.579 | 1.545 | 75.962 | 79.044 | 11.895 | 340.621 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 51 | 58.639 | 79.934 | 4.306 | 7.46 | 40.724 | 214.885 | 403.335 | 711.892 | 10 |
| gw-vector1 | target | 16 | 51 | 27.843 | 59.972 | 3.856 | 9.66 | 52.785 | 3.714 | 0.814 | 4.99 | 6 |
| gw-worker3 | generator | 4 | 51 | 52.203 | 81.412 | 1.37 | 2.85 | 18.702 | 192.102 | 6.727 | 12.886 | 144 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-20261009T105601 | 149.083 | 252.31 | 3019.896 | 3129.344 |
| abusive | coolify-proxy | 280.558 | 411.37 | 390.724 | 721.4 |
| gw-vector1 | gk4owk8-20261009T105807 | 160.644 | 419.44 | 3091.737 | 3185.664 |
| gw-vector1 | coolify-proxy | 140.587 | 240.82 | 266.208 | 893.2 |

## Webapp process

From the webapp's own counters over 259.409 s, commit 42c2db2e. The times exclude the proxy, TLS, and the network.

Finished 1528.368 req/s in total: 1507.335 from the benchmark and 21.032 of background traffic, of which 3.809 are the crawler loop. Server errors: 0 per second. Requests in flight: 2.902 on average, 14 at most. Event loop delay: 203.216 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 69.529 | 102.191 |
| webapp V8Worker | 7.618 | 57.997 |
| webapp libuv-worker | 4.56 | 15.044 |
| proxy | 280.887 | 417.731 |

The proxy accepted 193.292 connections per second on average, 325.944 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 381158 | 1469.334 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 11041 | 42.562 | 25.901 | 49.212 | 266.211 | 25.842 | 49.101 | 99.275 |
| /person/:personKey | 1813 | 6.989 | 109.667 | 684.961 | 968.242 | 48.391 | 329.149 | 82.681 |
| /og/:first/:second | 413 | 1.592 | 590.144 | 1426.389 | 1885.278 | n/a | n/a | 9.927 |
| /show/:showKey | 249 | 0.96 | 174.37 | 820.833 | 1585 | 157.394 | 495 | 78.313 |
| /sign-up | 72 | 0.278 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 44 | 0.17 | 60 | 440 | 780 | 36.667 | 197.5 | 88.636 |
| /sign-in | 10 | 0.039 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| / | 5 | 0.019 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 1864 | 1224 | 628 | 34.335 | 85.748 | 287.308 |
| person-fingerprint-baseline | 640 | 640 | 0 | 0 | n/a | n/a |
| details-movie-v2 | 463 | 90 | 325 | 80.562 | 141.398 | 225.588 |
| details-missing-v1 | 598 | 0 | 598 | 100 | n/a | n/a |
| details-show-v2 | 455 | 230 | 208 | 49.451 | 145.64 | 251.667 |
| episode-grid | 249 | 23 | 220 | 90.763 | 29.737 | 124.545 |
| related-cards | 116 | 51 | 64 | 56.034 | 90.132 | 487.5 |
| movie-collection | 30 | 19 | 11 | 36.667 | 27.5 | 72.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 352 | 1.357 | 52.818 |
| grpc /qdrant.Points/Get 0 | 352 | 1.357 | 27.724 |
| grpc /qdrant.Points/UpdateBatch 0 | 10 | 0.039 | 40.184 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 3038.032 req/s, of which 1530.696 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 42c2db2e | 1528.368 | 0 | 69.529 | 102.191 | 14 | 203.216 | 2512.871 |
| 10.0.0.20 | 42c2db2e | 1505.151 | 0 | 77.834 | 104.222 | 23 | 303.486 | 2555.801 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /person/:personKey | 70 | 0 | 1 | 1743 | 0 |
| resolve address | /movie/:movieKey | 10597 | 0 | 0 | 446 | 0 |
| resolve address | /show/:showKey | 0 | 0 | 0 | 249 | 0 |
| resolve address | /sign-up | 71 | 1 | 0 | 0 | 0 |
| resolve address | /discover/:type? | 2 | 0 | 0 | 87 | 0 |
| resolve address | / | 5 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 4 | 0 |
| resolve address | /sign-in | 10 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 4 | 0 |
| 10.0.0.20 | /person/:personKey | 76 | 0 | 1 | 1810 | 0 |
| 10.0.0.20 | /movie/:movieKey | 10492 | 0 | 0 | 539 | 0 |
| 10.0.0.20 | /discover/:type? | 3 | 0 | 0 | 62 | 0 |
| 10.0.0.20 | /sign-up | 93 | 1 | 0 | 1 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 269 | 0 |
| 10.0.0.20 | / | 3 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-in | 7 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /:type/:category/:page | 0 | 0 | 0 | 1 | 0 |
