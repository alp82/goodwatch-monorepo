# 20261005T053736Z-load-pv-hot-public-duo-b

Label: pv-hot-public-duo-b. Time: 2026-10-05T05:37:51.239Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 833a2e5363de517bd1f6fd4617a364e50fca32c3 (dirty).

Rate plan: 15 visitors/s for 30 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 45 visitors/s for 35 s, then 50 visitors/s for 35 s, then 55 visitors/s for 35 s, then 60 visitors/s for 35 s, then 65 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<98

362365 requests; 1413.358 req/s; 0% errors; p95 193.279 ms; 128 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 31173 | 121.586 | 0 | 18.081 | 199.291 | 686.989 | 15.266 | 163.649 | 591.925 | 31119/0/0/0/0 |
| home | 22323 | 87.068 | 0 | 21.093 | 209.663 | 712.181 | 17.759 | 160.912 | 620.576 | 22316/0/0/0/0 |
| og_person | 112 | 0.437 | 0 | 13.179 | 264.852 | 596.777 | 9.823 | 187.035 | 438.904 | 112/0/0/0/0 |
| og_share_list | 113 | 0.441 | 0 | 22.97 | 236.043 | 632.163 | 13.975 | 137.136 | 568.894 | 113/0/0/0/0 |
| og_title | 443 | 1.728 | 0 | 14.545 | 181.579 | 659.879 | 9.776 | 117.845 | 613.167 | 443/0/0/0/0 |
| person | 14321 | 55.857 | 0 | 17.363 | 180.936 | 813.256 | 14.59 | 148.455 | 687.171 | 14303/0/0/0/0 |
| share_list | 21610 | 84.287 | 0 | 15.411 | 181.051 | 899.434 | 12.318 | 134.428 | 652.386 | 21584/0/0/0/0 |
| title_movie | 250762 | 978.065 | 0 | 18.068 | 193.57 | 634.435 | 15.332 | 155.511 | 569.108 | 250450/0/0/0/0 |
| title_show | 21508 | 83.889 | 0 | 19.563 | 186.279 | 658.905 | 16.522 | 156.381 | 590.814 | 21508/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 15 | 14810 | 493.667 | 0 | 9.912 | 24.205 | 43.552 | 8.335 | 22.248 |
| s02 | 30 | 33425 | 955 | 0 | 10.213 | 29.648 | 45.154 | 8.47 | 27.429 |
| s03 | 40 | 45591 | 1302.6 | 0 | 12.004 | 40.698 | 87.009 | 10.126 | 35.933 |
| s04 | 45 | 51688 | 1476.8 | 0 | 14.369 | 62.187 | 117.28 | 12.185 | 55.614 |
| s05 | 50 | 56732 | 1620.914 | 0 | 17.584 | 68.425 | 133.548 | 14.969 | 61.646 |
| s06 | 55 | 63952 | 1827.2 | 0 | 17.473 | 58.44 | 89.357 | 14.472 | 51.036 |
| s07 | 60 | 69482 | 1985.2 | 0 | 43.69 | 207.068 | 508.372 | 35.307 | 167.661 |
| s08 | 65 | 26685 | 1628.533 | 0 | 195.818 | 1058.741 | 1733.356 | 154.841 | 943.019 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

10916 visitors; 9780 complete page views; 0% failed page views; page view p95 786.05 ms; 20865 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 15 | 14.967 | 13.3 | 0 | 4.81 | 17.837 | 54 | 83.3 | 493.667 | 0 | 28.433 | 22.13 | 33.117 |
| s02 | 30 | 28.943 | 25.743 | 0 | 4.928 | 21.235 | 55 | 89 | 955 | 0 | 55 | 22.027 | 32.385 |
| s03 | 40 | 39.286 | 35.057 | 0 | 6.99 | 33.775 | 59 | 119 | 1302.6 | 0 | 74.629 | 22.4 | 39.406 |
| s04 | 45 | 44.629 | 40.143 | 0 | 9.09 | 55.956 | 66 | 196.8 | 1476.8 | 0 | 84.8 | 22.622 | 41.915 |
| s05 | 50 | 49.657 | 44.086 | 0 | 12.269 | 58.778 | 77 | 195 | 1620.914 | 0 | 94.343 | 22.833 | 46.435 |
| s06 | 55 | 54.629 | 49.2 | 0 | 12.474 | 51.687 | 78.5 | 171 | 1827.2 | 0 | 103.8 | 23.659 | 48.956 |
| s07 | 60 | 59.657 | 53.657 | 0 | 36.173 | 173.923 | 174 | 843.15 | 1985.2 | 0 | 113.057 | 38.18 | 214.113 |
| s08 | 65 | 47.541 | 43.025 | 0 | 176.641 | 800.059 | 853 | 2409.8 | 1628.533 | 0 | 98.56 | 154.128 | 770.808 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- |
| s01 | 15 | 20.942 | 22.86 | 2.278 | 62.966 |
| s02 | 30 | 38.501 | 42.775 | 4.729 | 132.265 |
| s03 | 40 | 48.495 | 58.7 | 6.124 | 174.295 |
| s04 | 45 | 49.644 | 61.14 | 6.967 | 200.488 |
| s05 | 50 | 48.928 | 50.577 | 7.6 | 220.258 |
| s06 | 55 | 58.393 | 68.236 | 8.584 | 241.72 |
| s07 | 60 | 81.7 | 83.741 | 10.76 | 284.561 |
| s08 | 65 | 85.371 | 85.497 | 10.226 | 259.989 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker1 | generator | 4 | 51 | 51.736 | 85.497 | 2.589 | 6.44 | 20.859 | 192.255 | 6.937 | 11.248 | 112 |
