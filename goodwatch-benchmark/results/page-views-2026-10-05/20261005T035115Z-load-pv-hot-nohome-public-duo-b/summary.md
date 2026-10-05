# 20261005T035115Z-load-pv-hot-nohome-public-duo-b

Label: pv-hot-nohome-public-duo-b. Time: 2026-10-05T03:51:38.006Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 30 visitors/s for 30 s, then 40 visitors/s for 35 s, then 45 visitors/s for 35 s, then 50 visitors/s for 35 s, then 55 visitors/s for 35 s, then 60 visitors/s for 35 s, then 65 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<98

328539 requests; 1520.478 req/s; 0% errors; p95 243.223 ms; 107 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 31283 | 144.778 | 0 | 22.972 | 242.779 | 627.585 | 19.446 | 202.112 | 587.884 | 31273/0/0/0/0 |
| og_person | 110 | 0.509 | 0 | 15.262 | 360.343 | 748.622 | 11.405 | 283.107 | 512.551 | 110/0/0/0/0 |
| og_share_list | 111 | 0.514 | 0 | 22.833 | 230.293 | 417.921 | 17.734 | 197.544 | 349.198 | 111/0/0/0/0 |
| og_title | 476 | 2.203 | 0 | 21.794 | 298.464 | 598.023 | 15.114 | 230.71 | 489.947 | 476/0/0/0/0 |
| person | 14292 | 66.143 | 0 | 19.335 | 206.347 | 593.99 | 16.192 | 181.868 | 562.979 | 14227/0/0/0/0 |
| share_list | 21408 | 99.076 | 0 | 19.439 | 232.492 | 750.465 | 16.433 | 208.906 | 707.464 | 21389/0/0/0/0 |
| title_movie | 240399 | 1112.566 | 0 | 21.923 | 254.657 | 760.44 | 18.86 | 221.022 | 705.214 | 239775/0/0/0/0 |
| title_show | 20460 | 94.689 | 0 | 22.056 | 204.642 | 574.106 | 18.835 | 178.452 | 559.925 | 20416/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 30388 | 1012.933 | 0 | 13.394 | 40.323 | 60.73 | 11.176 | 36.003 |
| s02 | 40 | 44345 | 1267 | 0 | 13.434 | 77.056 | 218.383 | 11.445 | 71.626 |
| s03 | 45 | 50437 | 1441.057 | 0 | 15.885 | 60.518 | 113.816 | 13.716 | 54.616 |
| s04 | 50 | 56729 | 1620.829 | 0 | 19.064 | 70.117 | 123.893 | 16.322 | 63.961 |
| s05 | 55 | 63054 | 1801.543 | 0 | 28.376 | 155.337 | 945.674 | 24.31 | 137.282 |
| s06 | 60 | 67970 | 1942 | 0 | 42.412 | 327.976 | 684.852 | 35.436 | 279.16 |
| s07 | 65 | 15616 | 1409.885 | 0 | 292.44 | 1019.42 | 1683.206 | 255.312 | 958.467 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

10037 visitors; 8922 complete page views; 0% failed page views; page view p95 1147 ms; 19096 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29.967 | 27.533 | 0 | 7.151 | 35.315 | 63 | 120 | 1012.933 | 0 | 56.8 | 24.296 | 41.236 |
| s02 | 40 | 39.286 | 34.543 | 0 | 7.88 | 80.244 | 62 | 303.6 | 1267 | 0 | 74.429 | 23.15 | 42.341 |
| s03 | 45 | 44.657 | 39.314 | 0 | 10.225 | 52.119 | 70 | 159 | 1441.057 | 0 | 84.6 | 23.084 | 43.117 |
| s04 | 50 | 49.629 | 44.057 | 0 | 13.185 | 67.789 | 79 | 205.8 | 1620.829 | 0 | 94.057 | 23.707 | 50.249 |
| s05 | 55 | 54.657 | 49.057 | 0 | 23.073 | 165.423 | 111 | 778.2 | 1801.543 | 0 | 103.429 | 25.45 | 82.493 |
| s06 | 60 | 59.629 | 52.857 | 0 | 34.597 | 252.118 | 164.5 | 1059.55 | 1942 | 0 | 112.686 | 38.156 | 300.949 |
| s07 | 65 | 41.802 | 36.294 | 0 | 274.872 | 1063.618 | 1390 | 2837.45 | 1409.885 | 0 | 87.576 | 328.438 | 1179.938 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 53.157 | 425.177 | 183.364 | 98.686 | 53.734 | 79.597 | 0.236 | 56.415 | 83.77 | 85.447 | 277.422 | 174.582 | 64.99 | 74.074 | 0.281 | 0.204 | 38.642 | 41.946 | 4.692 | 134.135 |
| s02 | 40 | 65.733 | 528.024 | 218.361 | 58.25 | 64.354 | 96.216 | 10.306 | 42.39 | 84.659 | 92.68 | 360.794 | 185.336 | 67.313 | 78.671 | 0.337 | 0.232 | 44.343 | 47.629 | 6.079 | 171.622 |
| s03 | 45 | 68.213 | 565.366 | 238.352 | 53.4 | 65.693 | 106.467 | 0.275 | 57.005 | 86.992 | 87.765 | 392.233 | 207.783 | 66.825 | 72.159 | 0.315 | 0.214 | 50.789 | 59.886 | 6.651 | 187.9 |
| s04 | 50 | 64.968 | 596.438 | 258.058 | 44.848 | 64.497 | 110.734 | 0.433 | 65.197 | 90.919 | 91.673 | 450.593 | 237.673 | 77.972 | 84.347 | 0.344 | 0.236 | 50.812 | 55.343 | 7.567 | 216.792 |
| s05 | 55 | 74.699 | 605.456 | 269.291 | 396.285 | 72.636 | 122.404 | 10.768 | 64.673 | 94.585 | 96.621 | 493.697 | 259.86 | 69.585 | 74.41 | 0.365 | 0.262 | 52.65 | 58.23 | 8.304 | 239.131 |
| s06 | 60 | 71.491 | 647.64 | 291.607 | 39.703 | 68.856 | 134.055 | 50.667 | 127.718 | 97.383 | 99.193 | 517.533 | 272.137 | 61.365 | 69.736 | 0.436 | 0.295 | 55.653 | 61.705 | 8.626 | 248.865 |
| s07 | 65 | 87.546 | 661.737 | 281.466 | 101.766 | 74.439 | 163.178 | 370.431 | 64.738 | 99.183 | 99.183 | 505.654 | 266.895 | 38.044 | 38.044 | 0.506 | 0.352 | 55.773 | 55.773 | 8.722 | 238.292 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 43 | 89.198 | 99.308 | 8.488 | 10.56 | 42.089 | 219.866 | 410.535 | 580.795 | 10 |
| gw-vector1 | target | 16 | 43 | 66.978 | 84.347 | 14.48 | 17.16 | 54.378 | 0.252 | 0.374 | 1.329 | 11 |
| gw-cache1 | data | 8 | 43 | 3.546 | 18.793 | 0.502 | 0.9 | 31.873 | 0.623 | 0.485 | 0.992 | 8 |
| gw-cache2 | data | 8 | 43 | 4.188 | 16.51 | 0.386 | 0.55 | 31.586 | 0.555 | 0.503 | 0.912 | 8 |
| gw-cache3 | data | 8 | 43 | 2.753 | 16.804 | 0.166 | 0.33 | 31.503 | 0.528 | 0.343 | 0.752 | 9 |
| gw-worker1 | generator | 4 | 43 | 48.067 | 61.705 | 1.664 | 2.88 | 18.975 | 197.337 | 6.918 | 9.802 | 145 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 76.573 | 182.65 | 3168.304 | 3187.712 |
| abusive | coolify-proxy | 563.539 | 709.56 | 331.04 | 533.4 |
| gw-vector1 | gk4owk8-011237769659 | 84.414 | 215.17 | 2437.668 | 2439.168 |
| gw-vector1 | coolify-proxy | 110.472 | 180.34 | 118.589 | 199 |
| gw-vector1 | qdrant-main | 838.147 | 1155.28 | 5837.467 | 6037.504 |

## Webapp process

From the webapp's own counters over 219.975 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 1541.489 req/s in total: 1496.402 from the benchmark and 45.087 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.674 on average, 7 at most. Event loop delay: 396.285 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 67.09 | 87.546 |
| webapp V8Worker | 5.714 | 46.402 |
| webapp libuv-worker | 3.371 | 8.101 |
| proxy | 568.887 | 678.742 |

The proxy accepted 246.422 connections per second on average, 304.15 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 321187 | 1460.107 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 7402 | 33.649 | 27.464 | 167.827 | 424.929 | 27.259 | 145.794 | 98.527 |
| /person/:personKey | 1206 | 5.482 | 48.395 | 281.273 | 779.375 | 27.047 | 85 | 95.854 |
| /u/:handle/lists/:id | 995 | 4.523 | 25.025 | 47.548 | 49.55 | 25 | 47.5 | 100 |
| /show/:showKey | 747 | 3.396 | 33.468 | 341.852 | 887.727 | 32.981 | 252.973 | 94.244 |
| /discover/:type? | 733 | 3.332 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /og/:first/:second | 546 | 2.482 | 25.325 | 48.117 | 65.4 | n/a | n/a | 99.817 |
| /og/lists/:id/:file | 90 | 0.409 | 25.862 | 49.138 | 110 | n/a | n/a | 100 |
| /api/e | 8 | 0.036 | 150 | 285 | 297 | n/a | n/a | 100 |
| / | 4 | 0.018 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/poster-impressions | 4 | 0.018 | 100 | 190 | 198 | n/a | n/a | 100 |
| /api/related | 1 | 0.005 | 100 | 190 | 198 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 196 | 29 | 156 | 85.204 | 144.604 | 198.993 |
| episode-grid | 196 | 30 | 160 | 84.694 | 28.621 | 92.333 |
| related-cards | 368 | 137 | 231 | 62.772 | 100.649 | 671.154 |
| details-movie-v2 | 719 | 143 | 547 | 80.111 | 144.15 | 223.846 |
| person-profile-v2 | 677 | 169 | 508 | 75.037 | 74.59 | 196.852 |
| person-fingerprint-baseline | 508 | 508 | 0 | 0 | n/a | n/a |
| movie-collection | 39 | 20 | 19 | 48.718 | 25 | 47.5 |
| share-list-view-v1 | 39 | 34 | 0 | 12.821 | 62.5 | 275 |
| share-list-availability-v1 | 22 | 22 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 850 | 3.864 | 13.015 |
| grpc /qdrant.Points/UpdateBatch 0 | 4 | 0.018 | 25.757 |
| grpc /qdrant.Points/Recommend 0 | 850 | 3.864 | 51.946 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 3080.104 req/s, of which 1583.703 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 1541.489 | 0 | 67.09 | 87.546 | 7 | 396.285 | 3123.801 |
| 10.0.0.20 | 3a45fcfd | 1532.684 | 0 | 66.292 | 87.581 | 5 | 127.718 | 2430.047 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 551 | 0 | 0 | 196 | 0 |
| resolve address | /movie/:movieKey | 6691 | 0 | 0 | 718 | 0 |
| resolve address | /person/:personKey | 528 | 0 | 0 | 678 | 0 |
| resolve address | /discover/:type? | 733 | 0 | 0 | 29 | 0 |
| resolve address | /u/:handle/lists/:id | 964 | 28 | 1 | 2 | 0 |
| resolve address | / | 4 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /person/:personKey | 521 | 0 | 0 | 389 | 0 |
| 10.0.0.20 | /movie/:movieKey | 6664 | 0 | 0 | 528 | 0 |
| 10.0.0.20 | /show/:showKey | 544 | 0 | 0 | 189 | 0 |
| 10.0.0.20 | /discover/:type? | 759 | 0 | 0 | 19 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 951 | 27 | 0 | 2 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 5 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /:type/:category/:page | 0 | 0 | 0 | 1 | 0 |
