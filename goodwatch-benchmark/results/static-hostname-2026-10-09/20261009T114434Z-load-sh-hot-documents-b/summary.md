# 20261009T114434Z-load-sh-hot-documents-b

Label: sh-hot-documents-b. Time: 2026-10-09T11:45:01.573Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot-documents. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34 (dirty).

Rate plan: 50 visitors/s for 30 s, then 100 visitors/s for 35 s, then 150 visitors/s for 35 s, then 200 visitors/s for 35 s, then 250 visitors/s for 35 s.

25484 requests; 147.248 req/s; 0% errors; p95 33.3 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 1830 | 10.574 | 0 | 5.972 | 32.145 | 57.28 | 4.648 | 29.319 | 50.936 | 1830/0/0/0/0 |
| home | 1288 | 7.442 | 0 | 5.361 | 29.898 | 59.228 | 4.346 | 28.203 | 55.709 | 1288/0/0/0/0 |
| og_person | 243 | 1.404 | 0 | 8.504 | 30.906 | 55.776 | 4.927 | 22.204 | 49.264 | 243/0/0/0/0 |
| og_share_list | 246 | 1.421 | 0 | 9.667 | 37.12 | 68.329 | 5.239 | 27.643 | 46.906 | 246/0/0/0/0 |
| og_title | 1044 | 6.032 | 0 | 9.23 | 41.102 | 81.884 | 4.782 | 29.792 | 51.89 | 1044/0/0/0/0 |
| person | 1261 | 7.286 | 0 | 5.871 | 29.366 | 57.095 | 4.492 | 26.299 | 51.544 | 1261/0/0/0/0 |
| share_list | 2352 | 13.59 | 0 | 5.841 | 31.363 | 54.989 | 4.595 | 28.697 | 51.845 | 2352/0/0/0/0 |
| title_movie | 15936 | 92.079 | 0 | 6.558 | 33.688 | 63.891 | 4.517 | 28.488 | 52.13 | 15936/0/0/0/0 |
| title_show | 1284 | 7.419 | 0 | 6.989 | 32.776 | 61.084 | 4.923 | 27.989 | 52.354 | 1284/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 50 | 1499 | 49.967 | 0 | 5.472 | 31.303 | 101.026 | 4.223 | 29.919 |
| s02 | 100 | 3375 | 96.429 | 0 | 6.336 | 26.723 | 48.059 | 4.611 | 25.574 |
| s03 | 150 | 5124 | 146.4 | 0 | 5.882 | 31.755 | 53.248 | 4.397 | 29.938 |
| s04 | 200 | 6875 | 196.429 | 0 | 6.25 | 29.366 | 49.654 | 4.482 | 26.925 |
| s05 | 250 | 8611 | 246.029 | 0 | 7.568 | 41.682 | 82.413 | 4.883 | 30.108 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

25484 visitors; 0 complete page views; 0% failed page views; page view p95 0 ms; 25484 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 50 | 49.967 | 0 | 0 | 5.472 | 31.303 | 0 | 0 | 49.967 | 0 | 49.967 | 12.474 | 19.625 |
| s02 | 100 | 96.429 | 0 | 0 | 6.336 | 26.723 | 0 | 0 | 96.429 | 0 | 96.429 | 12.168 | 20.917 |
| s03 | 150 | 146.4 | 0 | 0 | 5.882 | 31.755 | 0 | 0 | 146.4 | 0 | 146.4 | 11.93 | 20.552 |
| s04 | 200 | 196.429 | 0 | 0 | 6.25 | 29.366 | 0 | 0 | 196.429 | 0 | 196.429 | 11.689 | 20.662 |
| s05 | 250 | 246.029 | 0 | 0 | 7.568 | 41.682 | 0 | 0 | 246.029 | 0 | 246.029 | 12.278 | 32.068 |

### By host

Files: page. Pages name the site's host.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 25484 | 147.248 | 0 | 6.534 | 33.3 | 4.552 | 28.436 | 25484 | 1 | 0 | 1 |
| Static hostname | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0 | 0 | n/a |

Site share of site and static traffic: 100% of requests and 0% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- |
| s01 | 50 | 25.964 | 31.646 | 1.608 | 21.18 |
| s02 | 100 | 44.23 | 52.018 | 3.032 | 41.056 |
| s03 | 150 | 58.013 | 65.165 | 4.559 | 62.131 |
| s04 | 200 | 69.689 | 77.861 | 6.058 | 83.172 |
| s05 | 250 | 81.895 | 88.485 | 7.332 | 101.488 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker1 | generator | 4 | 34 | 54.529 | 88.485 | 1.232 | 2.47 | 21.86 | 60.173 | 4.388 | 7.612 | 18 |
