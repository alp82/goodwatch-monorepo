# 20261004T032732Z-load-baseline-latency-warm

Label: baseline-latency-warm. Time: 2026-10-04T03:27:58.157Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 88af219ad16c3a75c7caf51916849256c1da8a5c.

Rate plan: 2 req/s for 150 s.

**Aborted:** http_req_duration{phase:main,step:s01}: p(95)<3000

26 requests; 1.628 req/s; 0% errors; p95 3117.237 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 2 | 0.125 | 0 | 1287.48 | 1523.752 | 1544.754 | 246.283 | 365.895 | 376.527 | 2/0/0/0/0 |
| home | 4 | 0.25 | 0 | 315.659 | 1321.752 | 1443.662 | 94.037 | 218.529 | 227.095 | 4/0/0/0/0 |
| og_share_list | 1 | 0.063 | 0 | 42.277 | 42.277 | 42.277 | 39.253 | 39.253 | 39.253 | 1/0/0/0/0 |
| og_title | 3 | 0.188 | 0 | 47.808 | 110.101 | 115.638 | 32.531 | 82.533 | 86.977 | 3/0/0/0/0 |
| person | 4 | 0.25 | 0 | 474.451 | 640.006 | 652.715 | 55.119 | 97.924 | 101.952 | 4/0/0/0/0 |
| share_list | 2 | 0.125 | 0 | 991.996 | 1622.926 | 1679.009 | 243.085 | 305.284 | 310.813 | 2/0/0/0/0 |
| title_movie | 3 | 0.188 | 0 | 827.886 | 2417.377 | 2558.665 | 146.975 | 157.799 | 158.762 | 3/0/0/0/0 |
| title_show | 7 | 0.438 | 0 | 2375.734 | 4027.29 | 4279.508 | 186.45 | 296.657 | 305.566 | 7/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 26 | 1.628 | 0 | 602.936 | 3117.237 | 4079.835 | 134.964 | 311.095 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 3 | 47.207 | 51.184 | 3.123 | 3.61 | 34.298 | 12.539 | 15.02 | 15.155 | 30 |
| pgnode01 | data | 16 | 4 | 5.669 | 8.422 | 0.67 | 0.72 | 70.682 | 2.122 | 2.479 | 2.811 | 13 |
| pgnode02 | data | 16 | 3 | 5.624 | 6.689 | 0.817 | 0.87 | 72.306 | 1.544 | 1.861 | 2.338 | 15 |
| pgnode03 | data | 16 | 3 | 4.856 | 6.561 | 0.58 | 0.61 | 65.449 | 0.111 | 0.135 | 0.177 | 7 |
| gw-cache1 | data | 8 | 3 | 1.312 | 2.391 | 0.33 | 0.36 | 35.785 | 0.94 | 1.49 | 1.647 | 9 |
| gw-cache2 | data | 8 | 4 | 3.626 | 8.051 | 0.295 | 0.33 | 35.665 | 1.01 | 2.312 | 3.571 | 12 |
| gw-cache3 | data | 8 | 4 | 9.856 | 13.808 | 0.43 | 0.47 | 35.546 | 0.928 | 1.438 | 2.313 | 9 |
| gw-vector1 | data | 16 | 3 | 6.213 | 8.586 | 0.493 | 0.52 | 39.647 | 0.113 | 0.157 | 0.167 | 7 |
| gw-worker3 | generator | 4 | 3 | 7.922 | 10.161 | 0.403 | 0.45 | 15.931 | 0.093 | 0.117 | 0.132 | 25 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 127.72 | 136.42 | 2653.184 | 2654.208 |
| abusive | coolify-proxy | 165.363 | 194.82 | 244 | 245.9 |

## Webapp process

From the webapp's own counters over 19.035 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 74.286 req/s in total: 1.786 from the benchmark and 72.5 of background traffic, of which 41.661 are the crawler loop. Server errors: 0 per second. Requests in flight: 9.5 on average, 14 at most. Event loop delay: 101.766 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 88.698 | 94.724 |
| webapp V8Worker | 41.938 | 71.191 |
| webapp libuv-worker | 22.242 | 25.51 |
| proxy | 143.044 | 154.643 |

The proxy accepted 62.446 connections per second on average, 65.456 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 387 | 20.331 | 43.778 | 194.846 | 275.812 | 28.289 | 83.75 | 100 |
| /person/:personKey | 145 | 7.618 | 359.375 | 1842.593 | 3550 | 80.921 | 350 | 43.448 |
| / | 71 | 3.73 | 49.306 | 280.625 | 1290 | 41.667 | 150 | 97.183 |
| /api/tonight | 63 | 3.31 | 38.415 | 183.462 | 237 | n/a | n/a | 100 |
| /api/e | 63 | 3.31 | 478.125 | 943.75 | 988.75 | n/a | n/a | 4.762 |
| /api/search-config | 62 | 3.257 | 46.97 | 261.25 | 292.25 | n/a | n/a | 100 |
| static | 59 | 3.1 | 61.364 | 202.5 | 382 | n/a | n/a | 98.305 |
| /api/og-image-warm | 53 | 2.784 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 46 | 2.417 | 566.667 | 3275 | 4655 | 211.111 | 770 | 28.261 |
| /sign-up | 12 | 0.63 | 571.429 | 957.143 | 991.429 | 37.5 | 140 | 41.667 |
| /show/:showKey | 12 | 0.63 | 1500 | 4640 | 4928 | 200 | 470 | 0 |
| /og/:first/:second | 4 | 0.21 | 33.333 | 90 | 98 | n/a | n/a | 100 |
| /sign-in | 3 | 0.158 | 250 | 925 | 985 | 25 | 47.5 | 66.667 |
| /discover/:type? | 3 | 0.158 | 1250 | 1925 | 1985 | 150 | 285 | 0 |
| /u/:handle/lists/:id | 3 | 0.158 | 250 | 1850 | 1970 | 125 | 192.5 | 66.667 |
| /og/lists/:id/:file | 2 | 0.105 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 99 | 41 | 58 | 58.586 | 98 | 355 |
| person-fingerprint-baseline | 57 | 57 | 0 | 0 | n/a | n/a |
| user-settings | 57 | 57 | 0 | 0 | n/a | n/a |
| related-show | 57 | 20 | 37 | 64.912 | 48.684 | 537.5 |
| details-movie | 45 | 5 | 40 | 88.889 | 107.5 | 195.25 |
| related-movie | 57 | 20 | 37 | 64.912 | 58.333 | 537.5 |
| availability-evidence-v1 | 57 | 12 | 45 | 78.947 | 25.568 | 48.58 |
| details-show | 12 | 7 | 5 | 41.667 | 125 | 275 |
| episode-grid | 12 | 9 | 3 | 25 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 24 | 1.261 | 56.783 |
| grpc /qdrant.Points/Get 0 | 76 | 3.993 | 8.571 |
