# Comparison: 20261004T031008Z-load-baseline-surface-og-title vs 20261004T204614Z-load-checkpoint-surface-og-title

**Warning:** Runs differ in rate_plan; they are not directly comparable.

Deltas are B minus A. Error rates are fractions.

## Load totals

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| duration_s | 415.056 | 865.064 | 450.008 | 108.421 |
| requests | 5939 | 77330 | 71391 | 1202.071 |
| rps | 14.309 | 89.392 | 75.083 | 524.731 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 20.396 | 10.811 | -9.586 | -46.996 |
| latency_ms.p95 | 74.82 | 106.77 | 31.95 | 42.703 |
| latency_ms.p99 | 130.139 | 210.762 | 80.622 | 61.951 |
| ttfb_ms.p95 | 65.76 | 104.503 | 38.743 | 58.916 |
| dropped_iterations | 0 | 0 | 0 | n/a |

## Route: og_title

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| rps | 14.309 | 89.392 | 75.083 | 524.731 |
| error_rate | 0 | 0 | 0 | n/a |
| latency_ms.p50 | 20.396 | 10.811 | -9.586 | -46.996 |
| latency_ms.p95 | 74.82 | 106.77 | 31.95 | 42.703 |
| latency_ms.p99 | 130.139 | 210.762 | 80.622 | 61.951 |
| ttfb_ms.p95 | 65.76 | 104.503 | 38.743 | 58.916 |

## Host: abusive

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 35.409 | 20.241 | -15.168 | -42.836 |
| cpu_busy_pct.max | 45.776 | 49.293 | 3.517 | 7.683 |
| load1.avg | 2.632 | 1.583 | -1.049 | -39.874 |
| load1.max | 3.57 | 3.82 | 0.25 | 7.003 |
| mem_used_pct.avg | 34.242 | 34.464 | 0.222 | 0.648 |
| mem_used_pct.max | 34.66 | 35.303 | 0.643 | 1.855 |

## Container: abusive/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 128.1 | 66.86 | -61.24 | -47.807 |
| cpu_pct.max | 171.66 | 212.3 | 40.64 | 23.675 |
| mem_mb.avg | 257.484 | 148.183 | -109.302 | -42.45 |
| mem_mb.max | 263 | 178.7 | -84.3 | -32.053 |

## Container: abusive/gk4owk8-012330965771

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | 88.381 | n/a | n/a | n/a |
| cpu_pct.max | 170.59 | n/a | n/a | n/a |
| mem_mb.avg | 2645.254 | n/a | n/a | n/a |
| mem_mb.max | 2649.088 | n/a | n/a | n/a |

## Container: abusive/gk4owk8-181009560892

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 39.456 | n/a | n/a |
| cpu_pct.max | n/a | 116.09 | n/a | n/a |
| mem_mb.avg | n/a | 2244.453 | n/a | n/a |
| mem_mb.max | n/a | 2328.576 | n/a | n/a |

## Host: gw-cache1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.093 | 3.082 | -1.011 | -24.699 |
| cpu_busy_pct.max | 20.307 | 18.2 | -2.107 | -10.376 |
| load1.avg | 0.302 | 0.24 | -0.061 | -20.356 |
| load1.max | 0.62 | 0.51 | -0.11 | -17.742 |
| mem_used_pct.avg | 35.793 | 34.472 | -1.321 | -3.69 |
| mem_used_pct.max | 36.088 | 35.061 | -1.026 | -2.844 |

## Host: gw-cache2

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 2.855 | 3.286 | 0.431 | 15.096 |
| cpu_busy_pct.max | 17 | 21.836 | 4.836 | 28.447 |
| load1.avg | 0.189 | 0.266 | 0.077 | 41.002 |
| load1.max | 0.44 | 0.6 | 0.16 | 36.364 |
| mem_used_pct.avg | 35.912 | 33.911 | -2.001 | -5.573 |
| mem_used_pct.max | 36.067 | 34.456 | -1.611 | -4.465 |

## Host: gw-cache3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.937 | 3.63 | -1.307 | -26.482 |
| cpu_busy_pct.max | 18.487 | 21.036 | 2.549 | 13.788 |
| load1.avg | 0.407 | 0.287 | -0.12 | -29.418 |
| load1.max | 0.88 | 0.6 | -0.28 | -31.818 |
| mem_used_pct.avg | 35.503 | 34.218 | -1.285 | -3.62 |
| mem_used_pct.max | 35.785 | 34.827 | -0.958 | -2.677 |

## Host: gw-vector1

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 9.039 | 10.725 | 1.685 | 18.646 |
| cpu_busy_pct.max | 23.16 | 24.304 | 1.144 | 4.94 |
| load1.avg | 1.416 | 1.981 | 0.565 | 39.867 |
| load1.max | 2.87 | 3.8 | 0.93 | 32.404 |
| mem_used_pct.avg | 39.774 | 48.685 | 8.91 | 22.403 |
| mem_used_pct.max | 40.298 | 49.018 | 8.72 | 21.639 |

## Container: gw-vector1/coolify-proxy

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 12.738 | n/a | n/a |
| cpu_pct.max | n/a | 60.9 | n/a | n/a |
| mem_mb.avg | n/a | 40.861 | n/a | n/a |
| mem_mb.max | n/a | 66.8 | n/a | n/a |

## Container: gw-vector1/gk4owk8-181159928589

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 46.899 | n/a | n/a |
| cpu_pct.max | n/a | 175.93 | n/a | n/a |
| mem_mb.avg | n/a | 2232.552 | n/a | n/a |
| mem_mb.max | n/a | 2271.232 | n/a | n/a |

## Container: gw-vector1/qdrant-main

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_pct.avg | n/a | 23.493 | n/a | n/a |
| cpu_pct.max | n/a | 124.55 | n/a | n/a |
| mem_mb.avg | n/a | 4038.537 | n/a | n/a |
| mem_mb.max | n/a | 4052.992 | n/a | n/a |

## Host: gw-worker3

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 9.825 | 14.225 | 4.4 | 44.783 |
| cpu_busy_pct.max | 23.23 | 55.726 | 32.496 | 139.888 |
| load1.avg | 0.225 | 0.59 | 0.366 | 162.779 |
| load1.max | 0.53 | 1.82 | 1.29 | 243.396 |
| mem_used_pct.avg | 16.13 | 26.436 | 10.306 | 63.896 |
| mem_used_pct.max | 16.815 | 31.806 | 14.991 | 89.152 |

## Host: pgnode01

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.896 | 6.745 | 1.849 | 37.761 |
| cpu_busy_pct.max | 9.05 | 25.827 | 16.777 | 185.381 |
| load1.avg | 0.714 | 1.2 | 0.485 | 67.894 |
| load1.max | 1.39 | 3.95 | 2.56 | 184.173 |
| mem_used_pct.avg | 70.677 | 70.512 | -0.164 | -0.233 |
| mem_used_pct.max | 70.83 | 71.763 | 0.933 | 1.318 |

## Host: pgnode02

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 4.752 | 7.029 | 2.277 | 47.91 |
| cpu_busy_pct.max | 8.368 | 17.572 | 9.204 | 109.99 |
| load1.avg | 1.11 | 0.752 | -0.358 | -32.265 |
| load1.max | 4.24 | 2.39 | -1.85 | -43.632 |
| mem_used_pct.avg | 72.365 | 71.446 | -0.919 | -1.27 |
| mem_used_pct.max | 72.556 | 71.723 | -0.833 | -1.148 |

## Host: pgnode03

| Metric | A | B | Delta | Delta % |
| --- | --- | --- | --- | --- |
| cpu_busy_pct.avg | 5.022 | 7.619 | 2.597 | 51.723 |
| cpu_busy_pct.max | 11.06 | 19.347 | 8.287 | 74.928 |
| load1.avg | 0.787 | 0.936 | 0.149 | 18.909 |
| load1.max | 1.89 | 2.66 | 0.77 | 40.741 |
| mem_used_pct.avg | 65.462 | 65.5 | 0.038 | 0.057 |
| mem_used_pct.max | 65.676 | 65.707 | 0.031 | 0.047 |

