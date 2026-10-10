# 20261009T111116Z-load-sh-movie-page-1-b

Label: sh-movie-page-1-b. Time: 2026-10-09T11:11:43.517Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34.

Rate plan: 10 visitors/s for 30 s, then 20 visitors/s for 35 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 75 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<113

16350 requests; 364.665 req/s; 0% errors; p95 1613.975 ms; 207 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 16350 | 364.665 | 0 | 82.128 | 1613.975 | 2966.334 | 58.906 | 1029.783 | 2094.962 | 16114/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 11063 | 368.767 | 0 | 66.185 | 204.599 | 265.954 | 44.653 | 131.816 |
| s02 | 20 | 5287 | 356.369 | 0 | 565.12 | 2675.868 | 3469.505 | 364.172 | 1787.621 |
| s03 | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s04 | 40 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s05 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s06 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s07 | 75 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

432 visitors; 432 complete page views; 0% failed page views; page view p95 4819.35 ms; 1697 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9.967 | 9.967 | 0 | 20.66 | 81.916 | 174 | 514.4 | 368.767 | 0 | 38.1 | 17.372 | 62.723 |
| s02 | 20 | 8.965 | 8.965 | 0 | 105.702 | 1275.045 | 2296 | 5806.2 | 356.369 | 0 | 37.342 | 177.623 | 982.556 |
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
| Site | 961 | 21.434 | 0 | 26.732 | 881.548 | 19.676 | 649.593 | 484 | 2 | 51 | 1 |
| Static hostname | 15389 | 343.231 | 0 | 85.123 | 1673.948 | 61.017 | 1060.032 | 1213 | 35 | 516 | 3 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 14 | 342 | n/a |

Site share of site and static traffic: 5.405% of requests and 9.026% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- |
| s01 | 10 | 88.317 | 96.88 | 6.977 | 58.8 |
| s02 | 20 | 99.901 | 99.901 | 8.725 | 67.18 |
| s03 | 30 | n/a | n/a | n/a | n/a |
| s04 | 40 | n/a | n/a | n/a | n/a |
| s05 | 50 | n/a | n/a | n/a | n/a |
| s06 | 60 | n/a | n/a | n/a | n/a |
| s07 | 75 | n/a | n/a | n/a | n/a |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker1 | generator | 4 | 9 | 91.388 | 99.901 | 1.438 | 2.28 | 20.092 | 61.786 | 7.504 | 8.942 | 814 |
