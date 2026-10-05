# 20261005T043143Z-load-pv-hot-nohome-public-hold-b

Label: pv-hot-nohome-public-hold-b. Time: 2026-10-05T04:32:05.480Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 40 visitors/s for 600 s.

787974 requests; 1312.024 req/s; 0% errors; p95 40.34 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 75751 | 126.13 | 0 | 12.895 | 39.076 | 66.467 | 11.226 | 35.096 | 62.362 | 75751/0/0/0/0 |
| og_person | 264 | 0.44 | 0 | 8.709 | 36.992 | 75.75 | 6.061 | 33.605 | 66.631 | 264/0/0/0/0 |
| og_share_list | 269 | 0.448 | 0 | 10.216 | 42.581 | 79.971 | 6.342 | 36.875 | 65.428 | 269/0/0/0/0 |
| og_title | 977 | 1.627 | 0 | 8.648 | 40.82 | 88.707 | 5.674 | 35.965 | 72.979 | 977/0/0/0/0 |
| person | 35386 | 58.92 | 0 | 10.449 | 35.956 | 68.999 | 8.787 | 32.073 | 58.89 | 35386/0/0/0/0 |
| share_list | 52212 | 86.936 | 0 | 10.534 | 36.474 | 75.501 | 8.705 | 32.062 | 64.176 | 52212/0/0/0/0 |
| title_movie | 575574 | 958.365 | 0 | 12.213 | 41.276 | 74.366 | 10.482 | 37.261 | 68.704 | 575562/0/0/0/0 |
| title_show | 47541 | 79.159 | 0 | 12.326 | 38.633 | 75.69 | 10.62 | 35.292 | 65.104 | 47541/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 40 | 787974 | 1313.29 | 0 | 12.076 | 40.34 | 73.679 | 10.348 | 36.439 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

23996 visitors; 21482 complete page views; 0% failed page views; page view p95 119 ms; 45470 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 40 | 39.993 | 35.803 | 0 | 6.523 | 34.982 | 59 | 119 | 1313.29 | 0 | 75.783 | 22.798 | 36.237 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

Over time, per slice of the run. The first request is the document, or the only request of a visitor without a page view:

| From second | Visitors | Failed page views % | First request p50 ms | First request p95 ms | First request p99 ms | First request max ms | Page view p50 ms | Page view p95 ms | Page view p99 ms | Page view max ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1199 | 0 | 6.898 | 31.14 | 54.782 | 97.387 | 59 | 109.2 | 157 | 321 |
| 30 | 1200 | 0 | 6.354 | 31.386 | 51.888 | 137.442 | 58 | 118 | 200 | 376 |
| 60 | 1200 | 0 | 7.059 | 38.828 | 73.721 | 208.899 | 61 | 122 | 283.4 | 464 |
| 90 | 1200 | 0 | 7.502 | 38.991 | 69.426 | 223.659 | 62 | 132.25 | 183.25 | 573 |
| 120 | 1200 | 0 | 6.774 | 35.855 | 216.111 | 589.237 | 60 | 118 | 544.36 | 969 |
| 150 | 1200 | 0 | 6.443 | 32.565 | 54.65 | 86.443 | 58 | 115 | 151.34 | 367 |
| 180 | 1200 | 0 | 6.347 | 34.223 | 88.694 | 235.982 | 57 | 129.65 | 314.97 | 605 |
| 210 | 1200 | 0 | 6.401 | 35.01 | 75.899 | 351.601 | 57 | 130 | 224.6 | 689 |
| 240 | 1200 | 0 | 6.384 | 33.317 | 55.993 | 119.955 | 58 | 111 | 163.92 | 293 |
| 270 | 1200 | 0 | 6.181 | 32.136 | 68.656 | 397.219 | 57 | 103.7 | 216.38 | 717 |
| 300 | 1200 | 0 | 7.016 | 36.447 | 61.393 | 174.206 | 59 | 122.1 | 175.64 | 221 |
| 330 | 1200 | 0 | 6.541 | 38.786 | 77.089 | 592.63 | 58 | 130.2 | 246.84 | 888 |
| 360 | 1200 | 0 | 6.295 | 37.813 | 67.485 | 114.335 | 58 | 123.35 | 206.08 | 553 |
| 390 | 1200 | 0 | 6.727 | 37.186 | 105.32 | 215.654 | 59 | 125.25 | 324 | 579 |
| 420 | 1200 | 0 | 6.799 | 36.619 | 85.384 | 265.02 | 59 | 119.15 | 318.92 | 706 |
| 450 | 1200 | 0 | 7.343 | 41.347 | 67.844 | 174.99 | 60 | 123 | 190.52 | 286 |
| 480 | 1200 | 0 | 6.141 | 27.303 | 49.644 | 123.137 | 56 | 101 | 130.6 | 277 |
| 510 | 1200 | 0 | 6.957 | 39.153 | 79.04 | 388.547 | 60 | 128.3 | 289.64 | 582 |
| 540 | 1200 | 0 | 6.026 | 24.698 | 48.834 | 161.052 | 57 | 99 | 135 | 319 |
| 570 | 1197 | 0 | 7.599 | 39.283 | 82.213 | 562.996 | 60 | 123.1 | 225.88 | 704 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 40 | 57.576 | 529.753 | 218.662 | 175.428 | 67.039 | 125.881 | 1.497 | 75.289 | 80.648 | 85.52 | 359.041 | 188.244 | 19.728 | 27.951 | 0.315 | 0.206 | 44.932 | 55.59 | 6.159 | 173.159 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 120 | 80.407 | 85.52 | 7.683 | 9.39 | 37.415 | 187.135 | 356.955 | 378.21 | 10 |
| gw-vector1 | target | 16 | 119 | 19.728 | 27.951 | 3.463 | 5.28 | 51.214 | 0.206 | 0.315 | 0.545 | 10 |
| gw-cache1 | data | 8 | 119 | 3.277 | 18.22 | 0.26 | 0.59 | 31.336 | 0.48 | 0.454 | 1.876 | 9 |
| gw-cache2 | data | 8 | 119 | 3.237 | 16.265 | 0.242 | 0.53 | 31.048 | 0.506 | 0.48 | 1.078 | 8 |
| gw-cache3 | data | 8 | 120 | 5.597 | 24.489 | 0.437 | 1.06 | 31.35 | 4.027 | 0.604 | 4.228 | 10 |
| gw-worker1 | generator | 4 | 120 | 44.678 | 55.59 | 1.811 | 3.05 | 18.676 | 171.674 | 6.105 | 6.461 | 16 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 71.776 | 170.84 | 2538.889 | 2571.264 |
| abusive | coolify-proxy | 531.385 | 577.01 | 308.118 | 337.7 |
| gw-vector1 | gk4owk8-011237769659 | 76.212 | 108.94 | 2818.014 | 2847.744 |
| gw-vector1 | coolify-proxy | 127.438 | 167.24 | 140.768 | 163.7 |
| gw-vector1 | qdrant-main | 36.19 | 114.71 | 3575.008 | 3594.24 |

## Webapp process

From the webapp's own counters over 605.432 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 1341.133 req/s in total: 1302.352 from the benchmark and 38.781 of background traffic, of which 0.003 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.773 on average, 6 at most. Event loop delay: 175.428 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 57.573 | 73.936 |
| webapp V8Worker | 8.045 | 26.102 |
| webapp libuv-worker | 2.696 | 5.113 |
| proxy | 529.757 | 550.126 |

The proxy accepted 218.663 connections per second on average, 227.902 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 767120 | 1267.062 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 17614 | 29.093 | 27.184 | 138.333 | 258.112 | 26.978 | 126.912 | 99.597 |
| /person/:personKey | 2604 | 4.301 | 40.586 | 197.395 | 296.833 | 26.243 | 49.862 | 99.117 |
| /u/:handle/lists/:id | 2245 | 3.708 | 25.011 | 47.521 | 49.522 | 25 | 47.5 | 100 |
| /discover/:type? | 1777 | 2.935 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /show/:showKey | 1711 | 2.826 | 34.165 | 242.083 | 356.095 | 33.063 | 188.774 | 98.656 |
| /og/:first/:second | 1294 | 2.137 | 25.039 | 47.574 | 49.577 | n/a | n/a | 100 |
| /og/lists/:id/:file | 233 | 0.385 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 15 | 0.025 | 204.545 | 625 | 925 | n/a | n/a | 73.333 |
| / | 11 | 0.018 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-in | 2 | 0.003 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-up | 1 | 0.002 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /:type | 1 | 0.002 | 50 | 95 | 99 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 483 | 82 | 373 | 83.023 | 141.291 | 195.48 |
| episode-grid | 483 | 74 | 404 | 84.679 | 26.49 | 56.071 |
| related-cards | 848 | 322 | 526 | 62.028 | 77.595 | 182.917 |
| details-movie-v2 | 1628 | 327 | 1205 | 79.914 | 139.166 | 195.297 |
| person-profile-v2 | 1327 | 397 | 930 | 70.083 | 75 | 190.132 |
| person-fingerprint-baseline | 930 | 930 | 0 | 0 | n/a | n/a |
| movie-collection | 104 | 61 | 43 | 41.346 | 25 | 47.5 |
| share-list-view-v1 | 107 | 76 | 1 | 28.972 | 31.25 | 87.5 |
| share-list-availability-v1 | 60 | 60 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 1978 | 3.267 | 4.502 |
| grpc /qdrant.Points/Recommend 0 | 1958 | 3.234 | 27.978 |
| grpc /qdrant.Points/UpdateBatch 0 | 16 | 0.026 | 31.128 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 2678.473 req/s, of which 1376.121 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 1341.133 | 0 | 57.573 | 73.936 | 6 | 175.428 | 2555.379 |
| 10.0.0.20 | 3a45fcfd | 1335.857 | 0 | 66.861 | 77.908 | 7 | 75.289 | 2885.617 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 1229 | 2 | 0 | 482 | 0 |
| resolve address | /movie/:movieKey | 16006 | 1 | 0 | 1626 | 0 |
| resolve address | /person/:personKey | 1269 | 2 | 0 | 1335 | 0 |
| resolve address | /discover/:type? | 1775 | 2 | 0 | 106 | 0 |
| resolve address | /u/:handle/lists/:id | 2175 | 68 | 0 | 2 | 0 |
| resolve address | /:type | 0 | 0 | 0 | 1 | 0 |
| resolve address | / | 10 | 1 | 0 | 0 | 0 |
| resolve address | /sign-in | 0 | 0 | 0 | 2 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 3 | 0 |
| resolve address | /sign-up | 0 | 1 | 0 | 0 | 0 |
| 10.0.0.20 | /person/:personKey | 1197 | 1 | 0 | 1507 | 0 |
| 10.0.0.20 | /movie/:movieKey | 15915 | 1 | 0 | 1606 | 0 |
| 10.0.0.20 | /show/:showKey | 1278 | 2 | 0 | 476 | 0 |
| 10.0.0.20 | /discover/:type? | 1784 | 1 | 0 | 94 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 2256 | 69 | 0 | 2 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.20 | / | 13 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-up | 0 | 1 | 0 | 2 | 0 |
