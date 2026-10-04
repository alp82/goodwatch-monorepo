# Comparison: 20261004T034007Z-load-baseline-latency-cold-longtail-2 vs 20261004T213017Z-load-checkpoint-latency-cold-longtail

**Warning:** Smoke run. Not a baseline.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 120.062 | 120.052 | -0.009 | -0.008 |
| requests | 119 | 119 | 0 | 0 |
| rps | 0.991 | 0.991 | 0 | 0.008 |
| error_rate | 0.008 | 0.008 | 0 | 0 |
| latency_ms.p50 | 659.662 | 211.437 | -448.225 | -67.948 |
| latency_ms.p95 | 2105.522 | 327.169 | -1778.353 | -84.461 |
| latency_ms.p99 | 3536.402 | 414.083 | -3122.32 | -88.291 |
| ttfb_ms.p95 | 644.831 | 325.392 | -319.439 | -49.538 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: discover

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0 | 0 | 0 | n/a |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 0 | 0 | 0 | n/a |
| latency_ms.p95 | 0 | 0 | 0 | n/a |
| latency_ms.p99 | 0 | 0 | 0 | n/a |
| ttfb_ms.p95 | 0 | 0 | 0 | n/a |

## Route: home

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0 | 0 | 0 | n/a |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 0 | 0 | 0 | n/a |
| latency_ms.p95 | 0 | 0 | 0 | n/a |
| latency_ms.p99 | 0 | 0 | 0 | n/a |
| ttfb_ms.p95 | 0 | 0 | 0 | n/a |

## Route: og_title

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0 | 0 | 0 | n/a |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 0 | 0 | 0 | n/a |
| latency_ms.p95 | 0 | 0 | 0 | n/a |
| latency_ms.p99 | 0 | 0 | 0 | n/a |
| ttfb_ms.p95 | 0 | 0 | 0 | n/a |

## Route: other

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.125 | 0.125 | 0 | 0.008 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 265.291 | 211.437 | -53.854 | -20.3 |
| latency_ms.p95 | 1381.281 | 657.452 | -723.828 | -52.403 |
| latency_ms.p99 | 1619.594 | 1104.527 | -515.066 | -31.802 |
| ttfb_ms.p95 | 856.639 | 654.721 | -201.918 | -23.571 |

## Route: title_movie

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.633 | 0.633 | 0 | 0.008 |
| error_rate | 0.013 | 0.013 | 0 | 0 |
| latency_ms.p50 | 589.609 | 198.661 | -390.948 | -66.306 |
| latency_ms.p95 | 1317.212 | 277.852 | -1039.36 | -78.906 |
| latency_ms.p99 | 2401.434 | 309.471 | -2091.963 | -87.113 |
| ttfb_ms.p95 | 640.144 | 276.016 | -364.128 | -56.882 |

## Route: title_show

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.233 | 0.233 | 0 | 0.008 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 967.769 | 241.678 | -726.091 | -75.027 |
| latency_ms.p95 | 2890.473 | 356.925 | -2533.548 | -87.652 |
| latency_ms.p99 | 4077.868 | 390.172 | -3687.696 | -90.432 |
| ttfb_ms.p95 | 643.697 | 355.171 | -288.527 | -44.823 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 37.259 | 14.307 | -22.952 | -61.602 |
| cpu_busy_pct.max | 44.277 | 18.846 | -25.431 | -57.436 |
| load1.avg | 3.451 | 1.668 | -1.783 | -51.678 |
| load1.max | 4.18 | 2.46 | -1.72 | -41.148 |
| mem_used_pct.avg | 34.176 | 34.458 | 0.282 | 0.825 |
| mem_used_pct.max | 34.348 | 34.664 | 0.316 | 0.92 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 115.7 | 34.02 | -81.68 | -70.597 |
| cpu_pct.max | 138.2 | 48.61 | -89.59 | -64.826 |
| mem_mb.avg | 248.496 | 97.085 | -151.411 | -60.931 |
| mem_mb.max | 249.9 | 99.42 | -150.48 | -60.216 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 105.232 | n/a | n/a | n/a |
| cpu_pct.max | 136.41 | n/a | n/a | n/a |
| mem_mb.avg | 2643.395 | n/a | n/a | n/a |
| mem_mb.max | 2649.088 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 24.267 | n/a | n/a |
| cpu_pct.max | n/a | 41.38 | n/a | n/a |
| mem_mb.avg | n/a | 2259.755 | n/a | n/a |
| mem_mb.max | n/a | 2263.04 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 2.91 | 2.517 | -0.393 | -13.517 |
| cpu_busy_pct.max | 8.48 | 5.405 | -3.075 | -36.262 |
| load1.avg | 0.265 | 0.26 | -0.006 | -2.118 |
| load1.max | 0.34 | 0.51 | 0.17 | 50 |
| mem_used_pct.avg | 35.838 | 34 | -1.838 | -5.129 |
| mem_used_pct.max | 36.056 | 34.229 | -1.827 | -5.068 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.25 | 2.179 | -1.071 | -32.951 |
| cpu_busy_pct.max | 7.361 | 6.67 | -0.691 | -9.387 |
| load1.avg | 0.246 | 0.451 | 0.205 | 83.266 |
| load1.max | 0.39 | 0.58 | 0.19 | 48.718 |
| mem_used_pct.avg | 35.612 | 33.383 | -2.229 | -6.258 |
| mem_used_pct.max | 35.804 | 33.654 | -2.151 | -6.006 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.185 | 3.677 | 0.491 | 15.424 |
| cpu_busy_pct.max | 9.641 | 13.747 | 4.106 | 42.589 |
| load1.avg | 0.362 | 0.296 | -0.066 | -18.267 |
| load1.max | 0.48 | 0.53 | 0.05 | 10.417 |
| mem_used_pct.avg | 35.498 | 33.854 | -1.644 | -4.631 |
| mem_used_pct.max | 35.7 | 34.306 | -1.394 | -3.903 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 68.844 | 11.611 | -57.233 | -83.134 |
| cpu_busy_pct.max | 81.589 | 17.994 | -63.595 | -77.946 |
| load1.avg | 11.307 | 2.542 | -8.765 | -77.519 |
| load1.max | 12.83 | 4.4 | -8.43 | -65.705 |
| mem_used_pct.avg | 43.791 | 49.038 | 5.247 | 11.981 |
| mem_used_pct.max | 44.001 | 49.315 | 5.313 | 12.076 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 4.299 | n/a | n/a |
| cpu_pct.max | n/a | 7.24 | n/a | n/a |
| mem_mb.avg | n/a | 40.256 | n/a | n/a |
| mem_mb.max | n/a | 40.84 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 37.046 | n/a | n/a |
| cpu_pct.max | n/a | 61.79 | n/a | n/a |
| mem_mb.avg | n/a | 2261.504 | n/a | n/a |
| mem_mb.max | n/a | 2327.552 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 49.142 | n/a | n/a |
| cpu_pct.max | n/a | 101.49 | n/a | n/a |
| mem_mb.avg | n/a | 4068.011 | n/a | n/a |
| mem_mb.max | n/a | 4080.64 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 9.16 | 4.667 | -4.493 | -49.048 |
| cpu_busy_pct.max | 25.25 | 15.642 | -9.608 | -38.051 |
| load1.avg | 0.308 | 0.263 | -0.045 | -14.595 |
| load1.max | 0.45 | 0.43 | -0.02 | -4.444 |
| mem_used_pct.avg | 17.374 | 20.615 | 3.24 | 18.65 |
| mem_used_pct.max | 18.163 | 21.321 | 3.158 | 17.387 |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.587 | 10.14 | 3.552 | 53.93 |
| cpu_busy_pct.max | 12.089 | 16.348 | 4.259 | 35.23 |
| load1.avg | 0.761 | 2.01 | 1.248 | 163.985 |
| load1.max | 1.14 | 3.05 | 1.91 | 167.544 |
| mem_used_pct.avg | 70.708 | 70.451 | -0.257 | -0.363 |
| mem_used_pct.max | 70.824 | 70.59 | -0.234 | -0.331 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.125 | 10.568 | 4.443 | 72.533 |
| cpu_busy_pct.max | 10.098 | 15.809 | 5.711 | 56.556 |
| load1.avg | 1.088 | 1.329 | 0.241 | 22.129 |
| load1.max | 1.64 | 2.13 | 0.49 | 29.878 |
| mem_used_pct.avg | 72.37 | 71.392 | -0.978 | -1.352 |
| mem_used_pct.max | 72.501 | 71.504 | -0.997 | -1.375 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 6.751 | 12.103 | 5.352 | 79.28 |
| cpu_busy_pct.max | 12.114 | 18.047 | 5.933 | 48.976 |
| load1.avg | 1.253 | 1.769 | 0.515 | 41.124 |
| load1.max | 2.8 | 2.62 | -0.18 | -6.429 |
| mem_used_pct.avg | 65.438 | 65.488 | 0.05 | 0.076 |
| mem_used_pct.max | 65.549 | 65.618 | 0.069 | 0.105 |

