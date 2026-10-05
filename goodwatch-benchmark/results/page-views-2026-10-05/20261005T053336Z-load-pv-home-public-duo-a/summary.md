# 20261005T053336Z-load-pv-home-public-duo-a

Label: pv-home-public-duo-a. Time: 2026-10-05T05:33:57.791Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 833a2e5363de517bd1f6fd4617a364e50fca32c3 (dirty).

Rate plan: 2 visitors/s for 20 s, then 5 visitors/s for 25 s, then 10 visitors/s for 25 s, then 20 visitors/s for 25 s, then 30 visitors/s for 25 s, then 40 visitors/s for 25 s, then 50 visitors/s for 25 s, then 60 visitors/s for 25 s.

**Aborted:** dropped_iterations: count<60

118661 requests; 770.248 req/s; 0.001% errors; p95 192.696 ms; 61 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home | 118661 | 770.248 | 0.001 | 24.276 | 192.696 | 673.113 | 21.932 | 184.353 | 658.007 | 116654/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 1599 | 79.95 | 0 | 12.527 | 34.067 | 42.656 | 10.722 | 30.286 |
| s02 | 5 | 4838 | 193.52 | 0 | 12.788 | 31.329 | 63.644 | 10.694 | 28.893 |
| s03 | 10 | 9717 | 388.68 | 0 | 12.319 | 42.566 | 98.02 | 10.463 | 39.406 |
| s04 | 20 | 19475 | 779 | 0 | 12.255 | 39.53 | 61.708 | 10.35 | 37.774 |
| s05 | 30 | 29725 | 1189 | 0 | 17.616 | 54.846 | 93.14 | 15.564 | 51.124 |
| s06 | 40 | 39544 | 1581.76 | 0 | 52.289 | 189.524 | 3271.366 | 48.559 | 179.666 |
| s07 | 50 | 13763 | 1519.824 | 0.007 | 102.717 | 494.113 | 822.002 | 97.277 | 476.842 |
| s08 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

2841 visitors; 2841 complete page views; 0% failed page views; page view p95 945 ms; 5855 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 1.95 | 1.95 | 0 | 4.576 | 18.406 | 75 | 108.4 | 79.95 | 0 | 3.9 | 23.478 | 36.988 |
| s02 | 5 | 4.72 | 4.72 | 0 | 4.774 | 16.531 | 75.5 | 119.75 | 193.52 | 0 | 9.44 | 25.965 | 37.271 |
| s03 | 10 | 9.48 | 9.48 | 0 | 4.699 | 32.516 | 76 | 153.2 | 388.68 | 0 | 18.96 | 24.245 | 34.725 |
| s04 | 20 | 19 | 19 | 0 | 6.161 | 29.705 | 76 | 160.3 | 779 | 0 | 38 | 23.105 | 33.207 |
| s05 | 30 | 29 | 29 | 0 | 9.823 | 45.799 | 97 | 246.8 | 1189 | 0 | 58 | 24.127 | 36.871 |
| s06 | 40 | 38 | 38 | 0 | 46.765 | 147.001 | 286.5 | 2118.6 | 1581.76 | 0 | 77.64 | 24.476 | 55.328 |
| s07 | 50 | 32.797 | 32.797 | 0 | 104.631 | 510.149 | 529 | 1712.8 | 1519.824 | 0.007 | 80.171 | 26.537 | 78.942 |
| s08 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 2 | 30.56 | 197.055 | 84.868 | 40.85 | 34.073 | 17.233 | 2.621 | 50.124 | 35.46 | 36.996 | 32.202 | 18.664 | 12.46 | 12.773 | 0.192 | 0.099 | 5.628 | 9.178 | 0.425 | 11.198 |
| s02 | 5 | 35.268 | 244.101 | 97.086 | 34.755 | 46.505 | 31.616 | 0.197 | 86.824 | 44.71 | 48.849 | 70.915 | 43.95 | 11.703 | 14.02 | 0.207 | 0.134 | 14.28 | 15.918 | 1.055 | 30.495 |
| s03 | 10 | 45.547 | 307.936 | 115.517 | 478.86 | 55.67 | 55.801 | 2.3 | 61.658 | 53.126 | 56.041 | 133.494 | 85.419 | 14.03 | 16.145 | 0.234 | 0.145 | 18.043 | 20.392 | 2.014 | 61.744 |
| s04 | 20 | 61.35 | 415.298 | 158.839 | 42.62 | 71.099 | 86.987 | 0.263 | 92.263 | 66.855 | 71.483 | 258.774 | 162.363 | 16.878 | 19.69 | 0.303 | 0.201 | 34.394 | 36.368 | 3.907 | 123.239 |
| s05 | 30 | 71.507 | 494.751 | 195.475 | 75.158 | 87.681 | 128.891 | 1.948 | 56.743 | 78.909 | 79.743 | 386.772 | 244.1 | 22.038 | 24.549 | 0.331 | 0.247 | 40.028 | 41.693 | 5.76 | 186.152 |
| s06 | 40 | 88.171 | 564.077 | 238.946 | 145.151 | 99.955 | 164.266 | 43.642 | 128.636 | 90.798 | 92.449 | 487.795 | 303.558 | 24.482 | 26.887 | 0.442 | 0.321 | 49.124 | 50.286 | 7.202 | 235.49 |
| s07 | 50 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 94.109 | 94.109 | 514.972 | 294.817 | 36.496 | 36.496 | 0.435 | 0.361 | 52.555 | 52.555 | 7.844 | 249.853 |
| s08 | 60 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 31 | 62.885 | 94.109 | 4.302 | 6.89 | 35.338 | 151.326 | 242.056 | 524.443 | 9 |
| gw-vector1 | target | 16 | 31 | 17.719 | 36.496 | 2.22 | 3.15 | 49.309 | 0.199 | 0.298 | 0.603 | 8 |
| gw-cache1 | data | 8 | 31 | 5.008 | 18.899 | 0.485 | 0.92 | 31.028 | 0.973 | 50.288 | 107.129 | 7 |
| gw-cache2 | data | 8 | 31 | 4.229 | 18.93 | 0.369 | 0.61 | 30.699 | 0.702 | 1.364 | 2.795 | 7 |
| gw-cache3 | data | 8 | 31 | 5.185 | 20.308 | 0.366 | 0.59 | 30.625 | 0.834 | 1.253 | 2.561 | 8 |
| gw-worker3 | generator | 4 | 31 | 28.016 | 52.555 | 0.809 | 1.2 | 20.085 | 113.369 | 3.565 | 7.844 | 121 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-052303740133 | 70.419 | 169.63 | 2279.754 | 2306.048 |
| abusive | coolify-proxy | 385.944 | 622.12 | 303.716 | 584.4 |
| gw-vector1 | gk4owk8-052500856273 | 84.716 | 174.26 | 2275.923 | 2297.856 |
| gw-vector1 | coolify-proxy | 90.695 | 238.97 | 154.413 | 499.6 |
| gw-vector1 | qdrant-main | 37.905 | 118.72 | 3905.074 | 3915.776 |

## Webapp process

From the webapp's own counters over 157.615 s, commit 833a2e53. The times exclude the proxy, TLS, and the network.

Finished 821.612 req/s in total: 753.623 from the benchmark and 67.989 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 2.065 on average, 14 at most. Event loop delay: 478.86 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 58.576 | 101.225 |
| webapp libuv-worker | 7.377 | 12.293 |
| webapp V8Worker | 4.259 | 18.822 |
| proxy | 391.015 | 618.771 |

The proxy accepted 156.257 connections per second on average, 262.318 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 117487 | 745.407 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| / | 3016 | 19.135 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/living-room/picks | 2999 | 19.027 | 41.06 | 243.481 | 294.097 | n/a | n/a | 99.466 |
| /movie/:movieKey | 433 | 2.747 | 150.694 | 587 | 933.4 | 139.375 | 385.417 | 86.143 |
| /person/:personKey | 283 | 1.796 | 106.25 | 692.391 | 938.478 | 26.046 | 49.488 | 87.986 |
| /show/:showKey | 118 | 0.749 | 161.111 | 672.222 | 934.444 | 142.857 | 391.111 | 85.593 |
| /api/e | 2 | 0.013 | 500 | 4700 | 4940 | n/a | n/a | 0 |
| /api/poster-impressions | 1 | 0.006 | 50 | 95 | 99 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 119 | 25 | 88 | 78.992 | 138.06 | 211.667 |
| episode-grid | 119 | 23 | 88 | 80.672 | 26.389 | 56.25 |
| details-movie-v2 | 434 | 95 | 316 | 78.111 | 139.734 | 197.738 |
| related-cards | 216 | 99 | 117 | 54.167 | 81.329 | 582.143 |
| person-profile-v2 | 283 | 84 | 196 | 70.318 | 92.378 | 386.429 |
| person-fingerprint-baseline | 199 | 199 | 0 | 0 | n/a | n/a |
| movie-collection | 30 | 14 | 16 | 53.333 | 26.667 | 60 |
| streaming-providers | 3011 | 3011 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 498 | 3.16 | 16.196 |
| grpc /qdrant.Points/Recommend 0 | 494 | 3.134 | 40.094 |
| grpc /qdrant.Points/UpdateBatch 0 | 3 | 0.019 | 40.905 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 1638.453 req/s, of which 884.83 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 833a2e53 | 821.612 | 0 | 58.576 | 101.225 | 14 | 478.86 | 2315.313 |
| 10.0.0.20 | 833a2e53 | 812.759 | 0 | 66.673 | 103.01 | 30 | 265.999 | 2315.316 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 0 | 0 | 0 | 119 | 0 |
| resolve address | /movie/:movieKey | 0 | 0 | 0 | 434 | 0 |
| resolve address | /person/:personKey | 0 | 0 | 0 | 283 | 0 |
| resolve address | /discover/:type? | 0 | 0 | 0 | 24 | 0 |
| resolve address | / | 3016 | 0 | 0 | 0 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 135 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 471 | 0 |
| 10.0.0.20 | /movie/:movieKey | 1 | 0 | 0 | 470 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 28 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| 10.0.0.20 | / | 3039 | 0 | 0 | 0 | 0 |
