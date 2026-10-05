# 20261005T054258Z-load-pv-hot-private-reuse-duo-b

Label: pv-hot-private-reuse-duo-b. Time: 2026-10-05T05:43:13.861Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: 833a2e5363de517bd1f6fd4617a364e50fca32c3 (dirty).

Rate plan: 20 visitors/s for 30 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 70 visitors/s for 35 s, then 80 visitors/s for 35 s, then 90 visitors/s for 35 s, then 100 visitors/s for 35 s.

583984 requests; 2116.039 req/s; 0% errors; p95 70.112 ms; 4 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 54285 | 196.699 | 0 | 16.226 | 71.063 | 340.486 | 14.659 | 68.224 | 339.44 | 54285/0/0/0/0 |
| home | 37693 | 136.579 | 0 | 17.609 | 79.759 | 736.003 | 15.83 | 75.719 | 723.512 | 37658/0/0/0/0 |
| og_person | 160 | 0.58 | 0 | 13.993 | 58.26 | 74.437 | 11.31 | 55.087 | 71.814 | 160/0/0/0/0 |
| og_share_list | 176 | 0.638 | 0 | 15.298 | 92.964 | 939.428 | 10.782 | 83.013 | 936.584 | 176/0/0/0/0 |
| og_title | 678 | 2.457 | 0 | 14.836 | 84.339 | 303.567 | 10.612 | 70.306 | 297.623 | 678/0/0/0/0 |
| person | 24667 | 89.38 | 0 | 14.889 | 73.362 | 442.167 | 13.48 | 69.564 | 440.218 | 24659/0/0/0/0 |
| share_list | 35817 | 129.781 | 0 | 13.427 | 66.445 | 219.986 | 11.873 | 62.868 | 218.724 | 35817/0/0/0/0 |
| title_movie | 396424 | 1436.424 | 0 | 15.252 | 69.353 | 430.129 | 13.813 | 66.677 | 429.041 | 396308/0/0/0/0 |
| title_show | 34084 | 123.502 | 0 | 15.774 | 65.825 | 710.383 | 14.235 | 62.522 | 709.098 | 34059/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 20169 | 672.3 | 0 | 10.391 | 24.24 | 48.449 | 8.828 | 22.625 |
| s02 | 40 | 45255 | 1293 | 0 | 9.874 | 25.206 | 40.824 | 8.474 | 23.048 |
| s03 | 50 | 57633 | 1646.657 | 0 | 10.262 | 27.876 | 45.662 | 8.93 | 25.817 |
| s04 | 60 | 68821 | 1966.314 | 0 | 11.563 | 37.152 | 63.422 | 10.272 | 35.416 |
| s05 | 70 | 80428 | 2297.943 | 0 | 12.016 | 43.199 | 88.026 | 10.695 | 41.292 |
| s06 | 80 | 92597 | 2645.629 | 0 | 18.216 | 66.035 | 139.182 | 16.715 | 64.017 |
| s07 | 90 | 104168 | 2976.229 | 0 | 21.503 | 120.779 | 1182.075 | 19.873 | 118.056 |
| s08 | 100 | 114913 | 3283.229 | 0 | 28.204 | 107.084 | 1475.898 | 26.173 | 104.093 |

## Page views

One visitor is one iteration, on a reused connection. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

17534 visitors; 15798 complete page views; 0% failed page views; page view p95 282 ms; 126 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 19.967 | 18.033 | 0 | 4.956 | 23.551 | 32 | 70 | 672.3 | 0 | 4.167 | 23.638 | 32.58 |
| s02 | 40 | 38.571 | 35.057 | 0 | 4.627 | 19.648 | 29 | 59 | 1293 | 0 | 0 | 0 | 0 |
| s03 | 50 | 49.286 | 44.4 | 0 | 5.7 | 25.73 | 31 | 67 | 1646.657 | 0 | 0 | 0 | 0 |
| s04 | 60 | 59.286 | 53.171 | 0 | 7.609 | 34.81 | 34 | 93 | 1966.314 | 0 | 0 | 0 | 0 |
| s05 | 70 | 69.286 | 62.257 | 0 | 8.701 | 40.322 | 36 | 108.1 | 2297.943 | 0 | 0 | 0 | 0 |
| s06 | 80 | 79.286 | 71.429 | 0 | 15.036 | 60.761 | 53 | 189.1 | 2645.629 | 0 | 0 | 0 | 0 |
| s07 | 90 | 89.286 | 81.114 | 0 | 19.682 | 104.101 | 63 | 1168.2 | 2976.229 | 0 | 0 | 0 | 0 |
| s08 | 100 | 98.857 | 88.486 | 0 | 26.801 | 97.901 | 80 | 1272.6 | 3283.229 | 0 | 0.029 | 22.43 | 22.43 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | gw-worker1 CPU % | gw-worker1 CPU max % | gw-worker1 TX Mbps | gw-worker1 RX Mbps |
| --- | --- | --- | --- | --- | --- |
| s01 | 20 | 25.144 | 29.58 | 0.109 | 0.105 |
| s02 | 40 | 34.691 | 36.533 | 0.106 | 0.102 |
| s03 | 50 | 41.279 | 43.829 | 0.128 | 0.138 |
| s04 | 60 | 44.136 | 47.388 | 0.131 | 0.144 |
| s05 | 70 | 50.194 | 55.369 | 0.141 | 0.18 |
| s06 | 80 | 55.554 | 61.45 | 0.155 | 0.201 |
| s07 | 90 | 58.593 | 61.635 | 0.158 | 0.206 |
| s08 | 100 | 62.134 | 71.011 | 0.165 | 0.236 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gw-worker1 | generator | 4 | 55 | 46.314 | 71.011 | 2.331 | 3.22 | 20.24 | 0.163 | 0.136 | 0.172 | 134 |
