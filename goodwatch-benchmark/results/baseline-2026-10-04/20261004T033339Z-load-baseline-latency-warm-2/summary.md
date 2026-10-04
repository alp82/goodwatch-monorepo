# 20261004T033339Z-load-baseline-latency-warm-2

Label: baseline-latency-warm-2. Time: 2026-10-04T03:34:04.467Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 88af219ad16c3a75c7caf51916849256c1da8a5c.

Rate plan: 2 req/s for 150 s.

299 requests; 1.969 req/s; 0% errors; p95 763.397 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 45 | 0.296 | 0 | 217.555 | 890.137 | 1122.706 | 103.654 | 202.341 | 266.986 | 45/0/0/0/0 |
| home | 34 | 0.224 | 0 | 62.472 | 137.792 | 185.337 | 24.655 | 55.845 | 64.071 | 34/0/0/0/0 |
| og_share_list | 32 | 0.211 | 0 | 32.691 | 128.808 | 170.076 | 29.435 | 125.484 | 167.249 | 32/0/0/0/0 |
| og_title | 40 | 0.263 | 0 | 20.895 | 82.062 | 129.26 | 10.93 | 66.626 | 107.811 | 40/0/0/0/0 |
| person | 36 | 0.237 | 0 | 141.891 | 352.213 | 903.299 | 43.887 | 106.949 | 149.866 | 36/0/0/0/0 |
| share_list | 25 | 0.165 | 0 | 149.357 | 322.235 | 410.269 | 89.887 | 164.167 | 232.008 | 25/0/0/0/0 |
| title_movie | 50 | 0.329 | 0 | 291.9 | 831.556 | 978.454 | 104.652 | 216.118 | 261.376 | 50/0/0/0/0 |
| title_show | 37 | 0.244 | 0 | 414.954 | 875.611 | 950.184 | 119.936 | 254.007 | 429.297 | 37/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 299 | 1.993 | 0 | 156.233 | 763.397 | 962.4 | 80.718 | 189.205 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 31 | 35.072 | 43.723 | 3.641 | 4.38 | 34.219 | 6.129 | 9.733 | 13.552 | 31 |
| pgnode01 | data | 16 | 30 | 4.612 | 7.88 | 0.658 | 2.16 | 70.677 | 1.734 | 4.166 | 65.125 | 13 |
| pgnode02 | data | 16 | 30 | 5.465 | 15.627 | 1.05 | 1.85 | 72.777 | 7.416 | 1.868 | 6.611 | 19 |
| pgnode03 | data | 16 | 30 | 5.695 | 9.918 | 0.756 | 1.08 | 65.409 | 0.176 | 0.131 | 0.621 | 6 |
| gw-cache1 | data | 8 | 30 | 4.781 | 18.783 | 0.511 | 0.83 | 35.79 | 0.975 | 0.701 | 1.248 | 10 |
| gw-cache2 | data | 8 | 31 | 3.671 | 8.178 | 0.409 | 0.53 | 35.603 | 1.014 | 1.953 | 3.719 | 12 |
| gw-cache3 | data | 8 | 30 | 3.149 | 8.416 | 0.334 | 0.46 | 35.451 | 0.842 | 0.751 | 1.078 | 8 |
| gw-vector1 | data | 16 | 30 | 23.426 | 32.055 | 3.738 | 4.06 | 41.465 | 0.154 | 0.162 | 0.25 | 6 |
| gw-worker3 | generator | 4 | 30 | 7.405 | 13.904 | 0.325 | 0.49 | 15.961 | 0.144 | 0.107 | 0.211 | 27 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 116.988 | 217.27 | 2662.763 | 2669.568 |
| abusive | coolify-proxy | 112.934 | 144.71 | 247.019 | 249.4 |

## Webapp process

From the webapp's own counters over 154.974 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 50.002 req/s in total: 1.981 from the benchmark and 48.021 of background traffic, of which 37.864 are the crawler loop. Server errors: 0 per second. Requests in flight: 3 on average, 10 at most. Event loop delay: 158.782 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 75.91 | 86.666 |
| webapp libuv-worker | 17.587 | 21.312 |
| webapp V8Worker | 12.716 | 46.408 |
| proxy | 110.723 | 119.627 |

The proxy accepted 43.283 connections per second on average, 50.442 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 2876 | 18.558 | 28.374 | 93.656 | 178.4 | 26.203 | 49.785 | 100 |
| /person/:personKey | 626 | 4.039 | 161.597 | 512.5 | 959.643 | 86.538 | 242.826 | 84.984 |
| /movie/:movieKey | 437 | 2.82 | 280.97 | 969.922 | 1757.222 | 171.008 | 419.5 | 55.835 |
| /sign-up | 188 | 1.213 | 64 | 451.429 | 843.333 | 26.857 | 66.364 | 89.362 |
| /show/:showKey | 75 | 0.484 | 450 | 986.111 | 1750 | 166.667 | 455 | 20 |
| / | 73 | 0.471 | 42.442 | 159.444 | 191.889 | 27.419 | 93.333 | 100 |
| /discover/:type? | 46 | 0.297 | 233.333 | 837.5 | 1540 | 74.194 | 184.667 | 67.391 |
| /og/:first/:second | 42 | 0.271 | 27.632 | 81.667 | 258 | n/a | n/a | 100 |
| static | 40 | 0.258 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /og/lists/:id/:file | 33 | 0.213 | 28.448 | 117.5 | 183.5 | n/a | n/a | 100 |
| /u/:handle/lists/:id | 26 | 0.168 | 163.158 | 370 | 474 | 65 | 178.333 | 92.308 |
| /sign-in | 14 | 0.09 | 87.5 | 650 | 930 | 26.923 | 65 | 85.714 |
| /api/related | 14 | 0.09 | 812.5 | 1825 | 1965 | n/a | n/a | 7.143 |
| /api/e | 11 | 0.071 | 708.333 | 1725 | 1945 | n/a | n/a | 0 |
| /api/search-config | 8 | 0.052 | 33.333 | 160 | 192 | n/a | n/a | 100 |
| /api/tonight | 8 | 0.052 | 33.333 | 90 | 98 | n/a | n/a | 100 |
| /api/og-image-warm | 5 | 0.032 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/genres/all | 3 | 0.019 | 75 | 185 | 197 | n/a | n/a | 100 |
| /api/poster-impressions | 2 | 0.013 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 590 | 97 | 493 | 83.559 | 71.445 | 189.69 |
| person-fingerprint-baseline | 493 | 493 | 0 | 0 | n/a | n/a |
| user-settings | 522 | 519 | 3 | 0.575 | 25 | 47.5 |
| related-show | 529 | 174 | 355 | 67.108 | 37.606 | 242.5 |
| details-movie | 445 | 54 | 391 | 87.865 | 104.95 | 192.277 |
| related-movie | 529 | 174 | 355 | 67.108 | 37.766 | 297.656 |
| availability-evidence-v1 | 517 | 93 | 424 | 82.012 | 25.917 | 49.242 |
| details-show | 78 | 39 | 39 | 50 | 125 | 196.25 |
| episode-grid | 77 | 40 | 37 | 48.052 | 25.694 | 48.819 |
| genres-movie | 3 | 3 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 204 | 1.316 | 62.114 |
| grpc /qdrant.Points/Get 0 | 712 | 4.594 | 5.547 |
| grpc /qdrant.Points/UpdateBatch 0 | 11 | 0.071 | 1996.65 |
