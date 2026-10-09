# 20261009T114434Z-load-sh-hot-documents-a

Label: sh-hot-documents-a. Time: 2026-10-09T11:45:06.671Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot-documents. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34 (dirty).

Rate plan: 50 visitors/s for 30 s, then 100 visitors/s for 35 s, then 150 visitors/s for 35 s, then 200 visitors/s for 35 s, then 250 visitors/s for 35 s.

25489 requests; 149.683 req/s; 0% errors; p95 28.877 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 1754 | 10.3 | 0 | 5.532 | 27.982 | 48.311 | 4.275 | 26.84 | 46.603 | 1754/0/0/0/0 |
| home | 1265 | 7.429 | 0 | 4.994 | 28.021 | 46.214 | 4.159 | 26.476 | 45.48 | 1265/0/0/0/0 |
| og_person | 258 | 1.515 | 0 | 7.197 | 23.312 | 69.364 | 4.315 | 21.404 | 62.836 | 258/0/0/0/0 |
| og_share_list | 287 | 1.685 | 0 | 8.552 | 38.941 | 51.161 | 4.922 | 31.598 | 46.989 | 287/0/0/0/0 |
| og_title | 1072 | 6.295 | 0 | 8.015 | 33.929 | 54.744 | 4.138 | 28.878 | 50.806 | 1072/0/0/0/0 |
| person | 1291 | 7.581 | 0 | 5.666 | 28.851 | 57.997 | 4.362 | 27.594 | 56.909 | 1291/0/0/0/0 |
| share_list | 2330 | 13.683 | 0 | 5.41 | 29.228 | 56.76 | 4.311 | 28.106 | 54.94 | 2330/0/0/0/0 |
| title_movie | 15938 | 93.595 | 0 | 6.057 | 28.611 | 49.877 | 4.325 | 26.158 | 47.817 | 15938/0/0/0/0 |
| title_show | 1294 | 7.599 | 0 | 6.3 | 26.594 | 44.975 | 4.512 | 24.554 | 43.067 | 1294/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 50 | 1499 | 49.967 | 0 | 5.484 | 33.976 | 65.482 | 4.291 | 32.757 |
| s02 | 100 | 3374 | 96.4 | 0 | 6.953 | 28.115 | 48.6 | 4.829 | 26.324 |
| s03 | 150 | 5125 | 146.429 | 0 | 5.957 | 31.801 | 54.615 | 4.349 | 29.774 |
| s04 | 200 | 6874 | 196.4 | 0 | 5.693 | 27.637 | 47.872 | 4.226 | 25.852 |
| s05 | 250 | 8617 | 246.2 | 0 | 6.294 | 27.774 | 49.051 | 4.268 | 24.046 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

25489 visitors; 0 complete page views; 0% failed page views; page view p95 0 ms; 25489 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 50 | 49.967 | 0 | 0 | 5.484 | 33.976 | 0 | 0 | 49.967 | 0 | 49.967 | 11.258 | 18.452 |
| s02 | 100 | 96.4 | 0 | 0 | 6.953 | 28.115 | 0 | 0 | 96.4 | 0 | 96.4 | 11.49 | 19.766 |
| s03 | 150 | 146.429 | 0 | 0 | 5.957 | 31.801 | 0 | 0 | 146.429 | 0 | 146.429 | 11.094 | 19.911 |
| s04 | 200 | 196.4 | 0 | 0 | 5.693 | 27.637 | 0 | 0 | 196.4 | 0 | 196.4 | 10.419 | 18.227 |
| s05 | 250 | 246.2 | 0 | 0 | 6.294 | 27.774 | 0 | 0 | 246.2 | 0 | 246.2 | 10.984 | 19.908 |

### By host

Files: page. Pages name the site's host.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 25489 | 149.683 | 0 | 6.031 | 28.877 | 4.32 | 26.573 | 25489 | 1 | 0 | 1 |
| Static hostname | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0 | 0 | n/a |

Site share of site and static traffic: 100% of requests and 0% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 50 | 41.49 | 84.997 | 128.385 | 222.483 | 44.125 | 13.821 | 0.979 | 121.82 | 32.747 | 41.556 | 51.432 | 31.386 | 19.151 | 24.918 | 0.228 | 0.919 | 22.88 | 25.242 | 1.561 | 21.468 |
| s02 | 100 | 39.742 | 133.451 | 226.645 | 48.354 | 47.318 | 23.502 | 0.276 | 96.589 | 34.347 | 43.093 | 94.344 | 74.433 | 22.897 | 36.162 | 0.3 | 4.376 | 42.538 | 48.837 | 3.045 | 42.524 |
| s03 | 150 | 40.708 | 149.288 | 324.236 | 61.134 | 54.585 | 29.48 | 0.355 | 60.216 | 54.93 | 58.043 | 139.117 | 86.348 | 15.776 | 18.456 | 0.213 | 0.58 | 53.129 | 55.921 | 4.296 | 60.193 |
| s04 | 200 | 43.297 | 182.775 | 425.09 | 54.58 | 48.752 | 36.85 | 0.276 | 75.289 | 54.593 | 58.692 | 174.195 | 102.69 | 23.739 | 34.989 | 0.229 | 0.606 | 63.58 | 68.622 | 5.879 | 82.76 |
| s05 | 250 | 49.245 | 234.379 | 522.188 | 62.248 | 48.585 | 42.055 | 0.747 | 69.457 | 50.487 | 53.938 | 218.753 | 117.947 | 19.01 | 24.606 | 0.204 | 0.437 | 78.915 | 83.642 | 7.332 | 105.01 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 34 | 44.907 | 58.692 | 3.534 | 5.1 | 40.344 | 81.621 | 134.967 | 224.268 | 13 |
| gw-vector1 | target | 16 | 35 | 19.972 | 36.162 | 2.66 | 3.51 | 58.098 | 3.463 | 0.233 | 0.735 | 10 |
| gw-worker3 | generator | 4 | 35 | 51.455 | 83.642 | 1.246 | 2.31 | 19.904 | 61.016 | 4.325 | 7.431 | 11 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-20261009T114143 | 99.864 | 239.79 | 2820.156 | 2872.32 |
| abusive | coolify-proxy | 156.273 | 252.24 | 225.735 | 232.7 |
| gw-vector1 | gk4owk8-20261009T114342 | 100.753 | 307.54 | 2815.327 | 2902.016 |
| gw-vector1 | coolify-proxy | 29.552 | 55.75 | 136.949 | 139.2 |

## Webapp process

From the webapp's own counters over 175.758 s, commit 7f64aeb2. The times exclude the proxy, TLS, and the network.

Finished 162.291 req/s in total: 145.182 from the benchmark and 17.109 of background traffic, of which 3.01 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.618 on average, 6 at most. Event loop delay: 222.483 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 43.105 | 58.557 |
| webapp V8Worker | 6.84 | 25.237 |
| webapp libuv-worker | 5.09 | 10.252 |
| webapp query-encoder | 0.072 | 1.786 |
| proxy | 157.667 | 241.19 |

The proxy accepted 326.209 connections per second on average, 535.781 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /movie/:movieKey | 16457 | 93.634 | 25.599 | 48.638 | 160.566 | 25.567 | 48.577 | 99.97 |
| /person/:personKey | 2393 | 13.615 | 34.402 | 149.398 | 199.513 | 30.481 | 98.842 | 99.749 |
| /u/:handle/lists/:id | 2364 | 13.45 | 25.011 | 47.52 | 49.521 | 25 | 47.5 | 100 |
| /discover/:type? | 1822 | 10.367 | 25.208 | 47.894 | 49.911 | 25.069 | 47.631 | 100 |
| /og/:first/:second | 1612 | 9.172 | 30.12 | 304.746 | 656.364 | n/a | n/a | 94.913 |
| /show/:showKey | 1376 | 7.829 | 27.172 | 138.519 | 232.75 | 27.151 | 127.191 | 99.782 |
| / | 1249 | 7.106 | 25.04 | 47.576 | 49.579 | 25 | 47.5 | 100 |
| /og/lists/:id/:file | 242 | 1.377 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /sign-up | 43 | 0.245 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| static | 7 | 0.04 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /sign-in | 4 | 0.023 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/related | 1 | 0.006 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/search-config | 1 | 0.006 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/command-palette | 1 | 0.006 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/living-room/picks | 1 | 0.006 | 150 | 285 | 297 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 1184 | 715 | 454 | 39.611 | 62.596 | 145.972 |
| person-fingerprint-baseline | 469 | 469 | 0 | 0 | n/a | n/a |
| details-movie-v2 | 606 | 206 | 353 | 66.007 | 137.58 | 195.191 |
| details-show-v2 | 120 | 15 | 93 | 87.5 | 137.5 | 193.75 |
| episode-grid | 120 | 20 | 99 | 83.333 | 25.773 | 48.969 |
| details-missing-v1 | 505 | 1 | 504 | 99.802 | n/a | n/a |
| related-cards | 134 | 53 | 80 | 60.448 | 77.652 | 169.5 |
| movie-collection | 11 | 5 | 6 | 54.545 | 25 | 47.5 |
| share-list-view-v1 | 34 | 25 | 0 | 26.471 | 25 | 47.5 |
| share-list-availability-v1 | 18 | 18 | 0 | 0 | n/a | n/a |
| command-palette-titles-v2 | 1 | 1 | 0 | 0 | n/a | n/a |
| streaming-providers | 1 | 1 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 334 | 1.9 | 3.68 |
| grpc /qdrant.Points/Recommend 0 | 334 | 1.9 | 29.472 |
| grpc /qdrant.Points/UpdateBatch 0 | 4 | 0.023 | 27.793 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 323.786 req/s, of which 178.603 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 7f64aeb2 | 162.291 | 0 | 43.105 | 58.557 | 6 | 222.483 | 2329.313 |
| 10.0.0.20 | 7f64aeb2 | 161.717 | 0 | 48.657 | 82.822 | 9 | 121.82 | 2312.293 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /person/:personKey | 1283 | 0 | 0 | 1108 | 0 |
| resolve address | /show/:showKey | 1256 | 0 | 0 | 120 | 0 |
| resolve address | /movie/:movieKey | 15996 | 0 | 0 | 462 | 0 |
| resolve address | /sign-up | 43 | 0 | 0 | 0 | 0 |
| resolve address | /discover/:type? | 1791 | 0 | 1 | 61 | 0 |
| resolve address | / | 1245 | 0 | 0 | 3 | 0 |
| resolve address | /sign-in | 2 | 0 | 0 | 2 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| resolve address | /u/:handle/lists/:id | 2333 | 30 | 0 | 2 | 0 |
| resolve address | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /movie/:movieKey | 15896 | 0 | 0 | 491 | 0 |
| 10.0.0.20 | /show/:showKey | 1328 | 0 | 0 | 130 | 0 |
| 10.0.0.20 | /person/:personKey | 1281 | 0 | 0 | 993 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 4 | 0 |
| 10.0.0.20 | /sign-up | 52 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 1320 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /discover/:type? | 1802 | 0 | 0 | 47 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 2299 | 29 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-in | 2 | 0 | 0 | 0 | 0 |
