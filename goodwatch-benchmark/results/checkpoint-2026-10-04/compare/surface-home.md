# Comparison: 20261004T024824Z-load-baseline-surface-home vs 20261004T184436Z-load-checkpoint-surface-home

**Warning:** Runs differ in rate_plan; they are not directly comparable.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 159.905 | 1010.051 | 850.146 | 531.658 |
| requests | 630 | 90469 | 89839 | 14260.159 |
| rps | 3.94 | 89.569 | 85.629 | 2173.409 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 123.09 | 4.267 | -118.823 | -96.534 |
| latency_ms.p95 | 2338.114 | 18.119 | -2319.994 | -99.225 |
| latency_ms.p99 | 3661.644 | 40.653 | -3620.992 | -98.89 |
| ttfb_ms.p95 | 236.474 | 17.171 | -219.303 | -92.739 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: home

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 3.94 | 89.569 | 85.629 | 2173.409 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 123.09 | 4.267 | -118.823 | -96.534 |
| latency_ms.p95 | 2338.114 | 18.119 | -2319.994 | -99.225 |
| latency_ms.p99 | 3661.644 | 40.653 | -3620.992 | -98.89 |
| ttfb_ms.p95 | 236.474 | 17.171 | -219.303 | -92.739 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 37.735 | 18.089 | -19.645 | -52.062 |
| cpu_busy_pct.max | 55.069 | 39.372 | -15.697 | -28.504 |
| load1.avg | 3.435 | 1.579 | -1.856 | -54.032 |
| load1.max | 4.09 | 3.35 | -0.74 | -18.093 |
| mem_used_pct.avg | 33.957 | 33.648 | -0.31 | -0.912 |
| mem_used_pct.max | 34.383 | 36.007 | 1.624 | 4.722 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 115.094 | 53.989 | -61.106 | -53.092 |
| cpu_pct.max | 171.83 | 149.71 | -22.12 | -12.873 |
| mem_mb.avg | 250.134 | 134.186 | -115.948 | -46.354 |
| mem_mb.max | 260.7 | 168.3 | -92.4 | -35.443 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 113.858 | n/a | n/a | n/a |
| cpu_pct.max | 207.22 | n/a | n/a | n/a |
| mem_mb.avg | 2612.96 | n/a | n/a | n/a |
| mem_mb.max | 2619.392 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 33.517 | n/a | n/a |
| cpu_pct.max | n/a | 129.58 | n/a | n/a |
| mem_mb.avg | n/a | 2116.695 | n/a | n/a |
| mem_mb.max | n/a | 2150.4 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.748 | 3.692 | -1.056 | -22.243 |
| cpu_busy_pct.max | 16.6 | 20.533 | 3.933 | 23.693 |
| load1.avg | 0.239 | 0.22 | -0.019 | -7.956 |
| load1.max | 0.42 | 0.67 | 0.25 | 59.524 |
| mem_used_pct.avg | 35.736 | 35.105 | -0.631 | -1.766 |
| mem_used_pct.max | 36.006 | 35.693 | -0.313 | -0.87 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.027 | 3.046 | -1.981 | -39.413 |
| cpu_busy_pct.max | 18.947 | 16.708 | -2.239 | -11.817 |
| load1.avg | 0.389 | 0.225 | -0.164 | -42.064 |
| load1.max | 0.69 | 0.58 | -0.11 | -15.942 |
| mem_used_pct.avg | 35.543 | 34.626 | -0.917 | -2.579 |
| mem_used_pct.max | 35.953 | 35.539 | -0.414 | -1.153 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.749 | 3.352 | -1.397 | -29.425 |
| cpu_busy_pct.max | 15.606 | 18.711 | 3.105 | 19.896 |
| load1.avg | 0.39 | 0.288 | -0.102 | -26.161 |
| load1.max | 0.69 | 0.96 | 0.27 | 39.13 |
| mem_used_pct.avg | 35.415 | 34.736 | -0.679 | -1.916 |
| mem_used_pct.max | 35.638 | 35.372 | -0.266 | -0.746 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.267 | 10.481 | 4.214 | 67.233 |
| cpu_busy_pct.max | 10.995 | 21.717 | 10.722 | 97.517 |
| load1.avg | 2.004 | 1.76 | -0.244 | -12.157 |
| load1.max | 2.69 | 3.27 | 0.58 | 21.561 |
| mem_used_pct.avg | 39.771 | 48.272 | 8.501 | 21.374 |
| mem_used_pct.max | 40.13 | 48.596 | 8.466 | 21.096 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 10.656 | n/a | n/a |
| cpu_pct.max | n/a | 47.6 | n/a | n/a |
| mem_mb.avg | n/a | 35.379 | n/a | n/a |
| mem_mb.max | n/a | 46.36 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 33.446 | n/a | n/a |
| cpu_pct.max | n/a | 155.02 | n/a | n/a |
| mem_mb.avg | n/a | 2092.669 | n/a | n/a |
| mem_mb.max | n/a | 2102.272 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 38.727 | n/a | n/a |
| cpu_pct.max | n/a | 104.54 | n/a | n/a |
| mem_mb.avg | n/a | 4044.754 | n/a | n/a |
| mem_mb.max | n/a | 4052.992 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.419 | 11.701 | 5.282 | 82.286 |
| cpu_busy_pct.max | 14.902 | 49.558 | 34.656 | 232.559 |
| load1.avg | 0.303 | 0.408 | 0.104 | 34.315 |
| load1.max | 0.41 | 1.31 | 0.9 | 219.512 |
| mem_used_pct.avg | 16.487 | 26.245 | 9.758 | 59.187 |
| mem_used_pct.max | 16.869 | 30.647 | 13.779 | 81.683 |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.181 | 7.765 | 2.583 | 49.855 |
| cpu_busy_pct.max | 8.582 | 12.889 | 4.307 | 50.186 |
| load1.avg | 0.561 | 1.54 | 0.979 | 174.492 |
| load1.max | 0.73 | 3.53 | 2.8 | 383.562 |
| mem_used_pct.avg | 70.779 | 70.438 | -0.341 | -0.482 |
| mem_used_pct.max | 71.9 | 70.613 | -1.288 | -1.791 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.108 | 8.638 | 3.53 | 69.106 |
| cpu_busy_pct.max | 9.753 | 16.01 | 6.257 | 64.155 |
| load1.avg | 1.022 | 1.026 | 0.004 | 0.436 |
| load1.max | 2.61 | 2.81 | 0.2 | 7.663 |
| mem_used_pct.avg | 71.541 | 71.553 | 0.012 | 0.017 |
| mem_used_pct.max | 71.647 | 71.79 | 0.144 | 0.2 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.798 | 9.957 | 4.159 | 71.726 |
| cpu_busy_pct.max | 11.139 | 18.332 | 7.193 | 64.575 |
| load1.avg | 0.499 | 1.051 | 0.551 | 110.425 |
| load1.max | 0.62 | 2.83 | 2.21 | 356.452 |
| mem_used_pct.avg | 65.449 | 65.435 | -0.013 | -0.02 |
| mem_used_pct.max | 65.631 | 65.621 | -0.01 | -0.015 |

