# 20261005T053736Z-load-pv-hot-public-duo-a

Label: pv-hot-public-duo-a. Time: 2026-10-05T05:37:58.365Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 833a2e5363de517bd1f6fd4617a364e50fca32c3 (dirty).

Rate plan: 15 visitors/s for 30 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 45 visitors/s for 35 s, then 50 visitors/s for 35 s, then 55 visitors/s for 35 s, then 60 visitors/s for 35 s, then 65 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<98

350044 requests; 1399.64 req/s; 0% errors; p95 207.752 ms; 122 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 30309 | 121.19 | 0 | 20.045 | 215.647 | 826.64 | 16.958 | 172.315 | 719.853 | 30233/0/0/0/0 |
| home | 21578 | 86.279 | 0 | 20.957 | 256.713 | 990.252 | 17.745 | 205.668 | 728 | 21512/0/0/0/0 |
| og_person | 124 | 0.496 | 0 | 13.797 | 203.179 | 991.507 | 9.768 | 197.317 | 775.523 | 124/0/0/0/0 |
| og_share_list | 99 | 0.396 | 0 | 21.341 | 208.895 | 751.935 | 13.666 | 169.387 | 531.424 | 99/0/0/0/0 |
| og_title | 454 | 1.815 | 0 | 18.328 | 257.25 | 732.959 | 12.416 | 173.725 | 615.275 | 454/0/0/0/0 |
| person | 15006 | 60.001 | 0 | 15.25 | 206.738 | 779.519 | 12.474 | 160.869 | 619.264 | 14995/0/0/0/0 |
| share_list | 21241 | 84.931 | 0 | 16.279 | 210.858 | 982.976 | 13.245 | 168.067 | 835.396 | 21208/0/0/0/0 |
| title_movie | 241007 | 963.659 | 0 | 17.74 | 191.573 | 813.136 | 15.16 | 158.031 | 651.031 | 240427/0/0/0/0 |
| title_show | 20226 | 80.873 | 0 | 19.043 | 273.686 | 1067.43 | 16.183 | 213.845 | 937.203 | 20112/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 15 | 15236 | 507.867 | 0 | 10.207 | 24.305 | 32.752 | 8.629 | 22.362 |
| s02 | 30 | 33642 | 961.2 | 0 | 10.422 | 29.917 | 46.368 | 8.82 | 27.189 |
| s03 | 40 | 45040 | 1286.857 | 0 | 12.267 | 36.803 | 57.214 | 10.336 | 32.635 |
| s04 | 45 | 50926 | 1455.029 | 0 | 14.598 | 64.241 | 129.235 | 12.333 | 58.381 |
| s05 | 50 | 57824 | 1652.114 | 0 | 17.176 | 64.859 | 120.357 | 14.533 | 57.563 |
| s06 | 55 | 63667 | 1819.057 | 0 | 19.494 | 69.127 | 121.175 | 16.208 | 61.132 |
| s07 | 60 | 68857 | 1967.343 | 0 | 55.125 | 308.231 | 739.218 | 44.483 | 241.583 |
| s08 | 65 | 14852 | 1471.112 | 0 | 337.329 | 1244.927 | 2009.136 | 277.352 | 1171.727 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

10560 visitors; 9451 complete page views; 0% failed page views; page view p95 900.5 ms; 20165 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 15 | 14.967 | 13.767 | 0 | 5.027 | 17.873 | 54 | 78.4 | 507.867 | 0 | 28.433 | 22.966 | 33.791 |
| s02 | 30 | 28.943 | 25.829 | 0 | 4.934 | 24.185 | 55 | 93 | 961.2 | 0 | 55 | 22.872 | 33.157 |
| s03 | 40 | 39.286 | 34.686 | 0 | 6.596 | 29.092 | 59 | 110.35 | 1286.857 | 0 | 74.629 | 22.917 | 35.991 |
| s04 | 45 | 44.629 | 39.714 | 0 | 9.433 | 61.086 | 66 | 203.1 | 1455.029 | 0 | 84.8 | 23.062 | 41.069 |
| s05 | 50 | 49.657 | 44.8 | 0 | 12.123 | 57.623 | 75 | 183.65 | 1652.114 | 0 | 94.343 | 23.443 | 48.683 |
| s06 | 55 | 54.629 | 49.171 | 0 | 14.817 | 61.02 | 83 | 218 | 1819.057 | 0 | 103.8 | 23.675 | 54.491 |
| s07 | 60 | 59.657 | 53.314 | 0 | 44.473 | 293.339 | 222 | 1109.75 | 1967.343 | 0 | 112.971 | 46.936 | 317.823 |
| s08 | 65 | 41.899 | 37.144 | 0 | 301.363 | 1108.857 | 1548 | 2638.4 | 1471.112 | 0 | 90.929 | 265.902 | 872.266 |

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

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 15 | 39.475 | 356.544 | 139.39 | 35.968 | 49.792 | 61.51 | 0.237 | 189.584 | 56.777 | 64.485 | 157.111 | 85.127 | 13.981 | 17.12 | 0.272 | 0.134 | 20.383 | 22.297 | 2.325 | 65.678 |
| s02 | 30 | 47.227 | 474.72 | 192.309 | 37.508 | 61.137 | 101.869 | 2.32 | 162.19 | 71.304 | 73.512 | 268.678 | 140.603 | 18.369 | 23.631 | 0.292 | 0.19 | 38.887 | 42.243 | 4.455 | 129.334 |
| s03 | 40 | 58.572 | 554.041 | 234.01 | 50.058 | 66.289 | 130.178 | 4.642 | 104.715 | 82.124 | 84.914 | 364.359 | 196.539 | 20.341 | 25.505 | 0.303 | 0.25 | 45.663 | 48.204 | 5.884 | 172.682 |
| s04 | 45 | 63.05 | 577.673 | 250.225 | 72.537 | 76.34 | 144.162 | 7.928 | 117.495 | 86.854 | 88.269 | 411.16 | 221.652 | 20.359 | 25.388 | 0.381 | 0.227 | 48.277 | 53.933 | 6.493 | 191.704 |
| s05 | 50 | 64.638 | 600.796 | 271.605 | 169.399 | 80.061 | 154.375 | 2.637 | 162.583 | 90.935 | 92.35 | 457.941 | 245.344 | 23.048 | 31.056 | 0.333 | 0.28 | 51.548 | 58.346 | 7.443 | 220.799 |
| s06 | 55 | 67.283 | 637.098 | 289.009 | 82.171 | 76.887 | 157.762 | 0.345 | 76.01 | 92.492 | 94.071 | 493.203 | 262.723 | 22.064 | 26.169 | 0.388 | 0.241 | 51.444 | 53.595 | 8.161 | 242.511 |
| s07 | 60 | 70.684 | 653.18 | 306.395 | 75.093 | 77.781 | 174.673 | 21.278 | 53.073 | 97.943 | 99.302 | 549.078 | 295.695 | 24.387 | 30.917 | 0.421 | 0.299 | 59.325 | 60.883 | 8.508 | 254.189 |
| s08 | 65 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 99.356 | 99.356 | 473.547 | 253.798 | 19.893 | 19.893 | 0.483 | 0.373 | 52.254 | 52.254 | 8.418 | 226.249 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 50 | 82.875 | 99.434 | 6.67 | 9.32 | 35.462 | 208.31 | 388.804 | 584.055 | 9 |
| gw-vector1 | target | 16 | 49 | 20.612 | 31.438 | 3.888 | 5.42 | 49.657 | 0.242 | 0.344 | 0.514 | 7 |
| gw-cache1 | data | 8 | 49 | 3.594 | 18.613 | 0.314 | 0.63 | 31.107 | 0.649 | 6.066 | 8.938 | 7 |
| gw-cache2 | data | 8 | 50 | 3.512 | 15.821 | 0.259 | 0.48 | 30.734 | 0.658 | 0.649 | 1.32 | 7 |
| gw-cache3 | data | 8 | 50 | 3.265 | 19.003 | 0.325 | 0.62 | 30.801 | 0.467 | 0.504 | 1.777 | 8 |
| gw-worker3 | generator | 4 | 50 | 45.357 | 60.883 | 1.672 | 2.71 | 21.166 | 182.781 | 6.212 | 9.105 | 150 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-052303740133 | 67.141 | 101.9 | 2270.781 | 2273.28 |
| abusive | coolify-proxy | 556.806 | 692.67 | 334.092 | 764.6 |
| gw-vector1 | gk4owk8-052500856273 | 85.431 | 175.22 | 2330.331 | 2378.752 |
| gw-vector1 | coolify-proxy | 141.437 | 349.52 | 148.161 | 179.5 |
| gw-vector1 | qdrant-main | 35.995 | 75.54 | 3904.491 | 3916.8 |

## Webapp process

From the webapp's own counters over 253.91 s, commit 833a2e53. The times exclude the proxy, TLS, and the network.

Finished 1432.332 req/s in total: 1381.101 from the benchmark and 51.231 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.16 on average, 5 at most. Event loop delay: 368.497 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 60.315 | 82.505 |
| webapp libuv-worker | 3.03 | 4.928 |
| webapp V8Worker | 2.847 | 18.449 |
| proxy | 556.327 | 663.92 |

The proxy accepted 243.278 connections per second on average, 315.15 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 342359 | 1348.346 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 7300 | 28.75 | 26.854 | 123.466 | 279.208 | 26.68 | 115.302 | 99.288 |
| /person/:personKey | 1064 | 4.19 | 41.113 | 226.486 | 446.286 | 26.083 | 49.559 | 97.556 |
| /u/:handle/lists/:id | 1001 | 3.942 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /show/:showKey | 747 | 2.942 | 32.649 | 260.568 | 439.222 | 32.033 | 191.814 | 97.323 |
| /discover/:type? | 714 | 2.812 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /og/:first/:second | 594 | 2.339 | 25.169 | 47.822 | 49.836 | n/a | n/a | 99.663 |
| / | 549 | 2.162 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/living-room/picks | 545 | 2.146 | 30.618 | 123 | 285 | n/a | n/a | 99.083 |
| /og/lists/:id/:file | 107 | 0.421 | 25.721 | 48.87 | 82.167 | n/a | n/a | 100 |
| /api/e | 10 | 0.039 | 166.667 | 400 | 480 | n/a | n/a | 90 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 184 | 49 | 127 | 73.37 | 140.625 | 194.866 |
| episode-grid | 184 | 45 | 138 | 75.543 | 27.148 | 72.5 |
| details-movie-v2 | 579 | 130 | 417 | 77.547 | 137.143 | 194.743 |
| related-cards | 327 | 133 | 194 | 59.327 | 79.615 | 225.556 |
| person-profile-v2 | 539 | 167 | 370 | 69.017 | 79.098 | 194.175 |
| person-fingerprint-baseline | 372 | 372 | 0 | 0 | n/a | n/a |
| movie-collection | 41 | 21 | 20 | 48.78 | 25 | 47.5 |
| share-list-view-v1 | 44 | 41 | 0 | 6.818 | 37.5 | 92.5 |
| share-list-availability-v1 | 24 | 24 | 0 | 0 | n/a | n/a |
| streaming-providers | 545 | 545 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 3 | 0.012 | 32.841 |
| grpc /qdrant.Points/Recommend 0 | 756 | 2.977 | 29.519 |
| grpc /qdrant.Points/Get 0 | 760 | 2.993 | 6.373 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 2890.866 req/s, of which 1509.765 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 833a2e53 | 1432.332 | 0 | 60.315 | 82.505 | 5 | 368.497 | 2320.086 |
| 10.0.0.20 | 833a2e53 | 1454.482 | 0 | 70.82 | 89.617 | 7 | 189.584 | 2427.98 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 563 | 0 | 0 | 184 | 0 |
| resolve address | /movie/:movieKey | 6729 | 0 | 0 | 579 | 0 |
| resolve address | /person/:personKey | 518 | 0 | 0 | 545 | 0 |
| resolve address | /discover/:type? | 714 | 0 | 0 | 35 | 0 |
| resolve address | / | 549 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 12 | 0 |
| resolve address | /u/:handle/lists/:id | 970 | 31 | 0 | 0 | 0 |
| 10.0.0.20 | /show/:showKey | 544 | 0 | 0 | 207 | 0 |
| 10.0.0.20 | /person/:personKey | 533 | 0 | 0 | 924 | 0 |
| 10.0.0.20 | /movie/:movieKey | 6909 | 0 | 0 | 739 | 0 |
| 10.0.0.20 | /discover/:type? | 716 | 0 | 0 | 52 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 15 | 0 |
| 10.0.0.20 | / | 535 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 914 | 29 | 0 | 0 | 0 |
