# 20261005T033324Z-load-pv-movie-public-duo-b

Label: pv-movie-public-duo-b. Time: 2026-10-05T03:33:45.008Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 30 visitors/s for 30 s, then 40 visitors/s for 35 s, then 45 visitors/s for 35 s, then 50 visitors/s for 35 s, then 55 visitors/s for 35 s, then 60 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<90

310454 requests; 1684.875 req/s; 0% errors; p95 266.432 ms; 96 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 310454 | 1684.875 | 0 | 18.124 | 266.432 | 679.268 | 15.323 | 205.387 | 588.606 | 309963/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 34162 | 1138.733 | 0 | 9.468 | 29.79 | 56.949 | 7.95 | 27.292 |
| s02 | 40 | 52250 | 1492.857 | 0 | 11.305 | 37.584 | 84.548 | 9.499 | 33.526 |
| s03 | 45 | 59394 | 1696.971 | 0 | 15.803 | 73.331 | 127.946 | 13.386 | 65.364 |
| s04 | 50 | 66006 | 1885.886 | 0 | 17.267 | 60.44 | 107.994 | 14.447 | 52.007 |
| s05 | 55 | 72677 | 2076.486 | 0 | 36.494 | 234.394 | 615.849 | 30.116 | 179.76 |
| s06 | 60 | 25965 | 1820.91 | 0 | 249.365 | 863.764 | 1494.008 | 190.075 | 770.355 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

8155 visitors; 8155 complete page views; 0% failed page views; page view p95 1057.3 ms; 16383 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 29.967 | 29.967 | 0 | 5.028 | 25.804 | 59 | 99.1 | 1138.733 | 0 | 59.933 | 21.955 | 32.625 |
| s02 | 40 | 39.286 | 39.286 | 0 | 6.283 | 31.785 | 64 | 116 | 1492.857 | 0 | 78.571 | 22.431 | 39.655 |
| s03 | 45 | 44.657 | 44.657 | 0 | 10.476 | 61.285 | 77 | 218 | 1696.971 | 0 | 89.314 | 24.053 | 54.773 |
| s04 | 50 | 49.629 | 49.629 | 0 | 12.01 | 50.827 | 82 | 183.2 | 1885.886 | 0 | 99.257 | 24.01 | 50.361 |
| s05 | 55 | 54.657 | 54.657 | 0 | 29.272 | 214.479 | 142 | 928.4 | 2076.486 | 0 | 108.829 | 30.414 | 254.037 |
| s06 | 60 | 46.846 | 46.846 | 0 | 208.151 | 730.15 | 1059.5 | 2462.95 | 1820.91 | 0 | 100.005 | 281.049 | 1101.782 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 30 | 48.658 | 475.285 | 185.953 | 4.887 | 53.561 | 92.865 | 8.389 | 10.769 | 68.356 | 77.168 | 265.936 | 143.572 | 34.262 | 37.931 | 0.291 | 0.254 | 42.129 | 51.933 | 4.582 | 127.868 |
| s02 | 40 | 55.245 | 543.05 | 226.001 | 34.362 | 59.746 | 129.055 | 0.236 | 21.288 | 84.379 | 85.505 | 395.869 | 201.512 | 30.993 | 33.499 | 0.407 | 0.243 | 53.805 | 56.995 | 6.534 | 186.819 |
| s03 | 45 | 64.514 | 582.01 | 243.892 | 19.944 | 75.387 | 136.255 | 14.089 | 50.779 | 89.193 | 93.961 | 438.445 | 228.565 | 35.216 | 36.573 | 0.469 | 0.28 | 56.98 | 59.143 | 7.585 | 217.899 |
| s04 | 50 | 68.557 | 612.719 | 264.689 | 23.024 | 70.835 | 151.188 | 5.231 | 38.819 | 92.225 | 93.586 | 499.704 | 265.384 | 35.482 | 39.668 | 0.374 | 0.261 | 59.798 | 62.74 | 8.402 | 242.726 |
| s05 | 55 | 75.455 | 631.289 | 287.021 | 93.05 | 78.254 | 161.845 | 32.026 | 93.574 | 96.459 | 98.113 | 540.564 | 286.447 | 37.064 | 41.254 | 0.445 | 0.348 | 62.381 | 67.402 | 8.756 | 252.444 |
| s06 | 60 | n/a | n/a | n/a | n/a | 66.772 | 166.349 | 494.581 | 43.439 | 99.169 | 99.307 | 530.977 | 286.257 | 37.084 | 38.227 | 0.508 | 0.44 | 65.072 | 70.225 | 9.235 | 255.642 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 37 | 87.125 | 99.307 | 6.773 | 9.39 | 35.236 | 228.738 | 433.902 | 572.986 | 10 |
| gw-vector1 | target | 16 | 37 | 35.029 | 41.254 | 5.776 | 8.52 | 50.822 | 0.284 | 0.407 | 0.693 | 11 |
| gw-cache1 | data | 8 | 37 | 4.384 | 16.393 | 0.339 | 0.6 | 32.033 | 0.495 | 0.495 | 0.995 | 8 |
| gw-cache2 | data | 8 | 36 | 4.98 | 19.121 | 0.351 | 0.72 | 31.739 | 0.571 | 0.396 | 1.009 | 8 |
| gw-cache3 | data | 8 | 37 | 6.356 | 24.815 | 0.407 | 0.92 | 32.588 | 8.228 | 0.796 | 6.219 | 9 |
| gw-worker1 | generator | 4 | 37 | 55.653 | 70.225 | 1.691 | 2.89 | 18.528 | 209.807 | 7.335 | 9.511 | 128 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 68.024 | 102.63 | 2210.982 | 2211.84 |
| abusive | coolify-proxy | 564.943 | 695.97 | 328.197 | 607.3 |
| gw-vector1 | gk4owk8-011237769659 | 85.839 | 190.79 | 2305.827 | 2315.264 |
| gw-vector1 | coolify-proxy | 140.21 | 216.95 | 95.455 | 154.4 |
| gw-vector1 | qdrant-main | 270.689 | 397.82 | 5524.148 | 5830.656 |

## Webapp process

From the webapp's own counters over 188.028 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 1698.686 req/s in total: 1651.699 from the benchmark and 46.988 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.027 on average, 5 at most. Event loop delay: 93.05 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 63.614 | 85.669 |
| webapp V8Worker | 8.627 | 21.322 |
| webapp libuv-worker | 2.437 | 4.259 |
| proxy | 577.929 | 682.713 |

The proxy accepted 246.458 connections per second on average, 300.503 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 304680 | 1620.395 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 8727 | 46.413 | 26.315 | 49.998 | 257.795 | 26.232 | 49.84 | 99.542 |
| /person/:personKey | 613 | 3.26 | 102.331 | 302.692 | 491.308 | 27.217 | 92.162 | 94.943 |
| /show/:showKey | 54 | 0.287 | 164.706 | 392 | 478.4 | 143.478 | 294.167 | 90.741 |
| /api/e | 6 | 0.032 | 240 | 294 | 298.8 | n/a | n/a | 100 |
| / | 4 | 0.021 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-up | 1 | 0.005 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 54 | 17 | 33 | 68.519 | 148.611 | 194.861 |
| episode-grid | 54 | 13 | 37 | 75.926 | 26.282 | 49.936 |
| related-cards | 172 | 73 | 99 | 57.558 | 84.701 | 368.333 |
| details-movie-v2 | 481 | 97 | 373 | 79.834 | 137.248 | 195.235 |
| person-profile-v2 | 611 | 164 | 447 | 73.159 | 74.674 | 185.505 |
| person-fingerprint-baseline | 447 | 447 | 0 | 0 | n/a | n/a |
| movie-collection | 24 | 15 | 9 | 37.5 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| rest POST /collections/{collection_name}/points/query/batch 200 | 4 | 0.021 | 72.031 |
| rest POST /collections/{collection_name}/points 200 | 2 | 0.011 | 6.222 |
| grpc /qdrant.Points/Get 0 | 584 | 3.106 | 6.737 |
| grpc /qdrant.Points/UpdateBatch 0 | 14 | 0.074 | 1472.085 |
| grpc /qdrant.Points/Recommend 0 | 388 | 2.064 | 41.08 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 3420.609 req/s, of which 1768.91 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 1698.686 | 0 | 63.614 | 85.669 | 5 | 93.05 | 2258.473 |
| 10.0.0.20 | 3a45fcfd | 1712.503 | 0 | 67.322 | 86.543 | 5 | 93.574 | 2272.5 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 0 | 0 | 0 | 54 | 0 |
| resolve address | /movie/:movieKey | 8251 | 0 | 0 | 481 | 0 |
| resolve address | /person/:personKey | 0 | 0 | 0 | 615 | 0 |
| resolve address | /discover/:type? | 0 | 0 | 0 | 1 | 0 |
| resolve address | /sign-up | 0 | 0 | 0 | 1 | 0 |
| resolve address | / | 4 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 316 | 0 |
| 10.0.0.20 | /movie/:movieKey | 8380 | 0 | 0 | 397 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 57 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.20 | / | 2 | 0 | 0 | 0 | 1 |
| 10.0.0.20 | /explore/:type/:category/:text | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /sign-up | 0 | 1 | 0 | 1 | 0 |
