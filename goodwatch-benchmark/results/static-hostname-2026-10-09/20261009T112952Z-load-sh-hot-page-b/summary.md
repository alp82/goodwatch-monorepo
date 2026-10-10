# 20261009T112952Z-load-sh-hot-page-b

Label: sh-hot-page-b. Time: 2026-10-09T11:30:20.038Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34 (dirty).

Rate plan: 10 visitors/s for 30 s, then 20 visitors/s for 35 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s.

165851 requests; 962.609 req/s; 0.001% errors; p95 63.718 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 16563 | 96.133 | 0 | 44.363 | 80.099 | 124.414 | 34.163 | 68.559 | 108.386 | 16539/0/0/0/0 |
| home | 10431 | 60.542 | 0 | 35.792 | 69.12 | 94.792 | 27.844 | 58.563 | 81.208 | 10431/0/0/0/0 |
| og_person | 49 | 0.284 | 0 | 8.92 | 30.734 | 44.418 | 6.196 | 21.396 | 32.59 | 49/0/0/0/0 |
| og_share_list | 52 | 0.302 | 0 | 10.296 | 28.327 | 48.128 | 5.07 | 20.536 | 26.678 | 52/0/0/0/0 |
| og_title | 209 | 1.213 | 0 | 9.251 | 42.833 | 71.148 | 4.822 | 26.445 | 59.37 | 209/0/0/0/0 |
| person | 7207 | 41.83 | 0 | 31.896 | 54.195 | 79.616 | 25.956 | 48.676 | 66.571 | 7207/0/0/0/0 |
| share_list | 10457 | 60.693 | 0.01 | 30.306 | 58.434 | 77.183 | 24.607 | 49.73 | 71.612 | 10456/0/0/1/0 |
| title_movie | 111802 | 648.905 | 0 | 30.893 | 58.193 | 85.625 | 25.516 | 51.456 | 74.3 | 111769/0/0/0/0 |
| title_show | 9081 | 52.707 | 0 | 38.685 | 69.112 | 97.717 | 30.076 | 59.706 | 80.699 | 9081/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9627 | 320.9 | 0 | 30.976 | 62.649 | 91.308 | 27.254 | 59.6 |
| s02 | 20 | 21737 | 621.057 | 0 | 31.536 | 60.637 | 86.938 | 26.723 | 55.035 |
| s03 | 30 | 33115 | 946.143 | 0 | 31.527 | 58.553 | 80.909 | 26.056 | 51.07 |
| s04 | 40 | 45352 | 1295.771 | 0 | 32.33 | 60.663 | 81.606 | 26.313 | 52.03 |
| s05 | 50 | 56020 | 1600.571 | 0.002 | 34.055 | 70.132 | 105.742 | 27.253 | 58.284 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

5087 visitors; 4563 complete page views; 0% failed page views; page view p95 218 ms; 17957 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9.967 | 8.933 | 0 | 5.363 | 19.065 | 127 | 239.95 | 320.9 | 0 | 35.133 | 20.212 | 32.061 |
| s02 | 20 | 19.286 | 16.914 | 0 | 5.092 | 21.705 | 122 | 182.25 | 621.057 | 0 | 67.657 | 19.337 | 31.808 |
| s03 | 30 | 29.286 | 26.229 | 0 | 5.732 | 29.242 | 130 | 196 | 946.143 | 0 | 103.229 | 21.501 | 35.632 |
| s04 | 40 | 39.286 | 35.743 | 0 | 5.624 | 29.487 | 126 | 211.5 | 1295.771 | 0 | 139.086 | 19.668 | 34.885 |
| s05 | 50 | 48.943 | 43.829 | 0 | 7.35 | 43.341 | 129 | 241.35 | 1600.571 | 0.002 | 172.971 | 19.319 | 38.465 |

### By host

Files: page. Pages name the static hostname. Static hostname: static.goodwatch.app.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 10331 | 59.962 | 0 | 5.399 | 30.014 | 4.222 | 25.304 | 5095 | 2.03 | 41 | 1 |
| Static hostname | 155520 | 902.647 | 0.001 | 33.389 | 64.559 | 27.441 | 55.797 | 12862 | 30.58 | 467 | 2.53 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 14.37 | 349 | n/a |

Site share of site and static traffic: 6.225% of requests and 8.139% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- |
| s01 | 10 | 22.552 | 24.255 | 1.697 | 41.645 |
| s02 | 20 | 46.59 | 71.612 | 4.186 | 90.451 |
| s03 | 30 | 80.61 | 83.325 | 6.972 | 145.103 |
| s04 | 40 | 77.324 | 89.04 | 7.29 | 177.337 |
| s05 | 50 | 82.993 | 86.32 | 8.955 | 224.083 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker1 | generator | 4 | 34 | 62.342 | 89.04 | 2.49 | 3.94 | 22.355 | 134.059 | 5.781 | 9.182 | 30 |
