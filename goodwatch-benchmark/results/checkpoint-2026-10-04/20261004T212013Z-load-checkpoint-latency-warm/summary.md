# 20261004T212013Z-load-checkpoint-latency-warm

Label: checkpoint-latency-warm. Time: 2026-10-04T21:20:38.501Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: surfaces. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 2 req/s for 150 s.

299 requests; 1.991 req/s; 0% errors; p95 26.536 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 34 | 0.226 | 0 | 4.627 | 12.59 | 17.838 | 3.585 | 11.505 | 16.937 | 34/0/0/0/0 |
| home | 44 | 0.293 | 0 | 4.268 | 12.924 | 17.684 | 3.302 | 12.501 | 17.098 | 44/0/0/0/0 |
| og_share_list | 33 | 0.22 | 0 | 12.093 | 34.405 | 51.124 | 8.917 | 31.487 | 48.672 | 33/0/0/0/0 |
| og_title | 34 | 0.226 | 0 | 12.216 | 31.465 | 66.7 | 9.164 | 28.352 | 64.071 | 34/0/0/0/0 |
| person | 38 | 0.253 | 0 | 5.022 | 34.972 | 44.922 | 3.559 | 34.233 | 44.037 | 38/0/0/0/0 |
| share_list | 43 | 0.286 | 0 | 5.422 | 38.357 | 52.708 | 4.388 | 37.459 | 49.801 | 43/0/0/0/0 |
| title_movie | 37 | 0.246 | 0 | 5.44 | 19.416 | 21.456 | 3.912 | 13.323 | 19.811 | 37/0/0/0/0 |
| title_show | 36 | 0.24 | 0 | 5.68 | 11.82 | 16.906 | 4.108 | 10.326 | 15.411 | 36/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 299 | 1.993 | 0 | 5.694 | 26.536 | 48.212 | 4.49 | 24.5 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 30 | 14.59 | 20.025 | 1.202 | 1.64 | 34.082 | 3.82 | 4.818 | 6.033 | 8 |
| pgnode01 | data | 16 | 30 | 7.531 | 11.309 | 0.891 | 1.4 | 70.453 | 3.007 | 6.457 | 67.079 | 11 |
| pgnode02 | data | 16 | 30 | 6.467 | 11.342 | 2.054 | 3.06 | 71.59 | 4.083 | 4.787 | 71.924 | 14 |
| pgnode03 | data | 16 | 30 | 8.695 | 14.199 | 2.152 | 3.83 | 65.481 | 0.085 | 0.104 | 0.157 | 3 |
| gw-cache1 | data | 8 | 30 | 2.416 | 7.985 | 0.256 | 0.43 | 34.103 | 0.704 | 0.46 | 1.06 | 7 |
| gw-cache2 | data | 8 | 30 | 4.184 | 18.413 | 0.285 | 0.54 | 33.588 | 0.571 | 0.45 | 0.916 | 7 |
| gw-cache3 | data | 8 | 30 | 2.354 | 6.317 | 0.235 | 0.33 | 33.837 | 0.641 | 0.335 | 0.791 | 8 |
| gw-vector1 | target | 16 | 30 | 10.566 | 18.878 | 1.949 | 2.87 | 49.025 | 0.124 | 0.22 | 0.386 | 9 |
| gw-worker3 | generator | 4 | 30 | 20.25 | 50 | 0.798 | 1.58 | 22.241 | 12.105 | 0.929 | 3.884 | 23 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 28.671 | 117.9 | 2200.815 | 2202.624 |
| abusive | coolify-proxy | 34.231 | 45.88 | 103.211 | 113.3 |
| gw-vector1 | gk4owk8-181159928589 | 39.919 | 178.6 | 2283.895 | 2300.928 |
| gw-vector1 | coolify-proxy | 3.503 | 7.75 | 41.232 | 42.98 |
| gw-vector1 | qdrant-main | 35.133 | 130.4 | 4059.273 | 4072.448 |

## Webapp process

From the webapp's own counters over 154.375 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 7.676 req/s in total: 1.989 from the benchmark and 5.687 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 0.433 on average, 2 at most. Event loop delay: 42.849 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 16.489 | 27.168 |
| webapp V8Worker | 3.749 | 19.434 |
| webapp libuv-worker | 2.367 | 4.147 |
| proxy | 33.316 | 40.024 |

The proxy accepted 12.845 connections per second on average, 15.028 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /person/:personKey | 311 | 2.015 | 71.392 | 193.833 | 268.9 | 33.638 | 164.598 | 100 |
| /movie/:movieKey | 261 | 1.691 | 136.236 | 224.687 | 289.937 | 132.796 | 196.667 | 99.617 |
| /show/:showKey | 44 | 0.285 | 75 | 198.889 | 278 | 50 | 188.421 | 100 |
| / | 32 | 0.207 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 24 | 0.155 | 26.087 | 49.565 | 452 | 26.087 | 49.565 | 95.833 |
| /u/:handle/lists/:id | 22 | 0.143 | 26.19 | 49.762 | 89 | 26.19 | 49.762 | 100 |
| static | 14 | 0.091 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /og/:first/:second | 13 | 0.084 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /og/lists/:id/:file | 12 | 0.078 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/e | 4 | 0.026 | 150 | 285 | 297 | n/a | n/a | 100 |
| /api/poster-impressions | 1 | 0.006 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /sign-up | 1 | 0.006 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 245 | 39 | 206 | 84.082 | 136.646 | 194.224 |
| related-cards | 114 | 29 | 85 | 74.561 | 71.284 | 97.128 |
| person-profile-v2 | 284 | 85 | 199 | 70.07 | 76.591 | 182.717 |
| person-fingerprint-baseline | 199 | 199 | 0 | 0 | n/a | n/a |
| details-show-v2 | 26 | 7 | 19 | 73.077 | 136.667 | 193.667 |
| episode-grid | 26 | 5 | 21 | 80.769 | 25 | 47.5 |
| movie-collection | 18 | 4 | 14 | 77.778 | 25 | 47.5 |
| share-list-view-v1 | 24 | 20 | 1 | 16.667 | 25 | 47.5 |
| share-list-availability-v1 | 12 | 12 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 2 | 0.013 | 117.856 |
| grpc /qdrant.Points/Recommend 0 | 480 | 3.109 | 24.767 |
| grpc /qdrant.Points/Get 0 | 482 | 3.122 | 1.373 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 17.03 req/s, of which 15.041 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 7.676 | 0 | 16.489 | 27.168 | 2 | 42.849 | 2252.055 |
| 10.0.0.20 | 392439b7 | 9.395 | 0 | 26.193 | 37.644 | 3 | 191.419 | 2276.125 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 19 | 0 | 0 | 245 | 0 |
| 10.0.0.21 | /discover/:type? | 23 | 0 | 0 | 17 | 0 |
| 10.0.0.21 | /person/:personKey | 23 | 0 | 0 | 288 | 0 |
| 10.0.0.21 | /show/:showKey | 18 | 0 | 0 | 26 | 0 |
| 10.0.0.21 | / | 32 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /u/:handle/lists/:id | 10 | 8 | 0 | 4 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /sign-up | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /movie/:movieKey | 18 | 1 | 0 | 433 | 0 |
| 10.0.0.20 | /show/:showKey | 18 | 1 | 0 | 44 | 0 |
| 10.0.0.20 | /person/:personKey | 15 | 1 | 0 | 367 | 0 |
| 10.0.0.20 | / | 18 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 11 | 1 | 0 | 20 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 12 | 7 | 0 | 3 | 0 |
