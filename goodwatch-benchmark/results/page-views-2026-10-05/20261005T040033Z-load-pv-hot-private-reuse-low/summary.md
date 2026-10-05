# 20261005T040033Z-load-pv-hot-private-reuse-low

Label: pv-hot-private-reuse-low. Time: 2026-10-05T04:00:55.859Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 10 visitors/s for 30 s, then 20 visitors/s for 35 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s.

112184 requests; 816.966 req/s; 0% errors; p95 389.644 ms; 27 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 10814 | 78.752 | 0 | 16.834 | 349.398 | 1766.967 | 15.471 | 348.74 | 1765.752 | 10814/0/0/0/0 |
| home | 7427 | 54.086 | 0 | 31.044 | 684.454 | 1874.45 | 29.855 | 681.571 | 1872.215 | 7372/0/0/0/0 |
| og_person | 24 | 0.175 | 0 | 11.015 | 364.706 | 455.035 | 8.391 | 359.08 | 452.183 | 24/0/0/0/0 |
| og_share_list | 34 | 0.248 | 0 | 20.862 | 561.182 | 1571.796 | 14.85 | 558.424 | 1569.146 | 34/0/0/0/0 |
| og_title | 135 | 0.983 | 0 | 13.807 | 354.809 | 707 | 10.183 | 352.205 | 699.615 | 135/0/0/0/0 |
| person | 4712 | 34.315 | 0 | 13.488 | 162.113 | 974.438 | 12.218 | 161.967 | 972.318 | 4712/0/0/0/0 |
| share_list | 6106 | 44.466 | 0 | 12.604 | 377.707 | 1255.063 | 11.038 | 377.122 | 1254.585 | 6106/0/0/0/0 |
| title_movie | 76741 | 558.857 | 0 | 15.016 | 371.315 | 1440.489 | 13.564 | 369.11 | 1439.803 | 76741/0/0/0/0 |
| title_show | 6191 | 45.085 | 0 | 14.257 | 394.77 | 1742.695 | 12.746 | 392.768 | 1741.353 | 6191/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9922 | 330.733 | 0 | 11.633 | 68.724 | 361.251 | 10.064 | 67.837 |
| s02 | 20 | 22593 | 645.514 | 0 | 11.83 | 105.876 | 533.961 | 10.33 | 105.116 |
| s03 | 30 | 34155 | 975.857 | 0 | 16.095 | 365.708 | 959.306 | 14.463 | 364.181 |
| s04 | 40 | 45514 | 1300.4 | 0 | 20.596 | 717.029 | 2522.604 | 19.258 | 716.083 |

## Page views

One visitor is one iteration, on a reused connection. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

3349 visitors; 3022 complete page views; 0% failed page views; page view p95 1244.8 ms; 77 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9.967 | 8.9 | 0 | 5.465 | 135.139 | 35 | 398.7 | 330.733 | 0 | 1.667 | 21.485 | 26.96 |
| s02 | 20 | 19.286 | 17.4 | 0 | 5.285 | 231.36 | 32 | 485.6 | 645.514 | 0 | 0 | 0 | 0 |
| s03 | 30 | 29.286 | 26.257 | 0 | 11.676 | 325.076 | 49 | 1036.8 | 975.857 | 0 | 0.114 | 21.061 | 28.724 |
| s04 | 40 | 38.571 | 35.057 | 0 | 21.162 | 520.238 | 71 | 2183.9 | 1300.4 | 0 | 0.657 | 21.891 | 46.697 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
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
| s01 | 10 | 39.82 | 183.092 | 70.465 | 405.46 | 46.672 | 20.464 | 5.406 | 400.479 | 40.059 | 48.575 | 52.525 | 38.938 | 66.881 | 74.208 | 0.231 | 0.12 | 12.484 | 19.094 | 0.102 | 0.088 |
| s02 | 20 | 48.157 | 189.344 | 69.294 | 497.734 | 52.542 | 31.486 | 0.934 | 385.537 | 57.444 | 59.438 | 95.827 | 77.051 | 61.192 | 68.808 | 0.235 | 0.161 | 17.054 | 21.153 | 0.096 | 0.069 |
| s03 | 30 | 76.393 | 231.867 | 69.03 | 694.08 | 63.536 | 48.292 | 6.167 | 395.76 | 52.955 | 61.665 | 140.065 | 77.08 | 58.008 | 62.11 | 0.248 | 0.168 | 27.516 | 30.873 | 0.243 | 0.174 |
| s04 | 40 | 75.833 | 268.581 | 73.34 | 492.229 | 71.682 | 59.85 | 41.223 | 599.708 | 54.778 | 60.382 | 182.808 | 93.365 | 64.595 | 74.273 | 0.294 | 0.183 | 31.692 | 34.641 | 0.135 | 0.12 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 28 | 50.796 | 61.665 | 4.596 | 5.91 | 42.725 | 72.102 | 112.502 | 200.605 | 8 |
| gw-vector1 | target | 16 | 28 | 62.791 | 76.422 | 12.746 | 13.83 | 54.53 | 0.16 | 0.261 | 0.44 | 11 |
| gw-cache1 | data | 8 | 27 | 5.759 | 18.806 | 0.249 | 0.6 | 31.827 | 0.69 | 2.189 | 4.065 | 8 |
| gw-cache2 | data | 8 | 28 | 2.732 | 6.846 | 0.189 | 0.34 | 31.321 | 0.568 | 0.565 | 1.226 | 7 |
| gw-cache3 | data | 8 | 28 | 3.331 | 13.418 | 0.286 | 0.55 | 31.385 | 0.529 | 0.463 | 0.947 | 9 |
| gw-worker3 | generator | 4 | 28 | 21.949 | 34.641 | 0.757 | 1.23 | 20.039 | 0.114 | 0.14 | 0.821 | 80 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 77.01 | 218.54 | 3132.233 | 3165.184 |
| abusive | coolify-proxy | 212.68 | 305.59 | 326.346 | 394.6 |
| gw-vector1 | gk4owk8-011237769659 | 55.264 | 114.54 | 2448.494 | 2461.696 |
| gw-vector1 | coolify-proxy | 37.06 | 64.69 | 190.025 | 400.5 |
| gw-vector1 | qdrant-main | 832.61 | 1063.99 | 5432.137 | 5488.64 |

## Webapp process

From the webapp's own counters over 142.368 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 437.198 req/s in total: 793.268 from the benchmark and -356.07 of background traffic, of which 0.007 are the crawler loop. Server errors: 0 per second. Requests in flight: 2.778 on average, 23 at most. Event loop delay: 694.08 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 56.807 | 104.229 |
| webapp V8Worker | 24.523 | 73.403 |
| webapp libuv-worker | 2.79 | 7.697 |
| proxy | 215.672 | 298.352 |

The proxy accepted 70.102 connections per second on average, 81.875 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 55473 | 389.645 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 1394 | 9.792 | 31.481 | 574.49 | 1520.741 | 30.945 | 347.727 | 93.042 |
| /person/:personKey | 391 | 2.746 | 74.231 | 944.565 | 2067.5 | 26.3 | 49.969 | 87.212 |
| /u/:handle/lists/:id | 149 | 1.047 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /show/:showKey | 142 | 0.997 | 40.341 | 950 | 1763.333 | 39.444 | 618.75 | 84.507 |
| /discover/:type? | 128 | 0.899 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| / | 102 | 0.716 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/living-room/picks | 98 | 0.688 | 437.5 | 1554.545 | 1910.909 | n/a | n/a | 0 |
| /og/:first/:second | 87 | 0.611 | 26.205 | 49.789 | 213 | n/a | n/a | 100 |
| /og/lists/:id/:file | 14 | 0.098 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 6 | 0.042 | 266.667 | 925 | 985 | n/a | n/a | 66.667 |
| /sign-in | 1 | 0.007 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 55 | 14 | 40 | 74.545 | 155.769 | 418 |
| episode-grid | 55 | 7 | 47 | 87.273 | 35.294 | 186.667 |
| related-cards | 167 | 60 | 107 | 64.072 | 92.917 | 855 |
| details-movie-v2 | 326 | 64 | 244 | 80.368 | 149.725 | 429.13 |
| person-profile-v2 | 304 | 114 | 190 | 62.5 | 86.875 | 694.444 |
| person-fingerprint-baseline | 190 | 190 | 0 | 0 | n/a | n/a |
| movie-collection | 24 | 12 | 12 | 50 | 30 | 380 |
| share-list-view-v1 | 20 | 9 | 0 | 55 | 30.556 | 725 |
| share-list-availability-v1 | 14 | 14 | 0 | 0 | n/a | n/a |
| streaming-providers | 99 | 99 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 398 | 2.796 | 25.134 |
| grpc /qdrant.Points/UpdateBatch 0 | 3 | 0.021 | 25.473 |
| grpc /qdrant.Points/Recommend 0 | 396 | 2.782 | 50.711 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 864.429 req/s, of which 71.161 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 3a45fcfd | 437.198 | 0 | 56.807 | 104.229 | 23 | 694.08 | 3130.145 |
| 10.0.0.20 | 3a45fcfd | 427.387 | 0 | 58.353 | 84.163 | 14 | 609.67 | 2432.887 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /show/:showKey | 87 | 0 | 0 | 55 | 0 |
| 10.0.0.21 | /movie/:movieKey | 1068 | 0 | 0 | 326 | 0 |
| 10.0.0.21 | /person/:personKey | 87 | 0 | 0 | 305 | 0 |
| 10.0.0.21 | /discover/:type? | 128 | 0 | 0 | 17 | 0 |
| 10.0.0.21 | /u/:handle/lists/:id | 133 | 14 | 0 | 2 | 0 |
| 10.0.0.21 | / | 102 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /person/:personKey | 84 | 0 | 0 | 402 | 0 |
| 10.0.0.20 | /movie/:movieKey | 1055 | 1 | 0 | 366 | 0 |
| 10.0.0.20 | /show/:showKey | 79 | 0 | 0 | 56 | 0 |
| 10.0.0.20 | /discover/:type? | 128 | 0 | 0 | 13 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 135 | 11 | 0 | 2 | 0 |
| 10.0.0.20 | / | 88 | 0 | 0 | 0 | 0 |
