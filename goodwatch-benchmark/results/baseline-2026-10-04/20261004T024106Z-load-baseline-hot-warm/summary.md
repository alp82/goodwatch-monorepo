# 20261004T024106Z-load-baseline-hot-warm

Label: baseline-hot-warm. Time: 2026-10-04T02:41:22.706Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: d742d9937868340d72ceb5c20101eab1be867f0c.

Rate plan: 1 req/s for 30 s, then 2 req/s for 35 s, then 4 req/s for 35 s, then 6 req/s for 35 s, then 8 req/s for 35 s, then 10 req/s for 35 s, then 12 req/s for 35 s, then 14 req/s for 35 s, then 16 req/s for 35 s, then 18 req/s for 35 s, then 20 req/s for 35 s, then 25 req/s for 35 s, then 30 req/s for 35 s, then 35 req/s for 35 s, then 40 req/s for 35 s, then 45 req/s for 35 s, then 50 req/s for 35 s, then 55 req/s for 35 s, then 60 req/s for 35 s, then 65 req/s for 35 s.

**Aborted:** http_req_duration{phase:main,step:s03}: p(95)<3000

216 requests; 2.12 req/s; 0% errors; p95 2790.754 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 15 | 0.147 | 0 | 644.808 | 4464.735 | 4858.756 | 204.759 | 331.675 | 341.484 | 15/0/0/0/0 |
| home | 15 | 0.147 | 0 | 469.697 | 2365.145 | 2661.719 | 113.547 | 378.778 | 411.625 | 15/0/0/0/0 |
| og_person | 2 | 0.02 | 0 | 25.243 | 34.861 | 35.716 | 18.203 | 25.997 | 26.689 | 2/0/0/0/0 |
| og_share_list | 2 | 0.02 | 0 | 45.187 | 56.815 | 57.849 | 41.307 | 53.133 | 54.184 | 2/0/0/0/0 |
| og_title | 5 | 0.049 | 0 | 32.804 | 126.169 | 141.423 | 19.61 | 97.795 | 113.383 | 5/0/0/0/0 |
| person | 8 | 0.079 | 0 | 182.927 | 857.767 | 1096.356 | 50.671 | 164.103 | 210.87 | 8/0/0/0/0 |
| share_list | 18 | 0.177 | 0 | 160.639 | 833.321 | 1511.311 | 93.085 | 216.432 | 431.458 | 18/0/0/0/0 |
| title_movie | 137 | 1.345 | 0 | 457.505 | 3002.76 | 5322.461 | 112.355 | 296.808 | 377.92 | 137/0/0/0/0 |
| title_show | 14 | 0.137 | 0 | 443.15 | 886.084 | 1046.104 | 113.987 | 195.62 | 218.786 | 14/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 29 | 0.967 | 0 | 292.381 | 1017.457 | 1257.827 | 103.504 | 208.071 |
| s02 | 2 | 68 | 1.943 | 0 | 297.283 | 1428.983 | 1935.914 | 111.48 | 214.198 |
| s03 | 4 | 119 | 3.4 | 0 | 573.533 | 4384.121 | 5394.858 | 113.956 | 338.856 |
| s04 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
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
| abusive | target | 8 | 20 | 37.812 | 46.972 | 3.296 | 3.97 | 33.427 | 9.616 | 9.22 | 13.288 | 37 |
| pgnode01 | data | 16 | 20 | 4.975 | 7.928 | 0.997 | 1.28 | 70.674 | 1.95 | 2.043 | 3.598 | 14 |
| pgnode02 | data | 16 | 21 | 4.435 | 6.729 | 0.644 | 0.75 | 71.502 | 1.272 | 1.451 | 1.927 | 14 |
| pgnode03 | data | 16 | 21 | 10.449 | 17.395 | 1.439 | 1.98 | 66.611 | 12.775 | 0.88 | 2.382 | 7 |
| gw-cache1 | data | 8 | 21 | 2.956 | 7.593 | 0.261 | 0.34 | 35.723 | 0.762 | 0.834 | 1.76 | 9 |
| gw-cache2 | data | 8 | 20 | 3.304 | 8.66 | 0.115 | 0.17 | 35.419 | 0.761 | 4.746 | 9.637 | 9 |
| gw-cache3 | data | 8 | 20 | 3.151 | 7.878 | 0.288 | 0.41 | 35.376 | 0.805 | 1.108 | 1.537 | 9 |
| gw-vector1 | data | 16 | 21 | 6.165 | 11.261 | 0.652 | 0.87 | 39.644 | 0.133 | 0.158 | 0.225 | 6 |
| gw-worker3 | generator | 4 | 20 | 8.257 | 21.371 | 0.22 | 0.33 | 16.569 | 0.123 | 0.096 | 0.13 | 70 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 119.268 | 209.35 | 2483.046 | 2494.464 |
| abusive | coolify-proxy | 115.061 | 139.27 | 251.15 | 253.4 |

## Webapp process

From the webapp's own counters over 104.982 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 50.685 req/s in total: 2.172 from the benchmark and 48.513 of background traffic, of which 36.035 are the crawler loop. Server errors: 0 per second. Requests in flight: 9.714 on average, 56 at most. Event loop delay: 199.939 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 81.004 | 93.701 |
| webapp V8Worker | 22.319 | 59.105 |
| webapp libuv-worker | 20.018 | 32.488 |
| proxy | 114.526 | 135.934 |

The proxy accepted 43.721 connections per second on average, 55.359 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 1851 | 17.632 | 31.544 | 167.185 | 281.633 | 27.43 | 78.81 | 99.298 |
| /movie/:movieKey | 455 | 4.334 | 378.218 | 3060.345 | 4943.103 | 158.495 | 464.474 | 41.319 |
| /person/:personKey | 390 | 3.715 | 179.861 | 1423.077 | 4025 | 95.492 | 298.276 | 71.282 |
| /sign-up | 129 | 1.229 | 88.393 | 896.429 | 3065 | 28.795 | 90.577 | 85.271 |
| static | 113 | 1.076 | 54.787 | 164.231 | 199 | n/a | n/a | 100 |
| / | 64 | 0.61 | 45.714 | 1400 | 4040 | 36.538 | 155 | 85.938 |
| /api/e | 46 | 0.438 | 366.667 | 835.714 | 967.143 | n/a | n/a | 32.609 |
| /show/:showKey | 45 | 0.429 | 795.455 | 4386.364 | 4877.273 | 231.818 | 1791.667 | 13.333 |
| /api/search-config | 29 | 0.276 | 31.522 | 87.917 | 97.583 | n/a | n/a | 100 |
| /api/tonight | 29 | 0.276 | 26.852 | 77.5 | 171 | n/a | n/a | 100 |
| /api/og-image-warm | 26 | 0.248 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /u/:handle/lists/:id | 20 | 0.191 | 142.857 | 1000 | 1800 | 62.5 | 200 | 85 |
| /discover/:type? | 16 | 0.152 | 500 | 4200 | 4840 | 155.556 | 280 | 31.25 |
| /og/:first/:second | 10 | 0.095 | 27.778 | 75 | 95 | n/a | n/a | 100 |
| /sign-in | 9 | 0.086 | 250 | 1775 | 1955 | 32.143 | 88.75 | 55.556 |
| /api/genres/all | 3 | 0.029 | 37.5 | 185 | 197 | n/a | n/a | 100 |
| /og/lists/:id/:file | 3 | 0.029 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 374 | 73 | 301 | 80.481 | 77.29 | 249.583 |
| person-fingerprint-baseline | 301 | 301 | 0 | 0 | n/a | n/a |
| user-settings | 509 | 508 | 1 | 0.196 | 25 | 47.5 |
| related-show | 509 | 244 | 265 | 52.063 | 38.075 | 572.917 |
| details-movie | 463 | 157 | 306 | 66.091 | 117.598 | 194.777 |
| related-movie | 509 | 244 | 265 | 52.063 | 38.075 | 742.188 |
| availability-evidence-v1 | 510 | 173 | 337 | 66.078 | 26.661 | 64.821 |
| details-show | 46 | 16 | 30 | 65.217 | 147.059 | 275 |
| episode-grid | 46 | 21 | 25 | 54.348 | 39.063 | 175 |
| genres-movie | 3 | 3 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 112 | 1.067 | 69.69 |
| grpc /qdrant.Points/Get 0 | 526 | 5.01 | 6.706 |
| grpc /qdrant.Points/UpdateBatch 0 | 2 | 0.019 | 19.975 |
