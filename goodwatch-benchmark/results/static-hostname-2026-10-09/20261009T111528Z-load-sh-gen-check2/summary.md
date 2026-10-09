# 20261009T111528Z-load-sh-gen-check2

**Smoke run. Not a baseline.**

Label: sh-gen-check2. Time: 2026-10-09T11:15:44.957Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34.

Rate plan: 2 visitors/s for 30 s.

2183 requests; 71.742 req/s; 0% errors; p95 68.348 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 2183 | 71.742 | 0 | 45.287 | 68.348 | 82.104 | 35.137 | 63.324 | 74.469 | 2183/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 2183 | 72.767 | 0 | 45.287 | 68.348 | 82.104 | 35.137 | 63.324 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

59 visitors; 59 complete page views; 0% failed page views; page view p95 173.4 ms; 235 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 1.967 | 1.967 | 0 | 5.957 | 33.909 | 124 | 173.4 | 72.767 | 0 | 7.833 | 16.931 | 27.886 |

### By host

Files: page. Pages name the static hostname. Static hostname: static.goodwatch.app.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 118 | 3.878 | 0 | 11.916 | 53.012 | 9.65 | 39.393 | 59 | 2 | 51 | 1 |
| Static hostname | 2065 | 67.864 | 0 | 46.014 | 69.251 | 36.122 | 63.72 | 176 | 35 | 516 | 3 |
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
| s01 | 2 | 20.231 | 24.824 | 1.437 | 11.882 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker3 | generator | 4 | 6 | 20.231 | 24.824 | 0.33 | 0.37 | 16.723 | 11.882 | 1.437 | 1.588 | 2 |
