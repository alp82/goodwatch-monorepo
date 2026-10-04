# Comparison: 20261004T025233Z-load-baseline-surface-title-movie vs 20261004T190349Z-load-checkpoint-surface-title-movie

**Warning:** Runs differ in rate_plan; they are not directly comparable.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 39.919 | 1010.075 | 970.156 | 2430.314 |
| requests | 44 | 90472 | 90428 | 205518.182 |
| rps | 1.102 | 89.57 | 88.467 | 8026.193 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 552.364 | 4.804 | -547.559 | -99.13 |
| latency_ms.p95 | 2934.413 | 19.072 | -2915.341 | -99.35 |
| latency_ms.p99 | 3312.759 | 41.27 | -3271.489 | -98.754 |
| ttfb_ms.p95 | 250.167 | 17.289 | -232.878 | -93.089 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: title_movie

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 1.102 | 89.57 | 88.467 | 8026.193 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 552.364 | 4.804 | -547.559 | -99.13 |
| latency_ms.p95 | 2934.413 | 19.072 | -2915.341 | -99.35 |
| latency_ms.p99 | 3312.759 | 41.27 | -3271.489 | -98.754 |
| ttfb_ms.p95 | 250.167 | 17.289 | -232.878 | -93.089 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 39.208 | 15.864 | -23.344 | -59.54 |
| cpu_busy_pct.max | 46.332 | 36.359 | -9.973 | -21.525 |
| load1.avg | 3.337 | 1.425 | -1.912 | -57.297 |
| load1.max | 3.71 | 2.71 | -1 | -26.954 |
| mem_used_pct.avg | 34.072 | 33.732 | -0.34 | -0.997 |
| mem_used_pct.max | 34.155 | 36.136 | 1.98 | 5.798 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 117.718 | 55.607 | -62.11 | -52.762 |
| cpu_pct.max | 132.85 | 171.68 | 38.83 | 29.228 |
| mem_mb.avg | 249.362 | 135.511 | -113.851 | -45.657 |
| mem_mb.max | 250.5 | 172.4 | -78.1 | -31.178 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 163.315 | n/a | n/a | n/a |
| cpu_pct.max | 221.54 | n/a | n/a | n/a |
| mem_mb.avg | 2630.656 | n/a | n/a | n/a |
| mem_mb.max | 2634.752 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 24.585 | n/a | n/a |
| cpu_pct.max | n/a | 138.3 | n/a | n/a |
| mem_mb.avg | n/a | 2143.089 | n/a | n/a |
| mem_mb.max | n/a | 2192.384 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 2.507 | 3.458 | 0.951 | 37.928 |
| cpu_busy_pct.max | 5.843 | 18.728 | 12.885 | 220.52 |
| load1.avg | 0.155 | 0.272 | 0.117 | 75.445 |
| load1.max | 0.21 | 0.69 | 0.48 | 228.571 |
| mem_used_pct.avg | 35.69 | 34.925 | -0.765 | -2.144 |
| mem_used_pct.max | 35.761 | 35.545 | -0.215 | -0.602 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 1.873 | 2.938 | 1.065 | 56.863 |
| cpu_busy_pct.max | 5.817 | 18.02 | 12.203 | 209.782 |
| load1.avg | 0.105 | 0.295 | 0.19 | 180.524 |
| load1.max | 0.15 | 0.85 | 0.7 | 466.667 |
| mem_used_pct.avg | 35.535 | 34.496 | -1.039 | -2.924 |
| mem_used_pct.max | 35.574 | 35.187 | -0.386 | -1.085 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | n/a | 4.38 | n/a | n/a |
| cpu_busy_pct.max | n/a | 25.16 | n/a | n/a |
| load1.avg | n/a | 0.331 | n/a | n/a |
| load1.max | n/a | 1.31 | n/a | n/a |
| mem_used_pct.avg | n/a | 34.85 | n/a | n/a |
| mem_used_pct.max | n/a | 37.276 | n/a | n/a |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.939 | 11.665 | 4.727 | 68.122 |
| cpu_busy_pct.max | 10.001 | 26.504 | 16.503 | 165.013 |
| load1.avg | 1.324 | 2.38 | 1.057 | 79.819 |
| load1.max | 1.44 | 5.59 | 4.15 | 288.194 |
| mem_used_pct.avg | 39.671 | 48.505 | 8.834 | 22.268 |
| mem_used_pct.max | 39.774 | 49.014 | 9.24 | 23.23 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 11.496 | n/a | n/a |
| cpu_pct.max | n/a | 45.09 | n/a | n/a |
| mem_mb.avg | n/a | 36.784 | n/a | n/a |
| mem_mb.max | n/a | 43.12 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 35.076 | n/a | n/a |
| cpu_pct.max | n/a | 158.24 | n/a | n/a |
| mem_mb.avg | n/a | 2125.07 | n/a | n/a |
| mem_mb.max | n/a | 2168.832 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 46.781 | n/a | n/a |
| cpu_pct.max | n/a | 156 | n/a | n/a |
| mem_mb.avg | n/a | 4115.079 | n/a | n/a |
| mem_mb.max | n/a | 4360.192 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.166 | 12.029 | 5.863 | 95.093 |
| cpu_busy_pct.max | 11.535 | 52.068 | 40.533 | 351.391 |
| load1.avg | 0.331 | 0.42 | 0.088 | 26.702 |
| load1.max | 0.55 | 1.49 | 0.94 | 170.909 |
| mem_used_pct.avg | 16.176 | 26.467 | 10.29 | 63.614 |
| mem_used_pct.max | 16.412 | 30.593 | 14.182 | 86.411 |

## Host: host-6

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | n/a | n/a | n/a | n/a |
| cpu_busy_pct.max | n/a | n/a | n/a | n/a |
| load1.avg | n/a | n/a | n/a | n/a |
| load1.max | n/a | n/a | n/a | n/a |
| mem_used_pct.avg | n/a | n/a | n/a | n/a |
| mem_used_pct.max | n/a | n/a | n/a | n/a |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.372 | 6.521 | 1.149 | 21.392 |
| cpu_busy_pct.max | 9.137 | 12.986 | 3.849 | 42.125 |
| load1.avg | 1.268 | 1.259 | -0.008 | -0.655 |
| load1.max | 1.38 | 4.05 | 2.67 | 193.478 |
| mem_used_pct.avg | 70.685 | 70.468 | -0.217 | -0.307 |
| mem_used_pct.max | 70.7 | 70.685 | -0.015 | -0.021 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.731 | 6.893 | 1.162 | 20.276 |
| cpu_busy_pct.max | 8.804 | 17.199 | 8.395 | 95.354 |
| load1.avg | 0.474 | 1.476 | 1.002 | 211.567 |
| load1.max | 0.57 | 3.3 | 2.73 | 478.947 |
| mem_used_pct.avg | 71.501 | 71.535 | 0.034 | 0.047 |
| mem_used_pct.max | 71.52 | 71.741 | 0.221 | 0.309 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.721 | 8.502 | 2.781 | 48.609 |
| cpu_busy_pct.max | 8.469 | 27.766 | 19.297 | 227.855 |
| load1.avg | 0.875 | 1.162 | 0.287 | 32.754 |
| load1.max | 1.17 | 3.62 | 2.45 | 209.402 |
| mem_used_pct.avg | 65.432 | 65.552 | 0.12 | 0.183 |
| mem_used_pct.max | 65.527 | 66.818 | 1.291 | 1.97 |

