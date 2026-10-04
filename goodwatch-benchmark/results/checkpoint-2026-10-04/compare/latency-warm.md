# Comparison: 20261004T033339Z-load-baseline-latency-warm-2 vs 20261004T212013Z-load-checkpoint-latency-warm

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 151.863 | 150.171 | -1.692 | -1.114 |
| requests | 299 | 299 | 0 | 0 |
| rps | 1.969 | 1.991 | 0.022 | 1.127 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 156.233 | 5.694 | -150.539 | -96.356 |
| latency_ms.p95 | 763.397 | 26.536 | -736.861 | -96.524 |
| latency_ms.p99 | 962.4 | 48.212 | -914.188 | -94.99 |
| ttfb_ms.p95 | 189.205 | 24.5 | -164.705 | -87.051 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: discover

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.296 | 0.226 | -0.07 | -23.593 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 217.555 | 4.627 | -212.928 | -97.873 |
| latency_ms.p95 | 890.137 | 12.59 | -877.547 | -98.586 |
| latency_ms.p99 | 1122.706 | 17.838 | -1104.868 | -98.411 |
| ttfb_ms.p95 | 202.341 | 11.505 | -190.836 | -94.314 |

## Route: home

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.224 | 0.293 | 0.069 | 30.87 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 62.472 | 4.268 | -58.204 | -93.167 |
| latency_ms.p95 | 137.792 | 12.924 | -124.868 | -90.621 |
| latency_ms.p99 | 185.337 | 17.684 | -167.653 | -90.458 |
| ttfb_ms.p95 | 55.845 | 12.501 | -43.344 | -77.615 |

## Route: og_share_list

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.211 | 0.22 | 0.009 | 4.287 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 32.691 | 12.093 | -20.598 | -63.008 |
| latency_ms.p95 | 128.808 | 34.405 | -94.403 | -73.289 |
| latency_ms.p99 | 170.076 | 51.124 | -118.952 | -69.941 |
| ttfb_ms.p95 | 125.484 | 31.487 | -93.997 | -74.907 |

## Route: og_title

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.263 | 0.226 | -0.037 | -14.042 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 20.895 | 12.216 | -8.679 | -41.537 |
| latency_ms.p95 | 82.062 | 31.465 | -50.597 | -61.657 |
| latency_ms.p99 | 129.26 | 66.7 | -62.56 | -48.398 |
| ttfb_ms.p95 | 66.626 | 28.352 | -38.274 | -57.446 |

## Route: person

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.237 | 0.253 | 0.016 | 6.745 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 141.891 | 5.022 | -136.868 | -96.46 |
| latency_ms.p95 | 352.213 | 34.972 | -317.241 | -90.071 |
| latency_ms.p99 | 903.299 | 44.922 | -858.377 | -95.027 |
| ttfb_ms.p95 | 106.949 | 34.233 | -72.716 | -67.991 |

## Route: share_list

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.165 | 0.286 | 0.122 | 73.938 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 149.357 | 5.422 | -143.935 | -96.37 |
| latency_ms.p95 | 322.235 | 38.357 | -283.878 | -88.097 |
| latency_ms.p99 | 410.269 | 52.708 | -357.561 | -87.153 |
| ttfb_ms.p95 | 164.167 | 37.459 | -126.707 | -77.182 |

## Route: title_movie

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.329 | 0.246 | -0.083 | -25.166 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 291.9 | 5.44 | -286.46 | -98.136 |
| latency_ms.p95 | 831.556 | 19.416 | -812.14 | -97.665 |
| latency_ms.p99 | 978.454 | 21.456 | -956.999 | -97.807 |
| ttfb_ms.p95 | 216.118 | 13.323 | -202.796 | -93.835 |

## Route: title_show

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 0.244 | 0.24 | -0.004 | -1.606 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 414.954 | 5.68 | -409.275 | -98.631 |
| latency_ms.p95 | 875.611 | 11.82 | -863.791 | -98.65 |
| latency_ms.p99 | 950.184 | 16.906 | -933.278 | -98.221 |
| ttfb_ms.p95 | 254.007 | 10.326 | -243.681 | -95.935 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 35.072 | 14.59 | -20.482 | -58.4 |
| cpu_busy_pct.max | 43.723 | 20.025 | -23.698 | -54.2 |
| load1.avg | 3.641 | 1.202 | -2.439 | -66.996 |
| load1.max | 4.38 | 1.64 | -2.74 | -62.557 |
| mem_used_pct.avg | 34.219 | 34.082 | -0.137 | -0.4 |
| mem_used_pct.max | 34.387 | 34.386 | 0 | 0 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 112.934 | 34.231 | -78.703 | -69.689 |
| cpu_pct.max | 144.71 | 45.88 | -98.83 | -68.295 |
| mem_mb.avg | 247.019 | 103.211 | -143.808 | -58.217 |
| mem_mb.max | 249.4 | 113.3 | -136.1 | -54.571 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 116.988 | n/a | n/a | n/a |
| cpu_pct.max | 217.27 | n/a | n/a | n/a |
| mem_mb.avg | 2662.763 | n/a | n/a | n/a |
| mem_mb.max | 2669.568 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 28.671 | n/a | n/a |
| cpu_pct.max | n/a | 117.9 | n/a | n/a |
| mem_mb.avg | n/a | 2200.815 | n/a | n/a |
| mem_mb.max | n/a | 2202.624 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.781 | 2.416 | -2.365 | -49.472 |
| cpu_busy_pct.max | 18.783 | 7.985 | -10.798 | -57.488 |
| load1.avg | 0.511 | 0.256 | -0.255 | -49.967 |
| load1.max | 0.83 | 0.43 | -0.4 | -48.193 |
| mem_used_pct.avg | 35.79 | 34.103 | -1.687 | -4.715 |
| mem_used_pct.max | 36.192 | 34.314 | -1.878 | -5.188 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.671 | 4.184 | 0.513 | 13.978 |
| cpu_busy_pct.max | 8.178 | 18.413 | 10.235 | 125.153 |
| load1.avg | 0.409 | 0.285 | -0.124 | -30.378 |
| load1.max | 0.53 | 0.54 | 0.01 | 1.887 |
| mem_used_pct.avg | 35.603 | 33.588 | -2.015 | -5.659 |
| mem_used_pct.max | 35.814 | 34.081 | -1.733 | -4.84 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 3.149 | 2.354 | -0.796 | -25.265 |
| cpu_busy_pct.max | 8.416 | 6.317 | -2.099 | -24.941 |
| load1.avg | 0.334 | 0.235 | -0.099 | -29.67 |
| load1.max | 0.46 | 0.33 | -0.13 | -28.261 |
| mem_used_pct.avg | 35.451 | 33.837 | -1.614 | -4.553 |
| mem_used_pct.max | 35.66 | 34.066 | -1.594 | -4.469 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 23.426 | 10.566 | -12.861 | -54.899 |
| cpu_busy_pct.max | 32.055 | 18.878 | -13.177 | -41.107 |
| load1.avg | 3.738 | 1.949 | -1.789 | -47.869 |
| load1.max | 4.06 | 2.87 | -1.19 | -29.31 |
| mem_used_pct.avg | 41.465 | 49.025 | 7.561 | 18.234 |
| mem_used_pct.max | 42.599 | 49.377 | 6.778 | 15.911 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 3.503 | n/a | n/a |
| cpu_pct.max | n/a | 7.75 | n/a | n/a |
| mem_mb.avg | n/a | 41.232 | n/a | n/a |
| mem_mb.max | n/a | 42.98 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 39.919 | n/a | n/a |
| cpu_pct.max | n/a | 178.6 | n/a | n/a |
| mem_mb.avg | n/a | 2283.895 | n/a | n/a |
| mem_mb.max | n/a | 2300.928 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 35.133 | n/a | n/a |
| cpu_pct.max | n/a | 130.4 | n/a | n/a |
| mem_mb.avg | n/a | 4059.273 | n/a | n/a |
| mem_mb.max | n/a | 4072.448 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 7.405 | 20.25 | 12.845 | 173.463 |
| cpu_busy_pct.max | 13.904 | 50 | 36.096 | 259.609 |
| load1.avg | 0.325 | 0.798 | 0.473 | 145.641 |
| load1.max | 0.49 | 1.58 | 1.09 | 222.449 |
| mem_used_pct.avg | 15.961 | 22.241 | 6.28 | 39.348 |
| mem_used_pct.max | 16.581 | 24.471 | 7.89 | 47.582 |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.612 | 7.531 | 2.919 | 63.306 |
| cpu_busy_pct.max | 7.88 | 11.309 | 3.429 | 43.515 |
| load1.avg | 0.658 | 0.891 | 0.234 | 35.53 |
| load1.max | 2.16 | 1.4 | -0.76 | -35.185 |
| mem_used_pct.avg | 70.677 | 70.453 | -0.224 | -0.317 |
| mem_used_pct.max | 70.79 | 70.555 | -0.236 | -0.333 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.465 | 6.467 | 1.002 | 18.336 |
| cpu_busy_pct.max | 15.627 | 11.342 | -4.285 | -27.42 |
| load1.avg | 1.05 | 2.054 | 1.003 | 95.525 |
| load1.max | 1.85 | 3.06 | 1.21 | 65.405 |
| mem_used_pct.avg | 72.777 | 71.59 | -1.187 | -1.632 |
| mem_used_pct.max | 73.584 | 71.625 | -1.959 | -2.662 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.695 | 8.695 | 3.001 | 52.687 |
| cpu_busy_pct.max | 9.918 | 14.199 | 4.281 | 43.164 |
| load1.avg | 0.756 | 2.152 | 1.395 | 184.487 |
| load1.max | 1.08 | 3.83 | 2.75 | 254.63 |
| mem_used_pct.avg | 65.409 | 65.481 | 0.072 | 0.11 |
| mem_used_pct.max | 65.499 | 65.61 | 0.11 | 0.169 |

