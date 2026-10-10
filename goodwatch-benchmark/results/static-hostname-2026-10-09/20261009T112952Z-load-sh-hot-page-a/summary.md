# 20261009T112952Z-load-sh-hot-page-a

Label: sh-hot-page-a. Time: 2026-10-09T11:30:25.185Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34 (dirty).

Rate plan: 10 visitors/s for 30 s, then 20 visitors/s for 35 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s.

166452 requests; 967.584 req/s; 0.002% errors; p95 56.062 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 14220 | 82.661 | 0.007 | 39.58 | 77.95 | 106.812 | 32.426 | 71.296 | 102.736 | 14219/0/0/1/0 |
| home | 11386 | 66.187 | 0.009 | 33.026 | 56.858 | 80.557 | 26.667 | 50.954 | 73.098 | 11385/0/0/1/0 |
| og_person | 54 | 0.314 | 0 | 7.416 | 22.985 | 46.676 | 4.679 | 16.512 | 35.802 | 54/0/0/0/0 |
| og_share_list | 47 | 0.273 | 0 | 8.514 | 18.808 | 31.342 | 6.046 | 16.806 | 28.629 | 47/0/0/0/0 |
| og_title | 194 | 1.128 | 0 | 7.526 | 27.802 | 56.757 | 4.637 | 23.872 | 53.451 | 194/0/0/0/0 |
| person | 6790 | 39.47 | 0 | 29.099 | 50.954 | 66.248 | 25.234 | 46.058 | 62.69 | 6790/0/0/0/0 |
| share_list | 10028 | 58.293 | 0 | 28.436 | 52.429 | 79.097 | 24.22 | 49.455 | 78.602 | 10028/0/0/0/0 |
| title_movie | 113980 | 662.565 | 0.001 | 28.478 | 51.639 | 71.416 | 24.188 | 47.694 | 67.492 | 113947/0/0/1/0 |
| title_show | 9753 | 56.694 | 0 | 35.818 | 61.285 | 82.01 | 28.305 | 54.365 | 79.615 | 9753/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9739 | 324.633 | 0 | 29.803 | 57.754 | 74.938 | 26.071 | 54.216 |
| s02 | 20 | 22403 | 640.086 | 0.009 | 29.805 | 56.577 | 80.766 | 25.941 | 52.503 |
| s03 | 30 | 33024 | 943.543 | 0 | 29.158 | 54.568 | 78.061 | 25.078 | 49.865 |
| s04 | 40 | 45088 | 1288.229 | 0.002 | 29.996 | 55.607 | 81.621 | 25.229 | 50.334 |
| s05 | 50 | 56198 | 1605.657 | 0 | 29.988 | 56.63 | 80.484 | 25.017 | 49.792 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

5094 visitors; 4589 complete page views; 0.065% failed page views; page view p95 176 ms; 17996 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9.967 | 8.967 | 0 | 4.913 | 16.63 | 123 | 193 | 324.633 | 0 | 35.167 | 20.622 | 33.013 |
| s02 | 20 | 19.286 | 17.857 | 0.319 | 4.912 | 20.15 | 117 | 170.7 | 640.086 | 0.009 | 68.657 | 18.51 | 30.409 |
| s03 | 30 | 29.286 | 26 | 0 | 5.12 | 27.708 | 118 | 176 | 943.543 | 0 | 103 | 18.405 | 29.929 |
| s04 | 40 | 39.286 | 35.571 | 0.08 | 5.191 | 23.492 | 113 | 184.75 | 1288.229 | 0.002 | 138.943 | 17.398 | 28.277 |
| s05 | 50 | 49.143 | 44 | 0 | 5.449 | 24.069 | 113 | 167.05 | 1605.657 | 0 | 173.429 | 16.94 | 27.14 |

### By host

Files: page. Pages name the static hostname. Static hostname: static.goodwatch.app.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 10376 | 60.316 | 0 | 4.806 | 25.001 | 3.988 | 23.753 | 5098 | 2.03 | 41 | 1 |
| Static hostname | 156076 | 907.269 | 0.002 | 30.691 | 56.666 | 26 | 51.272 | 12898 | 30.58 | 467 | 2.53 |
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

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 30.373 | 40.629 | 44.906 | 44.717 | 31.813 | 7.529 | 0.434 | 46.191 | 25.802 | 31.143 | 18.317 | 20.043 | 11.411 | 14.725 | 0.164 | 0.543 | 24.942 | 28.652 | 1.752 | 42.892 |
| s02 | 20 | 30.375 | 58.136 | 64.155 | 39.867 | 33.29 | 11.569 | 0.512 | 55.301 | 28.991 | 34.303 | 28.147 | 29.491 | 12.102 | 18.847 | 0.247 | 0.801 | 38.687 | 42.1 | 3.678 | 89.825 |
| s03 | 30 | 35.217 | 75.183 | 84.798 | 45.077 | 44.222 | 16.027 | 0.669 | 124.048 | 27.37 | 31.042 | 46.967 | 24.35 | 13.046 | 18.052 | 0.211 | 0.812 | 56.887 | 63.553 | 5.25 | 129.688 |
| s04 | 40 | 31.99 | 89.507 | 99.933 | 282.252 | 29.93 | 16.983 | 0.246 | 49.861 | 28.525 | 32.393 | 44.757 | 28.398 | 16.465 | 29.277 | 0.226 | 0.572 | 67.141 | 76.055 | 7.793 | 179.471 |
| s05 | 50 | 41.072 | 95.769 | 114.978 | 114.742 | 43.702 | 20.769 | 0.511 | 107.336 | 33.071 | 35.622 | 51.956 | 33.652 | 16.064 | 22.941 | 0.221 | 0.859 | 72.721 | 73.596 | 8.924 | 225.249 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 34 | 29.107 | 35.622 | 2.952 | 3.52 | 40.947 | 28.917 | 37.208 | 97.725 | 9 |
| gw-vector1 | target | 16 | 34 | 13.797 | 29.277 | 3.219 | 3.91 | 52.524 | 0.687 | 0.211 | 0.42 | 6 |
| gw-worker3 | generator | 4 | 35 | 50.261 | 76.055 | 1.531 | 2.51 | 18.078 | 127.988 | 5.249 | 10.709 | 21 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-20261009T105601 | 101.867 | 231.66 | 3134.253 | 3218.432 |
| abusive | coolify-proxy | 72.999 | 114.04 | 244.582 | 312.2 |
| gw-vector1 | gk4owk8-20261009T105807 | 104.656 | 299.21 | 3188.646 | 3264.512 |
| gw-vector1 | coolify-proxy | 15.704 | 31.36 | 178.159 | 282.7 |

## Webapp process

From the webapp's own counters over 178.611 s, commit 42c2db2e. The times exclude the proxy, TLS, and the network.

Finished 124.387 req/s in total: 935.053 from the benchmark and -810.666 of background traffic, of which 2.195 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.429 on average, 5 at most. Event loop delay: 282.252 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 35.301 | 52.322 |
| webapp V8Worker | 5.239 | 44.784 |
| webapp libuv-worker | 4.432 | 10.108 |
| proxy | 72.911 | 109.121 |

The proxy accepted 83.146 connections per second on average, 133.141 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 14233 | 79.687 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 3605 | 20.183 | 27.352 | 143.311 | 234.767 | 27.202 | 136.674 | 99.778 |
| /person/:personKey | 1260 | 7.054 | 42.112 | 158.73 | 198.73 | 33.874 | 124.583 | 99.762 |
| /og/:first/:second | 527 | 2.951 | 115.104 | 864.623 | 1841.25 | n/a | n/a | 75.712 |
| /u/:handle/lists/:id | 451 | 2.525 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 363 | 2.032 | 25.349 | 48.163 | 67.125 | 25.069 | 47.631 | 100 |
| /show/:showKey | 310 | 1.736 | 29.468 | 167.143 | 222.5 | 29.026 | 160.294 | 100 |
| / | 286 | 1.601 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/living-room/picks | 282 | 1.579 | 25.36 | 48.183 | 69.667 | n/a | n/a | 99.645 |
| /og/lists/:id/:file | 49 | 0.274 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /sign-up | 42 | 0.235 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-in | 1 | 0.006 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 1051 | 591 | 445 | 43.768 | 65.926 | 156.098 |
| person-fingerprint-baseline | 460 | 460 | 0 | 0 | n/a | n/a |
| details-movie-v2 | 478 | 152 | 283 | 68.201 | 141.603 | 197.595 |
| details-missing-v1 | 369 | 0 | 369 | 100 | n/a | n/a |
| details-show-v2 | 86 | 43 | 38 | 50 | 140.278 | 194.028 |
| episode-grid | 52 | 5 | 47 | 90.385 | 25.543 | 48.533 |
| related-cards | 73 | 31 | 42 | 57.534 | 69.697 | 98.333 |
| movie-collection | 21 | 10 | 10 | 52.381 | 25 | 47.5 |
| share-list-availability-v1 | 18 | 18 | 0 | 0 | n/a | n/a |
| share-list-view-v1 | 31 | 27 | 0 | 12.903 | 25 | 47.5 |
| streaming-providers | 282 | 282 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 309 | 1.73 | 2.374 |
| grpc /qdrant.Points/Recommend 0 | 192 | 1.075 | 26.197 |
| grpc /qdrant.Points/UpdateBatch 0 | 6 | 0.034 | 339.914 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 197.345 req/s, of which -737.708 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 42c2db2e | 124.387 | 0 | 35.301 | 52.322 | 5 | 282.252 | 2517.852 |
| 10.0.0.20 | 42c2db2e | 73.012 | 0 | 38.242 | 69.656 | 6 | 302.175 | 2553.465 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /person/:personKey | 293 | 2 | 0 | 964 | 0 |
| resolve address | /movie/:movieKey | 3231 | 0 | 0 | 375 | 0 |
| resolve address | /show/:showKey | 258 | 0 | 0 | 52 | 0 |
| resolve address | /sign-up | 42 | 0 | 0 | 0 | 0 |
| resolve address | /discover/:type? | 352 | 0 | 0 | 27 | 0 |
| resolve address | /u/:handle/lists/:id | 432 | 17 | 0 | 2 | 0 |
| resolve address | / | 285 | 1 | 0 | 0 | 0 |
| resolve address | /sign-in | 1 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /person/:personKey | 274 | 3 | 0 | 947 | 0 |
| 10.0.0.20 | /movie/:movieKey | 3197 | 0 | 0 | 403 | 0 |
| 10.0.0.20 | /discover/:type? | 375 | 1 | 0 | 54 | 0 |
| 10.0.0.20 | /show/:showKey | 254 | 0 | 0 | 76 | 0 |
| 10.0.0.20 | /sign-up | 39 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | / | 261 | 1 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-in | 3 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 455 | 17 | 0 | 0 | 0 |
