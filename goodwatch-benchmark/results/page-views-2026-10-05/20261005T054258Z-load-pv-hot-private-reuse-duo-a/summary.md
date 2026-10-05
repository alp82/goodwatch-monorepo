# 20261005T054258Z-load-pv-hot-private-reuse-duo-a

Label: pv-hot-private-reuse-duo-a. Time: 2026-10-05T05:43:21.511Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: 833a2e5363de517bd1f6fd4617a364e50fca32c3 (dirty).

Rate plan: 20 visitors/s for 30 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 70 visitors/s for 35 s, then 80 visitors/s for 35 s, then 90 visitors/s for 35 s, then 100 visitors/s for 35 s.

**k6 failed:** exit 105.

575448 requests; 2102.128 req/s; 0% errors; p95 70.396 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 51452 | 187.956 | 0 | 15.281 | 72.728 | 633.29 | 13.803 | 70.142 | 631.842 | 51452/0/0/0/0 |
| home | 33357 | 121.854 | 0.003 | 18.214 | 78.144 | 295.255 | 16.486 | 75.555 | 288.501 | 33356/0/0/1/0 |
| og_person | 167 | 0.61 | 0 | 12.64 | 62.416 | 641.266 | 10.612 | 56.639 | 625.698 | 167/0/0/0/0 |
| og_share_list | 180 | 0.658 | 0 | 18.692 | 85.902 | 198.462 | 14.078 | 69.094 | 162.385 | 180/0/0/0/0 |
| og_title | 665 | 2.429 | 0 | 15.145 | 79.918 | 144.069 | 11.058 | 67.538 | 125.931 | 665/0/0/0/0 |
| person | 24900 | 90.96 | 0 | 12.761 | 60.513 | 355.244 | 11.426 | 59.201 | 352.569 | 24900/0/0/0/0 |
| share_list | 33344 | 121.807 | 0 | 12.633 | 65.244 | 199.924 | 11.064 | 63.245 | 197.251 | 33343/0/0/0/0 |
| title_movie | 399046 | 1457.726 | 0 | 14.894 | 70.297 | 420.36 | 13.512 | 67.705 | 417.975 | 399046/0/0/0/0 |
| title_show | 32337 | 118.128 | 0 | 14.867 | 72.396 | 343.147 | 13.327 | 70.272 | 340.9 | 32337/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 19844 | 661.467 | 0 | 10.019 | 25.892 | 50.172 | 8.377 | 24.075 |
| s02 | 40 | 44945 | 1284.143 | 0 | 9.604 | 27.641 | 48.789 | 8.29 | 25.835 |
| s03 | 50 | 57514 | 1643.257 | 0 | 9.915 | 27.728 | 47.667 | 8.565 | 25.62 |
| s04 | 60 | 68982 | 1970.914 | 0 | 11.133 | 37.326 | 60.778 | 9.915 | 35.792 |
| s05 | 70 | 80578 | 2302.229 | 0 | 12.15 | 44.475 | 79.477 | 10.833 | 42.458 |
| s06 | 80 | 91565 | 2616.143 | 0 | 19.387 | 75.527 | 549.392 | 17.946 | 73.414 |
| s07 | 90 | 105044 | 3001.257 | 0.001 | 21.327 | 100.303 | 1102.677 | 19.7 | 97.438 |
| s08 | 100 | 106976 | 3056.457 | 0 | 25.353 | 104.892 | 1259.392 | 23.604 | 99.751 |

## Page views

One visitor is one iteration, on a reused connection. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

17291 visitors; 15562 complete page views; 0.006% failed page views; page view p95 311 ms; 125 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 19.967 | 17.833 | 0 | 4.89 | 20.779 | 31 | 68 | 661.467 | 0 | 4.167 | 22.374 | 32.005 |
| s02 | 40 | 38.571 | 34.8 | 0 | 5.182 | 25.371 | 28 | 63 | 1284.143 | 0 | 0 | 0 | 0 |
| s03 | 50 | 49.286 | 44.543 | 0 | 6.265 | 24.379 | 30 | 68 | 1643.257 | 0 | 0 | 0 | 0 |
| s04 | 60 | 59.286 | 53.543 | 0 | 8.425 | 35.478 | 34 | 90 | 1970.914 | 0 | 0 | 0 | 0 |
| s05 | 70 | 69.286 | 62.086 | 0 | 9.488 | 42.115 | 36 | 110.4 | 2302.229 | 0 | 0 | 0 | 0 |
| s06 | 80 | 79.286 | 70.857 | 0 | 17.708 | 68.796 | 57 | 347.4 | 2616.143 | 0 | 0 | 0 | 0 |
| s07 | 90 | 89.286 | 81.143 | 0.035 | 19.452 | 98.357 | 63 | 1122 | 3001.257 | 0.001 | 0 | 0 | 0 |
| s08 | 100 | 91.914 | 82.371 | 0 | 23.045 | 106.417 | 70 | 1278.8 | 3056.457 | 0 | 0 | 0 | 0 |

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

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 45.848 | 296.486 | 82.755 | 39.277 | 44.422 | 76.097 | 0.236 | 76.993 | 50.001 | 56.505 | 198.705 | 104.833 | 14.301 | 18.964 | 0.247 | 0.139 | 22.908 | 27.405 | 0.108 | 0.09 |
| s02 | 40 | 59.236 | 370.889 | 80.485 | 30.495 | 62.313 | 127.465 | 1.104 | 41.833 | 59.301 | 63.497 | 371.184 | 195.568 | 17.572 | 21.212 | 0.317 | 0.186 | 33.036 | 36.435 | 0.115 | 0.087 |
| s03 | 50 | 67.204 | 389.172 | 73.022 | 72.996 | 66.464 | 159.766 | 0.315 | 56.743 | 64.167 | 67.186 | 455.672 | 246.208 | 20.617 | 22.936 | 0.339 | 0.263 | 42.827 | 44.811 | 0.149 | 0.135 |
| s04 | 60 | 71.873 | 420.992 | 76.62 | 57.267 | 80.081 | 170.887 | 1.341 | 73.651 | 68.005 | 73.427 | 546.366 | 291.22 | 21.757 | 24.841 | 0.333 | 0.263 | 41.535 | 45.756 | 0.132 | 0.111 |
| s05 | 70 | 84.478 | 436.033 | 69.817 | 127.325 | 78.869 | 198.493 | 4.056 | 69.719 | 71.018 | 72.674 | 606.356 | 316.65 | 24.961 | 29.236 | 0.354 | 0.29 | 49.471 | 53.676 | 0.151 | 0.151 |
| s06 | 80 | 89.19 | 460.793 | 72.145 | 87.872 | 91.583 | 217.954 | 50.306 | 83.547 | 76.264 | 79.067 | 713.488 | 373.278 | 26.945 | 29.655 | 0.41 | 0.343 | 53.283 | 56.875 | 0.15 | 0.147 |
| s07 | 90 | 92.99 | 498.391 | 75.993 | 100.455 | 93.341 | 250.085 | 68.695 | 85.251 | 79.831 | 80.645 | 816.381 | 434.186 | 28.885 | 34.945 | 0.489 | 0.439 | 56.074 | 61.705 | 0.155 | 0.141 |
| s08 | 100 | 85.277 | 465.105 | 78.581 | 192.468 | 92.792 | 260.703 | 86.106 | 99.538 | 80.785 | 83.944 | 836.772 | 439.84 | 27.327 | 32.339 | 0.714 | 0.436 | 59.301 | 65.152 | 0.165 | 0.176 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 55 | 68.346 | 83.944 | 5.984 | 7.65 | 35.893 | 296.114 | 560.745 | 928.369 | 9 |
| gw-vector1 | target | 16 | 54 | 23.162 | 34.945 | 3.75 | 6.29 | 50.211 | 0.297 | 0.402 | 2.016 | 8 |
| gw-cache1 | data | 8 | 54 | 3.165 | 18.304 | 0.194 | 0.47 | 31.165 | 0.557 | 8.652 | 14.63 | 8 |
| gw-cache2 | data | 8 | 54 | 4.534 | 16.278 | 0.299 | 0.66 | 30.842 | 0.55 | 0.644 | 1.096 | 7 |
| gw-cache3 | data | 8 | 55 | 3.535 | 18.331 | 0.29 | 0.5 | 30.747 | 0.522 | 0.51 | 1.315 | 9 |
| gw-worker3 | generator | 4 | 55 | 44.256 | 65.152 | 1.473 | 2.67 | 22.685 | 0.125 | 0.138 | 0.213 | 129 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-052303740133 | 84.847 | 111 | 2275.347 | 2276.352 |
| abusive | coolify-proxy | 437.384 | 558.18 | 402.156 | 639.4 |
| gw-vector1 | gk4owk8-052500856273 | 89.44 | 161.43 | 2553.799 | 2750.464 |
| gw-vector1 | coolify-proxy | 183.025 | 298.55 | 161.976 | 237.1 |
| gw-vector1 | qdrant-main | 21.777 | 77.41 | 3902.862 | 3919.872 |

## Webapp process

From the webapp's own counters over 278.294 s, commit 833a2e53. The times exclude the proxy, TLS, and the network.

Finished 2125.56 req/s in total: 2070.043 from the benchmark and 55.517 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.37 on average, 6 at most. Event loop delay: 192.468 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 75.843 | 100.826 |
| webapp libuv-worker | 3.691 | 5.302 |
| webapp V8Worker | 3.139 | 22.731 |
| proxy | 423.248 | 525.088 |

The proxy accepted 75.9 connections per second on average, 98.827 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 562383 | 2020.825 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 11693 | 42.017 | 26.44 | 87.935 | 315.538 | 26.314 | 49.996 | 98.94 |
| /person/:personKey | 1772 | 6.367 | 43.645 | 304.516 | 697.692 | 26.85 | 83.877 | 94.921 |
| /u/:handle/lists/:id | 1621 | 5.825 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 1244 | 4.47 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /show/:showKey | 950 | 3.414 | 28.04 | 180.233 | 384.615 | 27.707 | 144.583 | 98.421 |
| /og/:first/:second | 867 | 3.115 | 25.116 | 47.72 | 49.729 | n/a | n/a | 100 |
| / | 847 | 3.044 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/living-room/picks | 837 | 3.008 | 42.791 | 186.938 | 279.19 | n/a | n/a | 99.522 |
| /og/lists/:id/:file | 176 | 0.632 | 25.731 | 48.889 | 82.4 | n/a | n/a | 100 |
| /api/e | 7 | 0.025 | 250 | 825 | 965 | n/a | n/a | 85.714 |
| /api/poster-impressions | 2 | 0.007 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 109 | 36 | 64 | 66.972 | 140.164 | 194.016 |
| episode-grid | 109 | 26 | 77 | 76.147 | 28.819 | 92.812 |
| details-movie-v2 | 702 | 153 | 503 | 78.205 | 140.503 | 196.934 |
| related-cards | 295 | 145 | 150 | 50.847 | 88.218 | 459.412 |
| person-profile-v2 | 865 | 198 | 662 | 77.11 | 83.305 | 254.583 |
| person-fingerprint-baseline | 667 | 667 | 0 | 0 | n/a | n/a |
| movie-collection | 33 | 17 | 16 | 48.485 | 26.667 | 60 |
| share-list-view-v1 | 53 | 46 | 0 | 13.208 | 35 | 91.25 |
| share-list-availability-v1 | 27 | 27 | 0 | 0 | n/a | n/a |
| streaming-providers | 838 | 838 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 6 | 0.022 | 32.996 |
| grpc /qdrant.Points/Get 0 | 600 | 2.156 | 10.05 |
| grpc /qdrant.Points/Recommend 0 | 598 | 2.149 | 35.13 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 4236.233 req/s, of which 2166.19 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | 833a2e53 | 2125.56 | 0 | 75.843 | 100.826 | 6 | 192.468 | 2323.227 |
| 10.0.0.20 | 833a2e53 | 2110.241 | 0 | 76.556 | 101.691 | 6 | 99.538 | 2732.094 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| 10.0.0.21 | /show/:showKey | 843 | 0 | 0 | 109 | 0 |
| 10.0.0.21 | /movie/:movieKey | 10998 | 0 | 0 | 702 | 0 |
| 10.0.0.21 | /person/:personKey | 905 | 0 | 0 | 867 | 0 |
| 10.0.0.21 | /discover/:type? | 1244 | 0 | 0 | 55 | 0 |
| 10.0.0.21 | / | 847 | 0 | 0 | 0 | 0 |
| 10.0.0.21 | /tv/:showKey | 0 | 0 | 0 | 3 | 0 |
| 10.0.0.21 | /u/:handle/lists/:id | 1576 | 45 | 0 | 0 | 0 |
| 10.0.0.20 | /show/:showKey | 905 | 0 | 0 | 116 | 0 |
| 10.0.0.20 | /person/:personKey | 869 | 0 | 0 | 456 | 0 |
| 10.0.0.20 | /movie/:movieKey | 10911 | 0 | 0 | 652 | 0 |
| 10.0.0.20 | /discover/:type? | 1209 | 0 | 0 | 38 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | / | 897 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 1486 | 43 | 0 | 0 | 0 |
