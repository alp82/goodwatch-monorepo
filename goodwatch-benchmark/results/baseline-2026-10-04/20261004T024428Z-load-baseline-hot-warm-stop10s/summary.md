# 20261004T024428Z-load-baseline-hot-warm-stop10s

Label: baseline-hot-warm-stop10s. Time: 2026-10-04T02:44:44.379Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: d742d9937868340d72ceb5c20101eab1be867f0c.

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s.

**Aborted:** http_req_duration{phase:main,step:s04}: p(95)<10000

344 requests; 2.569 req/s; 0% errors; p95 4801.344 ms; 5 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 21 | 0.157 | 0 | 1023.866 | 4394.427 | 7969.356 | 230.603 | 351.13 | 419.716 | 21/0/0/0/0 |
| home | 23 | 0.172 | 0 | 140.824 | 3500.535 | 7080.814 | 36.312 | 276.662 | 1615.629 | 23/0/0/0/0 |
| og_person | 3 | 0.022 | 0 | 17.82 | 190.114 | 205.43 | 12.297 | 153.087 | 165.601 | 3/0/0/0/0 |
| og_share_list | 4 | 0.03 | 0 | 77.933 | 141.997 | 150.622 | 74.92 | 139.673 | 148.307 | 4/0/0/0/0 |
| og_title | 13 | 0.097 | 0 | 29.38 | 194.771 | 207.415 | 16.805 | 158.014 | 159.303 | 13/0/0/0/0 |
| person | 16 | 0.119 | 0 | 603.713 | 5365.198 | 8233.589 | 71.446 | 221.569 | 238.358 | 16/0/0/0/0 |
| share_list | 29 | 0.217 | 0 | 475.057 | 3105.769 | 5236.302 | 144.471 | 337.297 | 429.575 | 29/0/0/0/0 |
| title_movie | 213 | 1.591 | 0 | 862.77 | 4862.023 | 13190.687 | 117.919 | 352.616 | 532.572 | 213/0/0/0/0 |
| title_show | 22 | 0.164 | 0 | 1650.377 | 5275.762 | 5428.456 | 149.465 | 239.745 | 298.791 | 22/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 438.878 | 1258.404 | 2127.99 | 118.822 | 239.485 |
| s02 | 2 | 68 | 1.943 | 0 | 376.25 | 1683.449 | 1991.36 | 106.933 | 248.358 |
| s03 | 4 | 135 | 3.857 | 0 | 663.362 | 2584.298 | 3888.422 | 111.134 | 291.518 |
| s04 | 6 | 112 | 3.303 | 0 | 1812.338 | 11633.223 | 13742.703 | 156.386 | 379.807 |
| s05 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s06 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s07 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s08 | 14 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s09 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s10 | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s11 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s12 | 25 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s13 | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s14 | 35 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s15 | 40 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s16 | 45 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s17 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s18 | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s19 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s20 | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 27 | 42.098 | 48.821 | 3.288 | 4.1 | 33.312 | 14.644 | 10.777 | 15.867 | 37 |
| pgnode01 | data | 16 | 26 | 9.518 | 16.777 | 1.283 | 1.9 | 71.284 | 16.599 | 6.929 | 19.464 | 15 |
| pgnode02 | data | 16 | 26 | 6.649 | 20.87 | 0.826 | 1.22 | 71.523 | 6.545 | 8.738 | 73.717 | 15 |
| pgnode03 | data | 16 | 26 | 7.179 | 15.824 | 0.91 | 1.19 | 65.424 | 0.123 | 0.103 | 0.154 | 5 |
| host-4 | data | n/a | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| gw-cache2 | data | 8 | 26 | 3.051 | 10.017 | 0.251 | 0.4 | 35.492 | 1.551 | 6.917 | 27.963 | 9 |
| gw-cache3 | data | 8 | 26 | 3.206 | 9.093 | 0.259 | 0.38 | 35.381 | 1.72 | 2.133 | 21.163 | 9 |
| gw-vector1 | data | 16 | 26 | 6.881 | 11.391 | 2.417 | 3.86 | 39.8 | 0.178 | 0.169 | 0.236 | 5 |
| gw-worker3 | generator | 4 | 26 | 10.21 | 17.413 | 0.35 | 0.47 | 17.578 | 0.081 | 0.075 | 0.274 | 71 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 153.099 | 226.42 | 2509.407 | 2618.368 |
| abusive | coolify-proxy | 126.69 | 183.42 | 254.815 | 267.6 |

## Webapp process

From the webapp's own counters over 137.087 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 56.453 req/s in total: 2.597 from the benchmark and 53.856 of background traffic, of which 37.509 are the crawler loop. Server errors: 0 per second. Requests in flight: 18.111 on average, 121 at most. Event loop delay: 930.534 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 88.401 | 106.338 |
| webapp V8Worker | 36.835 | 97.726 |
| webapp libuv-worker | 21.181 | 32.264 |
| proxy | 120.707 | 173.908 |

The proxy accepted 49.107 connections per second on average, 81.21 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 2515 | 18.346 | 39.101 | 286.436 | 608.333 | 29.827 | 125.208 | 95.507 |
| /movie/:movieKey | 588 | 4.289 | 562.016 | 4821.053 | 10000 | 165.041 | 744.118 | 29.592 |
| /person/:personKey | 527 | 3.844 | 274.138 | 3278 | 7804.167 | 97.629 | 438.649 | 54.269 |
| static | 242 | 1.765 | 40.604 | 197.66 | 338.667 | n/a | n/a | 98.76 |
| / | 169 | 1.233 | 41.422 | 693.75 | 2930 | 31.548 | 167 | 92.308 |
| /sign-up | 162 | 1.182 | 254.167 | 3264.286 | 4652.857 | 33.471 | 199.286 | 56.79 |
| /api/e | 139 | 1.014 | 460.241 | 960.5 | 3830 | n/a | n/a | 2.158 |
| /api/tonight | 135 | 0.985 | 33.088 | 162.5 | 255 | n/a | n/a | 100 |
| /api/search-config | 134 | 0.977 | 39.881 | 221.667 | 366 | n/a | n/a | 98.507 |
| /api/og-image-warm | 114 | 0.832 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /show/:showKey | 53 | 0.387 | 803.571 | 4805 | 8675 | 184.615 | 477.143 | 7.547 |
| /api/related | 46 | 0.336 | 809.524 | 1846.667 | 1969.333 | n/a | n/a | 4.348 |
| /u/:handle/lists/:id | 31 | 0.226 | 333.333 | 4587.5 | 8450 | 96.875 | 272.5 | 48.387 |
| /discover/:type? | 22 | 0.16 | 1000 | 4957.143 | 8900 | 172.727 | 298.571 | 9.091 |
| /og/:first/:second | 19 | 0.139 | 29.688 | 168.333 | 193.667 | n/a | n/a | 100 |
| /api/genres/all | 17 | 0.124 | 47.222 | 330 | 466 | n/a | n/a | 94.118 |
| /sign-in | 9 | 0.066 | 91.667 | 1550 | 1910 | 28.125 | 77.5 | 77.778 |
| /og/lists/:id/:file | 5 | 0.036 | 62.5 | 175 | 195 | n/a | n/a | 100 |
| /api/movie/collection | 4 | 0.029 | 50 | 95 | 99 | n/a | n/a | 100 |
| /api/poster-impressions | 2 | 0.015 | 50 | 290 | 298 | n/a | n/a | 100 |
| /:type | 1 | 0.007 | 50 | 95 | 99 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 438 | 115 | 323 | 73.744 | 97.098 | 338 |
| person-fingerprint-baseline | 323 | 323 | 0 | 0 | n/a | n/a |
| user-settings | 708 | 706 | 2 | 0.282 | 25 | 47.5 |
| related-show | 731 | 388 | 343 | 46.922 | 46.102 | 498.929 |
| details-movie | 644 | 281 | 363 | 56.366 | 124.667 | 197.267 |
| related-movie | 731 | 388 | 343 | 46.922 | 46.102 | 857 |
| availability-evidence-v1 | 705 | 314 | 391 | 55.461 | 27.849 | 89.327 |
| details-show | 64 | 33 | 31 | 48.438 | 132.609 | 193.261 |
| episode-grid | 64 | 35 | 29 | 45.313 | 30.208 | 127.5 |
| genres-movie | 17 | 17 | 0 | 0 | n/a | n/a |
| movie-collection | 4 | 0 | 4 | 100 | 33.333 | 90 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 184 | 1.342 | 80.025 |
| grpc /qdrant.Points/UpdateBatch 0 | 2 | 0.015 | 23.012 |
| grpc /qdrant.Points/Get 0 | 686 | 5.004 | 11.755 |
