# Comparison: 20261004T030446Z-load-baseline-surface-share-list vs 20261004T202649Z-load-checkpoint-surface-share-list

**Warning:** Runs differ in rate_plan; they are not directly comparable.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 205.938 | 1010.094 | 804.156 | 390.484 |
| requests | 1023 | 90469 | 89446 | 8743.5 |
| rps | 4.968 | 89.565 | 84.597 | 1703.015 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 197.619 | 4.4 | -193.219 | -97.773 |
| latency_ms.p95 | 1295.442 | 20.478 | -1274.964 | -98.419 |
| latency_ms.p99 | 4648.153 | 41.554 | -4606.599 | -99.106 |
| ttfb_ms.p95 | 287.532 | 19.42 | -268.113 | -93.246 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: share_list

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 4.968 | 89.565 | 84.597 | 1703.015 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 197.619 | 4.4 | -193.219 | -97.773 |
| latency_ms.p95 | 1295.442 | 20.478 | -1274.964 | -98.419 |
| latency_ms.p99 | 4648.153 | 41.554 | -4606.599 | -99.106 |
| ttfb_ms.p95 | 287.532 | 19.42 | -268.113 | -93.246 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 38.464 | 17.959 | -20.505 | -53.309 |
| cpu_busy_pct.max | 53.731 | 33.3 | -20.431 | -38.025 |
| load1.avg | 3.703 | 1.455 | -2.248 | -60.716 |
| load1.max | 4.53 | 2.7 | -1.83 | -40.397 |
| mem_used_pct.avg | 34.075 | 34.118 | 0.043 | 0.126 |
| mem_used_pct.max | 34.412 | 34.639 | 0.227 | 0.66 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 121.739 | 58.225 | -63.514 | -52.172 |
| cpu_pct.max | 247.73 | 144.77 | -102.96 | -41.561 |
| mem_mb.avg | 248.745 | 135.9 | -112.845 | -45.366 |
| mem_mb.max | 255.2 | 161.2 | -94 | -36.834 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 129.491 | n/a | n/a | n/a |
| cpu_pct.max | 231.61 | n/a | n/a | n/a |
| mem_mb.avg | 2620.123 | n/a | n/a | n/a |
| mem_mb.max | 2624.512 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 34.647 | n/a | n/a |
| cpu_pct.max | n/a | 129.37 | n/a | n/a |
| mem_mb.avg | n/a | 2182.552 | n/a | n/a |
| mem_mb.max | n/a | 2194.432 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.516 | 3.321 | -1.195 | -26.456 |
| cpu_busy_pct.max | 21.166 | 17.158 | -4.008 | -18.936 |
| load1.avg | 0.37 | 0.259 | -0.11 | -29.866 |
| load1.max | 0.66 | 0.65 | -0.01 | -1.515 |
| mem_used_pct.avg | 35.807 | 34.693 | -1.114 | -3.112 |
| mem_used_pct.max | 36.335 | 35.28 | -1.055 | -2.903 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 2.171 | 2.991 | 0.82 | 37.761 |
| cpu_busy_pct.max | 14.073 | 18.534 | 4.461 | 31.699 |
| load1.avg | 0.279 | 0.211 | -0.068 | -24.475 |
| load1.max | 0.76 | 0.63 | -0.13 | -17.105 |
| mem_used_pct.avg | 35.887 | 34.135 | -1.752 | -4.882 |
| mem_used_pct.max | 36.002 | 34.645 | -1.357 | -3.77 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.121 | 3.125 | -0.996 | -24.166 |
| cpu_busy_pct.max | 17.624 | 19.588 | 1.964 | 11.144 |
| load1.avg | 0.241 | 0.224 | -0.017 | -7.062 |
| load1.max | 0.43 | 0.58 | 0.15 | 34.884 |
| mem_used_pct.avg | 35.467 | 34.496 | -0.971 | -2.738 |
| mem_used_pct.max | 35.655 | 35.237 | -0.419 | -1.174 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 8.934 | 11.767 | 2.832 | 31.7 |
| cpu_busy_pct.max | 19.3 | 24.031 | 4.731 | 24.513 |
| load1.avg | 1.946 | 2.431 | 0.486 | 24.958 |
| load1.max | 3.37 | 5.57 | 2.2 | 65.282 |
| mem_used_pct.avg | 40.624 | 48.643 | 8.019 | 19.739 |
| mem_used_pct.max | 41.084 | 49.082 | 7.998 | 19.467 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 11.193 | n/a | n/a |
| cpu_pct.max | n/a | 45.99 | n/a | n/a |
| mem_mb.avg | n/a | 39.79 | n/a | n/a |
| mem_mb.max | n/a | 47.7 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 43.378 | n/a | n/a |
| cpu_pct.max | n/a | 197.16 | n/a | n/a |
| mem_mb.avg | n/a | 2212.972 | n/a | n/a |
| mem_mb.max | n/a | 2291.712 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 52.68 | n/a | n/a |
| cpu_pct.max | n/a | 155.23 | n/a | n/a |
| mem_mb.avg | n/a | 4045.583 | n/a | n/a |
| mem_mb.max | n/a | 4059.136 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.032 | 9.708 | 3.675 | 60.925 |
| cpu_busy_pct.max | 18.878 | 32.207 | 13.329 | 70.606 |
| load1.avg | 0.183 | 0.327 | 0.144 | 78.72 |
| load1.max | 0.39 | 1.08 | 0.69 | 176.923 |
| mem_used_pct.avg | 16.338 | 25.708 | 9.37 | 57.351 |
| mem_used_pct.max | 16.815 | 27.399 | 10.584 | 62.94 |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.472 | 9.835 | 4.363 | 79.728 |
| cpu_busy_pct.max | 9.085 | 48.051 | 38.966 | 428.905 |
| load1.avg | 0.413 | 1.653 | 1.24 | 299.909 |
| load1.max | 0.65 | 4 | 3.35 | 515.385 |
| mem_used_pct.avg | 70.678 | 70.442 | -0.236 | -0.334 |
| mem_used_pct.max | 70.789 | 70.672 | -0.118 | -0.166 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.656 | 11.482 | 5.826 | 103.004 |
| cpu_busy_pct.max | 10.262 | 66.224 | 55.962 | 545.332 |
| load1.avg | 1.296 | 1.306 | 0.01 | 0.764 |
| load1.max | 3.04 | 3.14 | 0.1 | 3.289 |
| mem_used_pct.avg | 72.392 | 71.421 | -0.971 | -1.342 |
| mem_used_pct.max | 72.606 | 71.622 | -0.984 | -1.355 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.344 | 13.105 | 6.761 | 106.584 |
| cpu_busy_pct.max | 9.299 | 30.239 | 20.94 | 225.186 |
| load1.avg | 0.97 | 3.043 | 2.073 | 213.732 |
| load1.max | 1.64 | 6.94 | 5.3 | 323.171 |
| mem_used_pct.avg | 65.433 | 65.762 | 0.329 | 0.503 |
| mem_used_pct.max | 65.578 | 66.864 | 1.286 | 1.961 |

