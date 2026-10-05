# 20261005T034339Z-load-pv-home-public-new

Label: pv-home-public-new. Time: 2026-10-05T03:44:01.152Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 1 visitors/s for 20 s, then 2 visitors/s for 25 s, then 3 visitors/s for 25 s, then 4 visitors/s for 25 s, then 5 visitors/s for 25 s, then 6 visitors/s for 25 s, then 8 visitors/s for 25 s.

**Aborted:** dropped_iterations: count<8

16963 requests; 126.607 req/s; 0% errors; p95 704.712 ms; 8 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home | 16963 | 126.607 | 0 | 40.908 | 704.712 | 2365.68 | 39.372 | 692.515 | 2319.147 | 16485/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 779 | 38.95 | 0 | 13.024 | 367.005 | 403.398 | 11.055 | 365.72 |
| s02 | 2 | 1968 | 78.72 | 0 | 12.816 | 391.801 | 443.707 | 11.031 | 388.747 |
| s03 | 3 | 2952 | 118.08 | 0 | 21.92 | 493.076 | 1525.076 | 20.13 | 490.696 |
| s04 | 4 | 4018 | 160.72 | 0 | 45.608 | 654.376 | 4402.679 | 44.564 | 652.302 |
| s05 | 5 | 4964 | 198.56 | 0 | 52.527 | 793.111 | 7724.614 | 50.646 | 789.038 |
| s06 | 6 | 2282 | 163.22 | 0 | 255.391 | 951.541 | 1460.508 | 254.917 | 949.425 |
| s07 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

401 visitors; 401 complete page views; 0% failed page views; page view p95 2777 ms; 846 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 0.95 | 0.95 | 0 | 3.861 | 15.071 | 430 | 535.1 | 38.95 | 0 | 1.9 | 22.338 | 31.129 |
| s02 | 2 | 1.92 | 1.92 | 0 | 4.589 | 16.179 | 396 | 550.65 | 78.72 | 0 | 3.84 | 26.299 | 36.657 |
| s03 | 3 | 2.88 | 2.88 | 0 | 10.319 | 312.562 | 476 | 1742.4 | 118.08 | 0 | 5.76 | 24.064 | 35.663 |
| s04 | 4 | 3.92 | 3.92 | 0 | 38.791 | 330.021 | 736.5 | 2752.3 | 160.72 | 0 | 7.84 | 26.501 | 37.676 |
| s05 | 5 | 4.76 | 4.76 | 0 | 108.847 | 831.987 | 960 | 6460.5 | 198.56 | 0 | 9.72 | 26.265 | 39.947 |
| s06 | 6 | 3.219 | 3.219 | 0 | 195.145 | 769.151 | 1186 | 2901.4 | 163.22 | 0 | 9.227 | 25.662 | 37.154 |
| s07 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 44.297 | 149.436 | 73.235 | 349.885 | 44.866 | 8.016 | 0.388 | 348.312 | 34.703 | 36.295 | 14.707 | 9.232 | 64.212 | 66.32 | 0.198 | 0.114 | 3.953 | 6.526 | 0.267 | 6.027 |
| s02 | 2 | 69.596 | 160.855 | 71.967 | 397.333 | 44.775 | 8.929 | 0.197 | 299.029 | 42.693 | 44.922 | 20.828 | 11.161 | 54.171 | 58.475 | 0.223 | 0.13 | 9.907 | 11.262 | 0.477 | 12.622 |
| s03 | 3 | 60.154 | 180.921 | 78.502 | 483.579 | 89.943 | 14.897 | 4.717 | 359.847 | 40.585 | 43.259 | 27.866 | 17.501 | 44.982 | 53.444 | 0.195 | 0.12 | 5.65 | 6.01 | 0.638 | 18.232 |
| s04 | 4 | 97.705 | 179.115 | 77.475 | 563.533 | 72.249 | 12.115 | 0.252 | 339.662 | 49.503 | 53.562 | 33.607 | 19.958 | 31.461 | 37.472 | 0.226 | 0.105 | 9.279 | 16.953 | 0.841 | 24.1 |
| s05 | 5 | 95.449 | 186.256 | 77.473 | 1078.908 | 72.693 | 13.411 | 3.161 | 720.295 | 50.834 | 52.886 | 35.201 | 21.443 | 27.435 | 31.854 | 0.27 | 0.12 | 14.707 | 18.671 | 1.024 | 29.414 |
| s06 | 6 | n/a | n/a | n/a | n/a | 70.24 | 14.152 | 0.173 | 451.073 | 51.296 | 52.717 | 36.722 | 22.113 | 29.779 | 31.448 | 0.299 | 0.156 | 10.421 | 12.709 | 1.05 | 28.84 |
| s07 | 8 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 27 | 44.113 | 53.562 | 3.067 | 5.14 | 40.674 | 16.406 | 26.899 | 40.393 | 10 |
| gw-vector1 | target | 16 | 27 | 42.829 | 66.32 | 9.077 | 11.58 | 52.624 | 0.123 | 0.227 | 0.402 | 9 |
| gw-cache1 | data | 8 | 27 | 3.904 | 17.891 | 0.24 | 0.67 | 31.995 | 0.607 | 4.413 | 7.503 | 8 |
| gw-cache2 | data | 8 | 26 | 2.623 | 6.419 | 0.179 | 0.33 | 31.577 | 0.602 | 0.541 | 0.952 | 7 |
| gw-cache3 | data | 8 | 27 | 5.258 | 17.657 | 0.341 | 0.55 | 31.696 | 0.566 | 0.493 | 0.869 | 9 |
| gw-worker3 | generator | 4 | 27 | 8.286 | 18.671 | 0.396 | 0.76 | 19.159 | 18.727 | 0.673 | 1.098 | 30 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 109.445 | 225.78 | 3100.293 | 3144.704 |
| abusive | coolify-proxy | 166.029 | 197.97 | 266.478 | 300.6 |
| gw-vector1 | gk4owk8-011237769659 | 87.953 | 236.58 | 2340.636 | 2377.728 |
| gw-vector1 | coolify-proxy | 14.235 | 40.81 | 83.665 | 94.56 |
| gw-vector1 | qdrant-main | 546.163 | 1053.4 | 5795.726 | 6599.68 |

## Webapp process

From the webapp's own counters over 137.595 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 98.616 req/s in total: 124.162 from the benchmark and -25.546 of background traffic, of which 0.007 are the crawler loop. Server errors: 0 per second. Requests in flight: 7.32 on average, 20 at most. Event loop delay: 1543.427 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 73.199 | 101.731 |
| webapp V8Worker | 46.278 | 78.338 |
| webapp libuv-worker | 3.469 | 5.642 |
| proxy | 170.707 | 194.974 |

The proxy accepted 75.28 connections per second on average, 83.778 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 8299 | 60.315 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /person/:personKey | 411 | 2.987 | 134.375 | 3345 | 4989 | 27.107 | 103.088 | 67.153 |
| /movie/:movieKey | 381 | 2.769 | 302.083 | 3880.233 | 4943.488 | 218.182 | 2381.818 | 49.869 |
| / | 258 | 1.875 | 26.008 | 49.415 | 903.333 | 26.008 | 49.415 | 97.674 |
| /api/living-room/picks | 206 | 1.497 | 680.328 | 1925.862 | 3970 | n/a | n/a | 3.883 |
| /show/:showKey | 49 | 0.356 | 444.444 | 3775 | 4755 | 294.444 | 1910 | 36.735 |
| /api/e | 4 | 0.029 | 233.333 | 293.333 | 298.667 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 50 | 16 | 32 | 68 | 173.81 | 1175 |
| episode-grid | 50 | 12 | 37 | 76 | 43.182 | 525 |
| related-cards | 150 | 55 | 92 | 63.333 | 210 | 3812.5 |
| details-movie-v2 | 387 | 64 | 304 | 83.463 | 178.247 | 880.921 |
| person-profile-v2 | 415 | 112 | 301 | 73.012 | 88.942 | 1689.655 |
| person-fingerprint-baseline | 302 | 300 | 0 | 0.662 | 1000 | 4700 |
| movie-collection | 24 | 10 | 14 | 58.333 | 31.818 | 650 |
| streaming-providers | 210 | 209 | 0 | 0.476 | 500 | 950 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 368 | 2.675 | 70.781 |
| grpc /qdrant.Points/UpdateBatch 0 | 5 | 0.036 | 62.878 |
| grpc /qdrant.Points/Get 0 | 374 | 2.718 | 58.887 |
| grpc /qdrant.Points/Scroll 0 | 1 | 0.007 | 53.618 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 195.712 req/s, of which 71.551 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 98.616 | 0 | 73.199 | 101.731 | 20 | 1543.427 | 3113.156 |
| 10.0.0.20 | 3a45fcfd | 96.502 | 0 | 69.456 | 117.51 | 14 | 720.295 | 2431.098 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 0 | 0 | 0 | 50 | 0 |
| resolve address | /movie/:movieKey | 0 | 0 | 0 | 387 | 0 |
| resolve address | /person/:personKey | 0 | 0 | 0 | 417 | 0 |
| resolve address | /discover/:type? | 0 | 0 | 0 | 14 | 0 |
| resolve address | /:type | 0 | 0 | 0 | 1 | 0 |
| resolve address | / | 258 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 312 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 0 | 0 | 418 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 1 | 0 | 55 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 14 | 0 |
| 10.0.0.20 | / | 236 | 0 | 0 | 1 | 0 |
