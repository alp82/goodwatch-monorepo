# 20261005T035115Z-load-pv-hot-nohome-public-duo-a

Label: pv-hot-nohome-public-duo-a. Time: 2026-10-05T03:51:37.723Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 30 visitors/s for 30 s, then 40 visitors/s for 35 s, then 45 visitors/s for 35 s, then 50 visitors/s for 35 s, then 55 visitors/s for 35 s, then 60 visitors/s for 35 s, then 65 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<98

331207 requests; 1532.193 req/s; 0% errors; p95 285.159 ms; 122 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 32324 | 149.534 | 0 | 21.38 | 251.829 | 688.489 | 18.439 | 199.565 | 558.607 | 32264/0/0/0/0 |
| og_person | 102 | 0.472 | 0 | 16.499 | 211.643 | 462.392 | 12.707 | 118.814 | 371.78 | 102/0/0/0/0 |
| og_share_list | 92 | 0.426 | 0 | 32.162 | 322.989 | 779.44 | 20.22 | 195.308 | 354.539 | 92/0/0/0/0 |
| og_title | 391 | 1.809 | 0 | 20.197 | 267.708 | 898.746 | 14.545 | 176.737 | 551.724 | 391/0/0/0/0 |
| person | 14834 | 68.623 | 0 | 19.907 | 321.089 | 873.482 | 16.258 | 225.263 | 696.48 | 14815/0/0/0/0 |
| share_list | 21932 | 101.459 | 0 | 19.68 | 224.502 | 709.613 | 16.398 | 160.542 | 619.332 | 21911/0/0/0/0 |
| title_movie | 240860 | 1114.24 | 0 | 22.249 | 292.036 | 877.053 | 19.003 | 233.544 | 768.215 | 240132/0/0/0/0 |
| title_show | 20672 | 95.631 | 0 | 20.095 | 296.368 | 1203.264 | 17.162 | 240.184 | 1184.316 | 20602/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29255 | 975.167 | 0 | 13.266 | 42.07 | 69.804 | 11.091 | 38.574 |
| s02 | 40 | 45298 | 1294.229 | 0 | 13.579 | 68.436 | 515.921 | 11.558 | 63.441 |
| s03 | 45 | 51545 | 1472.714 | 0 | 15.543 | 56.113 | 93.306 | 13.392 | 51.493 |
| s04 | 50 | 58093 | 1659.8 | 0 | 18.172 | 72.686 | 133.177 | 15.475 | 66.117 |
| s05 | 55 | 62622 | 1789.2 | 0 | 29.061 | 147.008 | 741.791 | 24.56 | 131.47 |
| s06 | 60 | 68334 | 1952.4 | 0 | 43.415 | 336.229 | 717.045 | 35.106 | 280.607 |
| s07 | 65 | 16060 | 1438.382 | 0 | 347.73 | 1299.206 | 1860.975 | 274.068 | 1192.296 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

10021 visitors; 9003 complete page views; 0% failed page views; page view p95 1155.8 ms; 19098 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29.967 | 26.767 | 0 | 7.025 | 30.756 | 63 | 116 | 975.167 | 0 | 56.8 | 24.188 | 41.668 |
| s02 | 40 | 39.286 | 35.229 | 0 | 8.405 | 76.197 | 63 | 316 | 1294.229 | 0 | 74.343 | 23.425 | 41.819 |
| s03 | 45 | 44.657 | 39.971 | 0 | 10.27 | 52.704 | 69 | 160 | 1472.714 | 0 | 84.6 | 23.298 | 43.454 |
| s04 | 50 | 49.629 | 45.229 | 0 | 12.478 | 64.459 | 79 | 208.9 | 1659.8 | 0 | 94.057 | 24.18 | 51.028 |
| s05 | 55 | 54.657 | 48.829 | 0 | 22.582 | 151.749 | 108 | 633.6 | 1789.2 | 0 | 103.543 | 25.93 | 83.081 |
| s06 | 60 | 59.629 | 53.286 | 0 | 35.104 | 240.599 | 163 | 1090.6 | 1952.4 | 0 | 112.6 | 38.211 | 292.222 |
| s07 | 65 | 40.035 | 36.81 | 0 | 296.992 | 858.648 | 1425 | 2940 | 1438.382 | 0 | 87.234 | 330.451 | 1220.532 |

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

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 52.558 | 425.709 | 183.303 | 40.457 | 53.227 | 80.843 | 0.236 | 74.372 | 83.013 | 84.444 | 273.181 | 173.16 | 65.107 | 73.555 | 0.313 | 0.223 | 36.112 | 46.134 | 4.351 | 127.817 |
| s02 | 40 | 65.878 | 528.842 | 219.226 | 469.161 | 64.474 | 96.201 | 10.327 | 67.294 | 84.769 | 91.321 | 360.138 | 184.463 | 66.046 | 79.235 | 0.339 | 0.229 | 45.393 | 47.132 | 5.98 | 174.786 |
| s03 | 45 | 68.161 | 563.589 | 237.38 | 183.555 | 66.328 | 107.611 | 2.949 | 85.71 | 87.2 | 88.897 | 394.103 | 206.454 | 66.939 | 72.049 | 0.321 | 0.21 | 45.301 | 49.844 | 6.517 | 189.442 |
| s04 | 50 | 64.949 | 595.943 | 258.77 | 75.093 | 64.782 | 110.318 | 0.433 | 82.04 | 90.335 | 92.159 | 451.267 | 238.446 | 77.369 | 86.622 | 0.35 | 0.238 | 52.229 | 56.266 | 7.452 | 219.904 |
| s05 | 55 | 75.853 | 618.391 | 274.17 | 574.543 | 74.251 | 124.433 | 11.877 | 90.1 | 94.815 | 97.64 | 493.885 | 260.568 | 69.707 | 74.722 | 0.355 | 0.258 | 52.415 | 59.238 | 8.083 | 237.091 |
| s06 | 60 | 70.542 | 643.464 | 290.17 | 109.761 | 70.356 | 137.842 | 76.88 | 69.522 | 97.475 | 99.284 | 518.456 | 274.2 | 61.906 | 71.272 | 0.431 | 0.291 | 55.991 | 58.651 | 8.494 | 251.326 |
| s07 | 65 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 95.245 | 99.329 | 439.888 | 238.343 | 38.578 | 38.578 | 0.503 | 0.348 | 51.656 | 52.415 | 7.963 | 219.491 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 43 | 88.978 | 99.329 | 8.446 | 10.56 | 42.129 | 218.514 | 408.092 | 545.913 | 10 |
| gw-vector1 | target | 16 | 43 | 67.134 | 86.622 | 14.45 | 17.16 | 54.387 | 0.251 | 0.373 | 1.39 | 11 |
| gw-cache1 | data | 8 | 43 | 3.629 | 18.635 | 0.502 | 0.9 | 31.859 | 0.622 | 0.483 | 1.201 | 8 |
| gw-cache2 | data | 8 | 43 | 4.148 | 17.136 | 0.379 | 0.55 | 31.61 | 0.547 | 0.502 | 1.012 | 8 |
| gw-cache3 | data | 8 | 44 | 2.996 | 16.052 | 0.165 | 0.33 | 31.522 | 0.534 | 0.341 | 0.691 | 9 |
| gw-worker3 | generator | 4 | 43 | 46.949 | 59.238 | 1.392 | 2.18 | 21.075 | 196.307 | 6.711 | 9.133 | 146 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 76.36 | 182.65 | 3168.304 | 3187.712 |
| abusive | coolify-proxy | 557.233 | 693.94 | 330.314 | 533.4 |
| gw-vector1 | gk4owk8-011237769659 | 77.81 | 132.92 | 2437.692 | 2439.168 |
| gw-vector1 | coolify-proxy | 107.935 | 152.1 | 119.175 | 143.3 |
| gw-vector1 | qdrant-main | 846.393 | 1155.28 | 5836.729 | 6037.504 |

## Webapp process

From the webapp's own counters over 221.43 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 1531.603 req/s in total: 1498.292 from the benchmark and 33.311 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.465 on average, 14 at most. Event loop delay: 574.543 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 66.673 | 92.252 |
| webapp V8Worker | 5.7 | 44.759 |
| webapp libuv-worker | 3.353 | 7.698 |
| proxy | 567.051 | 665.37 |

The proxy accepted 245.985 connections per second on average, 297.592 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 321187 | 1450.512 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 7408 | 33.455 | 27.486 | 168.211 | 424.714 | 27.277 | 146.385 | 98.529 |
| /person/:personKey | 1214 | 5.483 | 48.638 | 280.545 | 776.875 | 27.063 | 85.417 | 95.881 |
| /u/:handle/lists/:id | 995 | 4.494 | 25.025 | 47.548 | 49.55 | 25 | 47.5 | 100 |
| /show/:showKey | 749 | 3.383 | 33.557 | 341.111 | 886.818 | 33.069 | 252.703 | 94.259 |
| /discover/:type? | 733 | 3.31 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /og/:first/:second | 546 | 2.466 | 25.325 | 48.117 | 65.4 | n/a | n/a | 99.817 |
| /og/lists/:id/:file | 90 | 0.406 | 25.862 | 49.138 | 110 | n/a | n/a | 100 |
| /api/e | 8 | 0.036 | 150 | 285 | 297 | n/a | n/a | 100 |
| / | 4 | 0.018 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/poster-impressions | 4 | 0.018 | 100 | 190 | 198 | n/a | n/a | 100 |
| /api/related | 1 | 0.005 | 100 | 190 | 198 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 199 | 29 | 159 | 85.427 | 144.286 | 198.929 |
| episode-grid | 199 | 30 | 163 | 84.925 | 28.547 | 91.833 |
| related-cards | 373 | 138 | 235 | 63.003 | 99.364 | 663.462 |
| details-movie-v2 | 723 | 144 | 550 | 80.083 | 144.092 | 222.885 |
| person-profile-v2 | 685 | 170 | 515 | 75.182 | 74.7 | 196.56 |
| person-fingerprint-baseline | 515 | 515 | 0 | 0 | n/a | n/a |
| movie-collection | 39 | 20 | 19 | 48.718 | 25 | 47.5 |
| share-list-view-v1 | 39 | 34 | 0 | 12.821 | 62.5 | 275 |
| share-list-availability-v1 | 22 | 22 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 4 | 0.018 | 25.757 |
| grpc /qdrant.Points/Recommend 0 | 864 | 3.902 | 51.778 |
| grpc /qdrant.Points/Get 0 | 864 | 3.902 | 12.833 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 3060.216 req/s, of which 1561.924 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 1531.603 | 0 | 66.673 | 92.252 | 14 | 574.543 | 3123.801 |
| 10.0.0.20 | 3a45fcfd | 1528.537 | 0 | 66.308 | 83.711 | 6 | 120.116 | 2430.297 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 551 | 0 | 0 | 199 | 0 |
| resolve address | /movie/:movieKey | 6691 | 0 | 0 | 722 | 0 |
| resolve address | /person/:personKey | 528 | 0 | 0 | 686 | 0 |
| resolve address | /discover/:type? | 733 | 0 | 0 | 29 | 0 |
| resolve address | /u/:handle/lists/:id | 964 | 28 | 1 | 2 | 0 |
| resolve address | / | 4 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /person/:personKey | 521 | 0 | 0 | 389 | 0 |
| 10.0.0.20 | /movie/:movieKey | 6664 | 0 | 0 | 530 | 0 |
| 10.0.0.20 | /show/:showKey | 544 | 0 | 0 | 191 | 0 |
| 10.0.0.20 | /discover/:type? | 759 | 0 | 0 | 19 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 951 | 27 | 0 | 2 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 5 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /:type/:category/:page | 0 | 0 | 0 | 1 | 0 |
