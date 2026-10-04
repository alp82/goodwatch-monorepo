# 20261004T032925Z-load-baseline-latency-cold

Label: baseline-latency-cold. Time: 2026-10-04T03:29:50.407Z. Target: https://goodwatch.app. Path: private. Cache: cold. URL set: surfaces. Git: 88af219ad16c3a75c7caf51916849256c1da8a5c.

Rate plan: 2 req/s for 150 s.

299 requests; 1.993 req/s; 0% errors; p95 783.268 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 41 | 0.273 | 0 | 225.67 | 686.57 | 793.044 | 110.45 | 267.043 | 357.035 | 41/0/0/0/0 |
| home | 37 | 0.247 | 0 | 82.535 | 264.898 | 331.05 | 24.845 | 92.618 | 108.909 | 37/0/0/0/0 |
| og_share_list | 27 | 0.18 | 0 | 39.337 | 122.365 | 191.125 | 35.982 | 118.604 | 187.598 | 27/0/0/0/0 |
| og_title | 43 | 0.287 | 0 | 21.2 | 74.187 | 88.375 | 12.099 | 59.039 | 65.222 | 43/0/0/0/0 |
| person | 41 | 0.273 | 0 | 156.943 | 457.957 | 974.408 | 49.496 | 113.165 | 162.558 | 41/0/0/0/0 |
| share_list | 40 | 0.267 | 0 | 183.081 | 591.938 | 656.499 | 106.479 | 218.074 | 252.745 | 40/0/0/0/0 |
| title_movie | 35 | 0.233 | 0 | 312.965 | 806.088 | 1044.023 | 111.663 | 253.059 | 342.827 | 35/0/0/0/0 |
| title_show | 35 | 0.233 | 0 | 561.127 | 1215.611 | 1480.014 | 128.373 | 278.33 | 350.191 | 35/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 299 | 1.993 | 0 | 160.23 | 783.268 | 1191.743 | 83.678 | 236.579 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 29 | 36.404 | 45.152 | 2.876 | 3.43 | 34.254 | 7.291 | 10.451 | 16.754 | 33 |
| pgnode01 | data | 16 | 30 | 5.013 | 7.928 | 0.592 | 0.78 | 70.659 | 2.295 | 6.076 | 65.785 | 14 |
| pgnode02 | data | 16 | 30 | 4.648 | 8.079 | 0.956 | 1.52 | 72.395 | 3.604 | 4.073 | 69.186 | 17 |
| pgnode03 | data | 16 | 30 | 6.087 | 9.184 | 0.794 | 1.98 | 65.439 | 0.159 | 0.121 | 0.399 | 7 |
| gw-cache1 | data | 8 | 30 | 9.304 | 26.096 | 0.61 | 1.12 | 37.455 | 18.413 | 2.153 | 5.007 | 10 |
| gw-cache2 | data | 8 | 30 | 4.317 | 18.748 | 0.208 | 0.4 | 35.61 | 0.835 | 1.405 | 2.846 | 12 |
| gw-cache3 | data | 8 | 30 | 2.437 | 6.595 | 0.321 | 0.45 | 35.423 | 0.857 | 0.987 | 2.365 | 9 |
| gw-vector1 | data | 16 | 30 | 8.258 | 13.096 | 1.286 | 1.9 | 39.838 | 0.15 | 0.167 | 0.223 | 6 |
| gw-worker3 | generator | 4 | 30 | 8.482 | 16.809 | 0.453 | 0.64 | 15.967 | 0.139 | 0.101 | 0.148 | 26 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 113.491 | 202.58 | 2660.74 | 2668.544 |
| abusive | coolify-proxy | 114.424 | 190.7 | 249.183 | 254.6 |

## Webapp process

From the webapp's own counters over 153.019 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 53.849 req/s in total: 1.954 from the benchmark and 51.895 of background traffic, of which 38.185 are the crawler loop. Server errors: 0 per second. Requests in flight: 5.452 on average, 14 at most. Event loop delay: 133.616 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 77.13 | 90.305 |
| webapp libuv-worker | 17.777 | 22.398 |
| webapp V8Worker | 15.997 | 51.377 |
| proxy | 114.101 | 155.413 |

The proxy accepted 45.279 connections per second on average, 62.838 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 2868 | 18.743 | 28.273 | 90.472 | 176.435 | 26.025 | 49.448 | 99.895 |
| /person/:personKey | 596 | 3.895 | 171.756 | 498.072 | 943.077 | 80.637 | 225.625 | 81.208 |
| /movie/:movieKey | 442 | 2.889 | 282.114 | 905.072 | 1508.889 | 169.259 | 419.535 | 54.977 |
| /sign-up | 229 | 1.497 | 64.041 | 273.462 | 463.143 | 26.628 | 60.625 | 96.507 |
| static | 190 | 1.242 | 26.836 | 65.909 | 105 | n/a | n/a | 100 |
| / | 130 | 0.85 | 35.326 | 186.364 | 440 | 26.515 | 56.25 | 98.462 |
| /show/:showKey | 91 | 0.595 | 459.524 | 991.667 | 1772.5 | 193.421 | 398.571 | 13.187 |
| /api/e | 69 | 0.451 | 422.917 | 918.333 | 2930 | n/a | n/a | 7.246 |
| /api/search-config | 62 | 0.405 | 31 | 87.083 | 97.417 | n/a | n/a | 100 |
| /api/tonight | 62 | 0.405 | 29.808 | 84.5 | 96.9 | n/a | n/a | 100 |
| /api/og-image-warm | 60 | 0.392 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /og/:first/:second | 44 | 0.288 | 26.19 | 49.762 | 412 | n/a | n/a | 97.727 |
| /discover/:type? | 41 | 0.268 | 237.5 | 853.571 | 970.714 | 89.13 | 199.688 | 68.293 |
| /u/:handle/lists/:id | 40 | 0.261 | 180 | 500 | 900 | 74.074 | 191.667 | 77.5 |
| /api/related | 28 | 0.183 | 300 | 1650 | 1930 | n/a | n/a | 50 |
| /og/lists/:id/:file | 27 | 0.176 | 29.348 | 132.5 | 186.5 | n/a | n/a | 100 |
| /sign-in | 13 | 0.085 | 116.667 | 675 | 935 | 25 | 47.5 | 84.615 |
| /api/poster-impressions | 4 | 0.026 | 150 | 900 | 980 | n/a | n/a | 75 |
| /api/genres/all | 3 | 0.02 | 37.5 | 185 | 197 | n/a | n/a | 100 |
| /:type/:category/:page | 1 | 0.007 | 500 | 950 | 990 | 150 | 285 | 0 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 528 | 135 | 393 | 74.432 | 76.633 | 186.907 |
| person-fingerprint-baseline | 393 | 393 | 0 | 0 | n/a | n/a |
| user-settings | 538 | 536 | 2 | 0.372 | 25 | 47.5 |
| related-show | 551 | 184 | 367 | 66.606 | 38.229 | 218.333 |
| details-movie | 446 | 37 | 409 | 91.704 | 102.709 | 193.374 |
| related-movie | 551 | 184 | 367 | 66.606 | 38.071 | 295 |
| availability-evidence-v1 | 534 | 70 | 464 | 86.891 | 25.778 | 48.978 |
| details-show | 92 | 33 | 59 | 64.13 | 125 | 194.868 |
| episode-grid | 91 | 39 | 52 | 57.143 | 25.49 | 48.431 |
| genres-movie | 3 | 3 | 0 | 0 | n/a | n/a |
| media_fingerprint_v1:discover | 1 | 0 | 1 | 100 | 100 | 190 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 734 | 4.797 | 5.846 |
| grpc /qdrant.Points/UpdateBatch 0 | 15 | 0.098 | 1254.623 |
| grpc /qdrant.Points/Recommend 0 | 206 | 1.346 | 60.604 |
