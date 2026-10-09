# 20261009T112421Z-load-sh-movie-origin-b

Label: sh-movie-origin-b. Time: 2026-10-09T11:24:48.648Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34 (dirty).

Rate plan: 10 visitors/s for 30 s, then 20 visitors/s for 35 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 70 visitors/s for 35 s, then 75 visitors/s for 35 s.

**Aborted:** page_view_failed{phase:main,step:s07}: rate<0.01

387383 requests; 1522.736 req/s; 0.043% errors; p95 133.515 ms; 105 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 387383 | 1522.736 | 0.043 | 16.686 | 133.515 | 764.118 | 15.041 | 129.715 | 763.521 | 385626/0/0/3/165 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 11063 | 368.767 | 0 | 10.734 | 32.932 | 56.985 | 9.316 | 31.627 |
| s02 | 20 | 24975 | 713.571 | 0 | 12.307 | 174.209 | 2303.389 | 10.786 | 172.081 |
| s03 | 30 | 37925 | 1083.571 | 0 | 10.339 | 35.981 | 90.444 | 8.968 | 34.573 |
| s04 | 40 | 50873 | 1453.514 | 0 | 15.417 | 163.713 | 2142.251 | 14.009 | 161.412 |
| s05 | 50 | 63825 | 1823.571 | 0 | 13.864 | 64.409 | 138.659 | 12.584 | 62.186 |
| s06 | 60 | 76775 | 2193.571 | 0 | 17.152 | 63.515 | 125.904 | 15.459 | 60.787 |
| s07 | 70 | 88571 | 2530.6 | 0.19 | 26.296 | 231.484 | 3285.818 | 23.307 | 228.596 |
| s08 | 75 | 33376 | 2317.876 | 0 | 35.168 | 379.792 | 686.955 | 32.949 | 367.305 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

10425 visitors; 10401 complete page views; 0.23% failed page views; page view p95 546.4 ms; 21045 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9.967 | 9.967 | 0 | 5.345 | 27.968 | 50 | 91.3 | 368.767 | 0 | 19.933 | 14.071 | 25.991 |
| s02 | 20 | 19.286 | 19.286 | 0 | 5.884 | 168.973 | 51 | 446.3 | 713.571 | 0 | 38.571 | 13.294 | 25.582 |
| s03 | 30 | 29.286 | 29.286 | 0 | 5.236 | 34.121 | 46 | 108 | 1083.571 | 0 | 58.571 | 12.604 | 22.19 |
| s04 | 40 | 39.286 | 39.286 | 0 | 10.68 | 176.362 | 59 | 1874.9 | 1453.514 | 0 | 78.514 | 12.821 | 22.496 |
| s05 | 50 | 49.286 | 49.286 | 0 | 9.959 | 65.485 | 56 | 176 | 1823.571 | 0 | 98.571 | 12.494 | 22.179 |
| s06 | 60 | 59.286 | 59.286 | 0 | 14.652 | 62.338 | 66 | 165.3 | 2193.571 | 0 | 118.571 | 12.804 | 25.901 |
| s07 | 70 | 68.257 | 67.571 | 1.005 | 23.929 | 227.808 | 96 | 3652 | 2530.6 | 0.19 | 137.514 | 12.916 | 29.965 |
| s08 | 75 | 59.864 | 59.864 | 0 | 34.537 | 399.375 | 108 | 568.4 | 2317.876 | 0 | 130.978 | 12.688 | 29.609 |

### By host

Files: origin. Pages name the static hostname. Static hostname: static.goodwatch.app.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 387383 | 1522.736 | 0.043 | 16.686 | 133.515 | 15.041 | 129.715 | 21045 | 37 | 567 | 2 |
| Static hostname | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 14 | 342 | n/a |

Site share of site and static traffic: 100% of requests and 100% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- |
| s01 | 10 | 18.974 | 21.651 | 1.711 | 45.504 |
| s02 | 20 | 36.508 | 38.938 | 3.481 | 93.775 |
| s03 | 30 | 50.918 | 56.891 | 5.214 | 143.558 |
| s04 | 40 | 57.44 | 59.133 | 6.883 | 191.098 |
| s05 | 50 | 66.108 | 71.209 | 8.282 | 231.261 |
| s06 | 60 | 77.011 | 79.148 | 10.099 | 285.838 |
| s07 | 70 | 80.363 | 87.298 | 11.571 | 327.332 |
| s08 | 75 | 83.241 | 83.241 | 12.049 | 332.678 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker1 | generator | 4 | 50 | 56.192 | 87.298 | 1.837 | 3.43 | 20.302 | 194.038 | 6.951 | 12.362 | 118 |
