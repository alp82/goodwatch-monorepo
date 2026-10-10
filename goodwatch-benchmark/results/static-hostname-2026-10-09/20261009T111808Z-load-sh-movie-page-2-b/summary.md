# 20261009T111808Z-load-sh-movie-page-2-b

Label: sh-movie-page-2-b. Time: 2026-10-09T11:18:35.761Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34 (dirty).

Rate plan: 10 visitors/s for 30 s, then 20 visitors/s for 35 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 75 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<113

286428 requests; 1310.776 req/s; 0% errors; p95 241.906 ms; 598 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 286428 | 1310.776 | 0 | 34.943 | 241.906 | 539.914 | 28.835 | 181.721 | 404.08 | 286202/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 11063 | 368.767 | 0 | 28.004 | 52.618 | 71.326 | 23.362 | 48.881 |
| s02 | 20 | 24975 | 713.571 | 0 | 29.114 | 52.301 | 67.554 | 23.985 | 46.557 |
| s03 | 30 | 37925 | 1083.571 | 0 | 29.286 | 53.172 | 73.924 | 24.854 | 48.175 |
| s04 | 40 | 50875 | 1453.571 | 0 | 30.098 | 52.521 | 70.405 | 24.393 | 46.993 |
| s05 | 50 | 63781 | 1822.314 | 0 | 34.116 | 85.264 | 149.81 | 27.653 | 70.365 |
| s06 | 60 | 76563 | 2187.514 | 0 | 46.908 | 165.031 | 265.01 | 36.631 | 127.121 |
| s07 | 75 | 21246 | 1571.7 | 0 | 291.883 | 724.599 | 968.187 | 213.072 | 518.802 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

7733 visitors; 7733 complete page views; 0% failed page views; page view p95 1179 ms; 31005 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9.967 | 9.967 | 0 | 5.505 | 22.757 | 120 | 175.2 | 368.767 | 0 | 39.867 | 20.335 | 32.966 |
| s02 | 20 | 19.286 | 19.286 | 0 | 5.552 | 20.076 | 117 | 163.3 | 713.571 | 0 | 77.143 | 18.754 | 30.557 |
| s03 | 30 | 29.286 | 29.286 | 0 | 5.724 | 22.604 | 118 | 175 | 1083.571 | 0 | 117.143 | 19.03 | 31.059 |
| s04 | 40 | 39.286 | 39.286 | 0 | 6.208 | 21.687 | 116 | 167 | 1453.571 | 0 | 157.143 | 18.504 | 29.187 |
| s05 | 50 | 49.286 | 49.286 | 0 | 12.246 | 65.235 | 136 | 388.6 | 1822.314 | 0 | 196.914 | 20.017 | 64.434 |
| s06 | 60 | 59.286 | 59.286 | 0 | 24.912 | 99.091 | 204 | 666 | 2187.514 | 0 | 236.057 | 26.95 | 104.704 |
| s07 | 75 | 41.353 | 41.353 | 0 | 70.872 | 295.162 | 1363 | 2506.9 | 1571.7 | 0 | 174.214 | 190.902 | 630.773 |

### By host

Files: page. Pages name the static hostname. Static hostname: static.goodwatch.app.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 15544 | 71.134 | 0 | 9.205 | 120.613 | 5.828 | 87.921 | 7800 | 2 | 51 | 1 |
| Static hostname | 270884 | 1239.642 | 0 | 35.64 | 250.465 | 29.535 | 188.297 | 23205 | 35 | 516 | 3 |
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
| s01 | 10 | 28.252 | 30.725 | 1.987 | 45.113 |
| s02 | 20 | 48.308 | 52.288 | 4.217 | 98.685 |
| s03 | 30 | 63.001 | 68.887 | 6.292 | 148.753 |
| s04 | 40 | 75.602 | 81.405 | 8.025 | 192.741 |
| s05 | 50 | 88.99 | 92.319 | 10.107 | 248.176 |
| s06 | 60 | 98.475 | 99.802 | 11.779 | 293.718 |
| s07 | 75 | 99.753 | 99.753 | 10.737 | 241.259 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker1 | generator | 4 | 43 | 68.261 | 99.852 | 1.8 | 3.3 | 20.394 | 174.578 | 7.246 | 12.635 | 330 |
