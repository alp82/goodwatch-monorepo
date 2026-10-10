# 20261009T113415Z-load-sh-movie-document-b

Label: sh-movie-document-b. Time: 2026-10-09T11:34:43.170Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: movie-document. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34 (dirty).

Rate plan: 25 visitors/s for 25 s, then 50 visitors/s for 30 s, then 75 visitors/s for 30 s, then 100 visitors/s for 30 s, then 125 visitors/s for 30 s, then 150 visitors/s for 30 s, then 175 visitors/s for 30 s, then 200 visitors/s for 30 s, then 225 visitors/s for 30 s, then 250 visitors/s for 30 s.

40555 requests; 137.425 req/s; 0% errors; p95 36.082 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 40555 | 137.425 | 0 | 6.147 | 36.082 | 99.676 | 4.327 | 30.781 | 88.452 | 40555/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 25 | 624 | 24.96 | 0 | 5.565 | 24.823 | 42.929 | 4.263 | 23.298 |
| s02 | 50 | 1438 | 47.933 | 0 | 5.24 | 26.194 | 47.915 | 4.002 | 24.929 |
| s03 | 75 | 2187 | 72.9 | 0 | 5.633 | 22.153 | 40.01 | 4.238 | 20.551 |
| s04 | 100 | 2937 | 97.9 | 0 | 5.913 | 26.664 | 60.66 | 4.345 | 25.612 |
| s05 | 125 | 3687 | 122.9 | 0 | 5.314 | 24.101 | 44.397 | 3.899 | 22.459 |
| s06 | 150 | 4438 | 147.933 | 0 | 5.663 | 22.65 | 41.852 | 4.128 | 20.705 |
| s07 | 175 | 5188 | 172.933 | 0 | 6.482 | 47.455 | 125.08 | 4.484 | 45.445 |
| s08 | 200 | 5936 | 197.867 | 0 | 5.8 | 24.017 | 48.416 | 3.982 | 20.43 |
| s09 | 225 | 6688 | 222.933 | 0 | 7.481 | 72.159 | 1877.095 | 5.458 | 66.07 |
| s10 | 250 | 7432 | 247.733 | 0 | 7.229 | 44.436 | 92.529 | 4.709 | 29.221 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

40555 visitors; 0 complete page views; 0% failed page views; page view p95 0 ms; 40555 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 25 | 24.96 | 0 | 0 | 5.565 | 24.823 | 0 | 0 | 24.96 | 0 | 24.96 | 12.95 | 19.371 |
| s02 | 50 | 47.933 | 0 | 0 | 5.24 | 26.194 | 0 | 0 | 47.933 | 0 | 47.933 | 12.231 | 19.658 |
| s03 | 75 | 72.9 | 0 | 0 | 5.633 | 22.153 | 0 | 0 | 72.9 | 0 | 72.9 | 12.204 | 19.286 |
| s04 | 100 | 97.9 | 0 | 0 | 5.913 | 26.664 | 0 | 0 | 97.9 | 0 | 97.9 | 12.014 | 20.036 |
| s05 | 125 | 122.9 | 0 | 0 | 5.314 | 24.101 | 0 | 0 | 122.9 | 0 | 122.9 | 12.132 | 21.026 |
| s06 | 150 | 147.933 | 0 | 0 | 5.663 | 22.65 | 0 | 0 | 147.933 | 0 | 147.933 | 11.918 | 20.853 |
| s07 | 175 | 172.933 | 0 | 0 | 6.482 | 47.455 | 0 | 0 | 172.933 | 0 | 172.933 | 12.128 | 21.053 |
| s08 | 200 | 197.867 | 0 | 0 | 5.8 | 24.017 | 0 | 0 | 197.867 | 0 | 197.867 | 12.051 | 20.917 |
| s09 | 225 | 222.933 | 0 | 0 | 7.481 | 72.159 | 0 | 0 | 222.933 | 0 | 222.933 | 11.9 | 22.024 |
| s10 | 250 | 247.733 | 0 | 0 | 7.229 | 44.436 | 0 | 0 | 247.733 | 0 | 247.733 | 12.025 | 33.661 |

### By host

Files: page. Pages name the site's host.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 40555 | 137.425 | 0 | 6.147 | 36.082 | 4.327 | 30.781 | 40555 | 1 | 0 | 1 |
| Static hostname | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0 | 0 | n/a |

Site share of site and static traffic: 100% of requests and 0% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- |
| s01 | 25 | 19.107 | 24.607 | 0.789 | 10.05 |
| s02 | 50 | 24.211 | 29.781 | 1.62 | 21.603 |
| s03 | 75 | 31.185 | 32.84 | 2.365 | 32.461 |
| s04 | 100 | 44.211 | 55.061 | 3.042 | 41.869 |
| s05 | 125 | 52.447 | 55.256 | 3.928 | 54.242 |
| s06 | 150 | 58.386 | 62.893 | 4.705 | 65.073 |
| s07 | 175 | 68.113 | 74.924 | 5.461 | 75.82 |
| s08 | 200 | 70.864 | 74.067 | 5.997 | 83.843 |
| s09 | 225 | 74.585 | 76.123 | 6.958 | 97.566 |
| s10 | 250 | 83.21 | 86.922 | 7.717 | 108.423 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker1 | generator | 4 | 58 | 52.16 | 86.922 | 1.645 | 2.8 | 22.564 | 58.091 | 4.193 | 7.754 | 63 |
