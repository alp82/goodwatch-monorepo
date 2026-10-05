# 20261005T034016Z-load-pv-hot-public-duo-a

Label: pv-hot-public-duo-a. Time: 2026-10-05T03:40:37.828Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 20 visitors/s for 30 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 55 visitors/s for 35 s, then 60 visitors/s for 35 s, then 65 visitors/s for 35 s, then 70 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<105

63127 requests; 790.195 req/s; 0% errors; p95 1506.781 ms; 114 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 5497 | 68.809 | 0 | 49.552 | 1666 | 4703.884 | 46.362 | 1664.727 | 4703.727 | 5338/0/0/0/0 |
| home | 4026 | 50.396 | 0 | 93.419 | 1499.382 | 4053.505 | 90.988 | 1496.169 | 4051.248 | 3929/0/0/0/0 |
| og_person | 26 | 0.325 | 0 | 75.063 | 340.46 | 1489.599 | 72.697 | 337.248 | 1485.71 | 26/0/0/0/0 |
| og_share_list | 14 | 0.175 | 0 | 49.427 | 1560.321 | 1980.085 | 38.026 | 1456.418 | 1957.586 | 14/0/0/0/0 |
| og_title | 73 | 0.914 | 0 | 135.067 | 1519.087 | 5263.115 | 113.622 | 1513.614 | 5259.21 | 73/0/0/0/0 |
| person | 2273 | 28.452 | 0 | 30.067 | 1887.667 | 3695.583 | 26.269 | 1886.961 | 3693.139 | 2228/0/0/0/0 |
| share_list | 3971 | 49.707 | 0 | 45.014 | 1319.048 | 4492.325 | 41.991 | 1315.412 | 4491.726 | 3959/0/0/0/0 |
| title_movie | 43391 | 543.149 | 0 | 42.538 | 1477.33 | 3666.424 | 39.801 | 1471.119 | 3666.049 | 42266/0/0/0/0 |
| title_show | 3856 | 48.268 | 0 | 44.524 | 1574.522 | 2930.714 | 40.781 | 1568.328 | 2924.085 | 3766/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 19756 | 658.533 | 0 | 16.346 | 392.917 | 1210.224 | 14.433 | 391.933 |
| s02 | 30 | 33727 | 963.629 | 0 | 49.626 | 1912.926 | 5307.227 | 46.248 | 1909.286 |
| s03 | 40 | 9644 | 647.776 | 0 | 387.357 | 1888.869 | 1940.754 | 384.504 | 1888.327 |
| s04 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s05 | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s06 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s07 | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s08 | 70 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

1847 visitors; 1662 complete page views; 0% failed page views; page view p95 3508.5 ms; 3689 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 19.967 | 17.967 | 0 | 10.041 | 330.31 | 81 | 989.3 | 658.533 | 0 | 37.933 | 23.979 | 37.058 |
| s02 | 30 | 28.571 | 25.571 | 0 | 93.476 | 2249.269 | 367 | 4600.1 | 963.629 | 0 | 55.143 | 24.19 | 44.258 |
| s03 | 40 | 16.658 | 15.314 | 0 | 419.747 | 1680.295 | 1339 | 2537.9 | 647.776 | 0 | 41.712 | 25.053 | 67.653 |
| s04 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s05 | 55 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s06 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s07 | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| s08 | 70 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 20 | 73.295 | 384.753 | 148.563 | 586.601 | 66.037 | 57.139 | 9.667 | 369.022 | 64.959 | 72.361 | 179.194 | 93.859 | 53.778 | 59.575 | 0.36 | 0.224 | 27.753 | 34.629 | 2.939 | 84.308 |
| s02 | 30 | 92.034 | 444.064 | 181.42 | 1227.805 | 92.21 | 93.701 | 124.361 | 583.98 | 80.234 | 82.863 | 271.811 | 150.916 | 57.435 | 62.888 | 0.327 | 0.25 | 41.39 | 47.214 | 4.592 | 130.907 |
| s03 | 40 | 105.895 | 386.171 | 147.461 | 461.821 | 94.18 | 99.391 | 522.817 | 565.63 | 80.596 | 84.399 | 240.44 | 127.675 | 77.899 | 79.741 | 0.371 | 0.276 | 34.989 | 44.812 | 3.875 | 100.759 |
| s04 | 50 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s05 | 55 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s06 | 60 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s07 | 65 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| s08 | 70 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 16 | 71.359 | 84.399 | 4.117 | 5.88 | 41.445 | 117.798 | 217.508 | 312.457 | 10 |
| gw-vector1 | target | 16 | 16 | 57.56 | 76.057 | 11.219 | 11.92 | 53.693 | 0.229 | 0.347 | 0.542 | 9 |
| gw-cache1 | data | 8 | 16 | 5.936 | 16.572 | 0.341 | 0.48 | 32.078 | 0.434 | 3.728 | 5.822 | 9 |
| gw-cache2 | data | 8 | 17 | 5.822 | 18.903 | 0.319 | 0.59 | 31.769 | 0.44 | 0.547 | 0.769 | 8 |
| gw-cache3 | data | 8 | 17 | 3.01 | 9.916 | 0.287 | 0.37 | 31.619 | 0.472 | 0.41 | 1.09 | 10 |
| gw-worker3 | generator | 4 | 16 | 34.171 | 47.214 | 1.108 | 1.81 | 21.036 | 103.114 | 3.635 | 5.222 | 141 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 116.759 | 199.77 | 3029.568 | 3112.96 |
| abusive | coolify-proxy | 384.191 | 465.67 | 406.381 | 620.1 |
| gw-vector1 | gk4owk8-011237769659 | 83.502 | 117.53 | 2274.496 | 2298.88 |
| gw-vector1 | coolify-proxy | 72.197 | 117.48 | 135.956 | 245.8 |
| gw-vector1 | qdrant-main | 696.446 | 923.8 | 6402.048 | 6425.6 |

## Webapp process

From the webapp's own counters over 83.793 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 797.576 req/s in total: 763.385 from the benchmark and 34.192 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 5.333 on average, 12 at most. Event loop delay: 1227.805 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 82.56 | 98.839 |
| webapp V8Worker | 38.371 | 64.948 |
| webapp libuv-worker | 2.884 | 4.085 |
| proxy | 406.868 | 495.875 |

The proxy accepted 162.931 connections per second on average, 205.924 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 61945 | 739.266 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 1426 | 17.018 | 28.843 | 703.261 | 2326.25 | 28.721 | 566 | 92.426 |
| /person/:personKey | 314 | 3.747 | 90.698 | 2056.25 | 4411.25 | 26.947 | 111.848 | 72.293 |
| /u/:handle/lists/:id | 205 | 2.447 | 25.123 | 47.733 | 49.743 | 25 | 47.5 | 100 |
| /discover/:type? | 131 | 1.563 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /show/:showKey | 120 | 1.432 | 31.579 | 1200 | 3200 | 31.25 | 700 | 83.333 |
| / | 109 | 1.301 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/living-room/picks | 104 | 1.241 | 666.667 | 1752.941 | 1997.647 | n/a | n/a | 0 |
| /og/:first/:second | 92 | 1.098 | 27.381 | 135 | 316 | n/a | n/a | 98.913 |
| /og/lists/:id/:file | 17 | 0.203 | 30.357 | 257.5 | 291.5 | n/a | n/a | 100 |
| /api/poster-impressions | 3 | 0.036 | 62.5 | 96.25 | 99.25 | n/a | n/a | 100 |
| /api/e | 1 | 0.012 | 150 | 285 | 297 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 28 | 6 | 21 | 78.571 | 188.889 | 950 |
| episode-grid | 28 | 5 | 23 | 82.143 | 35.938 | 285 |
| related-cards | 94 | 37 | 57 | 60.638 | 333.333 | 3600 |
| details-movie-v2 | 208 | 44 | 157 | 78.846 | 175.641 | 931.25 |
| person-profile-v2 | 215 | 60 | 155 | 72.093 | 98.077 | 1442.857 |
| person-fingerprint-baseline | 155 | 155 | 0 | 0 | n/a | n/a |
| movie-collection | 20 | 11 | 9 | 45 | 58.333 | 177.5 |
| share-list-view-v1 | 15 | 9 | 0 | 40 | 100 | 460 |
| share-list-availability-v1 | 9 | 9 | 0 | 0 | n/a | n/a |
| streaming-providers | 104 | 104 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 2 | 0.024 | 19.932 |
| grpc /qdrant.Points/Recommend 0 | 192 | 2.291 | 84.115 |
| grpc /qdrant.Points/Get 0 | 196 | 2.339 | 49.267 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 1638.259 req/s, of which 874.874 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 797.576 | 0 | 82.56 | 98.839 | 12 | 1227.805 | 3046.723 |
| 10.0.0.20 | 3a45fcfd | 832.443 | 0 | 79.949 | 107.836 | 14 | 583.98 | 2373.48 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 93 | 0 | 0 | 28 | 0 |
| resolve address | /movie/:movieKey | 1222 | 0 | 0 | 208 | 0 |
| resolve address | /person/:personKey | 97 | 0 | 0 | 218 | 0 |
| resolve address | /u/:handle/lists/:id | 182 | 21 | 0 | 2 | 0 |
| resolve address | / | 109 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| resolve address | /discover/:type? | 131 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /person/:personKey | 90 | 0 | 0 | 171 | 0 |
| 10.0.0.20 | /movie/:movieKey | 1310 | 0 | 0 | 195 | 0 |
| 10.0.0.20 | /show/:showKey | 100 | 0 | 0 | 32 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 167 | 11 | 0 | 2 | 0 |
| 10.0.0.20 | / | 107 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /discover/:type? | 144 | 0 | 0 | 0 | 0 |
