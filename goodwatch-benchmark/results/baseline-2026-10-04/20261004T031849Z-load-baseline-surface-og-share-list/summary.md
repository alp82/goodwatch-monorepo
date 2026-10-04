# 20261004T031849Z-load-baseline-surface-og-share-list

Label: baseline-surface-og-share-list. Time: 2026-10-04T03:19:14.710Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 88af219ad16c3a75c7caf51916849256c1da8a5c.

Rate plan: 1 req/s for 25 s, then 2 req/s for 30 s, then 4 req/s for 30 s, then 6 req/s for 30 s, then 8 req/s for 30 s, then 10 req/s for 30 s, then 12 req/s for 30 s, then 14 req/s for 30 s, then 16 req/s for 30 s, then 18 req/s for 30 s, then 20 req/s for 30 s, then 25 req/s for 30 s, then 30 req/s for 30 s, then 35 req/s for 30 s.

5937 requests; 14.303 req/s; 0% errors; p95 136.888 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| og_share_list | 5937 | 14.303 | 0 | 34.22 | 136.888 | 206.695 | 31.15 | 133.697 | 203.558 | 5937/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 24 | 0.96 | 0 | 30.82 | 66.738 | 84.912 | 27.677 | 61.783 |
| s02 | 2 | 58 | 1.933 | 0 | 34.433 | 123.51 | 148.464 | 31.429 | 119.071 |
| s03 | 4 | 115 | 3.833 | 0 | 32.057 | 76.75 | 110.316 | 27.493 | 73.822 |
| s04 | 6 | 175 | 5.833 | 0 | 31.041 | 111.966 | 147.162 | 27.325 | 109.226 |
| s05 | 8 | 235 | 7.833 | 0 | 30.737 | 91.631 | 158.128 | 27.247 | 88.696 |
| s06 | 10 | 295 | 9.833 | 0 | 35.989 | 170.037 | 241.801 | 32.372 | 167.318 |
| s07 | 12 | 355 | 11.833 | 0 | 31.544 | 94.816 | 138.277 | 28.306 | 92.2 |
| s08 | 14 | 415 | 13.833 | 0 | 33.541 | 151.148 | 274.244 | 30.684 | 147.989 |
| s09 | 16 | 475 | 15.833 | 0 | 33.797 | 111.363 | 188.671 | 30.335 | 107.84 |
| s10 | 18 | 535 | 17.833 | 0 | 32.664 | 105.184 | 146.035 | 29.331 | 102.133 |
| s11 | 20 | 595 | 19.833 | 0 | 33.443 | 109.315 | 151.678 | 30.429 | 106.365 |
| s12 | 25 | 737 | 24.567 | 0 | 37.373 | 154.351 | 212.788 | 34.156 | 150.86 |
| s13 | 30 | 888 | 29.6 | 0 | 34.227 | 118.144 | 161.765 | 31.296 | 114.836 |
| s14 | 35 | 1035 | 34.5 | 0 | 39.711 | 180.93 | 223.9 | 36.537 | 176.644 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 83 | 35.648 | 47.221 | 3.305 | 4.37 | 34.219 | 5.508 | 27.351 | 58.934 | 35 |
| pgnode01 | data | 16 | 83 | 5.118 | 9.723 | 0.602 | 1.19 | 70.663 | 2.055 | 3.793 | 65.983 | 15 |
| pgnode02 | data | 16 | 82 | 5.166 | 14.086 | 0.926 | 2.95 | 72.367 | 3.052 | 3.183 | 70.175 | 18 |
| pgnode03 | data | 16 | 82 | 5.742 | 15.618 | 1.333 | 3.57 | 65.458 | 0.1 | 0.104 | 0.41 | 6 |
| gw-cache1 | data | 8 | 82 | 3.637 | 16.568 | 0.281 | 0.53 | 35.766 | 0.869 | 0.747 | 2.581 | 10 |
| gw-cache2 | data | 8 | 83 | 3.178 | 14.272 | 0.219 | 0.61 | 35.709 | 1.631 | 1.557 | 4.008 | 11 |
| gw-cache3 | data | 8 | 83 | 3.313 | 16.596 | 0.297 | 0.53 | 35.46 | 0.826 | 0.712 | 1.792 | 10 |
| gw-vector1 | data | 16 | 82 | 6.377 | 11.638 | 1.285 | 1.68 | 39.749 | 0.14 | 0.162 | 0.266 | 10 |
| gw-worker3 | generator | 4 | 82 | 7.245 | 18.168 | 0.317 | 0.69 | 16.132 | 0.106 | 0.099 | 0.213 | 43 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 104.234 | 228.73 | 2648.73 | 2654.208 |
| abusive | coolify-proxy | 119.483 | 168 | 258.824 | 265.3 |

## Webapp process

From the webapp's own counters over 418.175 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 63.56 req/s in total: 14.2 from the benchmark and 49.36 of background traffic, of which 36.882 are the crawler loop. Server errors: 0 per second. Requests in flight: 5.145 on average, 34 at most. Event loop delay: 102.946 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 74.957 | 93.117 |
| webapp libuv-worker | 14.695 | 20.922 |
| webapp V8Worker | 10.721 | 47.909 |
| proxy | 119.228 | 158.18 |

The proxy accepted 44.653 connections per second on average, 62.955 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 7547 | 18.047 | 27.48 | 83.442 | 171.141 | 25.839 | 49.094 | 100 |
| /og/lists/:id/:file | 5939 | 14.202 | 29.868 | 108.811 | 186.192 | n/a | n/a | 99.966 |
| /person/:personKey | 1697 | 4.058 | 171.496 | 660.372 | 1191.905 | 86.796 | 214.128 | 82.086 |
| /movie/:movieKey | 1123 | 2.685 | 263.485 | 951.4 | 1799.268 | 168.89 | 379.067 | 60.73 |
| /sign-up | 536 | 1.282 | 67.614 | 443.333 | 906.667 | 26.172 | 49.727 | 91.791 |
| / | 226 | 0.54 | 29.737 | 95.741 | 196.286 | 26.488 | 56.875 | 99.115 |
| static | 212 | 0.507 | 30.46 | 95.667 | 184 | n/a | n/a | 100 |
| /api/e | 152 | 0.363 | 435.238 | 909.524 | 981.905 | n/a | n/a | 3.289 |
| /api/tonight | 146 | 0.349 | 27.037 | 70.556 | 127 | n/a | n/a | 100 |
| /api/search-config | 145 | 0.347 | 30.208 | 109.375 | 181.875 | n/a | n/a | 100 |
| /show/:showKey | 137 | 0.328 | 462 | 1703.846 | 3630 | 237.288 | 485.926 | 20.438 |
| /api/og-image-warm | 136 | 0.325 | 25.185 | 47.852 | 49.867 | n/a | n/a | 100 |
| /api/related | 42 | 0.1 | 450 | 1650 | 1930 | n/a | n/a | 35.714 |
| /sign-in | 36 | 0.086 | 69.231 | 320 | 464 | 26.471 | 55 | 94.444 |
| /api/genres/all | 8 | 0.019 | 33.333 | 160 | 192 | n/a | n/a | 100 |
| /api/poster-impressions | 5 | 0.012 | 31.25 | 450 | 490 | n/a | n/a | 80 |
| /discover/:type? | 1 | 0.002 | 1000 | 1900 | 1980 | 100 | 190 | 0 |
| /:type | 1 | 0.002 | 100 | 190 | 198 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 1633 | 374 | 1259 | 77.097 | 76.05 | 187.113 |
| person-fingerprint-baseline | 1259 | 1259 | 0 | 0 | n/a | n/a |
| user-settings | 1266 | 1259 | 6 | 0.553 | 25 | 47.5 |
| related-show | 1287 | 281 | 1006 | 78.166 | 36.715 | 196.25 |
| details-movie | 1128 | 42 | 1086 | 96.277 | 101.105 | 191.105 |
| related-movie | 1287 | 281 | 1006 | 78.166 | 36.608 | 292.206 |
| availability-evidence-v1 | 1262 | 54 | 1208 | 95.721 | 25.68 | 48.791 |
| details-show | 139 | 12 | 127 | 91.367 | 130 | 197.235 |
| episode-grid | 138 | 26 | 112 | 81.159 | 26.667 | 64 |
| genres-movie | 8 | 8 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 2014 | 4.816 | 3.528 |
| grpc /qdrant.Points/UpdateBatch 0 | 18 | 0.043 | 25.805 |
| grpc /qdrant.Points/Recommend 0 | 576 | 1.377 | 47.831 |
