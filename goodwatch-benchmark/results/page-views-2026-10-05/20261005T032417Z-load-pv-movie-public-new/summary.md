# 20261005T032417Z-load-pv-movie-public-new

Label: pv-movie-public-new. Time: 2026-10-05T03:24:53.742Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 5 visitors/s for 30 s, then 10 visitors/s for 35 s, then 20 visitors/s for 35 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 80 visitors/s for 35 s, then 100 visitors/s for 35 s, then 125 visitors/s for 35 s, then 150 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<225

577720 requests; 1769.72 req/s; 0% errors; p95 308.399 ms; 241 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 577720 | 1769.72 | 0 | 14.042 | 308.399 | 734.976 | 11.97 | 231.473 | 630.482 | 576935/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 5 | 5662 | 188.733 | 0 | 10.483 | 23.752 | 38.437 | 8.803 | 21.471 |
| s02 | 10 | 12844 | 366.971 | 0 | 10.379 | 22.075 | 30.096 | 8.492 | 20.131 |
| s03 | 20 | 25650 | 732.857 | 0 | 9.545 | 20.66 | 28.379 | 7.996 | 18.529 |
| s04 | 30 | 38950 | 1112.857 | 0 | 9.332 | 22.085 | 32.691 | 7.873 | 20.243 |
| s05 | 40 | 52250 | 1492.857 | 0 | 9.52 | 24.101 | 41.176 | 8.076 | 21.753 |
| s06 | 50 | 65550 | 1872.857 | 0 | 9.003 | 22.979 | 34.933 | 7.755 | 20.819 |
| s07 | 60 | 78850 | 2252.857 | 0 | 9.682 | 29.906 | 54.329 | 8.297 | 27.256 |
| s08 | 80 | 104463 | 2984.657 | 0 | 14.67 | 61.612 | 180.981 | 12.222 | 51.636 |
| s09 | 100 | 131096 | 3745.6 | 0 | 32.161 | 133.738 | 361.352 | 24.8 | 110.47 |
| s10 | 125 | 62405 | 3794.294 | 0 | 264.531 | 882.735 | 1243.585 | 198.449 | 752.523 |
| s11 | 150 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

15179 visitors; 15179 complete page views; 0% failed page views; page view p95 1195.1 ms; 30460 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 5 | 4.967 | 4.967 | 0 | 5.026 | 26.173 | 63 | 87 | 188.733 | 0 | 9.933 | 24.939 | 36.935 |
| s02 | 10 | 9.657 | 9.657 | 0 | 5.137 | 17.067 | 64 | 83 | 366.971 | 0 | 19.314 | 25.901 | 38.418 |
| s03 | 20 | 19.286 | 19.286 | 0 | 4.866 | 16.743 | 59 | 82 | 732.857 | 0 | 38.571 | 24.2 | 34.883 |
| s04 | 30 | 29.286 | 29.286 | 0 | 4.506 | 17.055 | 57 | 79 | 1112.857 | 0 | 58.571 | 23.259 | 33.233 |
| s05 | 40 | 39.286 | 39.286 | 0 | 4.669 | 18.401 | 56 | 84 | 1492.857 | 0 | 78.571 | 22.541 | 32.818 |
| s06 | 50 | 49.286 | 49.286 | 0 | 4.805 | 19.72 | 55 | 81 | 1872.857 | 0 | 98.571 | 21.61 | 31.439 |
| s07 | 60 | 59.286 | 59.286 | 0 | 5.365 | 25.682 | 58 | 99 | 2252.857 | 0 | 118.571 | 22.123 | 33.566 |
| s08 | 80 | 78.543 | 78.543 | 0 | 9.704 | 57.213 | 71 | 224 | 2984.657 | 0 | 157.114 | 23.03 | 43.665 |
| s09 | 100 | 98.571 | 98.571 | 0 | 26.898 | 125.127 | 131 | 440.1 | 3745.6 | 0 | 197.029 | 28.22 | 95.08 |
| s10 | 125 | 98.376 | 98.376 | 0 | 227.963 | 722.712 | 1066 | 2107.65 | 3794.294 | 0 | 203.137 | 198.162 | 799.218 |
| s11 | 150 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 5 | 21.698 | 181.028 | 74.953 | 34.985 | 34.206 | 17.437 | 0.511 | 110.875 | 32.228 | 34.636 | 28.879 | 15.829 | 12.511 | 16.894 | 0.279 | 0.45 | 14.042 | 20.426 | 0.855 | 21.532 |
| s02 | 10 | 26.208 | 228.271 | 84.84 | 85.841 | 35.358 | 28.593 | 0.433 | 283.301 | 39.167 | 42.634 | 55.436 | 30.027 | 11.201 | 18.135 | 0.238 | 0.119 | 19.768 | 24.291 | 1.748 | 47.547 |
| s03 | 20 | 28.315 | 296.434 | 104.084 | 45.044 | 41.768 | 46.291 | 1.18 | 49.927 | 45.715 | 48.241 | 102.813 | 56.01 | 12.659 | 16.465 | 0.289 | 0.129 | 33.836 | 39.078 | 3.353 | 92.525 |
| s04 | 30 | 36.327 | 344.299 | 124.472 | 30.889 | 41.458 | 58.624 | 2.008 | 82.105 | 55.431 | 56.793 | 152.445 | 75.626 | 15.08 | 22.322 | 0.417 | 0.174 | 45.638 | 49.843 | 5.088 | 143.991 |
| s05 | 40 | 40.668 | 399.667 | 146.079 | 37.082 | 50.944 | 80.076 | 0.59 | 111.269 | 61.32 | 63.887 | 196.984 | 102.131 | 15.224 | 17.722 | 0.298 | 0.158 | 54.016 | 56.971 | 6.704 | 192.745 |
| s06 | 50 | 42.808 | 435.001 | 163.051 | 31.151 | 51.703 | 95.919 | 1.813 | 66.245 | 65.725 | 68.151 | 251.57 | 136.088 | 16.168 | 18.015 | 0.297 | 0.165 | 60.31 | 61.954 | 8.141 | 234.202 |
| s07 | 60 | 47.295 | 478.577 | 182.122 | 43.57 | 61.822 | 109.109 | 2.037 | 53.597 | 71.493 | 72.899 | 301.598 | 155.447 | 18.19 | 22.994 | 0.296 | 0.202 | 68.883 | 70.743 | 9.913 | 289.689 |
| s08 | 80 | 55.102 | 561.538 | 227.025 | 59.43 | 74.768 | 142.039 | 41.682 | 374.527 | 83.798 | 85.245 | 399.003 | 207.595 | 21.027 | 24.251 | 0.397 | 0.232 | 80.509 | 83.804 | 12.894 | 385.934 |
| s09 | 100 | 61.795 | 609.015 | 263.925 | 136.631 | 79.928 | 177.388 | 70.713 | 435.868 | 91.881 | 94.552 | 482.47 | 254.81 | 23.719 | 30.74 | 0.464 | 0.284 | 86.752 | 91.142 | 14.98 | 465.96 |
| s10 | 125 | 82.051 | 651.793 | 291.889 | 211.997 | 83.999 | 198.49 | 572.458 | 345.167 | 98.671 | 99.43 | 539.038 | 287.19 | 26.842 | 29.367 | 0.645 | 0.39 | 92.263 | 92.665 | 18.277 | 533.628 |
| s11 | 150 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 65 | 62.208 | 99.43 | 4.673 | 8.47 | 34.62 | 120.782 | 230.219 | 552.273 | 8 |
| gw-vector1 | target | 16 | 65 | 16.656 | 30.74 | 2.443 | 6.23 | 49.087 | 0.217 | 0.336 | 0.849 | 8 |
| gw-cache1 | data | 8 | 65 | 2.985 | 15.552 | 0.238 | 0.53 | 32.046 | 0.468 | 0.534 | 3.078 | 8 |
| gw-cache2 | data | 8 | 65 | 2.874 | 16.576 | 0.167 | 0.52 | 31.734 | 0.565 | 0.422 | 1.285 | 7 |
| gw-cache3 | data | 8 | 65 | 3.101 | 18.015 | 0.235 | 0.5 | 31.79 | 0.484 | 0.313 | 0.8 | 9 |
| gw-worker3 | generator | 4 | 65 | 52.855 | 92.665 | 1.825 | 3.64 | 22.765 | 220.091 | 7.489 | 18.5 | 248 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 50.457 | 155.43 | 2208.941 | 2211.84 |
| abusive | coolify-proxy | 398.717 | 692.78 | 268.312 | 671.9 |
| gw-vector1 | gk4owk8-011237769659 | 85.557 | 218.49 | 2346.362 | 2419.712 |
| gw-vector1 | coolify-proxy | 91.22 | 209.97 | 72.505 | 146.4 |
| gw-vector1 | qdrant-main | 23.171 | 59.79 | 4945.794 | 4963.328 |

## Webapp process

From the webapp's own counters over 330.183 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 909.895 req/s in total: 1750.035 from the benchmark and -840.14 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 0.738 on average, 4 at most. Event loop delay: 211.997 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 42.168 | 86.974 |
| webapp V8Worker | 5.46 | 20.928 |
| webapp libuv-worker | 2.218 | 4.754 |
| proxy | 404.865 | 656.982 |

The proxy accepted 158.996 connections per second on average, 301.936 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 282265 | 854.874 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 8296 | 25.125 | 26.696 | 109.705 | 198.67 | 26.545 | 105.277 | 99.783 |
| /person/:personKey | 743 | 2.25 | 79.448 | 193.927 | 316.286 | 26.426 | 55.943 | 98.923 |
| /show/:showKey | 98 | 0.297 | 145.614 | 281.875 | 402 | 135.385 | 230 | 97.959 |
| /api/e | 8 | 0.024 | 171.429 | 420 | 484 | n/a | n/a | 87.5 |
| / | 6 | 0.018 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/poster-impressions | 1 | 0.003 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 100 | 23 | 72 | 77 | 140.984 | 197.049 |
| episode-grid | 100 | 18 | 79 | 82 | 25.309 | 48.086 |
| related-cards | 295 | 128 | 167 | 56.61 | 71.311 | 167.143 |
| details-movie-v2 | 648 | 170 | 461 | 73.765 | 134.521 | 193.452 |
| person-profile-v2 | 734 | 205 | 529 | 72.071 | 69.322 | 173.49 |
| person-fingerprint-baseline | 529 | 529 | 0 | 0 | n/a | n/a |
| movie-collection | 41 | 27 | 14 | 34.146 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 7 | 0.021 | 492.101 |
| grpc /qdrant.Points/Recommend 0 | 652 | 1.975 | 29.269 |
| grpc /qdrant.Points/Get 0 | 658 | 1.993 | 5.069 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 1819.512 req/s, of which 69.477 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 909.895 | 0 | 42.168 | 86.974 | 4 | 211.997 | 2257.945 |
| 10.0.0.20 | 3a45fcfd | 907.53 | 0 | 53.807 | 91.272 | 6 | 435.868 | 2264.977 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 0 | 0 | 0 | 100 | 0 |
| resolve address | /movie/:movieKey | 7653 | 0 | 0 | 648 | 0 |
| resolve address | /person/:personKey | 0 | 0 | 0 | 743 | 0 |
| resolve address | /discover/:type? | 0 | 0 | 0 | 6 | 0 |
| resolve address | / | 6 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 1037 | 0 |
| 10.0.0.20 | /movie/:movieKey | 7625 | 0 | 0 | 801 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 96 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.20 | / | 7 | 0 | 0 | 1 | 4 |
| 10.0.0.20 | /u/:handle/lists/:id | 0 | 0 | 0 | 6 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /:type/:category/:page | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /:type/:category | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /u/:handle | 0 | 0 | 0 | 6 | 0 |
