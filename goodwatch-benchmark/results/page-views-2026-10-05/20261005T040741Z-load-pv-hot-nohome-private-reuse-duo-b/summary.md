# 20261005T040741Z-load-pv-hot-nohome-private-reuse-duo-b

Label: pv-hot-nohome-private-reuse-duo-b. Time: 2026-10-05T04:08:03.202Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 30 visitors/s for 30 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 70 visitors/s for 35 s, then 80 visitors/s for 35 s, then 90 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<135

373083 requests; 1960.08 req/s; 0.001% errors; p95 162.786 ms; 152 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 36128 | 189.807 | 0 | 15.436 | 110.398 | 1146.439 | 13.881 | 107.725 | 1142.128 | 35957/0/0/0/0 |
| og_person | 116 | 0.609 | 0 | 11.85 | 380.478 | 739.733 | 9.602 | 359.847 | 712.246 | 116/0/0/0/0 |
| og_share_list | 125 | 0.657 | 0 | 18.21 | 632.797 | 1014.234 | 13.955 | 553.256 | 975.202 | 125/0/0/0/0 |
| og_title | 505 | 2.653 | 0 | 12.254 | 481.823 | 1603.51 | 9.171 | 383.055 | 1601.692 | 505/0/0/0/0 |
| person | 16065 | 84.401 | 0 | 12.243 | 173.651 | 1681.716 | 10.832 | 171.436 | 1679.338 | 15986/0/0/0/0 |
| share_list | 25342 | 133.14 | 0 | 12.234 | 206.457 | 1063.955 | 10.727 | 199.129 | 1006.002 | 25199/0/0/0/0 |
| title_movie | 271697 | 1427.424 | 0.002 | 14.365 | 174.125 | 1224.662 | 13.006 | 168.236 | 1175.082 | 269871/0/0/3/2 |
| title_show | 23105 | 121.388 | 0 | 14.207 | 234.363 | 1800.868 | 12.947 | 232.444 | 1798.913 | 23069/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29890 | 996.333 | 0 | 9.756 | 29.591 | 52.222 | 8.349 | 28 |
| s02 | 50 | 55765 | 1593.286 | 0 | 10.617 | 44.406 | 87.915 | 9.313 | 42.017 |
| s03 | 60 | 67740 | 1935.429 | 0 | 11.488 | 57.238 | 198.425 | 10.191 | 55.663 |
| s04 | 70 | 79545 | 2272.714 | 0 | 14.211 | 65.142 | 145.537 | 12.838 | 63.694 |
| s05 | 80 | 92056 | 2630.171 | 0.004 | 19.383 | 283.248 | 2722.595 | 17.909 | 280.675 |
| s06 | 90 | 48087 | 2364.073 | 0.002 | 35.49 | 978.38 | 3053.346 | 33.173 | 935.938 |

## Page views

One visitor is one iteration, on a reused connection. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

11292 visitors; 10100 complete page views; 0.03% failed page views; page view p95 1082 ms; 232 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29.967 | 27.3 | 0 | 4.934 | 24.664 | 30 | 71 | 996.333 | 0 | 3.767 | 21.655 | 31.322 |
| s02 | 50 | 48.571 | 43.371 | 0 | 6.902 | 42.248 | 32 | 104 | 1593.286 | 0 | 0 | 0 | 0 |
| s03 | 60 | 59.286 | 52.829 | 0 | 7.806 | 60.549 | 34 | 155.6 | 1935.429 | 0 | 0 | 0 | 0 |
| s04 | 70 | 69.286 | 61.886 | 0 | 10.902 | 69.96 | 40 | 189.5 | 2272.714 | 0 | 0 | 0 | 0 |
| s05 | 80 | 79.229 | 71.714 | 0.08 | 16.886 | 288.437 | 58 | 2235.45 | 2630.171 | 0.004 | 0.4 | 22.611 | 33.777 |
| s06 | 90 | 69.811 | 60.863 | 0.081 | 33.488 | 1028.031 | 87 | 3318.8 | 2364.073 | 0.002 | 5.162 | 22.761 | 63.651 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 49.269 | 320.782 | 70.718 | 42.915 | 59.756 | 93.503 | 3.968 | 58.774 | 51.445 | 58.298 | 238.687 | 123.818 | 30.875 | 41.261 | 0.319 | 0.222 | 31.542 | 40.252 | 0.104 | 0.113 |
| s02 | 50 | 72.733 | 374.19 | 67.135 | 38.622 | 67.795 | 134.645 | 2.951 | 52.286 | 64.275 | 70.723 | 431.53 | 218.196 | 35.088 | 39.248 | 0.335 | 0.209 | 36.999 | 40.223 | 0.062 | 0.084 |
| s03 | 60 | 73.75 | 408.885 | 66.485 | 98.948 | 79.309 | 167.408 | 42.02 | 79.549 | 67.593 | 71.57 | 511.414 | 268.557 | 39.329 | 44.099 | 0.381 | 0.303 | 43.25 | 50.474 | 0.095 | 0.123 |
| s04 | 70 | 78.367 | 427.719 | 64.18 | 40.457 | 86.32 | 167.437 | 54.945 | 113.235 | 69.191 | 71.204 | 605.826 | 313.201 | 50.076 | 67.192 | 0.408 | 0.438 | 49.449 | 53.497 | 0.188 | 0.194 |
| s05 | 80 | 83.559 | 454.646 | 63.131 | 87.414 | 93.813 | 209.923 | 39.868 | 40.785 | 75.275 | 81.598 | 699.004 | 364.617 | 61.098 | 68.586 | 0.543 | 0.421 | 54.923 | 62.988 | 0.159 | 0.195 |
| s06 | 90 | 82.6 | 476.257 | 84.376 | 122.868 | 85.863 | 549.901 | 478.214 | 434.82 | 80.492 | 83.851 | 692.106 | 330.633 | 86.794 | 98.307 | 0.653 | 0.497 | 54.053 | 55.222 | 0.155 | 0.195 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 38 | 66.896 | 83.851 | 5.779 | 8.06 | 36.882 | 263.75 | 514.265 | 770.185 | 10 |
| gw-vector1 | target | 16 | 38 | 47.25 | 98.307 | 7.803 | 19.8 | 53.911 | 0.328 | 0.411 | 0.765 | 12 |
| gw-cache1 | data | 8 | 38 | 2.818 | 16.27 | 0.274 | 0.52 | 31.76 | 0.406 | 0.428 | 1.061 | 14 |
| gw-cache2 | data | 8 | 37 | 5.179 | 18.446 | 0.511 | 0.83 | 31.438 | 0.658 | 0.56 | 2.252 | 8 |
| gw-cache3 | data | 8 | 38 | 1.616 | 6.166 | 0.075 | 0.2 | 31.436 | 0.367 | 0.341 | 1.034 | 15 |
| gw-worker1 | generator | 4 | 38 | 43.735 | 62.988 | 1.486 | 2.35 | 19.695 | 0.145 | 0.124 | 0.416 | 233 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 88.086 | 158.66 | 2360.509 | 2564.096 |
| abusive | coolify-proxy | 404.951 | 539.64 | 411.326 | 955.1 |
| gw-vector1 | gk4owk8-011237769659 | 96.776 | 232.97 | 2422.541 | 2423.808 |
| gw-vector1 | coolify-proxy | 187.295 | 750.84 | 230.676 | 705 |
| gw-vector1 | qdrant-main | 354.785 | 791 | 5102.942 | 5332.992 |

## Webapp process

From the webapp's own counters over 194.02 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 2009.315 req/s in total: 1925.55 from the benchmark and 83.765 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 3.079 on average, 9 at most. Event loop delay: 124.572 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 73.533 | 93.444 |
| webapp V8Worker | 11.008 | 58.717 |
| webapp libuv-worker | 2.487 | 6.01 |
| proxy | 407.951 | 484.463 |

The proxy accepted 68.256 connections per second on average, 84.918 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 371778 | 1916.185 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 8090 | 41.697 | 26.249 | 49.873 | 327.727 | 26.124 | 49.635 | 98.925 |
| /u/:handle/lists/:id | 1097 | 5.654 | 25.023 | 47.543 | 49.545 | 25 | 47.5 | 100 |
| /person/:personKey | 1002 | 5.164 | 35.684 | 278.684 | 544.545 | 26.137 | 49.661 | 95.808 |
| /discover/:type? | 900 | 4.639 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /show/:showKey | 682 | 3.515 | 27.859 | 254.091 | 715.833 | 27.589 | 174.643 | 96.481 |
| /og/:first/:second | 621 | 3.201 | 25.121 | 47.731 | 49.74 | n/a | n/a | 100 |
| /og/lists/:id/:file | 126 | 0.649 | 25.403 | 48.266 | 87 | n/a | n/a | 100 |
| /api/e | 6 | 0.031 | 225 | 850 | 970 | n/a | n/a | 66.667 |
| / | 5 | 0.026 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-up | 2 | 0.01 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-in | 1 | 0.005 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /:type | 1 | 0.005 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 74 | 22 | 49 | 70.27 | 145.455 | 198.636 |
| episode-grid | 74 | 19 | 53 | 74.324 | 35.256 | 145 |
| related-cards | 210 | 76 | 134 | 63.81 | 120.513 | 790.625 |
| details-movie-v2 | 421 | 107 | 299 | 74.584 | 144.828 | 198.966 |
| person-profile-v2 | 361 | 124 | 237 | 65.651 | 85.969 | 257.187 |
| person-fingerprint-baseline | 237 | 237 | 0 | 0 | n/a | n/a |
| movie-collection | 27 | 11 | 16 | 59.259 | 30.769 | 160 |
| share-list-view-v1 | 37 | 32 | 1 | 13.514 | 41.667 | 93.75 |
| share-list-availability-v1 | 20 | 20 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 6 | 0.031 | 31.942 |
| grpc /qdrant.Points/Recommend 0 | 514 | 2.649 | 50.624 |
| grpc /qdrant.Points/Get 0 | 518 | 2.67 | 21.366 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 3947.894 req/s, of which 2022.344 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 3a45fcfd | 2009.315 | 0 | 73.533 | 93.444 | 9 | 124.572 | 2321.938 |
| 10.0.0.20 | 3a45fcfd | 1937.125 | 0 | 78.153 | 98.169 | 9 | 434.82 | 2433.711 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /show/:showKey | 608 | 1 | 0 | 73 | 0 |
| 10.0.0.21 | /movie/:movieKey | 7670 | 0 | 0 | 422 | 0 |
| 10.0.0.21 | /person/:personKey | 639 | 1 | 0 | 362 | 0 |
| 10.0.0.21 | /discover/:type? | 899 | 1 | 0 | 19 | 0 |
| 10.0.0.21 | /sign-up | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.21 | /u/:handle/lists/:id | 1071 | 24 | 0 | 2 | 0 |
| 10.0.0.21 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | / | 5 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /person/:personKey | 588 | 1 | 0 | 588 | 0 |
| 10.0.0.20 | /movie/:movieKey | 7514 | 0 | 0 | 481 | 0 |
| 10.0.0.20 | /show/:showKey | 618 | 1 | 0 | 76 | 0 |
| 10.0.0.20 | /discover/:type? | 825 | 1 | 0 | 22 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 1081 | 34 | 0 | 2 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 2 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-up | 0 | 1 | 0 | 2 | 0 |
