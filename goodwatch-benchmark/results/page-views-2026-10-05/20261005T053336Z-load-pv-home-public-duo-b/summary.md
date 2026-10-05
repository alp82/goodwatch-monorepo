# 20261005T053336Z-load-pv-home-public-duo-b

Label: pv-home-public-duo-b. Time: 2026-10-05T05:33:51.259Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 833a2e5363de517bd1f6fd4617a364e50fca32c3 (dirty).

Rate plan: 2 visitors/s for 20 s, then 5 visitors/s for 25 s, then 10 visitors/s for 25 s, then 20 visitors/s for 25 s, then 30 visitors/s for 25 s, then 40 visitors/s for 25 s, then 50 visitors/s for 25 s, then 60 visitors/s for 25 s.

**Aborted:** dropped_iterations: count<60

126187 requests; 798.266 req/s; 0.006% errors; p95 195.08 ms; 71 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home | 126187 | 798.266 | 0.006 | 23.91 | 195.08 | 802.83 | 21.391 | 185.472 | 790.017 | 124370/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 1599 | 79.95 | 0 | 12.497 | 35.403 | 49.521 | 10.581 | 34.099 |
| s02 | 5 | 4838 | 193.52 | 0 | 12.279 | 28.558 | 38.671 | 10.129 | 26.201 |
| s03 | 10 | 9717 | 388.68 | 0 | 12.024 | 35.085 | 68.928 | 10.049 | 32.781 |
| s04 | 20 | 19475 | 779 | 0 | 11.947 | 38.567 | 65.476 | 10.178 | 36.179 |
| s05 | 30 | 29725 | 1189 | 0 | 16.058 | 58.939 | 108.351 | 13.825 | 55.501 |
| s06 | 40 | 39904 | 1596.16 | 0 | 44.7 | 142.813 | 3030.217 | 41.139 | 134.226 |
| s07 | 50 | 20929 | 1600.527 | 0.038 | 92.798 | 513.045 | 4204.431 | 85.088 | 483.967 |
| s08 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

3029 visitors; 3029 complete page views; 0% failed page views; page view p95 1031.8 ms; 6239 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 1.95 | 1.95 | 0 | 5.024 | 28.775 | 75 | 106.2 | 79.95 | 0 | 3.9 | 25.004 | 40.498 |
| s02 | 5 | 4.72 | 4.72 | 0 | 5.568 | 23.336 | 75 | 108.3 | 193.52 | 0 | 9.44 | 24.348 | 35.519 |
| s03 | 10 | 9.48 | 9.48 | 0 | 5.057 | 39.172 | 76 | 157.8 | 388.68 | 0 | 18.96 | 24.418 | 35.569 |
| s04 | 20 | 19 | 19 | 0 | 5.235 | 31.874 | 74 | 178 | 779 | 0 | 38 | 23.2 | 33.48 |
| s05 | 30 | 29 | 29 | 0 | 9.22 | 46.615 | 94 | 257.2 | 1189 | 0 | 58 | 23.054 | 35.662 |
| s06 | 40 | 38.84 | 38.84 | 0 | 36.234 | 128.975 | 231 | 2081 | 1596.16 | 0 | 77.8 | 24.864 | 49.996 |
| s07 | 50 | 35.484 | 35.484 | 0 | 83.922 | 429.803 | 476.5 | 3361.1 | 1600.527 | 0.038 | 84.58 | 27.4 | 84.53 |
| s08 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- |
| s01 | 2 | 6.354 | 6.974 | 0.456 | 11.812 |
| s02 | 5 | 11.769 | 15.112 | 1.04 | 29.611 |
| s03 | 10 | 19.343 | 26.069 | 2.022 | 60.004 |
| s04 | 20 | 30.084 | 36.23 | 3.971 | 120.52 |
| s05 | 30 | 41.617 | 48.542 | 5.633 | 176.173 |
| s06 | 40 | 47.23 | 50 | 7.688 | 243.35 |
| s07 | 50 | 54.172 | 55.332 | 8.221 | 252.15 |
| s08 | 60 | n/a | n/a | n/a | n/a |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker1 | generator | 4 | 32 | 28.682 | 55.332 | 0.564 | 1.31 | 17.665 | 118.971 | 3.801 | 8.345 | 132 |
