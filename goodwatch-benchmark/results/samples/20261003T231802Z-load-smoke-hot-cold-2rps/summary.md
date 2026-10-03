# 20261003T231802Z-load-smoke-hot-cold-2rps

**Smoke run. Not a baseline.**

Label: smoke-hot-cold-2rps. Time: 2026-10-03T23:18:16.971Z. Target: https://goodwatch.app. Path: private. Cache: cold. URL set: hot. Git: 70006d016ecdf084f9a7ebbb435f393178432b29 (dirty).

Rate plan: 2 req/s for 60 s.

119 requests; 1.983 req/s; 0% errors; p95 2475.538 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p95 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 14 | 0.233 | 0 | 248.096 | 2124.554 | 2870.737 | 234.762 | 14/0/0/0/0 |
| home | 7 | 0.117 | 0 | 127.208 | 621.783 | 752.874 | 298.064 | 7/0/0/0/0 |
| og_person | 2 | 0.033 | 0 | 39.241 | 56.631 | 58.177 | 9.944 | 2/0/0/0/0 |
| og_title | 5 | 0.083 | 0 | 48.601 | 193.717 | 209.534 | 182.848 | 5/0/0/0/0 |
| person | 3 | 0.05 | 0 | 168.82 | 353.359 | 369.763 | 69.301 | 3/0/0/0/0 |
| title_movie | 84 | 1.4 | 0 | 384.369 | 2404.249 | 4467.02 | 525.982 | 84/0/0/0/0 |
| title_show | 4 | 0.067 | 0 | 2106.771 | 3300.22 | 3442.925 | 647.475 | 4/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p95 ms |
| --- | --- | --- | --- | --- | --- |
| s01 | 2 | 119 | 1.983 | 0 | 2475.538 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abio | target | 8 | 13 | 38.884 | 50.453 | 3.256 | 3.68 | 35.532 | 10.161 | 9.518 | 12.303 | 14 |
| gw-worker3 | generator | 4 | 12 | 10.457 | 17.935 | 0.32 | 0.39 | 16.549 | 0.174 | 0.131 | 0.173 | 27 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abio | gk4owk8-122325782866 | 136.068 | 302.12 | 2927.458 | 2933.76 |
| abio | coolify-proxy | 95.308 | 116.94 | 257.262 | 268.6 |
