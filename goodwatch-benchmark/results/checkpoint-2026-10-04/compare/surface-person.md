# Comparison: 20261004T025718Z-load-baseline-surface-person vs 20261004T194232Z-load-checkpoint-surface-person

**Warning:** Runs differ in rate_plan; they are not directly comparable.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 143.912 | 1010.049 | 866.138 | 601.854 |
| requests | 461 | 90475 | 90014 | 19525.813 |
| rps | 3.203 | 89.575 | 86.371 | 2696.281 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 219.16 | 4.409 | -214.751 | -97.988 |
| latency_ms.p95 | 5441.198 | 20.774 | -5420.425 | -99.618 |
| latency_ms.p99 | 6850.669 | 45.425 | -6805.244 | -99.337 |
| ttfb_ms.p95 | 216.484 | 19.686 | -196.799 | -90.907 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: person

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 3.203 | 89.575 | 86.371 | 2696.281 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 219.16 | 4.409 | -214.751 | -97.988 |
| latency_ms.p95 | 5441.198 | 20.774 | -5420.425 | -99.618 |
| latency_ms.p99 | 6850.669 | 45.425 | -6805.244 | -99.337 |
| ttfb_ms.p95 | 216.484 | 19.686 | -196.799 | -90.907 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 37.578 | 18.344 | -19.234 | -51.184 |
| cpu_busy_pct.max | 52.07 | 33.36 | -18.71 | -35.932 |
| load1.avg | 3.21 | 1.537 | -1.673 | -52.126 |
| load1.max | 4.44 | 2.95 | -1.49 | -33.559 |
| mem_used_pct.avg | 34.077 | 34.73 | 0.653 | 1.916 |
| mem_used_pct.max | 34.317 | 35.894 | 1.577 | 4.596 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 115.823 | 57.759 | -58.064 | -50.132 |
| cpu_pct.max | 153.04 | 155.29 | 2.25 | 1.47 |
| mem_mb.avg | 245.834 | 140.032 | -105.802 | -43.038 |
| mem_mb.max | 257 | 164.7 | -92.3 | -35.914 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 132.394 | n/a | n/a | n/a |
| cpu_pct.max | 293.68 | n/a | n/a | n/a |
| mem_mb.avg | 2631.362 | n/a | n/a | n/a |
| mem_mb.max | 2634.752 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 34.615 | n/a | n/a |
| cpu_pct.max | n/a | 142.56 | n/a | n/a |
| mem_mb.avg | n/a | 2295.803 | n/a | n/a |
| mem_mb.max | n/a | 2379.776 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 2.038 | 3.359 | 1.321 | 64.786 |
| cpu_busy_pct.max | 5.11 | 16.166 | 11.056 | 216.36 |
| load1.avg | 0.123 | 0.247 | 0.124 | 100.858 |
| load1.max | 0.23 | 0.63 | 0.4 | 173.913 |
| mem_used_pct.avg | 35.771 | 34.831 | -0.941 | -2.63 |
| mem_used_pct.max | 35.944 | 35.42 | -0.524 | -1.459 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.989 | 3.259 | -1.73 | -34.676 |
| cpu_busy_pct.max | 19.288 | 18.465 | -0.823 | -4.267 |
| load1.avg | 0.257 | 0.319 | 0.062 | 24.291 |
| load1.max | 0.61 | 0.66 | 0.05 | 8.197 |
| mem_used_pct.avg | 35.564 | 34.259 | -1.305 | -3.67 |
| mem_used_pct.max | 35.93 | 34.874 | -1.055 | -2.937 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.102 | 3.668 | 0.566 | 18.236 |
| cpu_busy_pct.max | 7.26 | 19.004 | 11.744 | 161.763 |
| load1.avg | 0.259 | 0.265 | 0.006 | 2.272 |
| load1.max | 0.49 | 0.61 | 0.12 | 24.49 |
| mem_used_pct.avg | 35.495 | 34.513 | -0.981 | -2.764 |
| mem_used_pct.max | 35.902 | 34.935 | -0.967 | -2.693 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.142 | 39.642 | 33.5 | 545.443 |
| cpu_busy_pct.max | 12.511 | 81.797 | 69.286 | 553.801 |
| load1.avg | 0.966 | 8.31 | 7.344 | 760.32 |
| load1.max | 1.16 | 14.53 | 13.37 | 1152.586 |
| mem_used_pct.avg | 39.656 | 51.531 | 11.876 | 29.947 |
| mem_used_pct.max | 39.827 | 53.692 | 13.865 | 34.813 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 10.161 | n/a | n/a |
| cpu_pct.max | n/a | 38.28 | n/a | n/a |
| mem_mb.avg | n/a | 40.202 | n/a | n/a |
| mem_mb.max | n/a | 45.86 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 35.363 | n/a | n/a |
| cpu_pct.max | n/a | 207.34 | n/a | n/a |
| mem_mb.avg | n/a | 2272.704 | n/a | n/a |
| mem_mb.max | n/a | 2325.504 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 504.998 | n/a | n/a |
| cpu_pct.max | n/a | 1151.64 | n/a | n/a |
| mem_mb.avg | n/a | 5037.163 | n/a | n/a |
| mem_mb.max | n/a | 5903.36 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.664 | 12.097 | 6.434 | 113.6 |
| cpu_busy_pct.max | 13.229 | 52.273 | 39.044 | 295.139 |
| load1.avg | 0.149 | 0.49 | 0.342 | 229.269 |
| load1.max | 0.31 | 1.67 | 1.36 | 438.71 |
| mem_used_pct.avg | 16.285 | 26.444 | 10.16 | 62.389 |
| mem_used_pct.max | 16.753 | 31.331 | 14.578 | 87.017 |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.04 | 8.972 | 3.933 | 78.031 |
| cpu_busy_pct.max | 11.245 | 24.296 | 13.051 | 116.06 |
| load1.avg | 0.782 | 1.226 | 0.444 | 56.703 |
| load1.max | 1.01 | 4.11 | 3.1 | 306.931 |
| mem_used_pct.avg | 71.228 | 70.545 | -0.683 | -0.959 |
| mem_used_pct.max | 71.985 | 71.707 | -0.279 | -0.387 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.028 | 8.788 | 3.76 | 74.792 |
| cpu_busy_pct.max | 11.153 | 15.436 | 4.283 | 38.402 |
| load1.avg | 0.576 | 1.571 | 0.995 | 172.791 |
| load1.max | 0.97 | 3.62 | 2.65 | 273.196 |
| mem_used_pct.avg | 71.504 | 71.5 | -0.004 | -0.005 |
| mem_used_pct.max | 71.606 | 71.658 | 0.051 | 0.072 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.544 | 10.426 | 4.882 | 88.058 |
| cpu_busy_pct.max | 9.686 | 19.476 | 9.79 | 101.074 |
| load1.avg | 0.517 | 1.885 | 1.368 | 264.901 |
| load1.max | 0.73 | 4.96 | 4.23 | 579.452 |
| mem_used_pct.avg | 65.485 | 65.424 | -0.062 | -0.094 |
| mem_used_pct.max | 65.576 | 65.577 | 0.002 | 0.003 |

