# 20261009T111803Z-load-sh-movie-page-2-a

Label: sh-movie-page-2-a. Time: 2026-10-09T11:18:35.347Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34 (dirty).

Rate plan: 10 visitors/s for 30 s, then 20 visitors/s for 35 s, then 30 visitors/s for 35 s, then 40 visitors/s for 35 s, then 50 visitors/s for 35 s, then 60 visitors/s for 35 s, then 75 visitors/s for 35 s.

360361 requests; 1497.716 req/s; 0% errors; p95 88.423 ms; 56 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie | 360361 | 1497.716 | 0 | 31.928 | 88.423 | 144.684 | 26.851 | 73.466 | 118.62 | 360235/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 11063 | 368.767 | 0 | 26.96 | 53.231 | 69.879 | 23.386 | 49.303 |
| s02 | 20 | 24975 | 713.571 | 0 | 28.096 | 51.211 | 74.589 | 23.986 | 46.831 |
| s03 | 30 | 37925 | 1083.571 | 0 | 28.415 | 52.061 | 77.04 | 24.371 | 48.531 |
| s04 | 40 | 50875 | 1453.571 | 0 | 28.853 | 52.799 | 72.718 | 24.301 | 48.701 |
| s05 | 50 | 63825 | 1823.571 | 0 | 29.513 | 52.225 | 72.907 | 24.358 | 46.925 |
| s06 | 60 | 76775 | 2193.571 | 0 | 31.112 | 58.989 | 80.314 | 25.475 | 50.627 |
| s07 | 75 | 94923 | 2712.086 | 0 | 49.089 | 132.864 | 193.22 | 38.86 | 109.897 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

9743 visitors; 9743 complete page views; 0% failed page views; page view p95 400 ms; 38943 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 9.967 | 9.967 | 0 | 5.456 | 23.099 | 116 | 171.4 | 368.767 | 0 | 39.867 | 19.582 | 31.6 |
| s02 | 20 | 19.286 | 19.286 | 0 | 5.381 | 20.501 | 114 | 161 | 713.571 | 0 | 77.143 | 18.357 | 29.278 |
| s03 | 30 | 29.286 | 29.286 | 0 | 5.556 | 19.739 | 113 | 176 | 1083.571 | 0 | 117.143 | 17.864 | 29.235 |
| s04 | 40 | 39.286 | 39.286 | 0 | 5.635 | 21.875 | 113 | 162 | 1453.571 | 0 | 157.143 | 17.4 | 28.627 |
| s05 | 50 | 49.286 | 49.286 | 0 | 7.113 | 31.574 | 115 | 175 | 1823.571 | 0 | 197.143 | 17.191 | 28.221 |
| s06 | 60 | 59.286 | 59.286 | 0 | 8.324 | 31.329 | 121 | 191 | 2193.571 | 0 | 237.143 | 17.274 | 31.77 |
| s07 | 75 | 73.4 | 73.4 | 0 | 29.399 | 98.441 | 234 | 555 | 2712.086 | 0 | 292.771 | 29.265 | 88.516 |

### By host

Files: page. Pages name the static hostname. Static hostname: static.goodwatch.app.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 19515 | 81.107 | 0 | 7.037 | 57.728 | 4.905 | 38.046 | 9762 | 2 | 51 | 1 |
| Static hostname | 340846 | 1416.609 | 0 | 32.642 | 89.952 | 27.556 | 74.723 | 29181 | 35 | 516 | 3 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 14 | 342 | n/a |

Site share of site and static traffic: 5.405% of requests and 9.026% of captured bytes.

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 10 | 35.166 | 43.719 | 48.907 | 32.363 | 42.547 | 9.131 | 0.708 | 126.801 | 21.273 | 28.427 | 18.219 | 12.783 | 11.614 | 15.586 | 0.186 | 0.597 | 25.596 | 30.289 | 2.134 | 49.436 |
| s02 | 20 | 33.44 | 61.649 | 64.898 | 47.371 | 33.506 | 11.261 | 0.316 | 57.005 | 24.379 | 27.706 | 27.127 | 17.372 | 10.878 | 11.699 | 0.188 | 0.619 | 45.143 | 52.131 | 4.141 | 98.908 |
| s03 | 30 | 36.289 | 75.473 | 82.731 | 33.805 | 33.347 | 15.748 | 0.63 | 104.453 | 25.353 | 27.293 | 35.383 | 20.42 | 13.172 | 16.244 | 0.206 | 0.68 | 58.907 | 62.41 | 5.885 | 141.37 |
| s04 | 40 | 33.13 | 91.822 | 102.68 | 36.558 | 37.649 | 16.045 | 0.434 | 98.882 | 26.614 | 29.744 | 43.618 | 24.155 | 16.784 | 30.83 | 0.2 | 0.597 | 69.809 | 71.943 | 8.012 | 194.885 |
| s05 | 50 | 39.243 | 105.691 | 124.421 | 30.364 | 42.953 | 19.147 | 0.276 | 75.551 | 31.373 | 42.218 | 55.618 | 31.979 | 14.665 | 18.278 | 0.241 | 0.86 | 80.109 | 84.123 | 9.895 | 244.444 |
| s06 | 60 | 47.006 | 120.251 | 143.952 | 44.586 | 37.149 | 21.217 | 0.237 | 54.842 | 33.56 | 37.968 | 64.267 | 36.052 | 13.974 | 18.13 | 0.215 | 0.825 | 88.658 | 90.235 | 11.372 | 286.27 |
| s07 | 75 | 54.286 | 95.277 | 106.316 | 46.716 | 35.197 | 16.34 | 0.247 | 49.468 | 34.264 | 40.821 | 51.258 | 28.347 | 12.713 | 20.41 | 0.218 | 0.709 | 98.552 | 99.652 | 14.176 | 366.532 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 48 | 28.152 | 42.218 | 2.51 | 3.53 | 39.103 | 24.519 | 42.297 | 69.168 | 10 |
| gw-vector1 | target | 16 | 48 | 13.54 | 30.83 | 2.135 | 2.85 | 51.09 | 0.698 | 0.206 | 0.29 | 8 |
| gw-worker3 | generator | 4 | 48 | 65.79 | 99.652 | 2.167 | 3.61 | 18.789 | 193.063 | 7.781 | 14.798 | 95 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-20261009T105601 | 94.233 | 222.99 | 2936.853 | 2982.912 |
| abusive | coolify-proxy | 89.72 | 134.3 | 226.698 | 234.6 |
| gw-vector1 | gk4owk8-20261009T105807 | 81.442 | 170.99 | 2946.475 | 2987.008 |
| gw-vector1 | coolify-proxy | 15.729 | 27.05 | 133.081 | 135.7 |

## Webapp process

From the webapp's own counters over 245.914 s, commit 42c2db2e. The times exclude the proxy, TLS, and the network.

Finished 160.129 req/s in total: 1465.757 from the benchmark and -1305.627 of background traffic, of which 2.586 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.396 on average, 4 at most. Event loop delay: 47.371 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 39.796 | 61.814 |
| webapp libuv-worker | 5.091 | 10.117 |
| webapp V8Worker | 3.642 | 20.815 |
| proxy | 85.369 | 127.31 |

The proxy accepted 98.182 connections per second on average, 152.613 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 26261 | 106.789 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /movie/:movieKey | 9400 | 38.225 | 26.479 | 93.651 | 189.538 | 26.413 | 75.703 | 99.957 |
| /person/:personKey | 1849 | 7.519 | 56.097 | 165.606 | 197.623 | 37.775 | 123.163 | 99.946 |
| /og/:first/:second | 377 | 1.533 | 243.151 | 834.804 | 982.647 | n/a | n/a | 61.008 |
| /show/:showKey | 104 | 0.423 | 144.444 | 261.818 | 299.636 | 137.838 | 213.333 | 99.038 |
| /sign-up | 50 | 0.203 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 42 | 0.171 | 31.818 | 93.125 | 158 | 25.61 | 48.659 | 100 |
| / | 5 | 0.02 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-in | 4 | 0.016 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/e | 2 | 0.008 | 50 | 290 | 298 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 1962 | 1047 | 894 | 46.636 | 54.101 | 106.633 |
| person-fingerprint-baseline | 915 | 915 | 0 | 0 | n/a | n/a |
| details-movie-v2 | 739 | 191 | 491 | 74.154 | 136.268 | 194.261 |
| details-missing-v1 | 646 | 0 | 646 | 100 | n/a | n/a |
| details-show-v2 | 149 | 51 | 86 | 65.772 | 130 | 193 |
| episode-grid | 103 | 2 | 100 | 98.058 | 25 | 47.5 |
| related-cards | 146 | 53 | 92 | 63.699 | 72.426 | 148.333 |
| movie-collection | 27 | 16 | 10 | 40.741 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 342 | 1.391 | 3.34 |
| grpc /qdrant.Points/UpdateBatch 0 | 12 | 0.049 | 39.416 |
| grpc /qdrant.Points/Recommend 0 | 342 | 1.391 | 27.205 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 247.517 req/s, of which -1218.239 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 42c2db2e | 160.129 | 0 | 39.796 | 61.814 | 4 | 47.371 | 2416.93 |
| 10.0.0.20 | 42c2db2e | 87.4 | 0 | 37.747 | 65.572 | 16 | 126.801 | 2418.035 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /person/:personKey | 33 | 0 | 0 | 1818 | 0 |
| resolve address | /movie/:movieKey | 8780 | 0 | 0 | 621 | 0 |
| resolve address | /show/:showKey | 1 | 0 | 0 | 103 | 0 |
| resolve address | /sign-up | 50 | 0 | 0 | 0 | 0 |
| resolve address | /discover/:type? | 1 | 0 | 0 | 82 | 0 |
| resolve address | / | 5 | 0 | 0 | 0 | 0 |
| resolve address | /sign-in | 4 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 5 | 0 |
| 10.0.0.20 | /person/:personKey | 47 | 0 | 1 | 1435 | 0 |
| 10.0.0.20 | /movie/:movieKey | 8809 | 0 | 0 | 542 | 0 |
| 10.0.0.20 | /discover/:type? | 4 | 0 | 0 | 80 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 117 | 0 |
| 10.0.0.20 | /sign-up | 70 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | / | 4 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /sign-in | 6 | 0 | 0 | 0 | 0 |
