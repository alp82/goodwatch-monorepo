# 20261009T113415Z-load-sh-movie-document-a

Label: sh-movie-document-a. Time: 2026-10-09T11:34:47.947Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: movie-document. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34 (dirty).

Rate plan: 25 visitors/s for 25 s, then 50 visitors/s for 30 s, then 75 visitors/s for 30 s, then 100 visitors/s for 30 s, then 125 visitors/s for 30 s, then 150 visitors/s for 30 s, then 175 visitors/s for 30 s, then 200 visitors/s for 30 s, then 225 visitors/s for 30 s, then 250 visitors/s for 30 s.

40556 requests; 137.445 req/s; 0% errors; p95 31.713 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 40556 | 137.445 | 0 | 5.83 | 31.713 | 86.554 | 4.232 | 28.975 | 84.105 | 40556/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 25 | 624 | 24.96 | 0 | 5.207 | 25.401 | 48.068 | 4.1 | 24.041 |
| s02 | 50 | 1438 | 47.933 | 0 | 5.285 | 25.834 | 63.706 | 4.095 | 24.363 |
| s03 | 75 | 2187 | 72.9 | 0 | 5.387 | 25.012 | 43.395 | 4.102 | 23.342 |
| s04 | 100 | 2937 | 97.9 | 0 | 5.58 | 25.148 | 50.283 | 4.059 | 23.139 |
| s05 | 125 | 3687 | 122.9 | 0 | 5.606 | 23.096 | 42.697 | 4.107 | 21.896 |
| s06 | 150 | 4438 | 147.933 | 0 | 5.578 | 25.266 | 50.821 | 4.162 | 22.686 |
| s07 | 175 | 5187 | 172.9 | 0 | 5.963 | 54.075 | 127.647 | 4.333 | 51.766 |
| s08 | 200 | 5938 | 197.933 | 0 | 5.306 | 19.944 | 35.467 | 3.823 | 18.101 |
| s09 | 225 | 6687 | 222.9 | 0 | 7.278 | 60.725 | 1639.806 | 5.317 | 58.061 |
| s10 | 250 | 7433 | 247.767 | 0 | 6.379 | 26.811 | 48.179 | 4.399 | 22.354 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

40556 visitors; 0 complete page views; 0% failed page views; page view p95 0 ms; 40556 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 25 | 24.96 | 0 | 0 | 5.207 | 25.401 | 0 | 0 | 24.96 | 0 | 24.96 | 11.221 | 18.721 |
| s02 | 50 | 47.933 | 0 | 0 | 5.285 | 25.834 | 0 | 0 | 47.933 | 0 | 47.933 | 10.999 | 18.78 |
| s03 | 75 | 72.9 | 0 | 0 | 5.387 | 25.012 | 0 | 0 | 72.9 | 0 | 72.9 | 10.832 | 18.34 |
| s04 | 100 | 97.9 | 0 | 0 | 5.58 | 25.148 | 0 | 0 | 97.9 | 0 | 97.9 | 10.888 | 18.935 |
| s05 | 125 | 122.9 | 0 | 0 | 5.606 | 23.096 | 0 | 0 | 122.9 | 0 | 122.9 | 11.06 | 20.097 |
| s06 | 150 | 147.933 | 0 | 0 | 5.578 | 25.266 | 0 | 0 | 147.933 | 0 | 147.933 | 11.118 | 20.434 |
| s07 | 175 | 172.9 | 0 | 0 | 5.963 | 54.075 | 0 | 0 | 172.9 | 0 | 172.9 | 11.015 | 19.711 |
| s08 | 200 | 197.933 | 0 | 0 | 5.306 | 19.944 | 0 | 0 | 197.933 | 0 | 197.933 | 10.741 | 19.262 |
| s09 | 225 | 222.9 | 0 | 0 | 7.278 | 60.725 | 0 | 0 | 222.9 | 0 | 222.9 | 10.687 | 18.945 |
| s10 | 250 | 247.767 | 0 | 0 | 6.379 | 26.811 | 0 | 0 | 247.767 | 0 | 247.767 | 10.655 | 19.769 |

### By host

Files: page. Pages name the site's host.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 40556 | 137.445 | 0 | 5.83 | 31.713 | 4.232 | 28.975 | 40556 | 1 | 0 | 1 |
| Static hostname | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0 | 0 | n/a |

Site share of site and static traffic: 100% of requests and 0% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 25 | 39.862 | 53.083 | 74.97 | 41.702 | 34.624 | 9.984 | 0.689 | 43.963 | 21.96 | 28.343 | 30.504 | 19.068 | 12.599 | 16.545 | 0.176 | 0.643 | 14.727 | 24.086 | 0.69 | 8.768 |
| s02 | 50 | 33.055 | 82.613 | 124.985 | 43.406 | 41.348 | 15.063 | 0.246 | 51.696 | 28.058 | 30.098 | 53.163 | 30.751 | 13.318 | 14.871 | 0.14 | 0.711 | 25.524 | 32.279 | 1.535 | 20.676 |
| s03 | 75 | 31.941 | 105.445 | 175.278 | 35.575 | 39.969 | 19.665 | 0.246 | 53.925 | 28.911 | 31.658 | 74.153 | 41.905 | 13.154 | 15.586 | 0.147 | 2.203 | 32.203 | 37.169 | 2.268 | 31.538 |
| s04 | 100 | 33.831 | 129.576 | 222.846 | 81.384 | 40.409 | 22.153 | 0.247 | 73.848 | 34.033 | 37.899 | 95.896 | 52.454 | 23.892 | 25.436 | 2.904 | 11.975 | 38.68 | 45.13 | 3.019 | 42.356 |
| s05 | 125 | 39.318 | 151.244 | 278.829 | 48.289 | 46.073 | 26.888 | 0.442 | 56.087 | 35.845 | 40.138 | 117.716 | 64.857 | 24.491 | 26.007 | 1.673 | 11.974 | 47.924 | 55.193 | 3.663 | 51.518 |
| s06 | 150 | 41.11 | 171.686 | 324.394 | 105.501 | 43.14 | 32.072 | 0.344 | 45.372 | 40.707 | 43.509 | 139.281 | 74.752 | 14.419 | 15.236 | 0.242 | 0.653 | 55.832 | 60.856 | 4.531 | 64.099 |
| s07 | 175 | 47.845 | 188.212 | 382.411 | 108.451 | 62.737 | 35.43 | 2.594 | 127.849 | 42.044 | 47.368 | 157.301 | 86.395 | 15.82 | 21.535 | 0.212 | 0.605 | 62.623 | 69.122 | 5.276 | 74.9 |
| s08 | 200 | 37.124 | 198.757 | 421.85 | 40.457 | 41.271 | 37.925 | 0.262 | 64.804 | 44.128 | 46.031 | 182.012 | 97.671 | 13.717 | 15.005 | 0.206 | 0.377 | 66.648 | 69.397 | 5.992 | 85.614 |
| s09 | 225 | 52.711 | 216.94 | 486.344 | 106.091 | 72.538 | 46.21 | 8.366 | 201.25 | 48.582 | 56.885 | 207.837 | 115.405 | 18.3 | 27.83 | 0.221 | 0.491 | 70.52 | 76.095 | 6.513 | 93.169 |
| s10 | 250 | 39.337 | 215.292 | 474.077 | 28.103 | 67.995 | 45.79 | 0.246 | 87.086 | 46.877 | 52.284 | 207.47 | 111.489 | 16.13 | 19.321 | 0.224 | 0.681 | 76.816 | 79.92 | 7.724 | 107.616 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 59 | 37.079 | 56.885 | 3.458 | 5.7 | 40.265 | 69.452 | 126.905 | 227.087 | 10 |
| gw-vector1 | target | 16 | 59 | 16.471 | 27.83 | 2.811 | 4.03 | 53.101 | 2.823 | 0.575 | 4.711 | 6 |
| gw-worker3 | generator | 4 | 59 | 48.541 | 79.92 | 1.372 | 3.07 | 20.98 | 57.47 | 4.079 | 8.743 | 26 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-20261009T105601 | 86.532 | 262.81 | 3112.214 | 3138.56 |
| abusive | coolify-proxy | 158.285 | 251.96 | 240.093 | 312.1 |
| gw-vector1 | gk4owk8-20261009T105807 | 116.321 | 362.07 | 3185.751 | 3237.888 |
| gw-vector1 | coolify-proxy | 29.525 | 50.44 | 143.437 | 187 |

## Webapp process

From the webapp's own counters over 300.429 s, commit 42c2db2e. The times exclude the proxy, TLS, and the network.

Finished 151.134 req/s in total: 135.003 from the benchmark and 16.13 of background traffic, of which 2.819 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.407 on average, 19 at most. Event loop delay: 108.451 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 38.402 | 71.352 |
| webapp libuv-worker | 4.603 | 14.238 |
| webapp V8Worker | 3.971 | 38.376 |
| proxy | 154.128 | 238.596 |

The proxy accepted 300.179 connections per second on average, 527.362 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /movie/:movieKey | 41292 | 137.443 | 25.367 | 48.197 | 121.976 | 25.337 | 48.141 | 99.954 |
| /person/:personKey | 1820 | 6.058 | 53.255 | 214.286 | 498.919 | 36.961 | 158.838 | 96.978 |
| /og/:first/:second | 462 | 1.538 | 207.527 | 743.023 | 957.907 | n/a | n/a | 68.615 |
| /show/:showKey | 94 | 0.313 | 134.043 | 286.923 | 765 | 121.154 | 244 | 96.809 |
| /sign-up | 76 | 0.253 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 44 | 0.146 | 33.333 | 94 | 156 | 26.19 | 49.762 | 100 |
| static | 10 | 0.033 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| / | 8 | 0.027 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-in | 7 | 0.023 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /og/lists/:id/:file | 1 | 0.003 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/living-room/picks | 1 | 0.003 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /api/poster-impressions | 1 | 0.003 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 1896 | 1181 | 701 | 37.711 | 61.877 | 155.804 |
| person-fingerprint-baseline | 715 | 715 | 0 | 0 | n/a | n/a |
| details-movie-v2 | 924 | 335 | 516 | 63.745 | 134.529 | 194.058 |
| details-missing-v1 | 663 | 0 | 663 | 100 | n/a | n/a |
| details-show-v2 | 105 | 31 | 62 | 70.476 | 131.481 | 193.148 |
| episode-grid | 96 | 22 | 72 | 77.083 | 26.056 | 49.507 |
| related-cards | 244 | 123 | 119 | 49.59 | 75.721 | 156.429 |
| movie-collection | 50 | 28 | 21 | 44 | 25 | 47.5 |
| share-list-view-v1 | 1 | 1 | 0 | 0 | n/a | n/a |
| streaming-providers | 1 | 1 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 514 | 1.711 | 4.975 |
| grpc /qdrant.Points/Recommend 0 | 514 | 1.711 | 28.856 |
| grpc /qdrant.Points/UpdateBatch 0 | 8 | 0.027 | 33.321 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 304.175 req/s, of which 169.171 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 42c2db2e | 151.134 | 0 | 38.402 | 71.352 | 19 | 108.451 | 2524.344 |
| 10.0.0.20 | 42c2db2e | 152.592 | 0 | 47.543 | 92.43 | 15 | 226.153 | 2559.305 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /person/:personKey | 69 | 17 | 0 | 1734 | 0 |
| resolve address | /movie/:movieKey | 40575 | 0 | 0 | 720 | 0 |
| resolve address | /show/:showKey | 0 | 0 | 0 | 96 | 0 |
| resolve address | /sign-up | 75 | 1 | 0 | 0 | 0 |
| resolve address | /discover/:type? | 2 | 0 | 0 | 89 | 0 |
| resolve address | / | 8 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 3 | 0 |
| resolve address | /sign-in | 7 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 7 | 0 |
| 10.0.0.20 | /person/:personKey | 76 | 12 | 0 | 2277 | 0 |
| 10.0.0.20 | /movie/:movieKey | 40505 | 0 | 0 | 809 | 0 |
| 10.0.0.20 | /discover/:type? | 1 | 0 | 0 | 82 | 0 |
| 10.0.0.20 | /show/:showKey | 1 | 0 | 0 | 93 | 0 |
| 10.0.0.20 | /sign-up | 80 | 1 | 0 | 0 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /:type | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 5 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-in | 7 | 0 | 0 | 0 | 0 |
