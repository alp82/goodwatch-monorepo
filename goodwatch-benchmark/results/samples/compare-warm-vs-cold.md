# Comparison: 20261003T231620Z-load-smoke-hot-warm-2rps vs 20261003T231802Z-load-smoke-hot-cold-2rps

**Warning:** Runs differ in cache_mode; they are not directly comparable.

**Warning:** Smoke run. Not a baseline.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 61.896 | 60.004 | -1.892 | -3.057 |
| requests | 119 | 119 | 0 | 0 |
| rps | 1.923 | 1.983 | 0.061 | 3.153 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 231.195 | 297.726 | 66.531 | 28.777 |
| latency_ms.p95 | 942.219 | 2475.538 | 1533.319 | 162.735 |
| latency_ms.p99 | 1483.135 | 4311.398 | 2828.262 | 190.695 |
| ttfb_ms.p95 | 225.662 | 521.037 | 295.375 | 130.893 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: discover

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.21 | 0.233 | 0.023 | 11.088 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 177.631 | 248.096 | 70.465 | 39.669 |
| latency_ms.p95 | 472.625 | 2124.554 | 1651.929 | 349.522 |
| latency_ms.p99 | 491.472 | 2870.737 | 2379.265 | 484.11 |
| ttfb_ms.p95 | 301.983 | 234.762 | -67.221 | -22.26 |

## Route: home

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.129 | 0.117 | -0.013 | -9.741 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 70.659 | 127.208 | 56.549 | 80.031 |
| latency_ms.p95 | 281.909 | 621.783 | 339.874 | 120.562 |
| latency_ms.p99 | 338.324 | 752.874 | 414.55 | 122.53 |
| ttfb_ms.p95 | 123.784 | 298.064 | 174.281 | 140.794 |

## Route: og_person

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.016 | 0.033 | 0.017 | 106.307 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 76.402 | 39.241 | -37.162 | -48.639 |
| latency_ms.p95 | 76.402 | 56.631 | -19.771 | -25.878 |
| latency_ms.p99 | 76.402 | 58.177 | -18.225 | -23.854 |
| ttfb_ms.p95 | 68.555 | 9.944 | -58.611 | -85.495 |

## Route: og_title

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.097 | 0.083 | -0.014 | -14.039 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 23.543 | 48.601 | 25.057 | 106.432 |
| latency_ms.p95 | 103.127 | 193.717 | 90.591 | 87.844 |
| latency_ms.p99 | 119.178 | 209.534 | 90.356 | 75.817 |
| ttfb_ms.p95 | 76.858 | 182.848 | 105.989 | 137.902 |

## Route: person

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.162 | 0.05 | -0.112 | -69.054 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 157.036 | 168.82 | 11.784 | 7.504 |
| latency_ms.p95 | 259.539 | 353.359 | 93.821 | 36.149 |
| latency_ms.p99 | 265.232 | 369.763 | 104.531 | 39.411 |
| ttfb_ms.p95 | 67.248 | 69.301 | 2.052 | 3.051 |

## Route: title_movie

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 1.228 | 1.4 | 0.172 | 14.012 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 278.368 | 384.369 | 106.001 | 38.08 |
| latency_ms.p95 | 1008.957 | 2404.249 | 1395.292 | 138.29 |
| latency_ms.p99 | 1501.276 | 4467.02 | 2965.744 | 197.548 |
| ttfb_ms.p95 | 220.286 | 525.982 | 305.696 | 138.772 |

## Route: title_show

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.081 | 0.067 | -0.014 | -17.477 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 466.023 | 2106.771 | 1640.748 | 352.074 |
| latency_ms.p95 | 1408.316 | 3300.22 | 1891.905 | 134.338 |
| latency_ms.p99 | 1472.395 | 3442.925 | 1970.53 | 133.832 |
| ttfb_ms.p95 | 206.324 | 647.475 | 441.152 | 213.815 |

## Host: abio

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 33.197 | 38.884 | 5.688 | 17.134 |
| cpu_busy_pct.max | 36.716 | 50.453 | 13.737 | 37.414 |
| load1.avg | 3.039 | 3.256 | 0.217 | 7.137 |
| load1.max | 3.42 | 3.68 | 0.26 | 7.602 |
| mem_used_pct.avg | 35.507 | 35.532 | 0.025 | 0.07 |
| mem_used_pct.max | 35.715 | 35.844 | 0.129 | 0.36 |

## Container: abio/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 93.495 | 95.308 | 1.812 | 1.938 |
| cpu_pct.max | 106.2 | 116.94 | 10.74 | 10.113 |
| mem_mb.avg | 255.6 | 257.262 | 1.662 | 0.65 |
| mem_mb.max | 260.2 | 268.6 | 8.4 | 3.228 |

## Container: abio/gk4owk8-122325782866

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 98.998 | 136.068 | 37.069 | 37.444 |
| cpu_pct.max | 118.14 | 302.12 | 183.98 | 155.73 |
| mem_mb.avg | 2925.41 | 2927.458 | 2.048 | 0.07 |
| mem_mb.max | 2932.736 | 2933.76 | 1.024 | 0.035 |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 7.021 | 10.457 | 3.436 | 48.945 |
| cpu_busy_pct.max | 12.96 | 17.935 | 4.975 | 38.387 |
| load1.avg | 0.196 | 0.32 | 0.124 | 63.137 |
| load1.max | 0.3 | 0.39 | 0.09 | 30 |
| mem_used_pct.avg | 16.485 | 16.549 | 0.064 | 0.387 |
| mem_used_pct.max | 17.015 | 17.13 | 0.115 | 0.679 |
