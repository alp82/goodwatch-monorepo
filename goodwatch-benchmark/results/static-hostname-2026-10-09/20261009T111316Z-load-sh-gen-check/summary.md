# 20261009T111316Z-load-sh-gen-check

**Smoke run. Not a baseline.**

Label: sh-gen-check. Time: 2026-10-09T11:13:33.348Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34.

Rate plan: 2 visitors/s for 40 s.

2923 requests; 72.165 req/s; 0% errors; p95 70.367 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 2923 | 72.165 | 0 | 42.861 | 70.367 | 76.878 | 31.988 | 57.943 | 68.17 | 2923/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 2923 | 73.075 | 0 | 42.861 | 70.367 | 76.878 | 31.988 | 57.943 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

79 visitors; 79 complete page views; 0% failed page views; page view p95 146 ms; 309 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 1.975 | 1.975 | 0 | 5.83 | 36.561 | 115 | 146 | 73.075 | 0 | 7.725 | 15.638 | 28.575 |

### By host

Files: page. Pages name the static hostname. Static hostname: static.goodwatch.app.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 158 | 3.901 | 0 | 7.192 | 42.643 | 5.887 | 36.717 | 79 | 2 | 51 | 1 |
| Static hostname | 2765 | 68.264 | 0 | 43.7 | 70.48 | 32.611 | 58.286 | 230 | 35 | 516 | 3 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 14 | 342 | n/a |

Site share of site and static traffic: 5.405% of requests and 9.026% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- |
| s01 | 2 | 19.391 | 24.411 | 1.471 | 12.096 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker3 | generator | 4 | 8 | 19.391 | 24.411 | 0.741 | 0.91 | 16.44 | 12.096 | 1.471 | 1.567 | 4 |
