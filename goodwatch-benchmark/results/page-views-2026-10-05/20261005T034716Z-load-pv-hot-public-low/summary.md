# 20261005T034716Z-load-pv-hot-public-low

Label: pv-hot-public-low. Time: 2026-10-05T03:47:37.804Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 10 visitors/s for 30 s, then 20 visitors/s for 35 s, then 25 visitors/s for 35 s, then 30 visitors/s for 35 s, then 35 visitors/s for 35 s.

134540 requests; 779.979 req/s; 0% errors; p95 308.049 ms; 20 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 10985 | 63.684 | 0 | 15.165 | 291.548 | 502.833 | 13.588 | 286.781 | 501.535 | 10955/0/0/0/0 |
| home | 8191 | 47.486 | 0 | 21.465 | 443.229 | 1178.884 | 19.495 | 437.647 | 1162.511 | 8191/0/0/0/0 |
| og_person | 42 | 0.243 | 0 | 12.717 | 284.178 | 412.601 | 10.675 | 279.018 | 409.685 | 42/0/0/0/0 |
| og_share_list | 40 | 0.232 | 0 | 14.282 | 488.682 | 722.82 | 9.529 | 484.813 | 709.22 | 40/0/0/0/0 |
| og_title | 168 | 0.974 | 0 | 10.472 | 322.721 | 650.922 | 7.755 | 318.285 | 558.032 | 168/0/0/0/0 |
| person | 5542 | 32.129 | 0 | 12.059 | 264.791 | 550.767 | 10.4 | 263.65 | 549.707 | 5542/0/0/0/0 |
| share_list | 8986 | 52.095 | 0 | 12.014 | 109.862 | 425.539 | 10.101 | 107.086 | 425.422 | 8986/0/0/0/0 |
| title_movie | 93075 | 539.591 | 0 | 13.778 | 250.518 | 490.889 | 12.153 | 249.145 | 490.543 | 93075/0/0/0/0 |
| title_show | 7511 | 43.544 | 0 | 14.571 | 374.199 | 1586.126 | 12.864 | 373.71 | 1585.702 | 7511/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9540 | 318 | 0 | 10.416 | 30.265 | 284.812 | 8.725 | 27.985 |
| s02 | 20 | 22281 | 636.6 | 0 | 11.829 | 113.64 | 400.774 | 9.931 | 112.373 |
| s03 | 25 | 27649 | 789.971 | 0 | 12.208 | 95.876 | 363.995 | 10.497 | 92.065 |
| s04 | 30 | 34803 | 994.371 | 0 | 14.186 | 265.964 | 380.989 | 12.388 | 264.371 |
| s05 | 35 | 40267 | 1150.486 | 0 | 24 | 422.222 | 2039.049 | 22.588 | 420.876 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

4075 visitors; 3654 complete page views; 0% failed page views; page view p95 731.4 ms; 7743 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9.967 | 8.7 | 0 | 4.964 | 64.402 | 56 | 308 | 318 | 0 | 18.933 | 24.309 | 34.482 |
| s02 | 20 | 19.286 | 17.257 | 0 | 5.293 | 207.281 | 59 | 498.1 | 636.6 | 0 | 36.657 | 24.239 | 35.875 |
| s03 | 25 | 24.657 | 21.629 | 0 | 5.532 | 239.201 | 59 | 441.6 | 789.971 | 0 | 46.771 | 23.38 | 35.34 |
| s04 | 30 | 29.629 | 26.943 | 0 | 6.988 | 280.259 | 67 | 604.5 | 994.371 | 0 | 56.257 | 24.601 | 36.776 |
| s05 | 35 | 34.314 | 31.114 | 0 | 28.615 | 397.165 | 117 | 1318.2 | 1150.486 | 0 | 65.314 | 21.668 | 33.687 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 34.453 | 216.658 | 86.567 | 355.39 | 39.949 | 22.133 | 0.739 | 307.418 | 42.003 | 43.689 | 50.272 | 26.266 | 24.693 | 28.135 | 0.207 | 0.118 | 16.032 | 22.711 | 1.537 | 42.578 |
| s02 | 20 | 55.054 | 275.744 | 105.867 | 504.812 | 54.455 | 39.038 | 7.61 | 404.149 | 52.951 | 62.325 | 98.691 | 52.882 | 28.673 | 32.935 | 0.244 | 0.151 | 30.465 | 36.842 | 3.13 | 88.739 |
| s03 | 25 | 55.577 | 294.523 | 114.367 | 776.918 | 52.951 | 41.851 | 0.235 | 355.39 | 55.692 | 62.798 | 118.741 | 57.996 | 31.526 | 45.432 | 0.247 | 0.168 | 29.847 | 33.021 | 3.864 | 109.498 |
| s04 | 30 | 62.989 | 333.441 | 126.357 | 391.304 | 63.182 | 51.181 | 9.922 | 603.378 | 58.746 | 63.179 | 145.404 | 77.618 | 47.794 | 54.814 | 0.233 | 0.139 | 34.93 | 36.165 | 4.562 | 131.711 |
| s05 | 35 | 79.919 | 346.427 | 137.241 | 1100.928 | 71.726 | 53.038 | 20.526 | 522.638 | 63.295 | 67.384 | 163.249 | 87.185 | 56.1 | 69.128 | 0.282 | 0.184 | 34.302 | 39.142 | 5.469 | 153.675 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 35 | 54.002 | 67.384 | 4.743 | 6.43 | 41.082 | 59.128 | 112.294 | 193.748 | 8 |
| gw-vector1 | target | 16 | 34 | 38.492 | 69.128 | 7.105 | 9.51 | 53.163 | 0.154 | 0.242 | 0.495 | 7 |
| gw-cache1 | data | 8 | 34 | 2.627 | 5.856 | 0.286 | 0.49 | 31.847 | 0.628 | 1.98 | 4.512 | 7 |
| gw-cache2 | data | 8 | 35 | 2.311 | 8.546 | 0.364 | 0.78 | 31.51 | 0.595 | 0.543 | 1.229 | 7 |
| gw-cache3 | data | 8 | 35 | 4.282 | 15.316 | 0.218 | 0.47 | 31.576 | 0.617 | 0.449 | 2.113 | 8 |
| gw-worker3 | generator | 4 | 34 | 28.392 | 39.142 | 0.757 | 1.67 | 19.942 | 101.351 | 3.579 | 5.903 | 43 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 75.443 | 145.05 | 3144.382 | 3149.824 |
| abusive | coolify-proxy | 289.62 | 362.16 | 307.623 | 471.4 |
| gw-vector1 | gk4owk8-011237769659 | 83.508 | 242.49 | 2448.444 | 2466.816 |
| gw-vector1 | coolify-proxy | 42.996 | 69.16 | 105.612 | 136.8 |
| gw-vector1 | qdrant-main | 390.515 | 775.92 | 5561.464 | 5795.84 |

## Webapp process

From the webapp's own counters over 176.172 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 426.037 req/s in total: 768.719 from the benchmark and -342.681 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 3.97 on average, 27 at most. Event loop delay: 1100.928 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 58.165 | 94.052 |
| webapp V8Worker | 20.853 | 62.701 |
| webapp libuv-worker | 4.139 | 9.005 |
| proxy | 291.878 | 401.532 |

The proxy accepted 112.964 connections per second on average, 159.067 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 66568 | 377.857 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 1866 | 10.592 | 34.97 | 485.161 | 1813.6 | 34.212 | 342.182 | 93.462 |
| /person/:personKey | 667 | 3.786 | 81.178 | 779.054 | 1939.091 | 27.082 | 89.599 | 88.456 |
| /show/:showKey | 263 | 1.493 | 113.571 | 1585 | 4123.333 | 103.247 | 1085 | 84.411 |
| /u/:handle/lists/:id | 213 | 1.209 | 25.118 | 47.724 | 49.733 | 25.118 | 47.724 | 100 |
| /discover/:type? | 138 | 0.783 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| / | 109 | 0.619 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /og/:first/:second | 106 | 0.602 | 26.238 | 49.851 | 394 | n/a | n/a | 98.113 |
| /api/living-room/picks | 106 | 0.602 | 414.063 | 1140 | 1988 | n/a | n/a | 0 |
| /og/lists/:id/:file | 19 | 0.108 | 29.688 | 105 | 181 | n/a | n/a | 100 |
| /api/e | 5 | 0.028 | 250 | 875 | 975 | n/a | n/a | 80 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 159 | 22 | 130 | 86.164 | 151.471 | 691.667 |
| episode-grid | 159 | 22 | 136 | 86.164 | 30.044 | 310 |
| related-cards | 280 | 100 | 180 | 64.286 | 91.827 | 1600 |
| details-movie-v2 | 579 | 89 | 464 | 84.629 | 150.556 | 439.583 |
| person-profile-v2 | 549 | 147 | 402 | 73.224 | 78.655 | 602.632 |
| person-fingerprint-baseline | 402 | 402 | 0 | 0 | n/a | n/a |
| movie-collection | 36 | 17 | 19 | 52.778 | 29.688 | 310 |
| share-list-view-v1 | 28 | 18 | 1 | 35.714 | 50 | 750 |
| share-list-availability-v1 | 18 | 18 | 0 | 0 | n/a | n/a |
| streaming-providers | 106 | 106 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 692 | 3.928 | 56.633 |
| grpc /qdrant.Points/Get 0 | 694 | 3.939 | 17.469 |
| grpc /qdrant.Points/UpdateBatch 0 | 5 | 0.028 | 36.634 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 839.462 req/s, of which 70.743 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 426.037 | 0 | 58.165 | 94.052 | 27 | 1100.928 | 3120.324 |
| 10.0.0.20 | 3a45fcfd | 411.761 | 0 | 56.767 | 84.247 | 13 | 603.378 | 2430.508 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 104 | 0 | 0 | 159 | 0 |
| resolve address | /movie/:movieKey | 1290 | 1 | 0 | 578 | 0 |
| resolve address | /person/:personKey | 115 | 0 | 0 | 552 | 0 |
| resolve address | /discover/:type? | 138 | 0 | 0 | 17 | 0 |
| resolve address | /u/:handle/lists/:id | 186 | 25 | 0 | 2 | 0 |
| resolve address | / | 109 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /person/:personKey | 86 | 0 | 0 | 417 | 0 |
| 10.0.0.20 | /movie/:movieKey | 1291 | 1 | 0 | 499 | 0 |
| 10.0.0.20 | /show/:showKey | 97 | 0 | 0 | 140 | 0 |
| 10.0.0.20 | /discover/:type? | 120 | 0 | 0 | 22 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 180 | 18 | 0 | 2 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 99 | 1 | 0 | 0 | 0 |
