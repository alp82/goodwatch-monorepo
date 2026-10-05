# 20261005T043143Z-load-pv-hot-nohome-public-hold-a

Label: pv-hot-nohome-public-hold-a. Time: 2026-10-05T04:32:04.562Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 40 visitors/s for 600 s.

790464 requests; 1314.884 req/s; 0% errors; p95 39.492 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 77150 | 128.334 | 0 | 12.734 | 40.948 | 77.675 | 11.011 | 37.218 | 71.52 | 77150/0/0/0/0 |
| og_person | 250 | 0.416 | 0 | 8.337 | 33.272 | 67.655 | 5.951 | 28.975 | 65.652 | 250/0/0/0/0 |
| og_share_list | 227 | 0.378 | 0 | 9.597 | 38.695 | 115.521 | 6.123 | 33.425 | 71.099 | 227/0/0/0/0 |
| og_title | 1027 | 1.708 | 0 | 8.504 | 41.521 | 94.539 | 5.582 | 35.358 | 81.358 | 1027/0/0/0/0 |
| person | 33575 | 55.85 | 0 | 10.54 | 37.88 | 69.328 | 8.902 | 34.272 | 65.653 | 33575/0/0/0/0 |
| share_list | 49623 | 82.545 | 0 | 10.342 | 35.696 | 62.718 | 8.523 | 31.607 | 57.867 | 49623/0/0/0/0 |
| title_movie | 580958 | 966.385 | 0 | 12.139 | 39.745 | 71.446 | 10.376 | 36.009 | 65.73 | 580958/0/0/0/0 |
| title_show | 47654 | 79.269 | 0 | 11.918 | 38.908 | 68.246 | 10.193 | 34.455 | 62.372 | 47654/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 40 | 790464 | 1317.44 | 0 | 11.992 | 39.492 | 71.202 | 10.237 | 35.709 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

23998 visitors; 21490 complete page views; 0% failed page views; page view p95 115 ms; 45470 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 40 | 39.997 | 35.817 | 0 | 6.33 | 33.704 | 57 | 115 | 1317.44 | 0 | 75.783 | 22.758 | 36.28 |

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

Over time, per slice of the run. The first request is the document, or the only request of a visitor without a page view:

| From second | Visitors | Failed page views % | First request p50 ms | First request p95 ms | First request p99 ms | First request max ms | Page view p50 ms | Page view p95 ms | Page view p99 ms | Page view max ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1199 | 0 | 6.634 | 31.021 | 54.885 | 108.695 | 59 | 106 | 175.31 | 439 |
| 30 | 1200 | 0 | 6.527 | 35.884 | 60.681 | 249.18 | 56 | 116.95 | 193.73 | 352 |
| 60 | 1200 | 0 | 6.544 | 32.62 | 63.853 | 197.04 | 58 | 113 | 247 | 392 |
| 90 | 1200 | 0 | 7.201 | 43.32 | 87.229 | 218.599 | 60 | 130.45 | 222.9 | 540 |
| 120 | 1200 | 0 | 6.489 | 34.336 | 70.811 | 461.656 | 59 | 112.35 | 236.16 | 999 |
| 150 | 1200 | 0 | 6.061 | 34.669 | 55.231 | 80.695 | 56 | 108.55 | 150.62 | 233 |
| 180 | 1200 | 0 | 6.514 | 39.249 | 74.599 | 264.977 | 57 | 125 | 302 | 512 |
| 210 | 1200 | 0 | 6.726 | 32.476 | 73.574 | 334.422 | 57 | 120.95 | 227.95 | 665 |
| 240 | 1200 | 0 | 6.428 | 30.493 | 50.647 | 291.101 | 58 | 110 | 169.64 | 378 |
| 270 | 1200 | 0 | 6.137 | 34.233 | 64.513 | 448.479 | 57 | 106 | 237.61 | 622 |
| 300 | 1200 | 0 | 6.586 | 34.092 | 53.633 | 88.884 | 59 | 119.1 | 168.24 | 254 |
| 330 | 1200 | 0 | 6.546 | 38.348 | 85.143 | 284.343 | 57 | 128 | 273.51 | 877 |
| 360 | 1200 | 0 | 6.648 | 32.786 | 68.563 | 109.234 | 58 | 120.9 | 189.36 | 239 |
| 390 | 1200 | 0 | 6.008 | 32.802 | 68.949 | 380.073 | 56 | 110 | 187 | 719 |
| 420 | 1200 | 0 | 6.59 | 31.329 | 122.944 | 334.499 | 57 | 111 | 394.02 | 784 |
| 450 | 1200 | 0 | 6.769 | 35.009 | 60.273 | 127.392 | 57 | 114.05 | 190.1 | 324 |
| 480 | 1200 | 0 | 5.931 | 28.442 | 48.682 | 153.978 | 53 | 97.3 | 132.78 | 230 |
| 510 | 1200 | 0 | 6.989 | 36.799 | 72.246 | 374.163 | 58 | 127 | 219.23 | 490 |
| 540 | 1200 | 0 | 6.079 | 24.679 | 47.148 | 153.084 | 55 | 94 | 144 | 294 |
| 570 | 1199 | 0 | 7.043 | 41.341 | 65.331 | 554.914 | 59 | 121.6 | 240.4 | 756 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 40 | 57.579 | 529.85 | 218.686 | 226.94 | 67.04 | 125.931 | 1.511 | 282.776 | 80.68 | 85.725 | 359.105 | 188.253 | 19.71 | 29.922 | 0.315 | 0.206 | 42.489 | 50.389 | 5.944 | 171.859 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 120 | 80.361 | 85.725 | 7.645 | 9.39 | 37.425 | 186.891 | 356.491 | 380.377 | 10 |
| gw-vector1 | target | 16 | 119 | 19.71 | 29.922 | 3.468 | 5.28 | 51.214 | 0.206 | 0.315 | 0.596 | 10 |
| gw-cache1 | data | 8 | 119 | 3.278 | 16.663 | 0.261 | 0.59 | 31.338 | 0.482 | 0.456 | 1.889 | 9 |
| gw-cache2 | data | 8 | 119 | 3.223 | 16.298 | 0.241 | 0.53 | 31.044 | 0.503 | 0.48 | 0.956 | 8 |
| gw-cache3 | data | 8 | 120 | 5.596 | 24.578 | 0.434 | 1.06 | 31.356 | 4.043 | 0.608 | 4.886 | 10 |
| gw-worker3 | generator | 4 | 120 | 42.442 | 50.389 | 1.874 | 2.83 | 21.176 | 171.545 | 5.934 | 6.863 | 13 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 72.022 | 170.84 | 2538.846 | 2571.264 |
| abusive | coolify-proxy | 533.011 | 577.01 | 308.994 | 337.7 |
| gw-vector1 | gk4owk8-011237769659 | 75.737 | 108.94 | 2817.971 | 2847.744 |
| gw-vector1 | coolify-proxy | 125.034 | 167.24 | 140.343 | 163.7 |
| gw-vector1 | qdrant-main | 36.35 | 114.71 | 3575.197 | 3594.24 |

## Webapp process

From the webapp's own counters over 605.716 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 1340.522 req/s in total: 1306.296 from the benchmark and 34.226 of background traffic, of which 0.003 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.58 on average, 7 at most. Event loop delay: 226.94 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 57.58 | 75.321 |
| webapp V8Worker | 8.044 | 25.667 |
| webapp libuv-worker | 2.699 | 5.946 |
| proxy | 529.866 | 558.034 |

The proxy accepted 218.69 connections per second on average, 233.098 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 767120 | 1266.469 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 17614 | 29.08 | 27.184 | 138.333 | 258.112 | 26.978 | 126.912 | 99.597 |
| /person/:personKey | 2601 | 4.294 | 40.59 | 197.43 | 296.865 | 26.241 | 49.859 | 99.116 |
| /u/:handle/lists/:id | 2245 | 3.706 | 25.011 | 47.521 | 49.522 | 25 | 47.5 | 100 |
| /discover/:type? | 1777 | 2.934 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /show/:showKey | 1712 | 2.826 | 34.185 | 242.037 | 356 | 33.083 | 188.793 | 98.657 |
| /og/:first/:second | 1294 | 2.136 | 25.039 | 47.574 | 49.577 | n/a | n/a | 100 |
| /og/lists/:id/:file | 233 | 0.385 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 15 | 0.025 | 204.545 | 625 | 925 | n/a | n/a | 73.333 |
| / | 11 | 0.018 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-in | 2 | 0.003 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-up | 1 | 0.002 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /:type | 1 | 0.002 | 50 | 95 | 99 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 485 | 82 | 375 | 83.093 | 141.343 | 195.478 |
| episode-grid | 485 | 74 | 406 | 84.742 | 26.482 | 55.833 |
| related-cards | 846 | 321 | 525 | 62.057 | 77.658 | 182.986 |
| details-movie-v2 | 1627 | 328 | 1204 | 79.84 | 139.145 | 195.298 |
| person-profile-v2 | 1323 | 395 | 928 | 70.144 | 75.059 | 190.175 |
| person-fingerprint-baseline | 928 | 928 | 0 | 0 | n/a | n/a |
| movie-collection | 104 | 61 | 43 | 41.346 | 25 | 47.5 |
| share-list-view-v1 | 107 | 76 | 1 | 28.972 | 31.25 | 87.5 |
| share-list-availability-v1 | 60 | 60 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 1976 | 3.262 | 4.5 |
| grpc /qdrant.Points/UpdateBatch 0 | 16 | 0.026 | 31.128 |
| grpc /qdrant.Points/Recommend 0 | 1956 | 3.229 | 27.986 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 2677.25 req/s, of which 1370.954 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 1340.522 | 0 | 57.58 | 75.321 | 7 | 226.94 | 2554.609 |
| 10.0.0.20 | 3a45fcfd | 1335.239 | 0 | 67.043 | 81.021 | 7 | 282.776 | 2884.492 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 1229 | 2 | 0 | 484 | 0 |
| resolve address | /movie/:movieKey | 16006 | 1 | 0 | 1626 | 0 |
| resolve address | /person/:personKey | 1269 | 2 | 0 | 1332 | 0 |
| resolve address | /discover/:type? | 1775 | 2 | 0 | 106 | 0 |
| resolve address | /u/:handle/lists/:id | 2175 | 68 | 0 | 2 | 0 |
| resolve address | /:type | 0 | 0 | 0 | 1 | 0 |
| resolve address | / | 10 | 1 | 0 | 0 | 0 |
| resolve address | /sign-in | 0 | 0 | 0 | 2 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 3 | 0 |
| resolve address | /sign-up | 0 | 1 | 0 | 0 | 0 |
| 10.0.0.20 | /person/:personKey | 1197 | 1 | 0 | 1510 | 0 |
| 10.0.0.20 | /movie/:movieKey | 15915 | 1 | 0 | 1607 | 0 |
| 10.0.0.20 | /show/:showKey | 1278 | 2 | 0 | 477 | 0 |
| 10.0.0.20 | /discover/:type? | 1784 | 1 | 0 | 95 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 2256 | 69 | 0 | 2 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.20 | / | 13 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-up | 0 | 1 | 0 | 2 | 0 |
