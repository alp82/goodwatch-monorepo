# 20261009T111112Z-load-sh-movie-page-1-a

Label: sh-movie-page-1-a. Time: 2026-10-09T11:11:44.199Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34.

Rate plan: 10 visitors/s for 30 s, then 20 visitors/s for 35 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 75 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<113

15195 requests; 358.699 req/s; 0% errors; p95 1368.808 ms; 144 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 15195 | 358.699 | 0 | 57.699 | 1368.808 | 2497.268 | 40.779 | 787.551 | 1484.31 | 14987/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 11063 | 368.767 | 0 | 48.645 | 112.458 | 157.053 | 35.234 | 75.401 |
| s02 | 20 | 4132 | 334.267 | 0 | 379.341 | 2336.618 | 2857.005 | 236.002 | 1376.259 |
| s03 | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s04 | 40 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s05 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s06 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s07 | 75 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

400 visitors; 400 complete page views; 0% failed page views; page view p95 3745.7 ms; 1610 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9.967 | 9.967 | 0 | 16.296 | 52.956 | 140 | 275.7 | 368.767 | 0 | 38.633 | 15.271 | 30.713 |
| s02 | 20 | 8.171 | 8.171 | 0 | 74.864 | 640.841 | 1437 | 4728 | 334.267 | 0 | 36.485 | 121.33 | 908.066 |
| s03 | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s04 | 40 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s05 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s06 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s07 | 75 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### By host

Files: page. Pages name the static hostname. Static hostname: static.goodwatch.app.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 892 | 21.057 | 0 | 19.175 | 689.077 | 13.249 | 481.064 | 450 | 2 | 51 | 1 |
| Static hostname | 14303 | 337.642 | 0 | 59.717 | 1502.575 | 41.724 | 850.713 | 1160 | 35 | 516 | 3 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 14 | 342 | n/a |

Site share of site and static traffic: 5.405% of requests and 9.026% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 26.438 | 38.747 | 42.863 | 34.133 | 38.672 | 7.727 | 0.512 | 65.066 | 20.885 | 25.627 | 16.968 | 9.9 | 12.209 | 16.845 | 0.197 | 0.496 | 86.697 | 92.602 | 7.296 | 62.831 |
| s02 | 20 | 31.872 | 47.709 | 56.815 | 37.049 | 34.331 | 8.681 | 0.395 | 45.7 | 25.693 | 25.693 | 22.455 | 13.171 | 12.503 | 12.503 | 0.227 | 0.908 | 99.951 | 99.951 | 9.119 | 69.485 |
| s03 | 30 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s04 | 40 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s05 | 50 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s06 | 60 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s07 | 75 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 8 | 21.739 | 25.693 | 1.121 | 1.45 | 38.858 | 11.018 | 18.048 | 22.455 | 9 |
| gw-vector1 | target | 16 | 9 | 12.02 | 16.845 | 1.848 | 2.15 | 50.701 | 0.501 | 0.192 | 0.236 | 6 |
| gw-worker3 | generator | 4 | 9 | 81.347 | 99.951 | 1.218 | 1.78 | 18.461 | 58.497 | 6.944 | 9.388 | 859 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-20261009T105601 | 92.277 | 156.64 | 2907.904 | 2919.424 |
| abusive | coolify-proxy | 36.398 | 50.4 | 221.95 | 227 |
| gw-vector1 | gk4owk8-20261009T105807 | 105.658 | 151.25 | 2904.292 | 2926.592 |
| gw-vector1 | coolify-proxy | 8.236 | 11.1 | 131.911 | 133 |

## Webapp process

From the webapp's own counters over 47.454 s, commit 42c2db2e. The times exclude the proxy, TLS, and the network.

Finished 53.442 req/s in total: 322.083 from the benchmark and -268.641 of background traffic, of which 1.58 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.222 on average, 2 at most. Event loop delay: 37.049 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 29.345 | 35.439 |
| webapp libuv-worker | 4.083 | 5.751 |
| webapp V8Worker | 1.757 | 2.376 |
| proxy | 41.522 | 49.377 |

The proxy accepted 47.065 connections per second on average, 57.904 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 1404 | 29.587 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 629 | 13.255 | 30.182 | 174.157 | 237.1 | 29.839 | 169.337 | 100 |
| /person/:personKey | 218 | 4.594 | 53.571 | 164.839 | 192.968 | 38.827 | 139.565 | 100 |
| /og/:first/:second | 73 | 1.538 | 190 | 739.286 | 947.857 | n/a | n/a | 75.342 |
| /discover/:type? | 16 | 0.337 | 28.571 | 80 | 96 | 26.667 | 60 | 100 |
| /show/:showKey | 12 | 0.253 | 140 | 194 | 198.8 | 140.909 | 194.091 | 100 |
| /sign-up | 11 | 0.232 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/e | 1 | 0.021 | 150 | 285 | 297 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 245 | 133 | 109 | 45.714 | 61.25 | 143.5 |
| person-fingerprint-baseline | 112 | 112 | 0 | 0 | n/a | n/a |
| details-movie-v2 | 155 | 37 | 103 | 76.129 | 130.952 | 194.167 |
| details-missing-v1 | 130 | 0 | 130 | 100 | n/a | n/a |
| details-show-v2 | 13 | 1 | 10 | 92.308 | 140 | 194 |
| episode-grid | 13 | 0 | 13 | 100 | 25 | 47.5 |
| related-cards | 28 | 8 | 19 | 71.429 | 72.222 | 97.222 |
| movie-collection | 8 | 7 | 1 | 12.5 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Scroll 0 | 14 | 0.295 | 1.845 |
| grpc /qdrant.Points/Recommend 0 | 77 | 1.623 | 27.406 |
| grpc /qdrant.Points/Get 0 | 77 | 1.623 | 2.541 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 88.992 req/s, of which -233.091 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 42c2db2e | 53.442 | 0 | 29.345 | 35.439 | 2 | 37.049 | 2397.848 |
| 10.0.0.20 | 42c2db2e | 34.849 | 0 | 37.572 | 53.192 | 7 | 65.066 | 2415.684 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /person/:personKey | 3 | 0 | 0 | 214 | 0 |
| resolve address | /movie/:movieKey | 499 | 0 | 0 | 131 | 0 |
| resolve address | /show/:showKey | 0 | 0 | 0 | 13 | 0 |
| resolve address | /sign-up | 11 | 0 | 0 | 0 | 0 |
| resolve address | /discover/:type? | 0 | 0 | 0 | 33 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /person/:personKey | 4 | 0 | 0 | 331 | 0 |
| 10.0.0.20 | /movie/:movieKey | 451 | 0 | 0 | 124 | 0 |
| 10.0.0.20 | /discover/:type? | 1 | 0 | 0 | 32 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 13 | 0 |
| 10.0.0.20 | /sign-up | 6 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | / | 1 | 0 | 0 | 0 | 0 |
