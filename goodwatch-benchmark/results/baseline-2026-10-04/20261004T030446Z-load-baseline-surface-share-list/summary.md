# 20261004T030446Z-load-baseline-surface-share-list

Label: baseline-surface-share-list. Time: 2026-10-04T03:05:11.525Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 88af219ad16c3a75c7caf51916849256c1da8a5c.

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s.

**Aborted:** http_req_duration{phase:main,step:s06}: p(95)<3000

1023 requests; 4.968 req/s; 0% errors; p95 1295.442 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| share_list | 1023 | 4.968 | 0 | 197.619 | 1295.442 | 4648.153 | 97.919 | 287.532 | 503.76 | 1023/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 166.839 | 655.138 | 881.942 | 102.121 | 236.093 |
| s02 | 2 | 68 | 1.943 | 0 | 223.974 | 1819.241 | 2533.774 | 107.545 | 311.101 |
| s03 | 4 | 135 | 3.857 | 0 | 174.71 | 1183.621 | 1711.078 | 98.833 | 219.086 |
| s04 | 6 | 205 | 5.857 | 0 | 150.332 | 544.377 | 699.572 | 91.109 | 210.418 |
| s05 | 8 | 275 | 7.857 | 0 | 170.789 | 933.328 | 1347.984 | 93.332 | 265.768 |
| s06 | 10 | 311 | 8.886 | 0 | 368.428 | 4322.565 | 4862.947 | 123.145 | 386.868 |
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
| abusive | target | 8 | 42 | 38.464 | 53.731 | 3.703 | 4.53 | 34.075 | 8.405 | 9.312 | 14.689 | 41 |
| pgnode01 | data | 16 | 41 | 5.472 | 9.085 | 0.413 | 0.65 | 70.678 | 2.831 | 5.811 | 66.469 | 14 |
| pgnode02 | data | 16 | 41 | 5.656 | 10.262 | 1.296 | 3.04 | 72.392 | 3.833 | 5.038 | 71.865 | 16 |
| pgnode03 | data | 16 | 41 | 6.344 | 9.299 | 0.97 | 1.64 | 65.433 | 0.094 | 0.1 | 0.164 | 5 |
| gw-cache1 | data | 8 | 41 | 4.516 | 21.166 | 0.37 | 0.66 | 35.807 | 0.921 | 0.724 | 3.051 | 11 |
| gw-cache2 | data | 8 | 42 | 2.171 | 14.073 | 0.279 | 0.76 | 35.887 | 2.394 | 2.701 | 4.708 | 9 |
| gw-cache3 | data | 8 | 41 | 4.121 | 17.624 | 0.241 | 0.43 | 35.467 | 0.73 | 0.71 | 1.798 | 9 |
| gw-vector1 | data | 16 | 41 | 8.934 | 19.3 | 1.946 | 3.37 | 40.624 | 7.55 | 0.681 | 4.614 | 7 |
| gw-worker3 | generator | 4 | 41 | 6.032 | 18.878 | 0.183 | 0.39 | 16.338 | 0.084 | 0.092 | 0.184 | 72 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 129.491 | 231.61 | 2620.123 | 2624.512 |
| abusive | coolify-proxy | 121.739 | 247.73 | 248.745 | 255.2 |

## Webapp process

From the webapp's own counters over 209.063 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 54.027 req/s in total: 4.898 from the benchmark and 49.129 of background traffic, of which 36.424 are the crawler loop. Server errors: 0 per second. Requests in flight: 6.31 on average, 39 at most. Event loop delay: 147.117 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 81.281 | 97.433 |
| webapp V8Worker | 26.117 | 116.92 |
| webapp libuv-worker | 21.408 | 31.556 |
| proxy | 115.391 | 161.481 |

The proxy accepted 44.742 connections per second on average, 78.377 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 3746 | 17.918 | 29.901 | 141.762 | 252.962 | 26.795 | 66.503 | 99.653 |
| /u/:handle/lists/:id | 1025 | 4.903 | 196.3 | 1596.154 | 3770 | 76.265 | 249.519 | 66.829 |
| /person/:personKey | 743 | 3.554 | 184.704 | 1182.813 | 2973.636 | 90.979 | 259.255 | 72.813 |
| /movie/:movieKey | 544 | 2.602 | 303.774 | 1871.875 | 4542.5 | 177.796 | 493.922 | 49.632 |
| /sign-up | 290 | 1.387 | 92.208 | 930.556 | 2825 | 28.101 | 89.773 | 81.724 |
| static | 197 | 0.942 | 34.441 | 175.937 | 280.6 | n/a | n/a | 99.492 |
| / | 112 | 0.536 | 32.941 | 185.455 | 488 | 26.5 | 58.75 | 97.321 |
| /show/:showKey | 106 | 0.507 | 580.645 | 3566.667 | 4980 | 248.889 | 641.667 | 19.811 |
| /api/e | 65 | 0.311 | 442.5 | 922.619 | 984.524 | n/a | n/a | 6.154 |
| /api/tonight | 61 | 0.292 | 28.241 | 78.214 | 95.643 | n/a | n/a | 100 |
| /api/search-config | 60 | 0.287 | 34.884 | 185.714 | 270 | n/a | n/a | 100 |
| /api/og-image-warm | 60 | 0.287 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/related | 32 | 0.153 | 200 | 3400 | 4680 | n/a | n/a | 50 |
| /sign-in | 22 | 0.105 | 71.429 | 862.5 | 972.5 | 26.19 | 49.762 | 77.273 |
| /api/genres/all | 2 | 0.01 | 100 | 190 | 198 | n/a | n/a | 100 |
| /api/poster-impressions | 2 | 0.01 | 50 | 95 | 99 | n/a | n/a | 100 |
| /about | 1 | 0.005 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /og/:first/:second | 1 | 0.005 | 250 | 475 | 495 | n/a | n/a | 0 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 716 | 124 | 592 | 82.682 | 75 | 192.672 |
| person-fingerprint-baseline | 592 | 592 | 0 | 0 | n/a | n/a |
| user-settings | 658 | 653 | 5 | 0.76 | 25 | 47.5 |
| related-show | 674 | 156 | 518 | 76.855 | 40.723 | 358.571 |
| details-movie | 553 | 19 | 534 | 96.564 | 107.666 | 191.394 |
| related-movie | 674 | 156 | 518 | 76.855 | 40.723 | 454 |
| availability-evidence-v1 | 652 | 24 | 628 | 96.319 | 25.738 | 48.902 |
| details-show | 106 | 5 | 101 | 95.283 | 125 | 192.5 |
| episode-grid | 105 | 14 | 91 | 86.667 | 26.453 | 55.625 |
| genres-movie | 2 | 2 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 326 | 1.559 | 56.817 |
| grpc /qdrant.Points/UpdateBatch 0 | 8 | 0.038 | 22.789 |
| grpc /qdrant.Points/Get 0 | 1040 | 4.975 | 5.603 |
