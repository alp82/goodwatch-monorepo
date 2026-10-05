# 20261005T033723Z-load-pv-smoke-hot

**Smoke run. Not a baseline.**

Label: pv-smoke-hot. Time: 2026-10-05T03:38:57.572Z. Target: https://goodwatch.app. Path: public. Cache: warm. URL set: hot. Git: 3a45fcfd3d55e5f847387f27ce9757a043cc700b (dirty).

Rate plan: 1 visitors/s for 20 s.

617 requests; 23.583 req/s; 0% errors; p95 32.637 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms | TTFB p99 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 43 | 1.644 | 0 | 17.359 | 21.203 | 21.9 | 13.994 | 20.414 | 21.47 | 43/0/0/0/0 |
| home | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| og_person | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| og_share_list | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0/0/0/0 |
| og_title | 2 | 0.076 | 0 | 18.87 | 22.961 | 23.324 | 15.686 | 19.677 | 20.032 | 2/0/0/0/0 |
| person | 2 | 0.076 | 0 | 5.056 | 7.353 | 7.557 | 4.732 | 6.965 | 7.163 | 2/0/0/0/0 |
| share_list | 2 | 0.076 | 0 | 4.434 | 5.521 | 5.618 | 4.156 | 5.239 | 5.336 | 2/0/0/0/0 |
| title_movie | 455 | 17.391 | 0 | 12.772 | 27.166 | 37.645 | 11.25 | 26.12 | 36.125 | 455/0/0/0/0 |
| title_show | 113 | 4.319 | 0 | 12.178 | 34.581 | 160.762 | 11.002 | 33.413 | 159.36 | 113/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p50 ms | TTFB p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 617 | 30.85 | 0 | 12.939 | 32.637 | 41.724 | 11.324 | 31.914 |

## Page views

One visitor is one iteration, on a new connection with a full TLS handshake. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: anon;US;en.

19 visitors; 16 complete page views; 0% failed page views; page view p95 118 ms; 36 TLS handshakes.

| Step | Visitors/s target | Visitors/s | Page views/s | Failed page views % | Document p50 ms | Document p95 ms | Page view p50 ms | Page view p95 ms | Requests/s | Request errors % | TLS handshakes/s | Handshake p50 ms | Handshake p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 0.95 | 0.8 | 0 | 5.278 | 19.085 | 66.5 | 118 | 30.85 | 0 | 1.8 | 24.207 | 35.372 |

The last response of each page before the run:

| Page | Status | Cache-Control | Vary | GW-Page-Cache | GW-Cache-Identity | Protocol | TLS | Cipher suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| share_list:browser | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:bot | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_movie:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| title_show:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| discover:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| home:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| person:browser | 200 | public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |
| share_list:bot | 200 | public, max-age=0, s-maxage=10, stale-while-revalidate=10 | GW-Cache-Identity, Accept-Encoding | hit | anon;US;en | HTTP/2.0 | tls1.3 | TLS_AES_128_GCM_SHA256 |

## Resources per step

Main thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.

| Step | Target | 10.0.0.21 main thread % | 10.0.0.21 proxy % | 10.0.0.21 proxy accepts/s | 10.0.0.21 loop delay max ms | 10.0.0.20 main thread % | 10.0.0.20 proxy % | 10.0.0.20 proxy accepts/s | 10.0.0.20 loop delay max ms | abusive CPU % | abusive CPU max % | abusive TX Mbps | abusive RX Mbps | gw-vector1 CPU % | gw-vector1 CPU max % | gw-vector1 TX Mbps | gw-vector1 RX Mbps | gw-worker3 CPU % | gw-worker3 CPU max % | gw-worker3 TX Mbps | gw-worker3 RX Mbps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s01 | 1 | 26.363 | 157.319 | 69.707 | 346.477 | 19.589 | 6.311 | 0.197 | 80.729 | 30.229 | 32.066 | 12.153 | 6.281 | 75.417 | 79.175 | 0.228 | 0.091 | 2.554 | 2.794 | 0.207 | 3.851 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abusive | target | 8 | 6 | 31.814 | 37.671 | 3.192 | 3.47 | 35.404 | 9.001 | 16.92 | 33.056 | 9 |
| gw-vector1 | target | 16 | 5 | 75.781 | 79.175 | 8.46 | 9.55 | 52.642 | 0.092 | 0.216 | 0.353 | 7 |
| gw-cache1 | data | 8 | 5 | 2.956 | 5.373 | 0.188 | 0.22 | 31.921 | 0.988 | 1.007 | 2.156 | 8 |
| gw-cache2 | data | 8 | 6 | 1.245 | 2.929 | 0.182 | 0.22 | 31.55 | 0.375 | 0.528 | 0.92 | 7 |
| gw-cache3 | data | 8 | 6 | 7.5 | 13.505 | 0.577 | 0.62 | 31.794 | 0.529 | 0.639 | 1.264 | 8 |
| gw-worker3 | generator | 4 | 5 | 4.338 | 8.363 | 0.604 | 0.71 | 19.024 | 9.799 | 0.324 | 0.645 | 3 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abusive | gk4owk8-011040174342 | 55.062 | 104 | 2326.528 | 2368.512 |
| abusive | coolify-proxy | 151.83 | 175.05 | 251.733 | 265.9 |
| gw-vector1 | gk4owk8-011237769659 | 35.032 | 41.46 | 2219.213 | 2220.032 |
| gw-vector1 | coolify-proxy | 12.634 | 20.39 | 60.526 | 63.3 |
| gw-vector1 | qdrant-main | 1026.552 | 1172.82 | 6320.333 | 6329.344 |

## Webapp process

From the webapp's own counters over 29.693 s, commit 3a45fcfd. The times exclude the proxy, TLS, and the network.

Finished 68.535 req/s in total: 64.528 from the benchmark and 4.008 of background traffic, of which 0 are the crawler loop. Server errors: 0 per second. Requests in flight: 1.2 on average, 4 at most. Event loop delay: 514.774 ms at most.

CPU in percent of one core:

| Part | Avg % | Max % |
| --- | --- | --- |
| webapp main | 29.968 | 40.786 |
| webapp libuv-worker | 3.963 | 4.756 |
| webapp V8Worker | 3.764 | 9.701 |
| proxy | 160.902 | 171.656 |

The proxy accepted 70.593 connections per second on average, 73.256 at most.

| Route pattern (anonymous, 2xx) | Requests | Req/s | p50 ms | p95 ms | p99 ms | Headers p50 ms | Headers p95 ms | Under 300 ms % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static | 961 | 32.365 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /person/:personKey | 113 | 3.806 | 83.14 | 195.658 | 271.75 | 27.438 | 88.389 | 100 |
| /movie/:movieKey | 89 | 2.997 | 129.464 | 213.75 | 322 | 123.585 | 199.151 | 98.876 |
| /show/:showKey | 16 | 0.539 | 66.667 | 220 | 284 | 44.444 | 220 | 100 |
| /u/:handle/lists/:id | 6 | 0.202 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| / | 4 | 0.135 | 25 | 47.5 | 49.5 | 25 | 47.5 | 100 |
| /discover/:type? | 3 | 0.101 | 125 | 192.5 | 198.5 | 75 | 185 | 100 |
| /api/living-room/picks | 3 | 0.101 | 375 | 925 | 985 | n/a | n/a | 0 |
| /og/:first/:second | 2 | 0.067 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |
| /og/lists/:id/:file | 1 | 0.034 | 25 | 47.5 | 49.5 | n/a | n/a | 100 |

| Data cache | Lookups | Hits | Misses | Miss % | Miss p50 ms | Miss p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| details-show-v2 | 10 | 4 | 6 | 60 | 140 | 194 |
| episode-grid | 10 | 4 | 6 | 60 | 25 | 47.5 |
| related-cards | 33 | 14 | 19 | 57.576 | 67.857 | 181 |
| details-movie-v2 | 80 | 18 | 61 | 77.5 | 130.233 | 195.116 |
| person-profile-v2 | 110 | 23 | 87 | 79.091 | 67.683 | 184.333 |
| person-fingerprint-baseline | 87 | 87 | 0 | 0 | n/a | n/a |
| movie-collection | 7 | 2 | 5 | 71.429 | 25 | 47.5 |
| share-list-view-v1 | 3 | 3 | 0 | 0 | n/a | n/a |
| share-list-availability-v1 | 2 | 2 | 0 | 0 | n/a | n/a |
| streaming-providers | 3 | 3 | 0 | 0 | n/a | n/a |

| Qdrant endpoint and status | Calls | Calls/s | Avg ms |
| --- | --- | --- | --- |
| grpc /qdrant.Points/Recommend 0 | 66 | 2.223 | 42.976 |
| grpc /qdrant.Points/UpdateBatch 0 | 2 | 0.067 | 39.297 |
| grpc /qdrant.Points/Get 0 | 68 | 2.29 | 3.339 |

## Webapp instances

The load spreads over 2 instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished 135.252 req/s, of which 70.724 are background traffic.

| Instance | Commit | Req/s | 5xx/s | Main thread avg % | Main thread max % | In flight max | Loop delay max ms | Memory MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resolve address | 3a45fcfd | 68.535 | 0 | 29.968 | 40.786 | 4 | 514.774 | 2431.715 |
| 10.0.0.20 | 3a45fcfd | 66.882 | 0 | 28.484 | 55.167 | 4 | 392.877 | 2273.824 |

| Instance | Page cache route | Hit | Stale | Joined | Miss | Bypass |
| --- | --- | --- | --- | --- | --- | --- |
| resolve address | /show/:showKey | 6 | 0 | 0 | 10 | 0 |
| resolve address | /movie/:movieKey | 9 | 0 | 0 | 80 | 0 |
| resolve address | /person/:personKey | 2 | 0 | 0 | 111 | 0 |
| resolve address | /discover/:type? | 1 | 0 | 0 | 2 | 0 |
| resolve address | / | 2 | 0 | 0 | 2 | 0 |
| resolve address | /u/:handle/lists/:id | 4 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /person/:personKey | 1 | 0 | 0 | 56 | 0 |
| 10.0.0.20 | /movie/:movieKey | 10 | 0 | 0 | 61 | 0 |
| 10.0.0.20 | /show/:showKey | 0 | 0 | 0 | 10 | 0 |
| 10.0.0.20 | /discover/:type? | 3 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | / | 2 | 0 | 0 | 2 | 0 |
| 10.0.0.20 | /u/:handle/lists/:id | 3 | 0 | 0 | 2 | 0 |
