# 20261004T213017Z-load-checkpoint-latency-cold-longtail

**Smoke run. Not a baseline.**

Label: checkpoint-latency-cold-longtail. Time: 2026-10-04T21:30:41.784Z. Target: https://goodwatch.app. Path: private. Cache: cold. URL set: longtail. Git: 392439b7ed9bdc686ffe17a8e5a6defbb6c62874 (dirty).

Rate plan: 1 req/s for 120 s.

119 requests; 0.991 req/s; 0.84% errors; p95 327.169 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| home | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| og_title | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| other | 15 | 0.125 | 0 | 211.437 | 657.452 | 1104.527 | 209.481 | 654.721 | 1099.472 | 15/0/0/0/0 |
| title_movie | 76 | 0.633 | 1.316 | 198.661 | 277.852 | 309.471 | 196.981 | 276.016 | 307.62 | 75/0/1/0/0 |
| title_show | 28 | 0.233 | 0 | 241.678 | 356.925 | 390.172 | 239.402 | 355.171 | 372.105 | 28/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 119 | 0.992 | 0.84 | 211.437 | 327.169 | 414.083 | 209.481 | 325.392 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 24 | 14.307 | 18.846 | 1.668 | 2.46 | 34.458 | 3.645 | 4.734 | 6.754 | 8 |
| pgnode01 | data | 16 | 24 | 10.14 | 16.348 | 2.01 | 3.05 | 70.451 | 3.798 | 7.05 | 59.131 | 11 |
| pgnode02 | data | 16 | 24 | 10.568 | 15.809 | 1.329 | 2.13 | 71.392 | 5.639 | 6.281 | 74.359 | 12 |
| pgnode03 | data | 16 | 24 | 12.103 | 18.047 | 1.769 | 2.62 | 65.488 | 0.097 | 0.117 | 0.237 | 3 |
| gw-cache1 | data | 8 | 24 | 2.517 | 5.405 | 0.26 | 0.51 | 34 | 0.751 | 0.478 | 1.611 | 7 |
| gw-cache2 | data | 8 | 24 | 2.179 | 6.67 | 0.451 | 0.58 | 33.383 | 0.801 | 0.405 | 0.725 | 7 |
| gw-cache3 | data | 8 | 25 | 3.677 | 13.747 | 0.296 | 0.53 | 33.854 | 0.794 | 0.335 | 0.624 | 8 |
| gw-vector1 | target | 16 | 24 | 11.611 | 17.994 | 2.542 | 4.4 | 49.038 | 0.136 | 0.238 | 0.511 | 7 |
| gw-worker3 | generator | 4 | 24 | 4.667 | 15.642 | 0.263 | 0.43 | 20.615 | 0.081 | 0.084 | 0.144 | 22 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-181009560892 | 24.267 | 41.38 | 2259.755 | 2263.04 |
| abusive | coolify-proxy | 34.02 | 48.61 | 97.085 | 99.42 |
| gw-vector1 | gk4owk8-181159928589 | 37.046 | 61.79 | 2261.504 | 2327.552 |
| gw-vector1 | coolify-proxy | 4.299 | 7.24 | 40.256 | 40.84 |
| gw-vector1 | qdrant-main | 49.142 | 101.49 | 4068.011 | 4080.64 |

## Webapp process

From the webapp's own counters over 124.297 s, commit 392439b7. The times exclude the proxy, TLS, and the network.

Finished 7.691 req/s in total: 0.957 from the benchmark and 6.734 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 0.625 on average, 2 at most. Event loop delay: 153.933 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 21.921 | 34.082 |
| webapp V8Worker | 4.544 | 20.378 |
| webapp libuv-worker | 3.528 | 5.945 |
| proxy | 32.699 | 41.859 |

The proxy accepted 13.066 connections per second on average, 16.863 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /movie/:movieKey | 303 | 2.438 | 146.591 | 257.121 | 293.848 | 140.89 | 199.047 | 99.67 |
| /person/:personKey | 229 | 1.842 | 85.855 | 193.736 | 292.75 | 35.34 | 169.863 | 99.127 |
| /show/:showKey | 53 | 0.426 | 157.813 | 294.091 | 447 | 147.143 | 276.429 | 96.226 |
| static | 34 | 0.274 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /:type/:category/:page | 4 | 0.032 | 150 | 280 | 296 | 150 | 280 | 100 |
| /api/e | 3 | 0.024 | 150 | 285 | 297 | n/a | n/a | 100 |
| / | 1 | 0.008 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /:type | 1 | 0.008 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-movie-v2 | 305 | 40 | 265 | 86.885 | 135.427 | 195.352 |
| related-cards | 188 | 56 | 132 | 70.213 | 69.725 | 96.972 |
| genres-movie | 1 | 1 | 0 | 0 | n/a | n/a |
| person-profile-v2 | 223 | 56 | 167 | 74.888 | 74.695 | 184.125 |
| person-fingerprint-baseline | 167 | 167 | 0 | 0 | n/a | n/a |
| details-show-v2 | 53 | 11 | 42 | 79.245 | 147.222 | 199.722 |
| episode-grid | 53 | 8 | 41 | 84.906 | 25.568 | 48.58 |
| movie-collection | 46 | 23 | 23 | 50 | 25 | 47.5 |
| media_fingerprint_v1:discover | 4 | 0 | 4 | 100 | 100 | 190 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 572 | 4.602 | 25.27 |
| grpc /qdrant.Points/UpdateBatch 0 | 2 | 0.016 | 34.49 |
| grpc /qdrant.Points/Get 0 | 574 | 4.618 | 1.484 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 16.525 req/s, of which 15.568 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 392439b7 | 7.691 | 0 | 21.921 | 34.082 | 2 | 153.933 | 2262.293 |
| 10.0.0.20 | 392439b7 | 8.822 | 0 | 28.159 | 38.365 | 3 | 67.753 | 2277.754 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /movie/:movieKey | 0 | 0 | 0 | 305 | 0 |
| 10.0.0.21 | /discover/:type? | 0 | 0 | 0 | 15 | 0 |
| 10.0.0.21 | /person/:personKey | 0 | 0 | 0 | 229 | 0 |
| 10.0.0.21 | /show/:showKey | 0 | 0 | 0 | 53 | 0 |
| 10.0.0.21 | / | 1 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.21 | /:type/:category/:page | 0 | 0 | 0 | 4 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 0 | 0 | 416 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 62 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 221 | 0 |
| 10.0.0.20 | / | 3 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 14 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /:type/:category/:page | 0 | 0 | 0 | 10 | 0 |
