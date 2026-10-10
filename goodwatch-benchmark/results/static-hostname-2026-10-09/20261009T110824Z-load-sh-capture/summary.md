# 20261009T110824Z-load-sh-capture

**Smoke run. Not a baseline.**

Label: sh-capture. Time: 2026-10-09T11:10:04.339Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 42c2db2eb9feb9be483b9a3d777504d6c912bb34.

Rate plan: 1 visitors/s for 15 s.

464 requests; 23.382 req/s; 0% errors; p95 89.808 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 84 | 4.233 | 0 | 66.54 | 90.286 | 90.444 | 57.204 | 88.139 | 88.427 | 84/0/0/0/0 |
| home | 10 | 0.504 | 0 | 35.867 | 46.376 | 48.731 | 32.487 | 46.141 | 48.444 | 10/0/0/0/0 |
| og_person | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| og_share_list | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| og_title | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| person | 2 | 0.101 | 0 | 32.081 | 39.319 | 39.962 | 26.136 | 33.467 | 34.119 | 2/0/0/0/0 |
| share_list | 52 | 2.62 | 0 | 46.318 | 54.673 | 67.952 | 30.827 | 54.547 | 67.469 | 52/0/0/0/0 |
| title_movie | 311 | 15.672 | 0 | 46.694 | 69.395 | 113.064 | 40.164 | 67.948 | 112.87 | 311/0/0/0/0 |
| title_show | 5 | 0.252 | 0 | 25.817 | 40.435 | 42.378 | 25.615 | 40.171 | 42.09 | 5/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 464 | 30.933 | 0 | 46.886 | 89.808 | 102.063 | 40.053 | 87.703 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

14 visitors; 13 complete page views; 0% failed page views; page view p95 196.6 ms; 50 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 0.933 | 0.867 | 0 | 3.414 | 7.41 | 103 | 196.6 | 30.933 | 0 | 3.333 | 16.673 | 25.756 |

### By host

Files: page. Pages name the static hostname. Static hostname: static.goodwatch.app.

Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.

| Host | Requests | Req/s | Error % | p50 ms | p95 ms | TTFB p50 ms | TTFB p95 ms | TLS handshakes | Requests/visit | Captured KB/visit | Connections/visit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site | 29 | 1.461 | 0 | 3.378 | 9.55 | 2.436 | 8.525 | 14 | 2.03 | 41 | 1 |
| Static hostname | 435 | 21.921 | 0 | 47.494 | 89.846 | 42.071 | 87.792 | 36 | 30.58 | 467 | 2.53 |
| Others | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 14.37 | 349 | n/a |

Site share of site and static traffic: 6.225% of requests and 8.139% of captured bytes.

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

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 27.887 | 17.169 | 24.711 | 40.555 | 31.034 | 3.842 | 0.493 | 52.286 | 21.571 | 25.427 | 10.7 | 6.6 | 10.448 | 11.223 | 0.201 | 0.534 | 10.581 | 12.663 | 0.695 | 5.268 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 4 | 19.964 | 25.427 | 0.773 | 0.87 | 38.831 | 6.751 | 10.467 | 11.575 | 9 |
| gw-vector1 | target | 16 | 5 | 12.566 | 18.851 | 3.422 | 3.68 | 50.661 | 0.558 | 0.199 | 0.222 | 6 |
| gw-worker3 | generator | 4 | 5 | 9.511 | 12.663 | 0.556 | 0.65 | 16.125 | 10.953 | 0.626 | 0.975 | 2 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-20261009T105601 | 95.415 | 140.73 | 2900.48 | 2906.112 |
| abusive | coolify-proxy | 18.715 | 29.6 | 212.45 | 213 |
| gw-vector1 | gk4owk8-20261009T105807 | 77.41 | 119.61 | 2898.944 | 2912.256 |
| gw-vector1 | coolify-proxy | 7.512 | 9.88 | 131.4 | 131.4 |

## Webapp process

From the webapp's own counters over 25.427 s, commit 42c2db2e. The times exclude the proxy, TLS, and the network.

Finished 20.529 req/s in total: 73.308 from the benchmark and -52.779 of background traffic, of which 1.573 are the crawler loop. Server errors: 0 per second. Requests in flight: 1 on average, 2 at most. Event loop delay: 40.555 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 29.159 | 36.74 |
| webapp libuv-worker | 4.76 | 6.941 |
| webapp V8Worker | 2.033 | 2.78 |
| proxy | 20.331 | 29.747 |

The proxy accepted 23.953 connections per second on average, 31.577 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 147 | 5.781 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /person/:personKey | 126 | 4.955 | 51.087 | 165 | 193 | 37.028 | 143.929 | 100 |
| /movie/:movieKey | 79 | 3.107 | 108.14 | 190.814 | 198.163 | 103.659 | 190.366 | 100 |
| /og/:first/:second | 53 | 2.084 | 216.667 | 668.75 | 933.75 | n/a | n/a | 73.585 |
| /show/:showKey | 11 | 0.433 | 81.25 | 186.25 | 197.25 | 68.75 | 181.667 | 100 |
| /discover/:type? | 9 | 0.354 | 28.125 | 77.5 | 95.5 | 25 | 47.5 | 100 |
| /u/:handle/lists/:id | 7 | 0.275 | 29.167 | 82.5 | 96.5 | 25 | 47.5 | 100 |
| /sign-up | 3 | 0.118 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| / | 2 | 0.079 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /api/living-room/picks | 2 | 0.079 | 50 | 95 | 99 | n/a | n/a | 100 |
| /og/lists/:id/:file | 1 | 0.039 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /sign-in | 1 | 0.039 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| person-profile-v2 | 142 | 82 | 59 | 42.254 | 58.929 | 157.143 |
| person-fingerprint-baseline | 60 | 60 | 0 | 0 | n/a | n/a |
| details-movie-v2 | 92 | 32 | 46 | 65.217 | 141 | 195.9 |
| details-missing-v1 | 66 | 0 | 66 | 100 | n/a | n/a |
| details-show-v2 | 11 | 5 | 3 | 54.545 | 100 | 190 |
| episode-grid | 9 | 2 | 7 | 77.778 | 25 | 47.5 |
| related-cards | 22 | 15 | 7 | 31.818 | 70.833 | 97.083 |
| movie-collection | 5 | 3 | 2 | 40 | 25 | 47.5 |
| share-list-view-v1 | 3 | 2 | 1 | 33.333 | 25 | 47.5 |
| share-list-availability-v1 | 2 | 2 | 0 | 0 | n/a | n/a |
| streaming-providers | 2 | 2 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/UpdateBatch 0 | 2 | 0.079 | 49.211 |
| grpc /qdrant.Points/Get 0 | 34 | 1.337 | 2.107 |
| grpc /qdrant.Points/Recommend 0 | 34 | 1.337 | 26.574 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 35.789 req/s, of which -37.519 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 42c2db2e | 20.529 | 0 | 29.159 | 36.74 | 2 | 40.555 | 2396.477 |
| 10.0.0.20 | 42c2db2e | 15.469 | 0 | 31.698 | 38.368 | 3 | 52.286 | 2411.68 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /person/:personKey | 1 | 0 | 0 | 125 | 0 |
| resolve address | /movie/:movieKey | 10 | 0 | 0 | 68 | 0 |
| resolve address | /show/:showKey | 2 | 0 | 0 | 9 | 0 |
| resolve address | /sign-up | 3 | 0 | 0 | 0 | 0 |
| resolve address | / | 0 | 0 | 0 | 2 | 0 |
| resolve address | /discover/:type? | 4 | 0 | 0 | 8 | 0 |
| resolve address | /u/:handle/lists/:id | 5 | 0 | 0 | 2 | 0 |
| resolve address | /sign-in | 1 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | /person/:personKey | 5 | 0 | 0 | 116 | 0 |
| 10.0.0.20 | /movie/:movieKey | 6 | 0 | 0 | 73 | 0 |
| 10.0.0.20 | /discover/:type? | 2 | 0 | 0 | 10 | 0 |
| 10.0.0.20 | /show/:showKey | 1 | 0 | 0 | 8 | 0 |
| 10.0.0.20 | /sign-up | 4 | 0 | 0 | 0 | 0 |
| 10.0.0.20 | / | 3 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 4 | 1 | 0 | 2 | 0 |
