# 20261003T231620Z-load-smoke-hot-warm-2rps

**Smoke run. Not a baseline.**

Label: smoke-hot-warm-2rps. Time: 2026-10-03T23:16:34.950Z. Target: https://goodwatch.app. Path: private. Cache: warm. URL set: hot. Git: 70006d016ecdf084f9a7ebbb435f393178432b29 (dirty).

Rate plan: 2 req/s for 60 s.

119 requests; 1.923 req/s; 0% errors; p95 942.219 ms; 0 dropped iterations.

## Routes

| Route | Requests | Req/s | Error % | p50 ms | p95 ms | p99 ms | TTFB p95 ms | Statuses (2xx/3xx/4xx/5xx/0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| discover | 13 | 0.21 | 0 | 177.631 | 472.625 | 491.472 | 301.983 | 13/0/0/0/0 |
| home | 8 | 0.129 | 0 | 70.659 | 281.909 | 338.324 | 123.784 | 8/0/0/0/0 |
| og_person | 1 | 0.016 | 0 | 76.402 | 76.402 | 76.402 | 68.555 | 1/0/0/0/0 |
| og_title | 6 | 0.097 | 0 | 23.543 | 103.127 | 119.178 | 76.858 | 6/0/0/0/0 |
| person | 10 | 0.162 | 0 | 157.036 | 259.539 | 265.232 | 67.248 | 10/0/0/0/0 |
| title_movie | 76 | 1.228 | 0 | 278.368 | 1008.957 | 1501.276 | 220.286 | 76/0/0/0/0 |
| title_show | 5 | 0.081 | 0 | 466.023 | 1408.316 | 1472.395 | 206.324 | 5/0/0/0/0 |

## Steps

| Step | Target req/s | Requests | Req/s | Error % | p95 ms |
| --- | --- | --- | --- | --- | --- |
| s01 | 2 | 119 | 1.983 | 0 | 942.219 |

## Hosts

| Host | Role | Cores | Samples | CPU avg % | CPU max % | Load avg | Load max | Memory avg % | RX Mbps avg | TX Mbps avg | TX Mbps max | TCP established max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abio | target | 8 | 13 | 33.197 | 36.716 | 3.039 | 3.42 | 35.507 | 7.761 | 8.573 | 12.093 | 14 |
| gw-worker3 | generator | 4 | 13 | 7.021 | 12.96 | 0.196 | 0.3 | 16.485 | 0.108 | 0.113 | 0.171 | 28 |

## Containers

CPU is in percent of one core.

| Host | Container | CPU avg % | CPU max % | Memory avg MB | Memory max MB |
| --- | --- | --- | --- | --- | --- |
| abio | gk4owk8-122325782866 | 98.998 | 118.14 | 2925.41 | 2932.736 |
| abio | coolify-proxy | 93.495 | 106.2 | 255.6 | 260.2 |
