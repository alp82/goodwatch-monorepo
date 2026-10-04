# 20261004T033808Z-load-baseline-latency-cold-longtail

**Smoke run. Not a baseline.**

Label: baseline-latency-cold-longtail. Time: 2026-10-04T03:38:34.184Z. Target: https://goodwatch.app. Path: private. Cache: cold. URL set: longtail. Git: 88af219ad16c3a75c7caf51916849256c1da8a5c.

Rate plan: 1 req/s for 120 s.

**Aborted:** http_req_duration{phase:main,step:s01}: p(95)<3000

6 requests; 0.519 req/s; 0% errors; p95 7558.637 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| home | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| og_title | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| other | 1 | 0.086 | 0 | 616.373 | 616.373 | 616.373 | 156.126 | 156.126 | 156.126 | 1/0/0/0/0 |
| title_movie | 5 | 0.432 | 0 | 3656.23 | 7633.776 | 7874.219 | 1350.467 | 1463.173 | 1475.25 | 5/0/0/0/0 |
| title_show | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 6 | 0.519 | 0 | 3369.044 | 7558.637 | 7859.191 | 1070.41 | 1459.399 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 2 | 48.38 | 50.928 | 5.59 | 5.78 | 34.331 | 11.498 | 14.592 | 14.745 | 30 |
| pgnode01 | data | 16 | 3 | 8.131 | 8.672 | 0.667 | 0.69 | 70.676 | 3.368 | 4.26 | 4.568 | 14 |
| pgnode02 | data | 16 | 3 | 5.632 | 9.121 | 0.99 | 1.21 | 73.623 | 2.175 | 2.811 | 3.447 | 19 |
| pgnode03 | data | 16 | 2 | 4.253 | 5.649 | 0.765 | 0.8 | 65.389 | 0.074 | 0.096 | 0.097 | 5 |
| gw-cache1 | data | 8 | 2 | 2.042 | 3.412 | 0.24 | 0.25 | 35.785 | 2.532 | 0.75 | 1.066 | 8 |
| gw-cache2 | data | 8 | 3 | 1.672 | 3.179 | 0.66 | 0.69 | 35.664 | 1.127 | 0.916 | 1.356 | 11 |
| gw-cache3 | data | 8 | 3 | 10.666 | 14.328 | 0.39 | 0.44 | 35.668 | 1.088 | 1.042 | 1.884 | 8 |
| gw-vector1 | data | 16 | 3 | 57.78 | 72.4 | 6.617 | 7.7 | 43.536 | 0.124 | 0.147 | 0.152 | 4 |
| gw-worker3 | generator | 4 | 3 | 9.306 | 14.985 | 0.453 | 0.48 | 16.567 | 0.072 | 0.09 | 0.126 | 10 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-012330965771 | 182.19 | 182.19 | 2661.376 | 2661.376 |
| abusive | coolify-proxy | 123.77 | 123.77 | 255.3 | 255.3 |

## Webapp process

From the webapp's own counters over 15.189 s, commit 86e011c8. The times exclude the proxy, TLS, and the network.

Finished 79.597 req/s in total: 0.395 from the benchmark and 79.202 of background traffic, of which 47.337 are the crawler loop. Server errors: 0 per second. Requests in flight: 35.667 on average, 55 at most. Event loop delay: 128.898 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 89.941 | 99.268 |
| webapp V8Worker | 61.586 | 97.695 |
| webapp libuv-worker | 17.455 | 19.773 |
| proxy | 149.632 | 150.965 |

The proxy accepted 65.713 connections per second on average, 66.164 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /browser-check | 372 | 24.492 | 69.178 | 296.735 | 456.235 | 37.652 | 168.261 | 95.43 |
| /person/:personKey | 87 | 5.728 | 1184.211 | 4533.929 | 4906.786 | 98.611 | 432.857 | 27.586 |
| static | 56 | 3.687 | 77.778 | 388 | 477.6 | n/a | n/a | 91.071 |
| / | 55 | 3.621 | 77.5 | 270.833 | 390 | 33.333 | 90 | 98.182 |
| /api/e | 52 | 3.424 | 580 | 1480 | 1896 | n/a | n/a | 0 |
| /api/tonight | 51 | 3.358 | 57.813 | 194.5 | 274.5 | n/a | n/a | 100 |
| /api/search-config | 50 | 3.292 | 85 | 275 | 400 | n/a | n/a | 98 |
| /api/og-image-warm | 41 | 2.699 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 30 | 1.975 | 2000 | 7500 | 9500 | 409.091 | 1700 | 13.333 |
| /sign-up | 23 | 1.514 | 383.333 | 1970 | 4310 | 44.231 | 142.5 | 39.13 |
| /api/related | 16 | 1.053 | 2000 | 4700 | 4940 | n/a | n/a | 0 |
| /show/:showKey | 4 | 0.263 | 2000 | 9500 | 9900 | 300 | 1800 | 25 |
| /sign-in | 1 | 0.066 | 1000 | 1900 | 1980 | 100 | 190 | 0 |
| /api/genres/all | 1 | 0.066 | 100 | 190 | 198 | n/a | n/a | 100 |
| /api/poster-impressions | 1 | 0.066 | 150 | 285 | 297 | n/a | n/a | 100 |
| /api/movie/collection | 1 | 0.066 | 100 | 190 | 198 | n/a | n/a | 100 |
| /:type/:category/:page | 1 | 0.066 | 500 | 950 | 990 | 100 | 190 | 0 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 38 | 14 | 24 | 63.158 | 125 | 420 |
| person-fingerprint-baseline | 24 | 24 | 0 | 0 | n/a | n/a |
| user-settings | 41 | 41 | 0 | 0 | n/a | n/a |
| related-show | 48 | 8 | 40 | 83.333 | 350 | 1707.143 |
| details-movie | 33 | 2 | 31 | 93.939 | 143.182 | 248.333 |
| related-movie | 48 | 8 | 40 | 83.333 | 450 | 3462.5 |
| availability-evidence-v1 | 39 | 3 | 36 | 92.308 | 30 | 160 |
| details-show | 7 | 1 | 6 | 85.714 | 200 | 470 |
| episode-grid | 7 | 1 | 6 | 85.714 | 37.5 | 92.5 |
| genres-movie | 2 | 2 | 0 | 0 | n/a | n/a |
| movie-collection | 1 | 0 | 1 | 100 | 25 | 47.5 |
| media_fingerprint_v1:discover | 1 | 0 | 1 | 100 | 50 | 95 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 78 | 5.135 | 19.022 |
| grpc /qdrant.Points/Recommend 0 | 44 | 2.897 | 165.599 |
