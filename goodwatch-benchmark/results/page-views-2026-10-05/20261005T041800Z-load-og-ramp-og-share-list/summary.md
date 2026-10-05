# 20261005T041800Z-load-og-ramp-og-share-list

Label: og-ramp-og-share-list. Time: 2026-10-05T04:18:21.670Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 50 req/s for 25 s, then 100 req/s for 30 s, then 200 req/s for 30 s, then 300 req/s for 30 s, then 400 req/s for 30 s, then 500 req/s for 30 s, then 650 req/s for 30 s, then 800 req/s for 30 s, then 1000 req/s for 30 s, then 1250 req/s for 30 s.

154203 requests; 522.575 req/s; 0% errors; p95 30.74 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| og_share_list | 154203 | 522.575 | 0 | 5.747 | 30.74 | 58.12 | 3.057 | 23.599 | 48.391 | 154203/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 50 | 1248 | 49.92 | 0 | 5.964 | 19.396 | 39.751 | 3.378 | 15.976 |
| s02 | 100 | 2874 | 95.8 | 0 | 5.811 | 17.363 | 38.607 | 3.463 | 14.426 |
| s03 | 200 | 5748 | 191.6 | 0 | 5.626 | 19.629 | 38.594 | 3.175 | 15.833 |
| s04 | 300 | 8747 | 291.567 | 0 | 5.418 | 19.96 | 36.904 | 3.058 | 16.159 |
| s05 | 400 | 11748 | 391.6 | 0 | 5.227 | 19.067 | 37.224 | 2.781 | 14.539 |
| s06 | 500 | 14747 | 491.567 | 0 | 5.101 | 21.25 | 45.161 | 2.713 | 16.214 |
| s07 | 650 | 19122 | 637.4 | 0 | 5.009 | 24.195 | 46.401 | 2.716 | 18.488 |
| s08 | 800 | 23621 | 787.367 | 0 | 5.448 | 34.911 | 67.597 | 2.863 | 27.936 |
| s09 | 1000 | 29495 | 983.167 | 0 | 6.09 | 32.196 | 56.032 | 3.155 | 24.627 |
| s10 | 1250 | 36853 | 1228.433 | 0 | 7.766 | 40.376 | 70.459 | 4.055 | 31.325 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 50 | 25.608 | 247.019 | 111.102 | 39.179 | 27.757 | 11.566 | 0.246 | 45.438 | 45.401 | 49.476 | 75.515 | 39.094 | 29.551 | 39.98 | 122.022 | 96.757 | 22.577 | 24.239 | 0.099 | 0.099 |
| s02 | 100 | 28.743 | 179.447 | 61.699 | 40.424 | 22.85 | 16.103 | 0.345 | 65.066 | 33.773 | 38.821 | 139.57 | 72.662 | 29.507 | 34.408 | 0.149 | 0.083 | 12.301 | 16.031 | 0.105 | 0.08 |
| s03 | 200 | 35.234 | 224.618 | 64.085 | 36.984 | 31.153 | 25.887 | 0.591 | 56.349 | 38.914 | 40.096 | 273.956 | 143.841 | 29.359 | 32.102 | 0.165 | 0.071 | 19.794 | 23.755 | 0.11 | 0.077 |
| s04 | 300 | 38.134 | 236.279 | 61.311 | 40.359 | 36.582 | 33.881 | 0.737 | 39.998 | 43.099 | 48.702 | 413.822 | 215.522 | 30.753 | 34.434 | 0.224 | 0.131 | 28.256 | 35.467 | 0.127 | 0.109 |
| s05 | 400 | 38.339 | 274.714 | 66.474 | 38.982 | 35.317 | 39.799 | 0.739 | 41.538 | 46.006 | 47.785 | 552.803 | 285.396 | 33.934 | 46.347 | 0.196 | 0.103 | 36.17 | 38.973 | 0.147 | 0.133 |
| s06 | 500 | 41.635 | 282.443 | 63.935 | 48.223 | 37.869 | 46.192 | 1.379 | 49.272 | 49.041 | 50.211 | 692.283 | 356.089 | 55.53 | 60.631 | 0.186 | 0.121 | 39.166 | 42.873 | 0.166 | 0.148 |
| s07 | 650 | 44.914 | 320.579 | 66.777 | 38.982 | 43.364 | 55.62 | 0.246 | 48.354 | 53.279 | 55.873 | 870.319 | 451.838 | 52.995 | 61.636 | 0.158 | 0.14 | 42.915 | 48.454 | 0.179 | 0.182 |
| s08 | 800 | 48.082 | 324.539 | 64.125 | 42.325 | 46.726 | 58.687 | 2.497 | 113.825 | 54.39 | 56.777 | 1106.43 | 573.062 | 73.396 | 81.388 | 0.258 | 0.16 | 53.469 | 62.781 | 0.205 | 0.23 |
| s09 | 1000 | 51.985 | 355.693 | 63.252 | 52.942 | 45.233 | 67.874 | 0.246 | 51.827 | 57.36 | 60.417 | 1382.415 | 715.396 | 73.926 | 79.484 | 0.283 | 0.206 | 59.568 | 62.59 | 0.238 | 0.288 |
| s10 | 1250 | 65.132 | 394.031 | 63.906 | 99.21 | 49.902 | 78.404 | 0.937 | 50.058 | 65.799 | 69.382 | 1729.282 | 893.081 | 65.08 | 69.364 | 0.271 | 0.226 | 64.704 | 67.031 | 0.264 | 0.3 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 59 | 47.935 | 69.382 | 3.886 | 5.27 | 35.964 | 366.653 | 708.332 | 1749.45 | 8 |
| gw-vector1 | target | 16 | 59 | 47.593 | 81.388 | 8.587 | 13.22 | 58.226 | 8.326 | 10.527 | 347.312 | 11 |
| gw-cache1 | data | 8 | 59 | 3.02 | 16.136 | 0.239 | 0.54 | 31.512 | 0.484 | 0.399 | 1.325 | 7 |
| gw-cache2 | data | 8 | 59 | 3.146 | 16.361 | 0.241 | 0.47 | 31.223 | 0.49 | 0.376 | 0.834 | 7 |
| gw-cache3 | data | 8 | 59 | 3.673 | 18.367 | 0.304 | 0.79 | 31.175 | 0.531 | 0.35 | 0.955 | 8 |
| gw-worker3 | generator | 4 | 59 | 37.798 | 67.031 | 1.538 | 2.87 | 31.862 | 0.165 | 0.163 | 0.273 | 1253 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 52.499 | 168.31 | 2326.493 | 2327.552 |
| abusive | coolify-proxy | 282.216 | 459.65 | 344.973 | 383.2 |
| gw-vector1 | gk4owk8-011237769659 | 43.666 | 165.58 | 2383.178 | 2385.92 |
| gw-vector1 | coolify-proxy | 43.623 | 85.63 | 107.058 | 117.6 |
| gw-vector1 | qdrant-main | 498.416 | 1057.82 | 4334.679 | 4651.008 |

## Webapp process

From the webapp's own counters over 299.972 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 290.583 req/s in total: 514.061 from the benchmark and -223.477 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 0.627 on average, 3 at most. Event loop delay: 99.21 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 40.933 | 67.51 |
| webapp V8Worker | 4.904 | 24.895 |
| webapp libuv-worker | 2.896 | 4.953 |
| proxy | 282.719 | 418.173 |

The proxy accepted 67.647 connections per second on average, 111.446 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /og/lists/:id/:file | 77056 | 256.877 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /person/:personKey | 872 | 2.907 | 78.478 | 191.727 | 262.087 | 26.861 | 71.434 | 100 |
| /movie/:movieKey | 718 | 2.394 | 138.843 | 248.393 | 299.679 | 133.333 | 199.152 | 99.025 |
| /show/:showKey | 72 | 0.24 | 127.027 | 260 | 292 | 120 | 210 | 100 |
| static | 30 | 0.1 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 3 | 0.01 | 225 | 925 | 985 | n/a | n/a | 66.667 |
| / | 2 | 0.007 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 72 | 26 | 43 | 63.889 | 141.026 | 194.103 |
| episode-grid | 72 | 14 | 55 | 80.556 | 25 | 47.5 |
| related-cards | 293 | 106 | 187 | 63.823 | 77.969 | 175.833 |
| details-movie-v2 | 724 | 126 | 571 | 82.597 | 135.974 | 193.597 |
| person-profile-v2 | 870 | 202 | 668 | 76.782 | 64.012 | 164.318 |
| person-fingerprint-baseline | 668 | 668 | 0 | 0 | n/a | n/a |
| movie-collection | 47 | 22 | 25 | 53.191 | 25 | 47.5 |
| share-list-view-v1 | 75 | 34 | 0 | 54.667 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 4 | 0.013 | 102.625 |
| grpc /qdrant.Points/Get 0 | 702 | 2.34 | 2.808 |
| grpc /qdrant.Points/Recommend 0 | 698 | 2.327 | 34.318 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 580.077 req/s, of which 66.016 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 3a45fcfd | 290.583 | 0 | 40.933 | 67.51 | 3 | 99.21 | 2324.895 |
| 10.0.0.20 | 3a45fcfd | 288.601 | 0 | 37.369 | 54.14 | 2 | 121.296 | 2433.242 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 72 | 0 |
| 10.0.0.21 | /movie/:movieKey | 0 | 0 | 0 | 724 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 872 | 0 |
| 10.0.0.21 | /discover/:type? | 0 | 0 | 0 | 47 | 0 |
| 10.0.0.21 | / | 2 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /person/:personKey | 1 | 0 | 0 | 485 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 0 | 0 | 609 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 73 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 58 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 7 | 1 | 0 | 0 | 0 |
