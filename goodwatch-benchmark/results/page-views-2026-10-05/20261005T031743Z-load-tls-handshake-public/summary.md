# 20261005T031743Z-load-tls-handshake-public

Label: tls-handshake-public. Time: 2026-10-05T03:18:04.815Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: handshake. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 25 visitors/s for 30 s, then 50 visitors/s for 35 s, then 100 visitors/s for 35 s, then 150 visitors/s for 35 s, then 200 visitors/s for 35 s, then 250 visitors/s for 35 s, then 300 visitors/s for 35 s, then 400 visitors/s for 35 s, then 500 visitors/s for 35 s.

**Aborted:** dropped_iterations: count<750

58983 requests; 199.64 req/s; 0.002% errors; p95 302.065 ms; 758 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| health | 58983 | 199.64 | 0.002 | 7.015 | 302.065 | 807.622 | 6.141 | 276.154 | 703.85 | 58980/0/0/0/1 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 25 | 749 | 24.967 | 0 | 3.625 | 14.413 | 29.727 | 3.256 | 13.885 |
| s02 | 50 | 1687 | 48.2 | 0 | 3.642 | 15.349 | 29.303 | 3.235 | 14.901 |
| s03 | 100 | 3374 | 96.4 | 0 | 3.596 | 17.41 | 36.387 | 3.248 | 17.026 |
| s04 | 150 | 5124 | 146.4 | 0 | 3.426 | 15.719 | 32.876 | 3.094 | 15.295 |
| s05 | 200 | 6874 | 196.4 | 0 | 3.434 | 17.575 | 31.914 | 3.109 | 16.899 |
| s06 | 250 | 8625 | 246.429 | 0 | 3.771 | 23.604 | 49.436 | 3.414 | 22.143 |
| s07 | 300 | 10374 | 296.4 | 0 | 5.582 | 34.788 | 59.682 | 4.82 | 30.692 |
| s08 | 400 | 13748 | 392.8 | 0 | 22.561 | 79.743 | 142.738 | 18.201 | 68.299 |
| s09 | 500 | 8428 | 412.197 | 0.012 | 166.968 | 1093.579 | 3006.307 | 154.021 | 898.872 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

58981 visitors; 0 complete page views; 0% failed page views; page view p95 0 ms; 58981 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 25 | 24.967 | 0 | 0 | 3.625 | 14.413 | 0 | 0 | 24.967 | 0 | 24.967 | 24.251 | 35.4 |
| s02 | 50 | 48.2 | 0 | 0 | 3.642 | 15.349 | 0 | 0 | 48.2 | 0 | 48.2 | 23.171 | 34.053 |
| s03 | 100 | 96.4 | 0 | 0 | 3.596 | 17.41 | 0 | 0 | 96.4 | 0 | 96.4 | 23.007 | 35.055 |
| s04 | 150 | 146.4 | 0 | 0 | 3.426 | 15.719 | 0 | 0 | 146.4 | 0 | 146.4 | 21.994 | 33.466 |
| s05 | 200 | 196.4 | 0 | 0 | 3.434 | 17.575 | 0 | 0 | 196.4 | 0 | 196.4 | 21.965 | 33.735 |
| s06 | 250 | 246.429 | 0 | 0 | 3.771 | 23.604 | 0 | 0 | 246.429 | 0 | 246.429 | 21.837 | 36.028 |
| s07 | 300 | 296.4 | 0 | 0 | 5.582 | 34.788 | 0 | 0 | 296.4 | 0 | 296.4 | 22.81 | 51.223 |
| s08 | 400 | 392.8 | 0 | 0 | 22.561 | 79.743 | 0 | 0 | 392.8 | 0 | 392.8 | 36.219 | 154.668 |
| s09 | 500 | 412.099 | 0 | 0 | 166.968 | 1093.579 | 0 | 0 | 412.197 | 0.012 | 412.099 | 448.09 | 1681.374 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 25 | 21.796 | 195.373 | 91.227 | 37.967 | 28.648 | 9.063 | 0.276 | 52.548 | 35.791 | 41.232 | 8.378 | 4.575 | 10.529 | 15.263 | 43.91 | 22.433 | 11.832 | 20.232 | 0.563 | 1.165 |
| s02 | 50 | 18.073 | 243.714 | 115.456 | 42.456 | 31.906 | 11.634 | 0.828 | 41.964 | 40.69 | 43.694 | 9.567 | 5.298 | 10.354 | 12.511 | 0.236 | 0.134 | 16.806 | 22.108 | 1.18 | 2.588 |
| s03 | 100 | 23.73 | 334.675 | 163.97 | 49.206 | 28.854 | 14.741 | 0.432 | 52.024 | 51.082 | 53.034 | 12.2 | 6.083 | 10.935 | 12.722 | 0.183 | 0.18 | 26.064 | 30.75 | 2.277 | 5.132 |
| s04 | 150 | 20.216 | 413.543 | 214.11 | 52.876 | 31.406 | 18.639 | 0.552 | 48.026 | 60.663 | 63.696 | 14.104 | 7.251 | 9.937 | 16.463 | 0.211 | 0.093 | 34.384 | 38.832 | 3.413 | 7.757 |
| s05 | 200 | 20.569 | 491.281 | 263.871 | 42.783 | 35.832 | 22.193 | 0.67 | 56.677 | 69.603 | 72.148 | 17.893 | 8.884 | 11.378 | 15.275 | 0.239 | 0.16 | 47.989 | 53.595 | 4.557 | 10.386 |
| s06 | 250 | 26.261 | 551.441 | 312.597 | 53.794 | 30.267 | 24.862 | 0.835 | 90.428 | 79.379 | 82.039 | 20.221 | 10.067 | 10.389 | 11.903 | 0.198 | 0.124 | 52.326 | 58.859 | 5.527 | 12.612 |
| s07 | 300 | 22.671 | 633.906 | 368.783 | 51.762 | 34.568 | 28.032 | 0.433 | 74.7 | 88.572 | 91.817 | 22.767 | 11.231 | 11.876 | 17.067 | 0.195 | 0.137 | 59.362 | 63.899 | 6.833 | 15.582 |
| s08 | 400 | 22.226 | 722.917 | 465.879 | 52.942 | 35.452 | 33.052 | 0.512 | 57.398 | 97.992 | 99.28 | 28.376 | 13.452 | 10.953 | 17.679 | 0.191 | 0.099 | 68.209 | 70.367 | 9.069 | 20.626 |
| s09 | 500 | 18.202 | 740.949 | 504.034 | 37.049 | 27.433 | 29.301 | 12.094 | 38.917 | 99.565 | 99.609 | 29.288 | 14.088 | 9.296 | 9.892 | 0.18 | 0.099 | 72.887 | 73.8 | 10.033 | 22.312 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 59 | 67.395 | 99.609 | 5.039 | 8.65 | 34.273 | 8.706 | 17.395 | 29.944 | 8 |
| gw-vector1 | target | 16 | 59 | 10.719 | 17.679 | 1.899 | 3.14 | 48.7 | 2.397 | 4.654 | 262.516 | 9 |
| gw-cache1 | data | 8 | 60 | 3.361 | 17.881 | 0.325 | 0.57 | 32.103 | 0.484 | 0.441 | 1.18 | 8 |
| gw-cache2 | data | 8 | 59 | 3.423 | 15.115 | 0.327 | 0.55 | 31.743 | 0.475 | 0.38 | 0.824 | 7 |
| gw-cache3 | data | 8 | 59 | 3.283 | 15.787 | 0.25 | 0.55 | 31.869 | 0.473 | 0.333 | 0.823 | 9 |
| gw-worker3 | generator | 4 | 59 | 41.516 | 73.8 | 1.124 | 2.19 | 25.908 | 10.204 | 4.505 | 10.648 | 732 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 25.044 | 56.63 | 2208.49 | 2210.816 |
| abusive | coolify-proxy | 453.165 | 753.49 | 220.276 | 286.2 |
| gw-vector1 | gk4owk8-011237769659 | 49.527 | 171.36 | 2198.875 | 2200.576 |
| gw-vector1 | coolify-proxy | 21.741 | 39.42 | 43.862 | 49.64 |
| gw-vector1 | qdrant-main | 28.91 | 91.13 | 4953.557 | 4973.568 |

## Webapp process

From the webapp's own counters over 299.761 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 31.695 req/s in total: 196.77 from the benchmark and -165.075 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 0.915 on average, 3 at most. Event loop delay: 62.313 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 21.669 | 32.52 |
| webapp V8Worker | 3.109 | 19.619 |
| webapp libuv-worker | 2.008 | 4.163 |
| proxy | 469.285 | 760.838 |

The proxy accepted 267.176 connections per second on average, 528.725 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /movie/:movieKey | 639 | 2.132 | 128.189 | 216.351 | 285.432 | 122.739 | 195.214 | 99.844 |
| /person/:personKey | 520 | 1.735 | 67.816 | 189.051 | 252.727 | 25.981 | 49.365 | 100 |
| static | 108 | 0.36 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /show/:showKey | 83 | 0.277 | 101.282 | 197.051 | 272.333 | 95.833 | 192.125 | 100 |
| /api/e | 7 | 0.023 | 150 | 285 | 297 | n/a | n/a | 100 |
| / | 5 | 0.017 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-up | 2 | 0.007 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /sign-in | 1 | 0.003 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/poster-impressions | 1 | 0.003 | 50 | 95 | 99 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 83 | 37 | 41 | 55.422 | 137.838 | 193.784 |
| episode-grid | 83 | 30 | 50 | 63.855 | 25.98 | 49.363 |
| related-cards | 316 | 137 | 179 | 56.646 | 67.857 | 100 |
| details-movie-v2 | 640 | 155 | 468 | 75.781 | 130.259 | 193.285 |
| person-profile-v2 | 514 | 175 | 339 | 65.953 | 72.552 | 175.492 |
| person-fingerprint-baseline | 339 | 339 | 0 | 0 | n/a | n/a |
| movie-collection | 55 | 34 | 21 | 38.182 | 25 | 47.5 |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Get 0 | 670 | 2.235 | 1.716 |
| grpc /qdrant.Points/Recommend 0 | 670 | 2.235 | 26.174 |
| grpc /qdrant.Points/UpdateBatch 0 | 7 | 0.023 | 79.444 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 65.282 req/s, of which -131.488 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 31.695 | 0 | 21.669 | 32.52 | 3 | 62.313 | 2258.668 |
| 10.0.0.20 | 3a45fcfd | 33.51 | 0 | 32.397 | 40.238 | 4 | 90.428 | 2255.328 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 0 | 0 | 0 | 83 | 0 |
| resolve address | /movie/:movieKey | 0 | 0 | 0 | 640 | 0 |
| resolve address | /person/:personKey | 0 | 0 | 0 | 521 | 0 |
| resolve address | /discover/:type? | 0 | 0 | 0 | 2 | 0 |
| resolve address | / | 5 | 0 | 0 | 0 | 0 |
| resolve address | /sign-in | 0 | 0 | 0 | 1 | 0 |
| resolve address | /tv/:showKey | 0 | 0 | 0 | 1 | 0 |
| resolve address | /sign-up | 1 | 1 | 0 | 0 | 0 |
| 10.0.0.20 | /person/:personKey | 0 | 0 | 0 | 982 | 0 |
| 10.0.0.20 | /movie/:movieKey | 0 | 0 | 0 | 736 | 0 |
| 10.0.0.20 | /show/:showKey | 1 | 0 | 0 | 105 | 0 |
| 10.0.0.20 | /discover/:type? | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /tv/:showKey | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /sign-in | 0 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | / | 4 | 1 | 0 | 0 | 0 |
