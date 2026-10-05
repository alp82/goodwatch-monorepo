# 20261005T040741Z-load-pv-hot-nohome-private-reuse-duo-a

Label: pv-hot-nohome-private-reuse-duo-a. Time: 2026-10-05T04:08:02.141Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 30 visitors/s for 30 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 70 visitors/s for 35 s, then 80 visitors/s for 35 s, then 90 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<135

376627 requests; 1958.103 req/s; 0.002% errors; p95 161.994 ms; 173 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 37251 | 193.67 | 0 | 15.065 | 177.575 | 1208.626 | 13.707 | 172.807 | 1204.322 | 36866/0/0/0/0 |
| og_person | 118 | 0.613 | 0 | 11.618 | 477.695 | 1127.456 | 9.342 | 468.385 | 809.182 | 118/0/0/0/0 |
| og_share_list | 137 | 0.712 | 0 | 14.849 | 272.195 | 955.193 | 10.499 | 181.569 | 940.642 | 137/0/0/0/0 |
| og_title | 485 | 2.522 | 0 | 13.427 | 188.665 | 1366.851 | 9.586 | 174.841 | 1363.666 | 485/0/0/0/0 |
| person | 17959 | 93.37 | 0 | 12.263 | 106.111 | 922.628 | 11.006 | 103.42 | 904.558 | 17914/0/0/0/0 |
| share_list | 23390 | 121.606 | 0.004 | 11.852 | 194.142 | 1006.048 | 10.419 | 190.531 | 987.159 | 23253/0/0/1/0 |
| title_movie | 274204 | 1425.6 | 0.003 | 14.278 | 161.182 | 1143.81 | 12.934 | 157.067 | 1091.623 | 272331/0/0/2/4 |
| title_show | 23083 | 120.01 | 0 | 13.71 | 156.776 | 1128.741 | 12.37 | 154.716 | 1098.226 | 23020/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29149 | 971.633 | 0 | 9.725 | 26.382 | 51.133 | 8.334 | 24.229 |
| s02 | 50 | 55995 | 1599.857 | 0 | 10.468 | 46.121 | 122.735 | 9.135 | 43.653 |
| s03 | 60 | 68754 | 1964.4 | 0 | 11.344 | 58.308 | 184.778 | 10.022 | 56.551 |
| s04 | 70 | 79092 | 2259.771 | 0 | 14.065 | 69.416 | 156.818 | 12.856 | 67.193 |
| s05 | 80 | 90189 | 2576.829 | 0.008 | 19.314 | 230.053 | 1837.526 | 17.912 | 227.687 |
| s06 | 90 | 53448 | 2392.178 | 0.002 | 31.676 | 961.257 | 2732.646 | 29.519 | 935.664 |

## Page views

One visitor is one iteration, on a reused connection. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

11425 visitors; 10170 complete page views; 0.039% failed page views; page view p95 861.7 ms; 244 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29.967 | 26.433 | 0 | 5.141 | 22.609 | 29 | 64.4 | 971.633 | 0 | 3.767 | 22.406 | 30.165 |
| s02 | 50 | 48.571 | 43.429 | 0 | 6.007 | 43.634 | 30 | 110 | 1599.857 | 0 | 0 | 0 | 0 |
| s03 | 60 | 59.286 | 53.629 | 0 | 8.436 | 52.622 | 33 | 153.6 | 1964.4 | 0 | 0 | 0 | 0 |
| s04 | 70 | 69.286 | 61.371 | 0 | 11.106 | 64.877 | 39 | 166 | 2259.771 | 0 | 0 | 0 | 0 |
| s05 | 80 | 79.2 | 70.114 | 0.163 | 17.467 | 273.068 | 57 | 1772.55 | 2576.829 | 0.008 | 0.543 | 26.329 | 39.673 |
| s06 | 90 | 69.553 | 61.675 | 0 | 29.81 | 1039.128 | 82 | 2330.3 | 2392.178 | 0.002 | 5.013 | 25.18 | 51.428 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 49.47 | 322.561 | 72.959 | 46.388 | 58.939 | 92.063 | 4.047 | 44.422 | 50.581 | 57.858 | 229.362 | 119.54 | 30.742 | 36.375 | 0.31 | 0.21 | 28.089 | 32.809 | 0.12 | 0.109 |
| s02 | 50 | 72.88 | 375.15 | 66.675 | 306.107 | 67.564 | 134.972 | 2.95 | 52.745 | 63.438 | 68.894 | 425.326 | 215.921 | 34.976 | 38.597 | 0.348 | 0.213 | 36.217 | 39.831 | 0.122 | 0.093 |
| s03 | 60 | 73.799 | 409.839 | 67.043 | 100.586 | 79.292 | 167.416 | 41.292 | 289.33 | 67.792 | 73.32 | 508.067 | 266.515 | 39.432 | 43.96 | 0.379 | 0.304 | 45.316 | 52.861 | 0.152 | 0.143 |
| s04 | 70 | 77.147 | 429.124 | 64.197 | 62.903 | 87.257 | 169.631 | 61.056 | 129.422 | 69.029 | 71.015 | 603.523 | 310.385 | 49.434 | 68.336 | 0.398 | 0.428 | 44.862 | 49.134 | 0.152 | 0.155 |
| s05 | 80 | 82.643 | 452.025 | 63.433 | 97.178 | 94.512 | 218.316 | 67.654 | 296.146 | 75.189 | 79.647 | 692.676 | 358.211 | 61.763 | 68.975 | 0.545 | 0.423 | 52.178 | 55.236 | 0.147 | 0.135 |
| s06 | 90 | 83.286 | 475.678 | 83.187 | 136.893 | 90.235 | 651.483 | 551.006 | 257.086 | 78.818 | 81.566 | 643.006 | 315.26 | 85.16 | 98.337 | 0.63 | 0.478 | 50.133 | 54.869 | 0.161 | 0.15 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 39 | 66.863 | 81.566 | 5.825 | 8.06 | 36.944 | 261.965 | 509.819 | 772.173 | 11 |
| gw-vector1 | target | 16 | 38 | 46.929 | 98.337 | 7.783 | 19.8 | 53.891 | 0.325 | 0.409 | 0.759 | 11 |
| gw-cache1 | data | 8 | 38 | 2.827 | 16.196 | 0.274 | 0.52 | 31.771 | 0.408 | 0.424 | 1.102 | 14 |
| gw-cache2 | data | 8 | 38 | 5.062 | 21.365 | 0.513 | 0.83 | 31.414 | 0.645 | 0.562 | 2.201 | 8 |
| gw-cache3 | data | 8 | 39 | 1.721 | 7.157 | 0.073 | 0.2 | 31.441 | 0.378 | 0.348 | 1.055 | 15 |
| gw-worker3 | generator | 4 | 38 | 42.426 | 55.236 | 1.452 | 2.43 | 21.933 | 0.132 | 0.142 | 0.219 | 211 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 88.065 | 169.56 | 2357.406 | 2564.096 |
| abusive | coolify-proxy | 398.889 | 489.08 | 416.487 | 803.2 |
| gw-vector1 | gk4owk8-011237769659 | 96.197 | 232.97 | 2422.568 | 2423.808 |
| gw-vector1 | coolify-proxy | 185.765 | 750.84 | 230.118 | 705 |
| gw-vector1 | qdrant-main | 351.385 | 791 | 5102.673 | 5332.992 |

## Webapp process

From the webapp's own counters over 195.971 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 1989.656 req/s in total: 1924.952 from the benchmark and 64.703 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 3.211 on average, 18 at most. Event loop delay: 306.107 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 73.379 | 95.654 |
| webapp V8Worker | 10.373 | 56.844 |
| webapp libuv-worker | 2.474 | 5.543 |
| proxy | 407.739 | 495.033 |

The proxy accepted 68.569 connections per second on average, 88.361 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 371778 | 1897.106 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 8092 | 41.292 | 26.256 | 49.886 | 327.636 | 26.13 | 49.647 | 98.925 |
| /u/:handle/lists/:id | 1097 | 5.598 | 25.023 | 47.543 | 49.545 | 25 | 47.5 | 100 |
| /person/:personKey | 1008 | 5.144 | 35.795 | 277.895 | 541.818 | 26.14 | 49.666 | 95.833 |
| /discover/:type? | 900 | 4.593 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /show/:showKey | 683 | 3.485 | 27.9 | 253.864 | 715.417 | 27.585 | 174.464 | 96.486 |
| /og/:first/:second | 621 | 3.169 | 25.121 | 47.731 | 49.74 | n/a | n/a | 100 |
| /og/lists/:id/:file | 126 | 0.643 | 25.403 | 48.266 | 87 | n/a | n/a | 100 |
| /api/e | 6 | 0.031 | 225 | 850 | 970 | n/a | n/a | 66.667 |
| / | 5 | 0.026 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-up | 2 | 0.01 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-in | 1 | 0.005 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /:type | 1 | 0.005 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 75 | 23 | 49 | 69.333 | 145.455 | 198.636 |
| episode-grid | 75 | 20 | 53 | 73.333 | 35.256 | 145 |
| related-cards | 211 | 77 | 134 | 63.507 | 120.513 | 790.625 |
| details-movie-v2 | 423 | 107 | 301 | 74.704 | 144.867 | 198.935 |
| person-profile-v2 | 367 | 125 | 242 | 65.94 | 85.5 | 255.625 |
| person-fingerprint-baseline | 242 | 242 | 0 | 0 | n/a | n/a |
| movie-collection | 27 | 11 | 16 | 59.259 | 30.769 | 160 |
| share-list-view-v1 | 37 | 32 | 1 | 13.514 | 41.667 | 93.75 |
| share-list-availability-v1 | 20 | 20 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 514 | 2.623 | 50.624 |
| grpc /qdrant.Points/Get 0 | 518 | 2.643 | 21.366 |
| grpc /qdrant.Points/UpdateBatch 0 | 6 | 0.031 | 31.942 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 3909.337 req/s, of which 1984.385 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 3a45fcfd | 1989.656 | 0 | 73.379 | 95.654 | 18 | 306.107 | 2322.449 |
| 10.0.0.20 | 3a45fcfd | 1918.759 | 0 | 78.462 | 97.708 | 15 | 296.146 | 2433.512 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /show/:showKey | 608 | 1 | 0 | 74 | 0 |
| 10.0.0.21 | /movie/:movieKey | 7670 | 0 | 0 | 423 | 0 |
| 10.0.0.21 | /person/:personKey | 639 | 1 | 0 | 368 | 0 |
| 10.0.0.21 | /discover/:type? | 899 | 1 | 0 | 19 | 0 |
| 10.0.0.21 | /sign-up | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.21 | /u/:handle/lists/:id | 1071 | 24 | 0 | 2 | 0 |
| 10.0.0.21 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | / | 5 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /person/:personKey | 588 | 1 | 0 | 595 | 0 |
| 10.0.0.20 | /movie/:movieKey | 7514 | 0 | 0 | 485 | 0 |
| 10.0.0.20 | /show/:showKey | 618 | 1 | 0 | 78 | 0 |
| 10.0.0.20 | /discover/:type? | 825 | 1 | 0 | 23 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 1081 | 34 | 0 | 2 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 2 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-up | 0 | 1 | 0 | 2 | 0 |
